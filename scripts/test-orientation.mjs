/* Orientation — model rules, Generator control, generation context, pipeline.
 *
 * Unit half: integration/orientation.js in Node (family defaults incl. the
 * pull-up-banner exception, swap-only dimension handling, capability rules).
 * Browser half: the REAL Generator — control defaults, blank artboard, demo
 * defaults, a MOCKED model call proving the generation prompt receives the
 * oriented canvas, and the converted/pushed package carrying oriented geometry
 * plus orientation intent. Only products present in the supplied Sterling
 * catalogue are selected (BCDP-CM, 212-C, 212B23, DP1218, B1438).
 *
 *   node scripts/test-orientation.mjs
 */
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const { chromium } = require(join(ROOT, 'node_modules/playwright-core/index.js'));
const O = require(join(ROOT, 'integration/orientation.js'));

const results = [];
let failed = 0;
const record = (name, pass, detail) => { results.push({ name, pass, detail }); if (!pass) failed++; };
function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what}: expected ${y}, got ${x}`);
}
function ok(c, m) { if (!c) throw new Error(m); }
function near(a, b, tol, what) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${what}: ${a} not within ${tol} of ${b}`);
}
async function check(name, fn) {
  try { record(name, true, (await fn()) || ''); }
  catch (e) { record(name, false, e.message); }
}

/* ══════════ UNIT: family defaults ══════════ */
const fam = (family, w, h, name) =>
  O.defaultOrientationFor({ productFamily: family, name: name || '', dimensions: { widthIn: w, heightIn: h } });

await check('family defaults: Business Card / Stamp / Name Badge / Nameplate / Brochure -> landscape', async () => {
  eq(fam('Business Cards', 3.5, 2), 'landscape', 'Business Cards');
  eq(fam('Business Card', 3.5, 2), 'landscape', 'Business Card');
  eq(fam('Stamp', 2.25, 0.8125), 'landscape', 'Stamp');
  eq(fam('Name Badge', 3, 1), 'landscape', 'Name Badge');
  eq(fam('Nameplate', 8, 2), 'landscape', 'Nameplate');
  eq(fam('Brochure', 11, 8.5), 'landscape', 'Brochure');
  return '5 families default landscape';
});

await check('family defaults: Sign -> portrait, Banner -> landscape', async () => {
  eq(fam('Sign', 12, 18), 'portrait', 'Sign');
  eq(fam('Signs', 18, 24), 'portrait', 'Signs');
  eq(fam('Banner', 22, 36, '13oz scrim banner 22" x 36"'), 'landscape', 'Banner');
  return 'Sign portrait; ordinary Banner landscape';
});

await check('pull-up / retractable / roll-up banner -> portrait (exception to Banner)', async () => {
  /* Rule-level: the supplied catalogue contains no pull-up banner product, so
   * the exception is proven on the rule itself — no product is invented. */
  for (const name of ['Pull-Up Banner Stand', 'Pull Up Banner 33x79', 'Retractable Banner',
                      'Roll-Up Banner Display', 'PREMIUM ROLL UP STAND']) {
    eq(O.defaultOrientationFor({ productFamily: 'Banner', name, dimensions: { widthIn: 33, heightIn: 79 } }),
       'portrait', name);
    eq(O.defaultReasonFor({ productFamily: 'Banner', name, dimensions: { widthIn: 33, heightIn: 79 } }),
       'pull-up-banner', name + ' reason');
  }
  eq(fam('Banner', 22, 120, '13oz scrim banner'), 'landscape', 'non-pull-up stays landscape');
  return '5 pull-up phrasings -> portrait; plain banner unaffected';
});

await check('unlisted families preserve the product\'s native orientation', async () => {
  eq(fam('Decal', 4, 6), 'portrait', 'Decal 4x6');
  eq(fam('Decal', 6, 4), 'landscape', 'Decal 6x4');
  eq(fam('Poster', 12, 18), 'portrait', 'Poster 12x18');
  eq(fam('Label', 3, 3), 'landscape', 'square counts as landscape');
  eq(O.defaultReasonFor({ productFamily: 'Decal', dimensions: { widthIn: 4, heightIn: 6 } }),
     'product-native', 'reason');
  return 'no invented default for Decal/Poster/Label — native ordering kept';
});

/* ══════════ UNIT: dimension handling ══════════ */
await check('orientation only ever SWAPS the same physical dimensions', async () => {
  eq(O.orientDimensions({ widthIn: 3.5, heightIn: 2 }, 'landscape'),
     { widthIn: 3.5, heightIn: 2, rotated: false }, 'landscape');
  eq(O.orientDimensions({ widthIn: 3.5, heightIn: 2 }, 'portrait'),
     { widthIn: 2, heightIn: 3.5, rotated: true }, 'portrait');
  /* Round-trip: two swaps give back the original numbers. */
  const once = O.orientDimensions({ widthIn: 12, heightIn: 18 }, 'landscape');
  const back = O.orientDimensions(once, 'portrait');
  eq([back.widthIn, back.heightIn], [12, 18], 'round trip');
  return '3.5x2 <-> 2x3.5, 12x18 <-> 18x12, values only reordered';
});

await check('per-edge values follow their physical edge; amounts unchanged', async () => {
  const edges = { top: 1, right: 2, bottom: 3, left: 4 };
  eq(O.orientEdges(edges, false), { top: 1, right: 2, bottom: 3, left: 4 }, 'unrotated');
  const r = O.orientEdges(edges, true);
  eq(r, { top: 4, right: 1, bottom: 2, left: 3 }, 'rotated mapping');
  eq([...Object.values(r)].sort(), [...Object.values(edges)].sort(), 'same amounts, reassigned only');
  return 'rotation reassigns edges, never changes an amount';
});

await check('orientProduct: 336x192 <-> 192x336, identity and DPI untouched', async () => {
  const p = {
    id: 6505, partNumber: 'BCDP-CM',
    dimensions: { widthIn: 3.5, heightIn: 2, dpi: 96 },
    bleed: { top: 12, right: 12, bottom: 12, left: 12 },
    legacy: { margins: { top: 6, right: 6, bottom: 6, left: 6 } },
    orientation: { landscapeAvailable: true, portraitAvailable: true },
  };
  const land = O.orientProduct(p, 'landscape');
  const port = O.orientProduct(p, 'portrait');
  eq([land.widthPx, land.heightPx], [336, 192], 'landscape px');
  eq([port.widthPx, port.heightPx], [192, 336], 'portrait px');
  eq(port.dpi, 96, 'dpi unchanged');
  eq(port.bleed, { top: 12, right: 12, bottom: 12, left: 12 }, 'uniform bleed unchanged');
  eq([p.id, p.partNumber], [6505, 'BCDP-CM'], 'record identity untouched');
  eq(p.dimensions, { widthIn: 3.5, heightIn: 2, dpi: 96 }, 'record dimensions never mutated');
  return 'oriented VIEW only — the product record is never modified';
});

/* ══════════ UNIT: capability rules ══════════ */
await check('capabilities: restriction locks; source labelled by provenance', async () => {
  const open = O.capabilitiesOf({ orientation: { landscapeAvailable: true, portraitAvailable: true } });
  eq(open.locked, false, 'both available -> free choice');

  const auth = O.capabilitiesOf({
    orientation: { landscapeAvailable: true, portraitAvailable: false },
    provenance: { authoritative: true } });
  eq([auth.locked, auth.lockedTo, auth.restrictionSource],
     [true, 'landscape', 'cms-verified'], 'authoritative restriction');

  const test = O.capabilitiesOf({
    orientation: { landscapeAvailable: false, portraitAvailable: true },
    provenance: { authoritative: false } });
  eq([test.locked, test.lockedTo, test.restrictionSource],
     [true, 'portrait', 'test-data'], 'inferred restriction is honoured but labelled test-data');

  const none = O.capabilitiesOf({ orientation: { landscapeAvailable: false, portraitAvailable: false } });
  eq(none.locked, false, 'both-false is meaningless -> treated as unrestricted');
  return 'lock only from explicit data; provenance decides the label';
});

await check('no restriction is manufactured for the inferred catalogue', async () => {
  const { readFileSync } = await import('node:fs');
  const cat = JSON.parse(readFileSync(join(ROOT, 'data/sterling-test-catalogue.json'), 'utf8'));
  const locked = cat.products.filter((p) =>
    p.orientation && (p.orientation.landscapeAvailable === false || p.orientation.portraitAvailable === false));
  eq(locked.length, 0, 'inferred products carrying a manufactured restriction');
  return `${cat.products.length} inferred products, 0 restrictions invented`;
});

/* ══════════ BROWSER ══════════ */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

/* The repo is served under a routed non-localhost hostname: browser-api.js
 * only routes /generate to the in-page engine in STATIC_MODE (non-localhost),
 * and the generation-context checks below need that real engine path. */
/* https so the page is a secure context — asset extraction requires
 * crypto.subtle. The route below intercepts before any real TLS happens. */
const base = 'https://generator.test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.route(`${base}/**`, async (route) => {
  const u = new URL(route.request().url());
  const f = join(ROOT, decodeURIComponent(u.pathname).replace(/^\//, ''));
  try {
    const b = await readFile(f);
    await route.fulfill({ status: 200, contentType: MIME[extname(f)] || 'application/octet-stream', body: b });
  } catch {
    await route.fulfill({ status: 404, body: 'not found' });
  }
});

/* Mock the model API: capture every prompt, return a fixed portrait design.
 * This is what proves the generation step RECEIVES the oriented canvas and the
 * output is composed for it — no real API key is used or needed. */
const apiRequests = [];
const FAKE_HTML = [
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
  '.card{width:216px;height:360px;background:#123;position:relative;color:#fff;font:700 20px sans-serif}',
  '.card--back{background:#321}',
  '</style></head><body>',
  '<div class="card card--front"><div style="padding-top:150px;text-align:center">PORTRAIT FRONT</div></div>',
  '<div class="card card--back"><div style="padding-top:150px;text-align:center">PORTRAIT BACK</div></div>',
  '</body></html>',
].join('\n');
await page.route('https://api.anthropic.com/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  apiRequests.push(body);
  if (body.stream) {
    const text = '```html\n' + FAKE_HTML + '\n```';
    const sse = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text } },
    ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  } else {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: 'FAKE VISUAL SPEC' }] }) });
  }
});

await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPDemoSamples?.all?.().length > 0
  && window.SMPProductSelection?.catalogueSize() > 0, { timeout: 20000 });
/* A dummy key so the mocked route is reached; it never leaves the browser. */
await page.evaluate(() => localStorage.setItem('anthropic_api_key', 'sk-ant-test-mocked'));

const uiState = () => page.evaluate(() => ({
  orientation: document.querySelector('#orientationToggle .orient-btn.active')?.dataset.orientation || null,
  landscapeEnabled: !document.querySelector('#orientationToggle [data-orientation="landscape"]').disabled,
  portraitEnabled: !document.querySelector('#orientationToggle [data-orientation="portrait"]').disabled,
  noteHidden: document.getElementById('orientationNote').classList.contains('hidden'),
  w: document.getElementById('dimWidth').value,
  h: document.getElementById('dimHeight').value,
  blankRatio: window.SMPBlankArtboard.aspectRatio(),
  blankPages: window.SMPBlankArtboard.pageCount(),
  blankVisible: !document.getElementById('blankState').classList.contains('hidden'),
  product: window.SMPProductSelection.get()?.partNumber || null,
  productId: window.SMPProductSelection.get()?.id ?? null,
}));
const pick = (part) => page.evaluate((p) => window.SMPProductSelection.selectByPartNumber(p), part);
const setOrient = (o) => page.evaluate((v) =>
  document.querySelector(`#orientationToggle [data-orientation="${v}"]`).click(), o);

await check('BCDP-CM defaults to Landscape with a 3.5:2 two-page blank preview', async () => {
  await pick('BCDP-CM');
  await page.waitForTimeout(500);
  const s = await uiState();
  eq(s.orientation, 'landscape', 'default orientation');
  eq([s.w, s.h], ['3.5', '2'], 'oriented dimensions');
  near(s.blankRatio, 1.75, 0.0001, 'blank ratio');
  eq(s.blankPages, 2, 'pages');
  ok(s.blankVisible, 'blank preview visible');
  ok(s.landscapeEnabled && s.portraitEnabled, 'both orientations offered (both available)');
  ok(s.noteHidden, 'no restriction note for an unrestricted product');
  return 'landscape · 3.5×2 · ratio 1.75 · Front+Back';
});

await check('switching BCDP-CM to Portrait -> 2:3.5 immediately, still 2 pages', async () => {
  await setOrient('portrait');
  await page.waitForTimeout(350);
  const s = await uiState();
  eq(s.orientation, 'portrait', 'control state');
  eq([s.w, s.h], ['2', '3.5'], 'dimensions swapped, same physical size');
  near(s.blankRatio, 2 / 3.5, 0.0001, 'blank ratio updated with no generation');
  eq(s.blankPages, 2, 'still two pages');
  ok(s.blankVisible, 'blank preview still live');
  const rec = await page.evaluate(() => window.SMPProductSelection.get().dimensions);
  eq([rec.widthIn, rec.heightIn], [3.5, 2], 'the product RECORD is untouched');
  return '2×3.5 · ratio 0.5714 · product record still 3.5×2';
});

await check('generation context receives the PORTRAIT canvas and oriented pixels', async () => {
  apiRequests.length = 0;
  await page.evaluate(() => document.getElementById('generateBtn').click());
  try {
    await page.waitForSelector('#resultState:not(.hidden)', { timeout: 30000 });
  } catch (e) {
    const errText = await page.evaluate(() =>
      document.getElementById('errorMessage')?.textContent || '(no error toast)');
    throw new Error(`generation did not reach the result state — app said: ${errText}`);
  }
  ok(apiRequests.length >= 2, `expected spec + html calls, saw ${apiRequests.length}`);
  const prompts = apiRequests.map((r) =>
    JSON.stringify(r.messages) + JSON.stringify(r.system || '')).join('\n');
  ok(/PORTRAIT \(vertical\)/.test(prompts), 'prompt must state PORTRAIT orientation');
  ok(prompts.includes('216 x 360 px'), 'prompt must carry the oriented bleed canvas 216x360');
  ok(prompts.includes('192 x 336 px'), 'prompt must carry the oriented trim 192x336');
  return `${apiRequests.length} model calls, all stating portrait 216×360 (trim 192×336)`;
});

await check('the generated output is composed portrait and replaces the blank state', async () => {
  /* The frame is sized by the iframe 'load' listener a beat after the result
   * state shows — wait for real pixel dimensions before measuring. */
  await page.waitForFunction(() => {
    const f = document.getElementById('previewFrame');
    return f && parseFloat(f.style.width) > 0 && parseFloat(f.style.height) > 0;
  }, { timeout: 15000 });
  const s = await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    return {
      result: !document.getElementById('resultState').classList.contains('hidden'),
      blank: !document.getElementById('blankState').classList.contains('hidden'),
      frameW: parseFloat(f.style.width), frameH: parseFloat(f.style.height),
      text: f.contentDocument?.body?.innerText || '',
    };
  });
  ok(s.result && !s.blank, 'result owns the preview');
  ok(s.frameH > s.frameW, `preview canvas must be portrait, got ${s.frameW}x${s.frameH}`);
  ok(/PORTRAIT FRONT/.test(s.text), 'the portrait-composed design is showing');
  return `portrait canvas ${s.frameW}×${s.frameH}`;
});

await check('portrait geometry survives convert / adapter / extraction / import intent', async () => {
  const r = await page.evaluate(async () => {
    const { template } = await window.SMPPush.convertCurrentDesign();
    const extracted = await window.SMPAssetExtract.extractAssets(template);
    const req = await window.SMPTransportImport.buildRequest(
      template, window.SMPProductSelection.get());
    const cp = template.canvasProperties;
    return {
      w: cp.width, h: cp.height, dpi: cp.dpi,
      bleed: [cp.bleedTop, cp.bleedRight, cp.bleedBottom, cp.bleedLeft],
      mode: cp.designerVariationCode,
      productList: template.productList,
      productNumber: cp.productNumber,
      pages: template.pages.length,
      metaOrientation: cp.sourceMeta.orientation,
      intent: req.manifest.source.orientationRequested,
      manifestKeys: Object.keys(req.manifest).sort(),
    };
  });
  eq([r.w, r.h], [192, 336], 'trim geometry is 192×336, not 336×192');
  eq(r.dpi, 96, 'DPI unchanged');
  eq(r.bleed, [12, 12, 12, 12], 'bleed amounts unchanged by orientation');
  eq(r.mode, 'FullColour', 'production settings unchanged');
  eq(r.productList, [6505], 'products.id unchanged');
  eq(r.productNumber, 'BCDP-CM', 'part number unchanged');
  eq(r.pages, 2, 'two pages in portrait too');
  eq(r.metaOrientation, 'portrait', 'orientation recorded in sourceMeta');
  eq(r.intent, 'portrait', 'import manifest carries orientationRequested intent');
  eq(r.manifestKeys, ['assets', 'contractVersion', 'pages', 'productId', 'source'],
     'no new trusted technical fields added to the manifest');
  return '192×336 · bleed 12/edge · [6505] BCDP-CM · intent portrait · no trusted dims sent';
});

await check('all five BCDP-CM demos initialize Landscape', async () => {
  const out = [];
  for (const id of ['sample-axiom', 'sample-standout', 'sample-averywillow',
                    'sample-studionorth', 'sample-solco']) {
    await page.evaluate(() => window.SMPProductSelection.clear());
    await setOrient('portrait').catch(() => {});
    await page.evaluate((sid) => window.SMPDemoSamples.load(sid), id);
    await page.waitForTimeout(2600);
    const s = await uiState();
    eq([s.product, s.orientation], ['BCDP-CM', 'landscape'], id);
    out.push(id.replace('sample-', ''));
  }
  return out.join(', ') + ' -> BCDP-CM landscape';
});

await check('a real catalogue Sign (212-C) defaults Portrait; Landscape swaps it live', async () => {
  await pick('212-C');                       // Aluminum Parking Sign 12x18, family Sign
  await page.waitForTimeout(500);
  let s = await uiState();
  eq(s.orientation, 'portrait', 'Sign family default');
  eq([s.w, s.h], ['12', '18'], '12 wide × 18 tall');
  near(s.blankRatio, 12 / 18, 0.001, 'portrait blank');
  ok(s.landscapeEnabled, 'landscape offered (no restriction in the data)');
  await setOrient('landscape');
  await page.waitForTimeout(350);
  s = await uiState();
  eq([s.w, s.h], ['18', '12'], 'swapped to 18 wide × 12 tall');
  near(s.blankRatio, 18 / 12, 0.001, 'blank updated immediately');
  return '212-C · portrait 12×18 -> landscape 18×12, blank follows instantly';
});

await check('a real catalogue Banner (212B23) defaults Landscape', async () => {
  await pick('212B23');                      // 13oz scrim banner 22x36, family Banner
  await page.waitForTimeout(500);
  const s = await uiState();
  eq(s.product, '212B23', 'product');
  eq(s.orientation, 'landscape', 'Banner family default');
  eq([s.w, s.h], ['36', '22'], 'physical 22×36 ordered landscape');
  near(s.blankRatio, 36 / 22, 0.001, 'blank ratio');
  const rec = await page.evaluate(() => window.SMPProductSelection.get().dimensions);
  eq([rec.widthIn, rec.heightIn], [22, 36], 'record untouched');
  return '212B23 · landscape 36×22 · record still 22×36';
});

await check('unrelated form edits never reset a manual orientation choice', async () => {
  await pick('BCDP-CM');
  await page.waitForTimeout(400);
  await setOrient('portrait');               // manual choice
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); };
    set('industry', 'Hospitality');
    set('businessName', 'Orientation Test Co');
    set('styleDirection', 'Minimal');
    set('specialInstructions', 'none');
  });
  await page.waitForTimeout(300);
  const s = await uiState();
  eq(s.orientation, 'portrait', 'manual choice preserved');
  eq([s.w, s.h], ['2', '3.5'], 'oriented dims preserved');
  return 'industry/name/style/instructions edited — still portrait';
});

await check('changing product establishes the NEW product\'s default', async () => {
  /* still portrait BCDP-CM from the previous check */
  await pick('212-C');
  await page.waitForTimeout(400);
  let s = await uiState();
  eq(s.orientation, 'portrait', 'Sign default (its own, not inherited)');
  await pick('DP1218');                      // Poster family: unlisted -> native 12x18 portrait
  await page.waitForTimeout(400);
  s = await uiState();
  eq(s.orientation, 'portrait', 'unlisted family keeps native orientation');
  eq([s.w, s.h], ['12', '18'], 'native ordering preserved');
  await pick('BCDP-CM');
  await page.waitForTimeout(400);
  s = await uiState();
  eq(s.orientation, 'landscape', 'back to the business-card default');
  eq([s.w, s.h], ['3.5', '2'], 'landscape dims');
  return '212-C portrait -> DP1218 native portrait -> BCDP-CM landscape';
});

await check('clearing the product leaves no stale orientation state', async () => {
  await setOrient('portrait');
  await page.evaluate(() => window.SMPProductSelection.clear());
  await page.waitForTimeout(400);
  const s = await uiState();
  eq(s.product, null, 'product cleared');
  eq(s.orientation, 'landscape', 'template-type default re-established (Business Card)');
  ok(s.landscapeEnabled && s.portraitEnabled, 'no leftover lock');
  ok(s.noteHidden, 'no leftover restriction note');
  const editable = await page.evaluate(() => !document.getElementById('dimWidth').readOnly);
  ok(editable, 'dimensions editable again');
  return 'standalone landscape, control free, no note, dims editable';
});

await check('an inferred product still allows switching (no manufactured lock)', async () => {
  await pick('B1438');
  await page.waitForTimeout(400);
  let s = await uiState();
  ok(s.landscapeEnabled && s.portraitEnabled, 'inferred product must not lock the control');
  ok(s.noteHidden, 'no restriction note fabricated');
  await setOrient('portrait');
  await page.waitForTimeout(300);
  s = await uiState();
  eq(s.orientation, 'portrait', 'user may switch');
  await page.evaluate(() => window.SMPProductSelection.clear());
  return 'B1438 free to switch; nothing presented as a Sterling restriction';
});

await check('no page errors', async () => {
  eq(pageErrors, [], 'page errors');
  return '0 errors';
});

console.log('\n====== ORIENTATION TESTS ======\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');

await browser.close();
process.exit(failed ? 1 : 0);
