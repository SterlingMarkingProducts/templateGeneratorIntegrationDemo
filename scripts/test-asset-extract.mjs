/* Phase 3B-LOCAL — asset extraction tests. Pure Node, no browser, no network.
 *
 *   node scripts/test-asset-extract.mjs
 */
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;

const networkAttempts = [];
globalThis.fetch = async (u) => { networkAttempts.push(String(u)); throw new Error('NETWORK BLOCKED: ' + u); };
globalThis.window = globalThis;
require(join(ROOT, 'integration/adapters/asset-extract.js'));
const AE = globalThis.SMPAssetExtract;

const results = [];
let failed = 0;
async function check(name, fn) {
  try { results.push({ name, pass: true, detail: (await fn()) || '' }); }
  catch (e) { failed++; results.push({ name, pass: false, detail: e.message }); }
}
function eq(a, b, w) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`${w}: expected ${y}, got ${x}`); }
function ok(c, m) { if (!c) throw new Error(m); }

/* --- tiny deterministic PNG-ish payloads (not real PNGs; extraction only
       decodes and hashes bytes, it never renders) --- */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const PNG_A = 'data:image/png;base64,' + b64('AAAA-bitmap-one');
const PNG_B = 'data:image/png;base64,' + b64('BBBB-bitmap-two');
const JPG_A = 'data:image/jpeg;base64,' + b64('CCCC-bitmap-three');

const img = (src, extra = {}) => ({
  type: 'image', version: '4.4.0', left: 10, top: 20, width: 100, height: 50,
  scaleX: 0.5, scaleY: 0.5, angle: 0, opacity: 1, originX: 'left', originY: 'top',
  crossOrigin: 'anonymous', sterlingType: 'artwork', src, ...extra,
});
const txtObj = () => text('x');
const text = (t) => ({ type: 'i-text', text: t, left: 1, top: 1, fontSize: 12 });
const pkg = (pages) => ({ version: 1.2, productList: [], canvasProperties: {},
  pages: pages.map((objects, i) => ({ page: i, canvasProperties: {},
    canvasData: { version: '4.4.0', objects } })) });

/* ==================== extraction basics ==================== */
await check('extracts a single embedded image and leaves geometry alone', async () => {
  const original = pkg([[text('hello'), img(PNG_A)]]);
  const before = JSON.parse(JSON.stringify(original));
  const r = await AE.extractAssets(original);

  eq(original, before, 'the caller package MUST NOT be mutated');
  eq(r.assets.length, 1, 'unique assets');
  eq(r.assets[0].refId, 'asset-1', 'refId');
  eq(r.assets[0].mimeType, 'image/png', 'mime');
  eq(r.assets[0].extension, 'png', 'extension');
  eq(r.assets[0].filename, 'asset-1.png', 'filename');
  eq(r.assets[0].byteLength, Buffer.from('AAAA-bitmap-one').length, 'decoded byte length');
  ok(/^[0-9a-f]{64}$/.test(r.assets[0].sha256), 'sha256 is 64 hex chars');

  const o = r.pages[0].canvasData.objects[1];
  eq(o.src, undefined, 'src must be removed');
  eq(o.importAssetRef, 'asset-1', 'reference marker added');
  ['left','top','width','height','scaleX','scaleY','angle','opacity','originX','originY',
   'crossOrigin','sterlingType','version'].forEach((k) =>
    eq(o[k], before.pages[0].canvasData.objects[1][k], `geometry field ${k} must be unchanged`));
  return `1 asset, marker written, ${r.assets[0].byteLength} bytes`;
});

await check('no imageKey is ever created client-side', async () => {
  const r = await AE.extractAssets(pkg([[img(PNG_A)], [img(PNG_B)]]));
  const blob = JSON.stringify(r);
  ok(!/imageKey/.test(blob), 'the client must never mint an imageKey');
  ok(!/getImage\.cfm/.test(blob), 'the client must not fabricate a Sterling image URL');
  return 'imageKey and getImage.cfm absent — both are server-owned';
});

/* ==================== deduplication ==================== */
await check('deduplicates the same bitmap on one page', async () => {
  const r = await AE.extractAssets(pkg([[img(PNG_A), img(PNG_A), img(PNG_B)]]));
  eq(r.stats.imageObjects, 3, 'image objects');
  eq(r.stats.uniqueAssets, 2, 'unique assets');
  eq(r.stats.duplicatesCollapsed, 1, 'collapsed');
  const objs = r.pages[0].canvasData.objects;
  eq(objs[0].importAssetRef, objs[1].importAssetRef, 'identical bitmaps share one ref');
  ok(objs[0].importAssetRef !== objs[2].importAssetRef, 'different bitmaps get different refs');
  return '3 objects -> 2 assets';
});

await check('deduplicates across front and back', async () => {
  const r = await AE.extractAssets(pkg([[img(PNG_A), img(PNG_B)], [img(PNG_A)]]));
  eq(r.stats.imageObjects, 3, 'image objects');
  eq(r.stats.uniqueAssets, 2, 'unique assets');
  const a = r.assets.find((x) => x.usedBy.length === 2);
  eq(a.usedBy, [{ page: 0, objectIndex: 0 }, { page: 1, objectIndex: 0 }], 'usedBy spans both pages');
  return 'front+back share one transmitted asset';
});

await check('mixed types are kept apart', async () => {
  const r = await AE.extractAssets(pkg([[img(PNG_A), img(JPG_A)]]));
  eq(r.stats.uniqueAssets, 2, 'unique assets');
  eq(r.assets.map((a) => a.mimeType).sort(), ['image/jpeg', 'image/png'], 'mime types');
  eq(r.assets.map((a) => a.extension).sort(), ['jpg', 'png'], 'extensions');
  return 'png + jpeg kept separate';
});

/* ==================== rejection ==================== */
async function rejects(fn, code, what) {
  try { await fn(); throw new Error(`${what}: expected a rejection, got success`); }
  catch (e) {
    if (e.name !== 'AssetExtractError') throw new Error(`${what}: wrong error type ${e.name}: ${e.message}`);
    if (e.code !== code) throw new Error(`${what}: expected code ${code}, got ${e.code}`);
    return e;
  }
}

await check('rejects an unsupported MIME type', async () => {
  const e = await rejects(() => AE.extractAssets(pkg([[img('data:application/pdf;base64,' + b64('%PDF'))]])),
    'unsupported-mime', 'pdf');
  ok(/application\/pdf/.test(e.message), 'message names the type');
  await rejects(() => AE.extractAssets(pkg([[img('data:text/html;base64,' + b64('<b>'))]])),
    'unsupported-mime', 'html');
  await rejects(() => AE.extractAssets(pkg([[img('data:image/gif;base64,' + b64('GIF89a'))]])),
    'unsupported-mime', 'gif');
  await rejects(() => AE.extractAssets(pkg([[img('data:image/webp;base64,' + b64('RIFF'))]])),
    'unsupported-mime', 'webp');
  return 'pdf, html, gif and webp all refused';
});

await check('small SVG data URIs stay INLINE, untouched', async () => {
  /* The Generator emits SVG logos at 570 bytes to 5 KB per design — three
   * orders of magnitude under its rasters. Extracting them would need
   * Sterling's upload path to accept SVG, which <cfimage> cannot open. */
  const SVG = 'data:image/svg+xml;base64,' + b64('<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>');
  const r = await AE.extractAssets(pkg([[img(SVG), img(PNG_A), txtObj()]]));
  eq(r.stats.imageObjects, 2, 'image objects seen');
  eq(r.stats.inlineObjects, 1, 'one left inline');
  eq(r.stats.extractedObjects, 1, 'one extracted');
  eq(r.stats.uniqueAssets, 1, 'only the raster becomes an asset');

  const svgObj = r.pages[0].canvasData.objects[0];
  eq(svgObj.src, SVG, 'the SVG src must be byte-identical');
  eq(svgObj.importAssetRef, undefined, 'no marker on an inline object');

  ok(AE.hasNoRasterDataUris(r.pages), 'no RASTER data URI remains');
  eq(AE.listDataUriMimes(r.pages), { 'image/svg+xml': 1 }, 'the inline SVG is still reported');
  return 'SVG inline and unmodified; PNG extracted';
});

await check('rejects malformed data URIs', async () => {
  await rejects(() => AE.extractAssets(pkg([[img('data:image/png,notbase64')]])),
    'malformed-data-uri', 'missing ;base64');
  await rejects(() => AE.extractAssets(pkg([[img('data:image/png;base64,')]])),
    'malformed-data-uri', 'empty payload');
  await rejects(() => AE.extractAssets(pkg([[img('data:image/png;base64,!!!not-base64!!!')]])),
    'malformed-data-uri', 'invalid base64');
  await rejects(() => AE.extractAssets(pkg([[img('data:garbage')]])),
    'malformed-data-uri', 'not a data URI at all');
  return '4 malformed forms refused';
});

await check('non-data image srcs are left completely alone', async () => {
  const already = img('getImage.cfm?key=3F2504E0-4F89-11D3-9A0C-0305E82C3301&mode=FC&ver=scale');
  const r = await AE.extractAssets(pkg([[already, img(PNG_A)]]));
  eq(r.stats.uniqueAssets, 1, 'only the data URI is extracted');
  eq(r.pages[0].canvasData.objects[0].src, already.src, 'existing getImage src untouched');
  eq(r.pages[0].canvasData.objects[0].importAssetRef, undefined, 'no marker added');
  return 'an already-imported image is a no-op';
});

/* ==================== helpers ==================== */
await check('hasNoRasterDataUris and pageSizes report correctly', async () => {
  const before = pkg([[img(PNG_A)]]);
  ok(!AE.hasNoRasterDataUris(before.pages), 'must detect a remaining raster data URI');
  const r = await AE.extractAssets(before);
  ok(AE.hasNoRasterDataUris(r.pages), 'must be clean after extraction');
  const sizes = AE.pageSizes(r.pages);
  eq(sizes.length, 1, 'one size per page');
  ok(sizes[0] > 0 && sizes[0] < 1000, `page size looks sane: ${sizes[0]}`);
  return `clean after extraction; page 0 = ${sizes[0]} bytes`;
});

await check('no request reached the network', async () => {
  eq(networkAttempts, [], 'fetch attempts');
  return '0 network calls';
});

console.log('\n=========== ASSET EXTRACTION TESTS ===========\n');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');
process.exit(failed ? 1 : 0);
