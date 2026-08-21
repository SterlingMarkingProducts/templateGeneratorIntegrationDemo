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
/* Design-only load by fixture id. Three of these designs are no longer
 * user-facing shortcuts, and loading design-only leaves whatever product the
 * test has selected untouched — which is exactly what these checks assert on.
 * The demo shortcut's own product binding is covered by
 * scripts/test-demo-product-binding.mjs. */
const loadSample = async (id) => {
  await page.waitForFunction(
    (sid) => (window.SMPDemoSamples?.all?.() || []).some((s) => s.id === sid),
    id, { timeout: 15000 },
  );
  await page.evaluate((sid) => window.SMPDemoSamples.loadDesignOnly(sid), id);
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
await check('search ranks the verified BCDP-CM first, never shows HLCBBCE', async () => {
  await page.fill('#productSearch', 'business');
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.sp-result')].map((b) => ({
    id: b.dataset.id, part: b.dataset.part,
    spec: b.querySelector('.sp-result-spec').textContent,
    verified: !!b.querySelector('.sp-dot.is-verified'),
    test: !!b.querySelector('.sp-dot.is-test') })));
  ok(rows.length > 1, 'the large catalogue should return many business-card matches');
  ok(rows.length <= 25, 'results must stay capped for a large catalogue');
  eq(rows[0].id, '6505', 'the CMS-verified record must rank first');
  eq(rows[0].part, 'BCDP-CM', 'result part');
  eq(rows[0].spec, '3.5 × 2 in · 2 pages', 'result summary');
  ok(rows[0].verified, 'BCDP-CM must be flagged CMS-verified');
  ok(rows.slice(1).every((r) => r.test), 'every other match must be flagged as test data');
  eq(rows.filter((r) => r.part === 'BCDP-CM').length, 1, 'BCDP-CM must be de-duplicated');
  const body = await page.evaluate(() => document.body.innerText);
  ok(!body.includes('HLCBBCE'), 'HLCBBCE must never appear in the Generator');
  return `${rows.length} matches, ${rows[0].part} first (verified), rest flagged test`;
});

await check('the catalogue is large and searchable by part and description', async () => {
  const size = await page.evaluate(() => window.SMPProductSelection.catalogueSize());
  ok(size > 300, `expected a large catalogue, got ${size}`);
  const exact = await page.evaluate(() => window.SMPProductSelection.search('B1438', { limit: 25 }));
  eq(exact.results[0].partNumber, 'B1438', 'exact part number must rank first');
  ok(!exact.results.some((r) => /^B1438[123]$/.test(r.partNumber)),
     'collapsed colour variations must not be selectable');
  const partial = await page.evaluate(() => window.SMPProductSelection.search('BCDP', { limit: 25 }));
  ok(partial.results.length > 1, 'partial part number should match several');
  ok(partial.results.every((r) => /BCDP/i.test(r.partNumber + r.name)), 'partial matches must contain the query');
  const byName = await page.evaluate(() => window.SMPProductSelection.search('banner', { limit: 25 }));
  ok(byName.total > 10, `description search should find many banners, got ${byName.total}`);
  return `${size} products · exact B1438 first · ${partial.results.length} BCDP* · ${byName.total} banners`;
});

await check('an inferred test product drives the Generator but stays non-authoritative', async () => {
  const r = await page.evaluate(async () => {
    const p = await window.SMPProductSelection.selectByPartNumber('B1438');
    const ctx = window.SMPProductProvider.resolve({
      templateType: 'Business Card', doubleSided: false, product: p });
    return {
      id: p.id, part: p.partNumber,
      inches: [p.dimensions.widthIn, p.dimensions.heightIn],
      px: [p.dimensions.widthPx, p.dimensions.heightPx],
      status: p.provenance.technicalDataStatus,
      authoritative: p.provenance.authoritative,
      mode: p.legacy.designerMode,
      ctxId: ctx.productId, ctxPart: ctx.productNumber, ctxStatus: ctx.technicalDataStatus,
      dims: [document.getElementById('dimWidth').value, document.getElementById('dimHeight').value],
      conf: document.querySelector('#productSelectedCard .sp-conf')?.className || '',
      confText: document.querySelector('#productSelectedCard .sp-conf')?.textContent || '',
    };
  });
  eq(r.part, 'B1438', 'part');
  eq(r.inches, [0.5, 1.5], 'B1438 inferred size');
  eq(r.px, [48, 144], 'canvas px at 96dpi');
  eq(r.status, 'inferred-test', 'technicalDataStatus');
  eq(r.authoritative, false, 'must NOT be authoritative');
  eq(r.mode, 'Grayscale', 'inferred stamps use Grayscale, never SingleColour');
  ok(r.id < 0, 'inferred ids must be synthetic and negative');
  /* Stamps default to LANDSCAPE (orientation milestone), so the form shows the
   * same physical 0.5x1.5 size ordered 1.5 wide x 0.5 tall. The record above is
   * untouched — orientation only reorders, never resizes. */
  eq(r.dims, ['1.5', '0.5'], 'the form is driven by the product, ordered landscape');
  eq(r.ctxPart, 'B1438', 'the real part number reaches the design context');
  eq(r.ctxStatus, 'inferred-test', 'confidence travels with the context');
  ok(/is-test/.test(r.conf), 'the card must show the test-data marker');
  ok(/inferred/i.test(r.confText), `card should say the size is inferred, got "${r.confText}"`);
  return `B1438 · 0.5×1.5in · 48×144px · Grayscale · inferred-test · id ${r.id}`;
});

await check('an inferred product contributes no productList id', async () => {
  await loadSample('sample-business-card');
  const r = await page.evaluate(async () => {
    await window.SMPProductSelection.selectByPartNumber('BCLST-E');   // 3.5x2 inferred card
    try {
      const { template } = await window.SMPPush.convertCurrentDesign();
      return { productList: template.productList,
               productNumber: template.canvasProperties.productNumber };
    } catch (e) { return { error: e.message }; }
  });
  ok(!r.error, 'conversion should succeed: ' + r.error);
  eq(r.productList, [], 'a synthetic negative id must never reach productList');
  eq(r.productNumber, 'BCLST-E', 'the REAL part number must still travel');
  await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
  await page.waitForTimeout(400);
  return 'productList [] · productNumber BCLST-E';
});

/* ---- selecting drives the technical settings --------------------- */
await check('selecting BCDP-CM drives the technical document settings', async () => {
  /* Self-contained: re-open the picker and click the real first result, so this
   * check does not depend on dropdown state left behind by earlier checks. */
  await page.evaluate(() => window.SMPProductSelection.clear());
  await page.fill('#productSearch', '');
  await page.fill('#productSearch', 'BCDP-CM');
  await page.waitForSelector('.sp-result', { timeout: 10000 });
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
  await loadSample('sample-axiom');
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
  await loadSample('sample-sign');            // 12×16in, while BCDP-CM is 3.5×2in
  const r = await page.evaluate(async () => {
    try { await window.SMPPush.convertCurrentDesign(); return { threw: false }; }
    catch (e) { return { threw: true, message: e.message }; }
  });
  ok(r.threw, 'a mismatched package must not be produced');
  /* The 12x16 sample declares itself portrait, so the guard names BCDP-CM's
   * size in that orientation (192×336) — same physical card, same refusal. */
  ok(/1152×1536/.test(r.message) && /(192×336|336×192)/.test(r.message) && /BCDP-CM/.test(r.message),
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
  await loadSample('sample-axiom');
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
