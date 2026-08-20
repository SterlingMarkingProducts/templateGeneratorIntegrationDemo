/* Phase 2B — broad product-matrix test. Pure Node, no browser, no network.
 *
 * Drives the WHOLE catalogue (CMS-verified + spreadsheet-inferred) through the
 * product -> normalized document -> Sterling package pipeline, then checks a
 * representative matrix of extremes in detail. The point is to catch geometry
 * that only breaks at the edges: quarter-inch stamps, 12-foot banners, very
 * tall, very wide, square, round.
 *
 *   node scripts/test-product-matrix.mjs
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;

const networkAttempts = [];
globalThis.fetch = async (u) => { networkAttempts.push(String(u)); throw new Error('NETWORK BLOCKED: ' + u); };
globalThis.window = globalThis;
require(join(ROOT, 'integration/product-contract.js'));
require(join(ROOT, 'integration/product-provider.js'));
require(join(ROOT, 'integration/normalized-design.js'));
require(join(ROOT, 'integration/adapters/sterling-legacy.js'));

const C = globalThis.SMPProductContract;
const P = globalThis.SMPProductProvider;
const N = globalThis.SMPNormalized;
const A = globalThis.SterlingLegacyAdapter;

const verified = JSON.parse(fs.readFileSync(join(ROOT, 'data/sterling-products.json'), 'utf8'));
const test = JSON.parse(fs.readFileSync(join(ROOT, 'data/sterling-test-catalogue.json'), 'utf8'));
const provider = new P.CatalogueProductProvider({
  records: [...verified.products, ...test.products],
  source: 'sterling-catalogue-local',
});

const results = [];
let failed = 0;
function check(name, fn) {
  try { results.push({ name, pass: true, detail: fn() || '' }); }
  catch (e) { failed++; results.push({ name, pass: false, detail: e.message }); }
}
function eq(a, b, w) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`${w}: expected ${y}, got ${x}`); }
function ok(c, m) { if (!c) throw new Error(m); }

/** Every product must survive the full pipeline. Returns the built package. */
function pipeline(product) {
  const ctx = P.resolve({
    templateType: product.productFamily || '',
    doubleSided: product.pages.min > 1,
    product,
  });
  const w = product.dimensions.widthPx, h = product.dimensions.heightPx;

  /* One element per page, inset inside the trim, so "objects stay inside the
   * document" is a real assertion rather than a trivially true one. */
  const inset = Math.max(1, Math.min(4, Math.floor(Math.min(w, h) / 8)));
  const page = (i) => ({
    index: i, bleedAuthored: false,
    elements: [
      N.rect({ x: inset, y: inset, width: Math.max(1, w - inset * 2),
               height: Math.max(1, h - inset * 2), fill: '#111', rotation: 0, opacity: 1 }),
      N.text({ x: inset, y: inset, width: Math.max(1, w - inset * 2), height: Math.max(1, Math.min(12, h / 2)),
               text: product.partNumber, fontFamily: 'Arial', fontSize: Math.max(4, Math.min(12, h / 4)),
               fill: '#fff', align: 'left', rotation: 0, opacity: 1 }),
    ],
  });
  const doc = N.createDocument({
    trimWidthPx: w, trimHeightPx: h, bleedPx: ctx.bleedPx, dpi: product.dimensions.dpi,
    unit: 'in', widthIn: product.dimensions.widthIn, heightIn: product.dimensions.heightIn,
    productContext: ctx,
    pages: Array.from({ length: product.pages.min }, (_, i) => page(i)),
    provenance: {},
  });
  const problems = N.validate(doc);
  if (problems.length) throw new Error(`${product.partNumber}: normalized doc invalid — ${problems.join('; ')}`);
  return { ctx, doc, template: A.toSterlingTemplate(doc) };
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function assertGeometry(product, built) {
  const tag = product.partNumber;
  const d = product.dimensions;
  ok(finite(d.widthPx) && finite(d.heightPx), `${tag}: canvas px not finite`);
  ok(d.widthPx > 0 && d.heightPx > 0, `${tag}: canvas px must be positive (${d.widthPx}x${d.heightPx})`);
  ok(Number.isInteger(d.widthPx) && Number.isInteger(d.heightPx), `${tag}: canvas px must be integers`);
  /* the 96dpi convention must actually hold */
  eq(d.widthPx, Math.round(d.widthIn * d.dpi), `${tag}: widthPx != widthIn*dpi`);
  eq(d.heightPx, Math.round(d.heightIn * d.dpi), `${tag}: heightPx != heightIn*dpi`);

  const cp = built.template.canvasProperties;
  ok(finite(cp.width) && finite(cp.height) && cp.width > 0 && cp.height > 0,
     `${tag}: package canvas invalid (${cp.width}x${cp.height})`);
  eq(built.template.pages.length, product.pages.min, `${tag}: page count`);

  built.template.pages.forEach((pg, i) => {
    ok(Array.isArray(pg.canvasData.objects) && pg.canvasData.objects.length > 0,
       `${tag}: page ${i} has no objects`);
    pg.canvasData.objects.forEach((o, j) => {
      ['left', 'top', 'width', 'height', 'scaleX', 'scaleY'].forEach((k) => {
        if (o[k] === undefined) return;
        ok(finite(o[k]), `${tag}: page ${i} object ${j} .${k} is ${o[k]}`);
      });
      ok(!(o.width < 0) && !(o.height < 0), `${tag}: page ${i} object ${j} has negative size`);
      const right = o.left + (o.width || 0) * (o.scaleX === undefined ? 1 : o.scaleX);
      const bottom = o.top + (o.height || 0) * (o.scaleY === undefined ? 1 : o.scaleY);
      /* canvasProperties.width/height are the TRIM box. Objects live in the
       * BLEED canvas (trim + 2*bleed), and a bleed element is cover-scaled, so
       * it legitimately overshoots on one axis. The bound below therefore
       * allows the bleed canvas plus a 10% cover-scale allowance — loose enough
       * for correct geometry, tight enough to catch a real blow-up (a runaway
       * scale puts objects at many times the canvas). */
      const bleedW = cp.width + 2 * built.ctx.bleedPx;
      const bleedH = cp.height + 2 * built.ctx.bleedPx;
      const slackW = bleedW * 0.1 + 2, slackH = bleedH * 0.1 + 2;
      ok(o.left >= -(built.ctx.bleedPx + slackW) && o.top >= -(built.ctx.bleedPx + slackH),
         `${tag}: page ${i} object ${j} starts outside the document (${o.left},${o.top})`);
      ok(right <= bleedW + slackW && bottom <= bleedH + slackH,
         `${tag}: page ${i} object ${j} extends past the document `
         + `(${right.toFixed(1)},${bottom.toFixed(1)} vs bleed canvas ${bleedW}x${bleedH})`);
    });
  });
}

/* ==================== sweep the WHOLE catalogue ==================== */
let all = [];
await (async () => {
  const r = await provider.search('', { limit: 100000 });
  all = await Promise.all(r.results.map((s) => provider.getById(s.id)));
})();

check('every catalogue product survives the full pipeline', () => {
  ok(all.length > 200, `expected a large catalogue, got ${all.length}`);
  const failures = [];
  for (const p of all) {
    try { assertGeometry(p, pipeline(p)); }
    catch (e) { failures.push(e.message); }
  }
  eq(failures.slice(0, 5), [], `${failures.length} product(s) failed`);
  return `${all.length} products: valid canvas, no NaN/negative geometry, objects inside the document`;
});

check('confidence flags are correct and exclusive', () => {
  const ver = all.filter((p) => p.provenance.technicalDataStatus === 'cms-verified');
  const inf = all.filter((p) => p.provenance.technicalDataStatus === 'inferred-test');
  eq(ver.length + inf.length, all.length, 'every record must carry a confidence');
  ok(ver.every((p) => p.provenance.authoritative === true), 'verified records must be authoritative');
  ok(inf.every((p) => p.provenance.authoritative === false), 'inferred records must NOT be authoritative');
  eq(ver.map((p) => p.partNumber), ['BCDP-CM'], 'the CMS-verified set');
  ok(inf.length > 200, `expected a large inferred set, got ${inf.length}`);
  return `${ver.length} cms-verified (BCDP-CM), ${inf.length} inferred-test`;
});

check('a synthetic id never reaches the Sterling package', () => {
  const inferred = all.find((p) => p.provenance.technicalDataStatus === 'inferred-test');
  ok(inferred.id < 0, 'inferred ids must be negative and obviously synthetic');
  const built = pipeline(inferred);
  eq(built.template.productList, [], 'inferred product must contribute no productList entry');
  eq(built.template.canvasProperties.productNumber, inferred.partNumber,
     'the REAL part number must still travel');

  const bcdp = all.find((p) => p.partNumber === 'BCDP-CM');
  eq(bcdp.id, 6505, 'BCDP-CM id');
  eq(pipeline(bcdp).template.productList, [6505], 'the verified product DOES contribute its id');
  return `${inferred.partNumber} (id ${inferred.id}) -> productList []; BCDP-CM -> [6505]`;
});

/* ==================== the representative matrix ==================== */
const area = (p) => p.dimensions.widthIn * p.dimensions.heightIn;
const ratio = (p) => p.dimensions.widthIn / p.dimensions.heightIn;
const byArea = [...all].sort((a, b) => area(a) - area(b));
const byRatio = [...all].sort((a, b) => ratio(a) - ratio(b));
const fam = (f) => all.filter((p) => p.productFamily === f);

const MATRIX = [
  ['smallest', byArea[0]],
  ['largest', byArea[byArea.length - 1]],
  ['tallest', byRatio[0]],
  ['widest', byRatio[byRatio.length - 1]],
  ['square', all.filter((p) => Math.abs(ratio(p) - 1) < 0.001).sort((a, b) => area(b) - area(a))[0]],
  ['round', all.find((p) => p.shape === 'circle')],
  ['stamp', fam('Stamp')[0]],
  ['banner/large print', fam('Banner')[0] || fam('Poster')[0]],
  ['poster', fam('Poster')[0]],
  ['sign', fam('Sign')[0]],
  ['business card (verified)', all.find((p) => p.partNumber === 'BCDP-CM')],
  ['name badge', fam('Name Badge')[0]],
  /* deterministic spread across the catalogue, not random */
  ...[7, 97, 197, 293, 401].map((n, i) => [`sample #${i + 1}`, byArea[n % byArea.length]]),
];

for (const [label, product] of MATRIX) {
  check(`matrix: ${label}`, () => {
    ok(product, `no catalogue product for "${label}"`);
    const built = pipeline(product);
    assertGeometry(product, built);
    const d = product.dimensions;
    return `${product.partNumber} · ${d.widthIn}×${d.heightIn}in · ${d.widthPx}×${d.heightPx}px · `
      + `${product.shape} · ${product.pages.min}p · ${product.legacy.designerMode} · `
      + `${product.provenance.technicalDataStatus}`;
  });
}

check('no sellable variation data anywhere in the catalogue', () => {
  const blob = JSON.stringify(all);
  ['LOWESTPRICE', 'lowestPrice', 'VARIATIONS', '"price"', '"cost"', 'Eprice', '$']
    .forEach((n) => ok(!blob.includes(n), `commercial data '${n}' reached a Product record`));
  /* SKUs are recorded as collapsed evidence, never as selectable products. */
  const withSkus = all.filter((p) => p.test && p.test.collapsedSkuCount > 0);
  ok(withSkus.length > 20, 'expected many products to have collapsed SKUs');
  /* A collapsed SKU must never ALSO be selectable as its own product — that is
   * the whole point of collapsing. B1438 is the worked example from the brief. */
  const parts = new Set(all.map((p) => p.partNumber));
  withSkus.forEach((p) => (p.test.collapsedSkus || []).forEach((s) => {
    ok(!parts.has(s), `collapsed SKU ${s} also appears as its own product`);
  }));
  const b1438 = all.find((p) => p.partNumber === 'B1438');
  ok(b1438, 'B1438 must be in the catalogue as the base part');
  eq(b1438.test.collapsedSkus, ['B14381', 'B14382', 'B14383'], 'B1438 variations');
  ['B14381', 'B14382', 'B14383'].forEach((v) =>
    ok(!parts.has(v), `${v} is a colour variation and must not be its own product`));
  return `${withSkus.length} products carry collapsed SKUs; none selectable; `
    + `B1438 collapses B14381/2/3`;
});

await (async () => {
  const t0 = Date.now();
  const r = await provider.search('B1438', { limit: 25 });
  const r2 = await provider.search('ban', { limit: 25 });
  const ms = Date.now() - t0;
  const pass = r.results[0] && r.results[0].partNumber === 'B1438'
    && r.results.length <= 25 && r2.results.length <= 25 && ms < 500;
  results.push({
    name: 'search: exact part first, capped, fast',
    pass,
    detail: `"B1438" -> ${r.results[0] && r.results[0].partNumber} (${r.total} total); `
      + `"ban" -> ${r2.results.length} shown of ${r2.total}; both searches in ${ms}ms`,
  });
  if (!pass) failed++;
})();

check('no request reached the network', () => {
  eq(networkAttempts, [], 'fetch attempts');
  return '0 network calls';
});

console.log('\n=========== PRODUCT MATRIX TESTS ===========\n');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');
process.exit(failed ? 1 : 0);
