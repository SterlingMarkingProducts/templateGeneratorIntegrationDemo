/* Phase 2B — browser-level product selection tests.
 *
 * Drives the REAL Generator: picks BCDP-CM through the actual search input and
 * result button, then checks what the form and the pushed package look like.
 * The Node-level contract tests live in scripts/test-product-selection.mjs.
 *
 *   node scripts/test-product-selection-ui.mjs
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const { chromium } = require(join(ROOT, 'node_modules/playwright-core/index.js'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const srv = await new Promise((r) => {
  const s = http.createServer(async (q, res) => {
    const f = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''));
    try {
      const b = await readFile(f);
      res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
      res.end(b);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const base = `http://127.0.0.1:${srv.address().port}`;

const results = [];
let failed = 0;
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  if (!pass) failed++;
};
function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what}: expected ${y}, got ${x}`);
}
function ok(c, m) { if (!c) throw new Error(m); }
async function check(name, fn) {
  try { record(name, true, (await fn()) || ''); }
  catch (e) { record(name, false, e.message); }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const load = async () => {
  await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
};
const loadSample = async (prefix) => {
  await page.evaluate((p) => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith('Load sample: ' + p))?.click(), prefix);
  await page.waitForTimeout(3000);
};
const convert = () => page.evaluate(async () => {
  const { template } = await window.SMPPush.convertCurrentDesign();
  const cp = template.canvasProperties;
  return { productList: template.productList, pages: template.pages.length,
    productNumber: cp.productNumber, mode: cp.designerVariationCode,
    w: cp.width, h: cp.height, version: template.version };
});

await load();

/* ---- the control exists and starts empty ------------------------- */
await check('Sterling Product control renders and starts unselected', async () => {
  const s = await page.evaluate(() => ({
    hasInput: !!document.getElementById('productSearch'),
    hasGroup: !!document.getElementById('sterlingProductGroup'),
    enabled: !document.getElementById('productSearch').disabled,
    cardHidden: document.getElementById('productSelectedCard').classList.contains('hidden'),
    selection: window.SMPProductSelection.get(),
    provider: window.SMPProductSelection.providerId(),
    dimsFree: !document.getElementById('dimWidth').readOnly,
    ttFree: !document.getElementById('templateType').disabled,
  }));
  ok(s.hasInput && s.hasGroup, 'control missing');
  ok(s.enabled, 'search input must enable once the catalogue loads');
  ok(s.cardHidden, 'no product card before selection');
  eq(s.selection, null, 'initial selection');
  eq(s.provider, 'catalogue-provider', 'provider id');
  ok(s.dimsFree && s.ttFree, 'controls must be free with no product selected');
  return 'catalogue-provider backing an empty selection';
});

/* ---- search finds only verified products ------------------------- */
await check('search returns BCDP-CM and never the retired HLCBBCE', async () => {
  await page.fill('#productSearch', 'business');
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.sp-result')].map((b) => ({
    id: b.dataset.id, part: b.querySelector('.sp-result-part').textContent,
    spec: b.querySelector('.sp-result-spec').textContent })));
  eq(rows.length, 1, 'result count');
  eq(rows[0].id, '6505', 'result id');
  eq(rows[0].part, 'BCDP-CM', 'result part');
  eq(rows[0].spec, '3.5 × 2 in · 2 pages', 'result summary');
  const body = await page.evaluate(() => document.body.innerText);
  ok(!body.includes('HLCBBCE'), 'HLCBBCE must never appear in the Generator');
  return rows[0].part + ' · ' + rows[0].spec;
});

/* ---- selecting drives the technical settings --------------------- */
await check('selecting BCDP-CM drives the technical document settings', async () => {
  await page.click('.sp-result');
  await page.waitForTimeout(900);
  const s = await page.evaluate(() => {
    const p = window.SMPProductSelection.get();
    const card = document.getElementById('productSelectedCard');
    return {
      part: card.querySelector('.sp-part').textContent,
      name: card.querySelector('.sp-name').textContent,
      spec: card.querySelector('.sp-spec').textContent,
      id: p.id, px: [p.dimensions.widthPx, p.dimensions.heightPx],
      inches: [p.dimensions.widthIn, p.dimensions.heightIn],
      pages: [p.pages.min, p.pages.max], bleed: p.bleed,
      margins: p.legacy.margins, shape: p.shape, mode: p.legacy.designerMode,
      orientation: p.orientation, authoritative: p.provenance.authoritative,
      dims: [document.getElementById('dimWidth').value, document.getElementById('dimHeight').value],
      unit: document.querySelector('.unit-btn.active').dataset.unit,
      locked: document.getElementById('dimWidth').readOnly
        && document.getElementById('dimHeight').readOnly
        && document.getElementById('templateType').disabled,
      badges: document.querySelectorAll('.product-locked-badge').length,
      templateType: document.getElementById('templateType').value,
    };
  });
  eq(s.id, 6505, 'products.id');
  eq(s.part, 'BCDP-CM', 'card part number');
  eq(s.name, 'Vibrant Colour Business Cards - Classic Matte', 'card name');
  eq(s.spec, '3.5 × 2 in · 2 pages', 'card summary');
  eq(s.inches, [3.5, 2], 'inches');
  eq(s.px, [336, 192], 'canvas px');
  eq(s.pages, [2, 2], 'pages');
  eq(s.bleed, { top: 12, right: 12, bottom: 12, left: 12 }, 'bleed');
  eq(s.margins, { top: 6, right: 6, bottom: 6, left: 6 }, 'safe margin');
  eq(s.shape, 'rect', 'shape');
  eq(s.mode, 'FullColour', 'designer mode');
  eq(s.orientation, { landscapeAvailable: true, portraitAvailable: true }, 'orientation');
  eq(s.authoritative, true, 'authoritative');
  eq(s.dims, ['3.5', '2'], 'form dimensions populated from the product');
  eq(s.unit, 'in', 'unit');
  eq(s.templateType, 'Business Card', 'creative template type');
  ok(s.locked, 'product-driven inputs must be locked');
  eq(s.badges, 2, 'both product-driven groups must be badged');
  return '6505 · 336×192 · 2 pages · bleed 12 · margin 6 · rect · FullColour, inputs locked';
});

/* ---- the pushed package carries the product ---------------------- */
await check('the pushed package identifies products.id 6505 / BCDP-CM', async () => {
  await loadSample('Axiom');
  const t = await convert();
  eq(t.productList, [6505], 'productList');
  eq(t.productNumber, 'BCDP-CM', 'canvasProperties.productNumber');
  eq(t.pages, 2, 'two pages, from minPages/maxPages 2');
  eq([t.w, t.h], [336, 192], 'canvas geometry');
  eq(t.mode, 'FullColour', 'designer mode');
  eq(t.version, 1.2, 'envelope version unchanged');
  return 'productList [6505], BCDP-CM, 2 pages, 336×192';
});

/* ---- mismatched geometry is refused, never silently shipped ------ */
await check('a product/canvas size disagreement is refused loudly', async () => {
  await loadSample('Sign');            // 12×16in, while BCDP-CM is 3.5×2in
  const r = await page.evaluate(async () => {
    try { await window.SMPPush.convertCurrentDesign(); return { threw: false }; }
    catch (e) { return { threw: true, message: e.message }; }
  });
  ok(r.threw, 'a mismatched package must not be produced');
  ok(/1152×1536/.test(r.message) && /336×192/.test(r.message) && /BCDP-CM/.test(r.message),
     'the error must name both sizes and the product: ' + r.message);
  return 'refused: ' + r.message.slice(0, 72) + '…';
});

/* ---- clearing restores standalone behaviour ---------------------- */
await check('clearing the product restores standalone behaviour', async () => {
  await page.evaluate(() => window.SMPProductSelection.clear());
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    selection: window.SMPProductSelection.get(),
    cardHidden: document.getElementById('productSelectedCard').classList.contains('hidden'),
    dimsFree: !document.getElementById('dimWidth').readOnly,
    ttFree: !document.getElementById('templateType').disabled,
    badges: document.querySelectorAll('.product-locked-badge').length,
  }));
  eq(s.selection, null, 'selection cleared');
  ok(s.cardHidden, 'card hidden');
  ok(s.dimsFree && s.ttFree, 'inputs unlocked');
  eq(s.badges, 0, 'badges removed');

  /* and the package goes back to carrying no product identity */
  await loadSample('Axiom');
  const t = await convert();
  eq(t.productList, [], 'productList empty with no product selected');
  eq(t.productNumber, '', 'productNumber empty with no product selected');
  eq(t.pages, 2, 'sample still double-sided via the template-type fallback');
  return 'standalone package unchanged: productList [], productNumber ""';
});

await check('no page errors', async () => {
  eq(pageErrors, [], 'page errors');
  return '0 errors';
});

console.log('\n=========== PHASE 2B UI TESTS ===========\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');

await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
