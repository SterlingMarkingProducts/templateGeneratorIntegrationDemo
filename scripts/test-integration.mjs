/* Integration-boundary test for the Design Template Generator.
 *
 * The Generator is the product; this proves the new normalized-model boundary
 * did not change a single thing the Sterling side sees, and that a REAL
 * generated design still reaches the existing realdesigner prototype editable.
 *
 * Every design used here comes from the Generator's own sample-generation
 * path (demo-samples.js -> data/test-templates.json), which loads genuine
 * generated HTML into exactly the state a real AI generation produces. No
 * hand-authored Fabric fixtures are used anywhere.
 *
 *   npm i --no-save playwright-core
 *   node scripts/test-integration.mjs --capture    # golden master (run on baseline)
 *   node scripts/test-integration.mjs              # compare + end-to-end
 */
import http from 'node:http';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const GOLDEN_DIR = join(ROOT, 'scripts', '__golden__');
const CAPTURE = process.argv.includes('--capture');
/* --only=<substring> restricts the design set; useful for a fast re-check after
 * touching the harness itself. The full set is the real gate. */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

/* Designs to exercise. Chosen to cover the test matrix: double-sided cards
 * with rich styling, a plain single-sided card, and a large single-page sign. */
const SAMPLES = [
  'Axiom (Neo-Brutalism)',
  'Atelier Noir (Art Deco)',
  'Business card 3.5" x 2"',
  'Sign 12" x 16"',
];

/* Sample name -> the id used by the Generator's fixture loader. Three of these
 * designs are no longer user-facing demo shortcuts; they remain regression
 * fixtures and are loaded by id. Golden-master filenames stay name-derived, so
 * the existing goldens are unaffected. */
const SAMPLE_IDS = {
  'Axiom (Neo-Brutalism)':    'sample-axiom',
  'Atelier Noir (Art Deco)':  'sample-artdeco',
  'Business card 3.5" x 2"':  'sample-business-card',
  'Sign 12" x 16"':           'sample-sign',
};

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg',
};

const srv = await new Promise((r) => {
  const s = http.createServer(async (req, res) => {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
    try {
      const b = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(b);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });

const sterlingHits = [];
ctx.on('request', (r) => {
  try { if (/(^|\.)sterling\.ca$/i.test(new URL(r.url()).hostname)) sterlingHits.push(r.url()); } catch {}
});

/* ------------------------------------------------------------------ *
 * Volatile fields — excluded from semantic comparison.
 *
 * These legitimately differ run to run and carry no design information.
 * EVERYTHING else must match: object counts, types, coordinates, sizes,
 * scales, rotation, colours, fonts, text, pages, bleed, canvasProperties.
 * ------------------------------------------------------------------ */
const VOLATILE = new Set([
  'templateKey',      // 'TG-' + Date.now().toString(36)
  'sourceHtml',       // provenance blob, only present after Generate JSON
  'orientation',      // documented additive field (canvasProperties.sourceMeta);
                      // goldens predate it. Covered by scripts/test-orientation.mjs.
]);

/* Embedded raster payloads are ~99% of a captured design (one Art-Deco card is
 * 2.69 MB of data: URI out of 2.71 MB). Comparing them byte-for-byte is both
 * pathologically slow and the wrong test: the background is re-rendered through
 * canvas.toDataURL() on every run, so its bytes are not a design property. They
 * are reduced to a digest — mime type, exact byte length, and both ends of the
 * payload — which still detects a changed or truncated image but costs nothing.
 * The refactor does not touch rasterisation, so this stays a real check. */
function digestLongString(str) {
  const mime = (/^data:([^;,]+)/.exec(str) || [, 'text'])[1];
  return `«${mime} len=${str.length} ${str.slice(0, 24)}…${str.slice(-24)}»`;
}

/** Deep-sort keys and drop volatile fields so comparison is order-insensitive. */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (VOLATILE.has(k)) continue;
      out[k] = canonical(v[k]);
    }
    return out;
  }
  if (typeof v === 'string' && v.length > 512) return digestLongString(v);
  /* Float noise from independent rounding paths is not a design difference. */
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 1000) / 1000;
  return v;
}

/** Structural diff of two canonical values; returns array of path strings. */
function diff(a, b, path = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb) { out.push(`${path}: type ${ta} -> ${tb}`); return out; }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} -> ${b.length}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (ta === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { out.push(`${path}.${k}: added (${JSON.stringify(b[k]).slice(0, 60)})`); continue; }
      if (!(k in b)) { out.push(`${path}.${k}: REMOVED`); continue; }
      diff(a[k], b[k], `${path}.${k}`, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
}

/** Load a sample in the real Generator UI and convert it via the real path. */
async function generateAndConvert(page, sampleName) {
  await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.SMPPush?.convertCurrentDesign, { timeout: 15000 });
  /* Load through the Generator's OWN sample path — the same state a real
   * generation reaches — but WITHOUT the demo's product binding, so the golden
   * masters keep comparing design conversion alone. Per-demo product binding
   * is covered by scripts/test-demo-product-binding.mjs. */
  const id = SAMPLE_IDS[sampleName];
  if (!id) throw new Error(`no fixture id for sample: ${sampleName}`);
  await page.waitForFunction(
    (sid) => (window.SMPDemoSamples?.all?.() || []).some((s) => s.id === sid),
    id, { timeout: 15000 },
  );
  await page.evaluate((sid) => window.SMPDemoSamples.loadDesignOnly(sid), id);
  /* `generatedHtml` is a script-scoped `let` in app.js, so it is NOT a window
   * property. The Generator's own readiness signal is the result panel. */
  await page.waitForSelector('#resultState:not(.hidden)', { timeout: 15000 });
  await page.waitForTimeout(900); // let preview/fonts settle as a user would
  return await page.evaluate(async () => {
    const { template } = await window.SMPPush.convertCurrentDesign();
    return template;
  });
}

const results = [];
let anyFail = false;
const ok = (checks, name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) anyFail = true;
};

fs.mkdirSync(GOLDEN_DIR, { recursive: true });

const SELECTED = ONLY ? SAMPLES.filter((n) => n.toLowerCase().includes(ONLY.toLowerCase())) : SAMPLES;
if (ONLY) console.log(`(--only=${ONLY}: ${SELECTED.length}/${SAMPLES.length} designs)`);

for (const sampleName of SELECTED) {
  const slug = sampleName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
  const goldenPath = join(GOLDEN_DIR, `${slug}.json`);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  process.stdout.write(`\n[${sampleName}] generating…`);
  const template = await generateAndConvert(page, sampleName);
  process.stdout.write(' converted.');

  if (CAPTURE) {
    fs.writeFileSync(goldenPath, JSON.stringify(canonical(template), null, 2));
    const objs = template.pages.reduce((n, p) => n + p.canvasData.objects.length, 0);
    console.log(`captured  ${sampleName.padEnd(28)} pages=${template.pages.length} objects=${objs} -> ${slug}.json`);
    await page.close();
    continue;
  }

  const checks = [];
  /* ---- 1. semantic equivalence against the golden master ---- */
  if (!fs.existsSync(goldenPath)) {
    ok(checks, 'golden master present', false, `missing ${slug}.json — run --capture on the baseline first`);
  } else {
    /* The golden was captured before the raster digest existed, so re-canonicalise
     * it on load. canonical() is idempotent for everything else. */
    const golden = canonical(JSON.parse(fs.readFileSync(goldenPath, 'utf8')));
    const now = canonical(template);
    const d = diff(golden, now, '');
    ok(checks, 'v1.2 payload semantically identical to baseline', d.length === 0,
      d.length ? `${d.length} difference(s): ` + d.slice(0, 6).join(' | ') : 'exact');
  }

  /* ---- 2. design-content assertions on the real generated design ---- */
  const objs = template.pages.flatMap((p) => p.canvasData.objects);
  const types = [...new Set(objs.map((o) => o.type))];
  const cp = template.canvasProperties;
  ok(checks, 'has pages', template.pages.length >= 1, `${template.pages.length}`);
  ok(checks, 'has objects', objs.length > 0, `${objs.length} objects, types: ${types.join(',')}`);
  ok(checks, 'v1.2 envelope', template.version === 1.2, String(template.version));
  ok(checks, 'trim dimensions carried', cp.trimWidthPx > 0 && cp.trimHeightPx > 0,
    `${cp.trimWidthPx}x${cp.trimHeightPx}`);
  ok(checks, 'text objects present', objs.some((o) => o.type === 'i-text'),
    `${objs.filter((o) => o.type === 'i-text').length} i-text`);
  ok(checks, 'no page errors in generator', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  /* ---- 3. end-to-end: real Push to Designer -> realdesigner ---- */
  const transferId = await page.evaluate(async () => {
    const { template } = await window.SMPPush.convertCurrentDesign();
    return await window.SMPPush.storeTransferLocallyWithFallback(template);
  });
  process.stdout.write(' pushing…');
  const dpage = await ctx.newPage();
  const dErrors = [];
  dpage.on('pageerror', (e) => dErrors.push(e.message));
  await dpage.goto(`${base}/realdesigner/index.html?transfer=${transferId}`, { waitUntil: 'domcontentloaded' });
  await dpage.waitForFunction(
    () => window.canvases && window.canvases.length > 0
       && window.canvases.some((c) => c.getObjects && c.getObjects().length > 0),
    { timeout: 30000 },
  ).catch(() => {});
  await dpage.waitForTimeout(1500);

  const designer = await dpage.evaluate(() => {
    const cvs = window.canvases || [];
    const first = cvs[0];
    let selectable = 0, activated = false, activeText = null;
    cvs.forEach((c) => c.getObjects().forEach((o) => { if (o.selectable !== false) selectable++; }));
    if (first) {
      const t = first.getObjects().find((o) => o.isType && o.isType('i-text'));
      if (t) { first.setActiveObject(t); activated = first.getActiveObject() === t; activeText = t.text; }
    }
    return {
      pages: cvs.length,
      counts: cvs.map((c) => c.getObjects().length),
      types: cvs.map((c) => [...new Set(c.getObjects().map((o) => o.type))]),
      canvas: window.canvasProperties
        ? { w: window.canvasProperties.width, h: window.canvasProperties.height,
            bleed: window.canvasProperties.bleedLeft }
        : null,
      selectable, activated, activeText,
    };
  });

  ok(checks, 'realdesigner page count matches', designer.pages === template.pages.length,
    `${designer.pages} vs ${template.pages.length}`);
  ok(checks, 'realdesigner loaded objects', (designer.counts[0] || 0) > 0, JSON.stringify(designer.counts));
  ok(checks, 'realdesigner canvas size matches', !!designer.canvas
    && designer.canvas.w === cp.width && designer.canvas.h === cp.height,
    designer.canvas ? `${designer.canvas.w}x${designer.canvas.h} vs ${cp.width}x${cp.height}` : 'none');
  ok(checks, 'realdesigner bleed matches', !!designer.canvas && designer.canvas.bleed === cp.bleedLeft,
    designer.canvas ? `${designer.canvas.bleed} vs ${cp.bleedLeft}` : 'none');
  ok(checks, 'objects editable after transfer', designer.activated,
    `active text: ${JSON.stringify(designer.activeText)}`);
  ok(checks, 'no page errors in realdesigner', dErrors.length === 0, dErrors.slice(0, 2).join(' | '));

  process.stdout.write(' designer loaded.');
  await dpage.screenshot({ path: join(GOLDEN_DIR, `..`, `_shot-${slug}.png`) }).catch(() => {});
  await dpage.close();
  await page.close();

  results.push({ sampleName, checks, template, designer });
}

if (CAPTURE) {
  console.log('\nGolden masters written. Re-run without --capture after refactoring.');
  await browser.close(); srv.close(); process.exit(0);
}

/* ---- 4. regression: Generate JSON / HTML / UI / recommendations ---- */
process.stdout.write('\n[regression] running…\n');
const rpage = await ctx.newPage();
const rErrors = [];
rpage.on('pageerror', (e) => rErrors.push(e.message));
const regression = [];
await generateAndConvert(rpage, 'Axiom (Neo-Brutalism)');

/* The Generate JSON toolbar button was retired; the converter it fronted is
 * still exercised through convertCurrentDesign below and by Push to Designer. */
const jsonGone = await rpage.evaluate(() => !document.getElementById('jsonBtn'));
ok(regression, 'the retired Generate JSON button is gone from the toolbar', jsonGone);

const uiOk = await rpage.evaluate(() => {
  const ids = ['templateType', 'dimWidth', 'dimHeight', 'unitToggle', 'industry', 'businessName',
    'styleDirection', 'referenceFile', 'generateBtn', 'regenBtn', 'downloadHtmlBtn',
    'pushToDesignerBtn', 'previewFrame', 'thumbFront', 'thumbBack'];
  const missing = ids.filter((i) => !document.getElementById(i));
  return { missing, htmlBtnEnabled: !document.getElementById('downloadHtmlBtn')?.disabled };
});
ok(regression, 'all Generator UI controls present', uiOk.missing.length === 0, `missing: ${uiOk.missing.join(',')}`);
ok(regression, 'HTML download available', uiOk.htmlBtnEnabled, String(uiOk.htmlBtnEnabled));
ok(regression, 'no generator page errors', rErrors.length === 0, rErrors.slice(0, 2).join(' | '));
await rpage.close();

/* recommendations prototype still classifies a pushed design */
const cpage = await ctx.newPage();
const cErrors = [];
cpage.on('pageerror', (e) => cErrors.push(e.message));
const gpage = await ctx.newPage();
await generateAndConvert(gpage, 'Axiom (Neo-Brutalism)');
const recId = await gpage.evaluate(async () => {
  const { template } = await window.SMPPush.convertCurrentDesign();
  return await window.SMPPush.storeTransferLocallyWithFallback(template);
});
await gpage.close();
await cpage.goto(`${base}/designer/index.html?transfer=${recId}`, { waitUntil: 'domcontentloaded' });
await cpage.waitForTimeout(3500);
const rec = await cpage.evaluate(() => ({
  bodyText: document.body.innerText.slice(0, 400),
  cards: document.querySelectorAll('[class*="product"], [class*="rec"]').length,
}));
ok(regression, 'recommendations prototype renders', rec.cards > 0 || /business card/i.test(rec.bodyText),
  `cards=${rec.cards}`);
ok(regression, 'no recommendations page errors', cErrors.length === 0, cErrors.slice(0, 2).join(' | '));
await cpage.close();

/* ---------------------------- report ---------------------------- */
console.log('\n============ GENERATOR INTEGRATION TEST ============\n');
for (const r of results) {
  const failed = r.checks.filter((c) => !c.pass);
  console.log(`${failed.length ? 'FAIL' : 'PASS'}  ${r.sampleName}`);
  console.log(`      pages=${r.template.pages.length} objects=${r.designer.counts ? JSON.stringify(r.designer.counts) : '?'}`
    + ` canvas=${r.template.canvasProperties.width}x${r.template.canvasProperties.height}`
    + ` bleed=${r.template.canvasProperties.bleedLeft}`
    + ` types=${r.designer.types ? JSON.stringify(r.designer.types[0]) : '?'}`);
  for (const c of r.checks) if (!c.pass) console.log(`      x ${c.name}: ${c.detail}`);
}
console.log('\n--- regression ---');
for (const c of regression) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : ' — ' + c.detail}`);

console.log('\n--- network ---');
console.log(sterlingHits.length === 0
  ? 'PASS  no request reached any sterling.ca host'
  : `NOTE  ${sterlingHits.length} request(s) to sterling.ca (pre-existing fonts.css): ${[...new Set(sterlingHits)].slice(0, 2).join(', ')}`);

const passed = results.filter((r) => r.checks.every((c) => c.pass)).length;
console.log(`\n${passed}/${results.length} designs fully passed${ONLY ? ' (filtered run)' : ''}`);
console.log(anyFail ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');

await browser.close();
srv.close();
process.exit(anyFail ? 1 : 0);
