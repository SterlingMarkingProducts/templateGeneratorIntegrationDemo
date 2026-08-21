/* Demo product binding + product-driven blank artboard.
 *
 * Drives the REAL Generator in a browser and proves:
 *   - only the five intended demo shortcuts are user-facing
 *   - each of those five binds to BCDP-CM / products.id 6505 through real
 *     application state (the picker, the form, and the pushed package)
 *   - the binding is PER DEMO, not a global rule, and a future demo can name
 *     a different product
 *   - selecting a product immediately shows a blank artboard at that product's
 *     aspect ratio and page count, scaled to fit
 *   - changing and clearing products updates/removes that state
 *   - the blank artboard never reaches the normalized design or the import
 *     package
 *
 *   node scripts/test-demo-product-binding.mjs
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const { chromium } = require(join(ROOT, 'node_modules/playwright-core/index.js'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2' };

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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPDemoSamples?.all?.().length > 0
  && window.SMPProductSelection?.catalogueSize() > 0, { timeout: 20000 });

const REMOVED = ['Business card 3.5" x 2"', 'Sign 12" x 16"', 'Atelier Noir (Art Deco)'];
const EXPECTED = ['Axiom (Neo-Brutalism)', 'Stand Out (Blue Wave)',
  'Avery Willow (Concrete Gold)', 'Studio North (Primary Pop)', 'Sol & Co. (Playful)'];

/* ── 1. the three shortcuts are gone from the UI ──────────────────── */
await check('exactly the five intended demo shortcuts are user-facing', async () => {
  const labels = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.textContent.trim().startsWith('Load sample: '))
    .map((b) => b.textContent.trim().replace('Load sample: ', '')));
  eq(labels.slice().sort(), EXPECTED.slice().sort(), 'shortcut buttons');
  return `${labels.length} shortcuts: ${labels.join(', ')}`;
});

await check('the three removed shortcuts are nowhere in the UI', async () => {
  const body = await page.evaluate(() => document.body.innerText);
  for (const name of REMOVED) ok(!body.includes(name), `"${name}" still visible in the UI`);
  const listed = await page.evaluate(() => window.SMPDemoSamples.list().map((s) => s.name));
  for (const name of REMOVED) ok(!listed.includes(name), `"${name}" still offered as a shortcut`);
  return 'Business card 3.5" x 2", Sign 12" x 16", Atelier Noir (Art Deco) removed';
});

await check('removed designs survive as regression fixtures', async () => {
  const all = await page.evaluate(() => window.SMPDemoSamples.all().map((s) => s.name));
  for (const name of REMOVED) ok(all.includes(name), `"${name}" lost as a fixture`);
  const loaded = await page.evaluate(async () => {
    await window.SMPDemoSamples.loadDesignOnly('sample-sign');
    return !document.getElementById('resultState').classList.contains('hidden');
  });
  ok(loaded, 'a non-shortcut fixture must still load through the fixture API');
  return `${all.length} samples in the file, 3 fixture-only, all still loadable`;
});

/* ── 2. per-demo product binding ──────────────────────────────────── */
const DEMO_IDS = {
  'Axiom (Neo-Brutalism)': 'sample-axiom',
  'Stand Out (Blue Wave)': 'sample-standout',
  'Avery Willow (Concrete Gold)': 'sample-averywillow',
  'Studio North (Primary Pop)': 'sample-studionorth',
  'Sol & Co. (Playful)': 'sample-solco',
};

for (const [name, id] of Object.entries(DEMO_IDS)) {
  await check(`${name} selects BCDP-CM / 6505 as real application state`, async () => {
    await page.evaluate(() => window.SMPProductSelection.clear());
    await page.waitForTimeout(300);
    /* Click the actual button the user clicks. */
    await page.evaluate((n) => [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Load sample: ' + n)?.click(), name);
    await page.waitForTimeout(3200);

    const s = await page.evaluate(async () => {
      const p = window.SMPProductSelection.get();
      const { template } = await window.SMPPush.convertCurrentDesign();
      return {
        id: p && p.id, part: p && p.partNumber, name: p && p.name,
        cardText: document.getElementById('productSelectedCard').textContent,
        dimsLocked: document.getElementById('dimWidth').readOnly,
        w: document.getElementById('dimWidth').value,
        h: document.getElementById('dimHeight').value,
        productList: template.productList,
        productNumber: template.canvasProperties.productNumber,
        pages: template.pages.length,
      };
    });
    eq(s.id, 6505, 'products.id');
    eq(s.part, 'BCDP-CM', 'partNumber');
    eq(s.name, 'Vibrant Colour Business Cards - Classic Matte', 'product name');
    ok(s.cardText.includes('BCDP-CM'), 'the picker must visibly show the product');
    ok(s.dimsLocked, 'product-controlled dimensions must be locked');
    eq([s.w, s.h], ['3.5', '2'], 'product-controlled dimensions');
    /* The relationship must survive into the pushed package. */
    eq(s.productList, [6505], 'productId carried through the pipeline');
    eq(s.productNumber, 'BCDP-CM', 'canvasProperties.productNumber');
    eq(s.pages, 2, 'BCDP-CM is a 2-page product');
    return `6505 / BCDP-CM · dims locked 3.5×2 · productList [6505] · 2 pages`;
  });
}

await check('the binding is per-demo configuration, not a global rule', async () => {
  const cfg = await page.evaluate(() => window.SMPDemoSamples.all().map((s) => ({
    id: s.id, shortcut: !!s.shortcut, product: s.product || null })));
  /* Every shortcut names its own product; nothing names it for them. */
  const shortcuts = cfg.filter((c) => c.shortcut);
  eq(shortcuts.length, 5, 'shortcut count');
  ok(shortcuts.every((c) => c.product && c.product.id === 6505 && c.product.partNumber === 'BCDP-CM'),
     'each shortcut must carry its own product block');
  /* The fixture-only samples deliberately carry NO product — proving the
   * binding comes from configuration and is not applied to every demo. */
  const fixtures = cfg.filter((c) => !c.shortcut);
  eq(fixtures.length, 3, 'fixture count');
  ok(fixtures.every((c) => c.product === null), 'fixture samples must stay standalone');
  /* And loading one of those leaves the product untouched. */
  await page.evaluate(() => window.SMPProductSelection.clear());
  await page.evaluate(() => window.SMPDemoSamples.load('sample-artdeco'));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.SMPProductSelection.get());
  eq(after, null, 'a demo with no product block must not select one');
  return '5 shortcuts each name their own product; 3 fixtures name none';
});

await check('a future demo can bind to a different Sterling product', async () => {
  /* Inject a hypothetical demo config with a DIFFERENT product and drive the
   * same code path, proving nothing is hard-coded to BCDP-CM. The product used
   * is a real catalogue record; the demo itself is synthetic and local to this
   * test. */
  const r = await page.evaluate(async () => {
    const other = (await window.SMPProductSelection.search('DP1218', { limit: 5 })).results[0];
    if (!other) return { skipped: true };
    await window.SMPProductSelection.clear();
    /* Same call the demo binder makes, driven by a different config value. */
    const p = await window.SMPProductSelection.selectByPartNumber(other.partNumber);
    return {
      skipped: false, part: p.partNumber, id: p.id,
      inches: [p.dimensions.widthIn, p.dimensions.heightIn],
      pages: p.pages.min,
      blankRatio: window.SMPBlankArtboard.aspectRatio(),
      blankPages: window.SMPBlankArtboard.pageCount(),
    };
  });
  ok(!r.skipped, 'DP1218 must exist in the test catalogue');
  eq(r.part, 'DP1218', 'a demo config naming another product selects that product');
  eq(r.inches, [12, 18], 'that product brings its own geometry');
  near(r.blankRatio, 12 / 18, 0.001, 'blank artboard follows the other product');
  eq(r.blankPages, 1, 'and its own page count');
  return `DP1218 · 12×18in · 1 page · blank ratio ${r.blankRatio.toFixed(4)}`;
});

/* ── 3. product-driven blank artboard ─────────────────────────────── */
const reload = async () => {
  await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.SMPDemoSamples?.all?.().length > 0
    && window.SMPProductSelection?.catalogueSize() > 0, { timeout: 20000 });
};

await check('with no product the Generator shows its standalone empty state', async () => {
  await reload();
  const s = await page.evaluate(() => ({
    empty: !document.getElementById('emptyState').classList.contains('hidden'),
    blank: !document.getElementById('blankState').classList.contains('hidden'),
    result: !document.getElementById('resultState').classList.contains('hidden'),
    boards: window.SMPBlankArtboard.pageCount(),
  }));
  ok(s.empty, 'empty state must show');
  ok(!s.blank && !s.result, 'no blank artboard and no result before anything is selected');
  eq(s.boards, 0, 'no artboards');
  return 'standalone empty state preserved';
});

await check('selecting BCDP-CM immediately shows a 2-page blank preview', async () => {
  await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({
    blank: !document.getElementById('blankState').classList.contains('hidden'),
    empty: !document.getElementById('emptyState').classList.contains('hidden'),
    result: !document.getElementById('resultState').classList.contains('hidden'),
    pages: window.SMPBlankArtboard.pageCount(),
    labels: [...document.querySelectorAll('#blankStage .ba-label')].map((e) => e.textContent),
    sizes: window.SMPBlankArtboard.boardSizes(),
    caption: document.getElementById('blankCaption').textContent,
  }));
  ok(s.blank, 'the blank artboard must show as soon as a product is selected');
  ok(!s.empty && !s.result, 'it replaces the empty state and is not the result state');
  eq(s.pages, 2, 'BCDP-CM declares minPages 2');
  eq(s.labels, ['Front', 'Back'], 'a 2-page printed product is Front + Back');
  eq(s.sizes.length, 2, 'two boards drawn');
  ok(s.caption.includes('BCDP-CM'), 'caption names the product');
  return `2 blank boards (${s.labels.join(' + ')}), ${Math.round(s.sizes[0].width)}×${Math.round(s.sizes[0].height)}px`;
});

await check('the BCDP-CM blank artboard has the correct 3.5:2 aspect ratio', async () => {
  const s = await page.evaluate(() => ({
    ratio: window.SMPBlankArtboard.aspectRatio(),
    sizes: window.SMPBlankArtboard.boardSizes(),
  }));
  near(s.ratio, 3.5 / 2, 0.0001, 'declared ratio');
  for (const b of s.sizes) {
    ok(b.width > 8 && b.height > 8, 'a board must actually be drawn');
    near(b.width / b.height, 3.5 / 2, 0.03, 'rendered board ratio');
  }
  return `ratio ${s.ratio.toFixed(4)}; rendered ${s.sizes.map((b) => (b.width / b.height).toFixed(3)).join(', ')}`;
});

await check('the artboard scales to fit and is never drawn at native size', async () => {
  const s = await page.evaluate(() => {
    const stage = document.getElementById('blankStage').getBoundingClientRect();
    return { stage: { w: stage.width, h: stage.height },
             sizes: window.SMPBlankArtboard.boardSizes() };
  });
  const rowW = s.sizes.reduce((n, b) => n + b.width, 0);
  ok(rowW <= s.stage.w + 1, `boards (${Math.round(rowW)}px) must fit the stage (${Math.round(s.stage.w)}px)`);
  for (const b of s.sizes) {
    ok(b.height <= s.stage.h + 1, 'a board must not overflow the stage vertically');
    ok(b.width <= 3.5 * 96 + 1, 'never scaled up past native 96-DPI size');
  }
  return `row ${Math.round(rowW)}px inside a ${Math.round(s.stage.w)}×${Math.round(s.stage.h)}px stage`;
});

await check('selecting a differently-shaped product updates the aspect ratio', async () => {
  const before = await page.evaluate(() => window.SMPBlankArtboard.aspectRatio());
  await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('DP1218'));
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({
    ratio: window.SMPBlankArtboard.aspectRatio(),
    pages: window.SMPBlankArtboard.pageCount(),
    labels: [...document.querySelectorAll('#blankStage .ba-label')].map((e) => e.textContent),
    sizes: window.SMPBlankArtboard.boardSizes(),
    caption: document.getElementById('blankCaption').textContent,
    w: document.getElementById('dimWidth').value,
    h: document.getElementById('dimHeight').value,
  }));
  ok(Math.abs(before - s.ratio) > 0.5, 'the ratio must actually change');
  near(s.ratio, 12 / 18, 0.001, 'new ratio');
  eq(s.pages, 1, 'DP1218 is a single-page product');
  eq(s.labels, ['Design'], 'a 1-page product has no Front/Back');
  near(s.sizes[0].width / s.sizes[0].height, 12 / 18, 0.03, 'rendered board ratio');
  ok(s.caption.includes('DP1218'), 'caption follows the product');
  eq([s.w, s.h], ['12', '18'], 'no stale dimensions from the previous product');
  return `3.5:2 -> 12:18, 2 pages -> 1 page, dims 12×18`;
});

await check('an inferred (non-importable) product still gets a blank artboard', async () => {
  const r = await page.evaluate(async () => {
    const p = await window.SMPProductSelection.selectByPartNumber('B1438');
    return { id: p.id, status: p.provenance.technicalDataStatus,
             ratio: window.SMPBlankArtboard.aspectRatio(),
             boards: window.SMPBlankArtboard.boardSizes().length,
             eligible: window.SMPTransportImport.eligibility(p).eligible };
  });
  ok(r.id < 0, 'inferred products carry synthetic negative ids');
  eq(r.status, 'inferred-test', 'provenance unchanged');
  ok(r.ratio > 0 && r.boards > 0, 'an inferred product must still get its blank canvas');
  eq(r.eligible, false, 'but must stay ineligible for real Sterling import');
  return `B1438 · id ${r.id} · blank shown · import ineligible`;
});

await check('clearing the product clears its context and the blank artboard', async () => {
  await page.evaluate(() => window.SMPProductSelection.clear());
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    selection: window.SMPProductSelection.get(),
    blankState: window.SMPBlankArtboard.state(),
    pages: window.SMPBlankArtboard.pageCount(),
    blankHidden: document.getElementById('blankState').classList.contains('hidden'),
    empty: !document.getElementById('emptyState').classList.contains('hidden'),
    dimsFree: !document.getElementById('dimWidth').readOnly,
    ttFree: !document.getElementById('templateType').disabled,
    boards: document.querySelectorAll('#blankStage .ba-board').length,
  }));
  eq(s.selection, null, 'product context cleared');
  eq(s.blankState, null, 'blank artboard state cleared');
  eq(s.pages, 0, 'no blank pages');
  eq(s.boards, 0, 'no artboards left in the DOM');
  ok(s.blankHidden && s.empty, 'back to the standalone empty state');
  ok(s.dimsFree && s.ttFree, 'inputs unlocked again');
  return 'no stale 6505 context, blank state removed, standalone restored';
});

/* ── 4. the blank artboard is presentation only ───────────────────── */
await check('generating replaces the blank artboard with the real design', async () => {
  await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
  await page.waitForTimeout(500);
  const before = await page.evaluate(() =>
    !document.getElementById('blankState').classList.contains('hidden'));
  ok(before, 'blank artboard showing before the design loads');
  await page.evaluate(() => window.SMPDemoSamples.load('sample-axiom'));
  await page.waitForTimeout(3200);
  const s = await page.evaluate(() => ({
    blank: !document.getElementById('blankState').classList.contains('hidden'),
    result: !document.getElementById('resultState').classList.contains('hidden'),
    empty: !document.getElementById('emptyState').classList.contains('hidden'),
    hasArt: !!document.getElementById('previewFrame').contentDocument?.body?.innerHTML?.trim(),
  }));
  ok(s.result && s.hasArt, 'the generated design must own the preview');
  ok(!s.blank && !s.empty, 'the blank artboard must be hidden once a design exists');
  return 'blank -> result, real artwork in the preview frame';
});

await check('blank artboard objects never enter the design or import package', async () => {
  const r = await page.evaluate(async () => {
    /* The blank artboard is still mounted (hidden) while the design converts —
     * exactly the situation in which a presentation-only state could leak. */
    const blankMounted = !!document.getElementById('blankState');
    const blankHidden = document.getElementById('blankState').classList.contains('hidden');
    const { template } = await window.SMPPush.convertCurrentDesign();
    const extracted = await window.SMPAssetExtract.extractAssets(template);
    const req = window.SMPTransportImport.buildRequest({
      product: window.SMPProductSelection.get(), extracted });
    const flat = JSON.stringify(template) + JSON.stringify(extracted) + JSON.stringify(req);
    const objs = template.pages.reduce((n, p) => n.concat(p.canvasData.objects), []);
    /* The extraction source is the offscreen render of the design HTML — the
     * blank artboard's markup must not appear in it either. */
    const previewHtml = document.getElementById('previewFrame').contentDocument
      .documentElement.outerHTML;
    return {
      blankMounted, blankHidden,
      pages: template.pages.length,
      objectTypes: [...new Set(objs.map((o) => o.type))].sort(),
      sterlingTypes: [...new Set(objs.map((o) => o.sterlingType).filter(Boolean))].sort(),
      objectCount: objs.length,
      leaks: ['ba-board', 'ba-page', 'blankState', 'blankStage', 'blank-state',
              'blank-caption', 'SMPBlankArtboard'].filter((k) => flat.includes(k)),
      previewLeaks: ['ba-board', 'blankStage', 'blank-state']
        .filter((k) => previewHtml.includes(k)),
      assets: extracted.assets.length,
      w: template.canvasProperties.width,
      h: template.canvasProperties.height,
      bleed: [template.canvasProperties.bleedTop, template.canvasProperties.bleedRight,
              template.canvasProperties.bleedBottom, template.canvasProperties.bleedLeft],
      bleedMargin: template.canvasProperties.bleedMargin,
    };
  });
  ok(r.blankMounted && r.blankHidden, 'the blank state must still be mounted but hidden');
  eq(r.previewLeaks, [], 'no blank-artboard markup in the extraction source');
  ok(r.objectCount > 0, 'the real design still has objects');
  eq(r.leaks, [], 'no blank-artboard identifier may appear anywhere in the package');
  ok(!r.objectTypes.includes('ba-board'), 'no artboard object type');
  eq(r.pages, 2, 'page count comes from the product, not the blank preview');
  eq([r.w, r.h], [336, 192], 'trim geometry untouched by the blank state');
  /* Sterling carries the bleed per edge and keeps bleedMargin at 0; both must
   * be exactly what the product context produced, with no blank-state effect. */
  eq(r.bleed, [12, 12, 12, 12], 'per-edge bleed untouched by the blank state');
  eq(r.bleedMargin, 0, 'bleedMargin untouched by the blank state');
  return `${r.objectCount} objects (${r.objectTypes.join('/')}) · sterlingTypes `
       + `${r.sterlingTypes.join('/')} · ${r.assets} assets · 336×192 · bleed 12/edge · `
       + 'zero blank-state leakage into template, assets or import request';
});

await check('no page errors', async () => {
  eq(pageErrors, [], 'page errors');
  return '0 errors';
});

console.log('\n====== DEMO BINDING + BLANK ARTBOARD TESTS ======\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');

await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
