/* Phase 2B — Sterling product selection tests. Pure Node, no browser, no network.
 *
 * Proves the seven things the milestone requires, using the ONLY verified
 * Phase 2B reference product: 6505 / BCDP-CM.
 *
 *   node scripts/test-product-selection.mjs
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;

/* network tripwire — nothing here may reach a socket */
const networkAttempts = [];
globalThis.fetch = async (url) => {
  networkAttempts.push(String(url));
  throw new Error('NETWORK BLOCKED IN TESTS: ' + url);
};

globalThis.window = globalThis;
require(join(ROOT, 'integration/product-contract.js'));
require(join(ROOT, 'integration/product-provider.js'));
require(join(ROOT, 'integration/normalized-design.js'));
require(join(ROOT, 'integration/adapters/sterling-legacy.js'));

const C = globalThis.SMPProductContract;
const P = globalThis.SMPProductProvider;
const N = globalThis.SMPNormalized;
const A = globalThis.SterlingLegacyAdapter;
const { CatalogueProductProvider, DemoProductProvider, ProductSourceError } = P;

const catalogue = JSON.parse(fs.readFileSync(join(ROOT, 'data/sterling-products.json'), 'utf8'));

const results = [];
let failed = 0;
function check(name, fn) {
  try { results.push({ name, pass: true, detail: fn() || '' }); }
  catch (e) { failed++; results.push({ name, pass: false, detail: e.message }); }
}
function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what}: expected ${y}, got ${x}`);
}
function ok(c, m) { if (!c) throw new Error(m); }

const provider = new CatalogueProductProvider({
  records: catalogue.products, source: 'sterling-catalogue-local',
});

let bcdp = null;
await (async () => { bcdp = await provider.getByPartNumber('BCDP-CM'); })();

/* ============ 1. BCDP-CM normalizes correctly ====================== */
check('1. BCDP-CM normalizes to a valid Product record', () => {
  eq(C.validate(bcdp), [], 'contract validation problems');
  eq(bcdp.partNumber, 'BCDP-CM', 'partNumber');
  eq(bcdp.name, 'Vibrant Colour Business Cards - Classic Matte', 'name');
  eq(bcdp.provenance.authoritative, true, 'authoritative');
  eq(bcdp.provenance.source, 'sterling-catalogue-local', 'source');
  return 'validator clean, record authoritative';
});

/* ============ 2. selecting BCDP-CM produces the exact spec ========= */
check('2. selecting BCDP-CM produces the exact Sterling spec', () => {
  eq(bcdp.id, 6505, 'products.id');
  eq(bcdp.dimensions.widthIn, 3.5, 'widthIn');
  eq(bcdp.dimensions.heightIn, 2, 'heightIn');
  eq(bcdp.dimensions.widthPx, 336, 'widthPx');
  eq(bcdp.dimensions.heightPx, 192, 'heightPx');
  eq(bcdp.pages, { min: 2, max: 2 }, 'pages');
  eq(bcdp.bleed, { top: 12, right: 12, bottom: 12, left: 12 }, 'bleed');
  eq(bcdp.legacy.margins, { top: 6, right: 6, bottom: 6, left: 6 }, 'safe margin');
  eq(bcdp.shape, 'rect', 'shape (Rectangle)');
  eq(bcdp.legacy.designerMode, 'FullColour', 'designer mode');
  eq(bcdp.legacy.designerVariationCode, 3, 'designerVariationCode');
  eq(bcdp.legacy.designerModeProven, true, 'code 3 is proven');
  eq(bcdp.orientation, { landscapeAvailable: true, portraitAvailable: true }, 'orientation');
  return '6505 · 3.5×2in · 336×192px · 2 pages · bleed 12 · margin 6 · rect · FullColour';
});

/* ============ 3. two pages → front and back ======================== */
check('3. BCDP-CM drives a front AND a back design', () => {
  ok(bcdp.pages.min === 2 && bcdp.pages.max === 2, 'fixture must be a 2-page product');
  /* This is the exact expression generator/app.js uses for doubleSided. */
  const pageCount = bcdp.pages.min;
  eq(pageCount > 1, true, 'doubleSided derived from product pages');

  const ctx = P.resolve({ templateType: 'Business Card', doubleSided: true, product: bcdp });
  eq(ctx.pageCount, 2, 'productContext.pageCount');

  /* And the adapter really emits two pages. */
  const page = () => ({ index: 0, bleedAuthored: false, elements: [
    N.rect({ x: 0, y: 0, width: 10, height: 10, fill: '#000', rotation: 0, opacity: 1 })] });
  const tpl = A.toSterlingTemplate(N.createDocument({
    trimWidthPx: 336, trimHeightPx: 192, bleedPx: 12, dpi: 96, unit: 'in',
    widthIn: 3.5, heightIn: 2, productContext: ctx,
    pages: [page(), { ...page(), index: 1 }], provenance: {},
  }));
  eq(tpl.pages.length, 2, 'template page count');
  return '2 pages in, 2 pages out';
});

/* ============ 4. generic defaults cannot override the product ====== */
check('4. generic "Business Card" defaults cannot override BCDP-CM', () => {
  const demo = new DemoProductProvider();
  const guess = demo.resolve({ templateType: 'Business Card', doubleSided: true });
  ok(guess.productId === null, 'demo guess must not invent an id');

  /* Hostile payload: every generic signal points the other way. */
  const ctx = P.resolve({
    templateType: 'Sign',          // wrong family
    doubleSided: false,            // wrong page count
    width: 18, height: 24,         // wrong geometry
    product: bcdp,
  });
  eq(ctx.productId, 6505, 'productId — product must win over templateType');
  eq(ctx.productNumber, 'BCDP-CM', 'productNumber');
  eq(ctx.bleedPx, 12, 'bleed — product must win over the Sign guess (0)');
  eq(ctx.pageCount, 2, 'pageCount — product must win over doubleSided:false');
  eq(ctx.designerMode, 'FullColour', 'designerMode');
  eq(ctx.authoritative, true, 'authoritative');
  eq(ctx.product.dimensions.widthIn, 3.5, 'geometry unaffected by the 18×24 payload');

  /* Same for the bleed helper the on-screen overlay uses. */
  eq(P.bleedPxForPayload({ templateType: 'Sign', product: bcdp }), 12, 'bleedPxForPayload');
  eq(P.bleedPxFor('Sign'), 0, 'sanity: a Sign really would otherwise be 0');
  return 'product beats template type on id, bleed, pages, mode and geometry';
});

/* ============ 5. standalone behaviour unchanged ==================== */
check('5. with no product selected the Generator behaves exactly as before', () => {
  const before = new DemoProductProvider().resolve({ templateType: 'Business Card', doubleSided: true });
  const after = P.resolve({ templateType: 'Business Card', doubleSided: true, product: null });
  eq(after, before, 'resolve() with product:null must equal the demo path');
  eq(after.authoritative, false, 'still non-authoritative');
  eq(after.productId, null, 'still no invented id');
  eq(P.bleedPxFor('Business Card'), 12, 'demo bleed unchanged');
  eq(P.bleedPxFor('Stamp'), 0, 'demo bleed unchanged');
  eq(P.bleedPxForPayload({ templateType: 'Business Card' }), 12, 'payload helper falls back');
  eq(new DemoProductProvider().designerModeFor('Nameplate'), 'EngravedPlastic', 'demo mode unchanged');
  /* An unselectable payload shape must not be mistaken for a product. */
  eq(P.resolve({ templateType: 'Business Card', doubleSided: true, product: { id: 1 } }), before,
     'a junk object in payload.product must be ignored, not trusted');
  return 'demo path bit-identical; junk product objects ignored';
});

/* ============ 6. product context reaches the pushed package ======== */
check('6. products.id 6505 and BCDP-CM reach the pushed template', () => {
  const ctx = P.resolve({ templateType: 'Business Card', doubleSided: true, product: bcdp });
  const doc = N.createDocument({
    trimWidthPx: 336, trimHeightPx: 192, bleedPx: ctx.bleedPx, dpi: 96, unit: 'in',
    widthIn: 3.5, heightIn: 2, productContext: ctx,
    pages: [{ index: 0, bleedAuthored: false, elements: [
      N.rect({ x: 0, y: 0, width: 10, height: 10, fill: '#000', rotation: 0, opacity: 1 })] }],
    provenance: {},
  });
  eq(N.validate(doc), [], 'normalized document problems');
  eq(doc.productContext.productId, 6505, 'productContext.productId');
  eq(doc.productContext.productNumber, 'BCDP-CM', 'productContext.productNumber');

  const tpl = A.toSterlingTemplate(doc);
  eq(tpl.productList, [6505], 'sterling template productList');
  eq(tpl.canvasProperties.productNumber, 'BCDP-CM', 'canvasProperties.productNumber');
  eq(tpl.canvasProperties.designerVariationCode, 'FullColour', 'designer mode in the package');
  eq(tpl.canvasProperties.width, 336, 'canvas width');
  eq(tpl.canvasProperties.height, 192, 'canvas height');
  return 'productList [6505], productNumber BCDP-CM, 336×192, FullColour';
});

/* ============ 7. no sellable-variation logic introduced ============ */
check('7. no sellable variation / ink-colour logic exists', () => {
  const blob = JSON.stringify(bcdp);
  ['VARIATIONS', 'variations', 'BCDP-CM-100', 'BCDP-CM-250', 'BCDP-CM-500',
   'LOWESTPRICE', 'lowestPrice', '$28.99', '$39.49', 'COLOURS', 'colours',
   'inkColour', 'PRODUCTOPTIONS'].forEach((n) => {
    ok(!blob.includes(n), `sellable-variation data '${n}' reached the Product record`);
  });
  /* And no such concept was added to the source files this milestone touched. */
  const sources = ['generator/product-select.js', 'integration/product-provider.js']
    .map((f) => fs.readFileSync(join(ROOT, f), 'utf8')).join('\n');
  [/\bvariationSelect/i, /\binkColou?rSelect/i, /\bskuSelect/i, /\bselectedVariation\b/i, /\blotSelect/i]
    .forEach((re) => ok(!re.test(sources), `variation-selector code matching ${re} was introduced`));
  /* The catalogue's product DATA must carry no pricing or variations. The
   * _provenance prose deliberately names what was discarded ("LOWESTPRICE and
   * three sellable VARIATIONS"), so scanning it would be a false positive —
   * scan the data and assert separately that the prose carries no values. */
  catalogue.products.forEach((rec) => {
    const { _provenance, ...data } = rec;
    const cat = JSON.stringify(data);
    ['VARIATIONS', 'variations', 'LOWESTPRICE', 'lowestPrice', 'COLOURS', '$', 'lot', 'price']
      .forEach((n) => ok(!cat.includes(n), `catalogue record carries commercial data '${n}'`));
    ok(!/\$\d|\d+\.\d{2}/.test(JSON.stringify(_provenance || {})),
       'catalogue provenance must not contain price values');
  });
  return 'no variation selectors, no pricing, no SKU handling';
});

/* ============ catalogue integrity =================================== */
check('catalogue serves only real, selectable products', () => {
  eq(catalogue.products.length, 1, 'catalogue size');
  eq(catalogue.products[0].partNumber, 'BCDP-CM', 'the only entry');
  const blob = JSON.stringify(catalogue);
  ok(!blob.includes('HLCBBCE'), 'retired test product HLCBBCE must not appear in the catalogue');
  ok(!/DEMO-|TEST-|SAMPLE-/.test(JSON.stringify(catalogue.products)), 'no fictional part numbers');
  return '1 verified product; HLCBBCE absent';
});

await (async () => {
  try {
    await provider.getByPartNumber('NOPE-123');
    results.push({ name: 'lookup miss raises not-found', pass: false, detail: 'no error thrown' });
    failed++;
  } catch (e) {
    const pass = e.name === 'ProductSourceError' && e.code === 'not-found';
    results.push({ name: 'lookup miss raises not-found', pass, detail: `${e.name}/${e.code}` });
    if (!pass) failed++;
  }
})();

check('no request reached the network', () => {
  eq(networkAttempts, [], 'real fetch attempts');
  return '0 network calls';
});

console.log('\n=========== PHASE 2B PRODUCT SELECTION TESTS ===========\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');
process.exit(failed ? 1 : 0);
