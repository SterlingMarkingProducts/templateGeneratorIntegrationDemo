/* Phase 3B-LOCAL — import transport tests against the MOCK endpoint.
 * Pure Node, no browser, no Sterling. templateImport.cfm does not exist yet.
 *
 *   node scripts/test-transport-import.mjs
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;

/* Tripwire: the transport must only ever use the INJECTED fetch. */
const networkAttempts = [];
globalThis.fetch = async (u) => { networkAttempts.push(String(u)); throw new Error('NETWORK BLOCKED: ' + u); };
globalThis.window = globalThis;
require(join(ROOT, 'integration/product-contract.js'));
require(join(ROOT, 'integration/product-provider.js'));
require(join(ROOT, 'integration/adapters/asset-extract.js'));
require(join(ROOT, 'integration/adapters/transport-import.js'));
require(join(ROOT, 'integration/adapters/mock-template-import.js'));

const P = globalThis.SMPProductProvider;
const TI = globalThis.SMPTransportImport;
const MOCK = globalThis.SMPMockTemplateImport;

const verified = JSON.parse(fs.readFileSync(join(ROOT, 'data/sterling-products.json'), 'utf8'));
const testCat = JSON.parse(fs.readFileSync(join(ROOT, 'data/sterling-test-catalogue.json'), 'utf8'));
const provider = new P.CatalogueProductProvider({
  records: [...verified.products, ...testCat.products], source: 'sterling-catalogue-local',
});

const BASE = 'https://mock.invalid/designer';   // never resolved — the mock is injected
const results = [];
let failed = 0;
async function check(name, fn) {
  try { results.push({ name, pass: true, detail: (await fn()) || '' }); }
  catch (e) { failed++; results.push({ name, pass: false, detail: e.message }); }
}
function eq(a, b, w) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`${w}: expected ${y}, got ${x}`); }
function ok(c, m) { if (!c) throw new Error(m); }

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const bigPng = (tag, kb) => 'data:image/png;base64,' + b64(tag + 'x'.repeat(kb * 1024));
const img = (src) => ({ type: 'image', version: '4.4.0', left: 5, top: 6, width: 400, height: 300,
  scaleX: 0.84, scaleY: 0.64, angle: 0, opacity: 1, originX: 'left', originY: 'top',
  crossOrigin: 'anonymous', src });
const txt = (t) => ({ type: 'i-text', text: t, left: 4, top: 4, fontSize: 11, fill: '#111' });
const pkg = (pages) => ({ version: 1.2, templateNumber: 0, productList: [6505], canvasProperties: {},
  pages: pages.map((objects, i) => ({ page: i, canvasProperties: {},
    canvasData: { version: '4.4.0', objects } })) });

let bcdp = null, inferred = null;
await (async () => {
  bcdp = await provider.getByPartNumber('BCDP-CM');
  inferred = await provider.getByPartNumber('B1438');
})();

/* ==================== eligibility ==================== */
await check('BCDP-CM is eligible; inferred test products are not', async () => {
  const a = TI.eligibility(bcdp);
  eq(a.eligible, true, 'BCDP-CM eligible');
  eq(bcdp.id, 6505, 'real designCentral id');

  const b = TI.eligibility(inferred);
  eq(b.eligible, false, 'B1438 must NOT be eligible');
  eq(b.reason, 'synthetic-id', 'reason');
  ok(inferred.id < 0, 'inferred ids are synthetic and negative');
  ok(/cannot be imported into Sterling/.test(b.message), 'message explains why');
  ok(/remains fully usable/.test(b.message), 'message says it still works locally');

  eq(TI.eligibility(null).reason, 'no-product', 'no product selected');
  return `6505 eligible; ${inferred.partNumber} (id ${inferred.id}) blocked as synthetic-id`;
});

await check('an ineligible product is refused before anything is built', async () => {
  try {
    await TI.buildRequest(pkg([[txt('x')]]), inferred);
    throw new Error('expected a rejection');
  } catch (e) {
    eq(e.name, 'TemplateImportError', 'error type');
    eq(e.code, 'not-eligible', 'error code');
  }
  return 'buildRequest refuses a synthetic-id product';
});

/* ==================== the BCDP-CM end-to-end path ==================== */
let e2e = null;
await check('BCDP-CM: 2-page design through extraction, transport and mock server', async () => {
  const shared = bigPng('LOGO', 40);          // appears on BOTH pages
  const frontOnly = bigPng('HERO', 60);
  const template = pkg([
    [txt('Mara Ellison'), img(shared), img(frontOnly), txt('+1 415 208 6640')],
    [img(shared), txt('AXIOM')],
  ]);
  const endpoint = MOCK.createMockImportEndpoint({ product: bcdp });
  const transport = new TI.TemplateImportTransport({ baseUrl: BASE, fetchImpl: endpoint });
  e2e = await transport.send(template, bcdp);
  const r = e2e.response;

  eq(e2e.manifest.productId, 6505, 'productId');
  eq(e2e.manifest.pages.length, 2, 'pages sent');
  eq(e2e.manifest.pages.map((p) => p.pageNumber), [0, 1], 'page numbers 0 and 1');
  eq(e2e.stats.imageObjects, 3, 'image objects');
  eq(e2e.stats.uniqueAssets, 2, 'unique assets transmitted');
  eq(e2e.stats.duplicatesCollapsed, 1, 'front/back duplicate collapsed');

  eq(r.pages, 2, 'server saw 2 pages');
  eq(r.live, false, 'draft is not live');
  eq(r.mapped, false, 'draft has no mappings');
  eq(r.openUrl, `/templateDesigner.cfm?template=${r.templateId}&product=6505`, 'openUrl');
  ok(r.templateId >= MOCK.MOCK_TEMPLATE_ID_BASE, 'mock ids are obviously synthetic');
  ok(r.mock === true && /SYNTHETIC/.test(r.mockNotice), 'response is labelled a mock');
  return `2 pages, 3 image objects -> 2 assets, openUrl ${r.openUrl}`;
});

await check('the stored canvas has imageKey + non-data src and unchanged geometry', async () => {
  const stored = e2e.response._mockStoredPages;
  eq(stored.length, 2, 'stored pages');
  const imgs = stored.flatMap((p) => p.canvasJson.objects.filter((o) => o.type === 'image'));
  eq(imgs.length, 3, 'image objects stored');
  imgs.forEach((o, i) => {
    ok(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(o.imageKey),
       `image ${i} imageKey must be UUID-shaped (getImage.cfm validates isValid("UUID"))`);
    ok(o.src.startsWith('getImage.cfm?key='), `image ${i} src must be a getImage URL`);
    ok(o.src.includes('mode=FC'), `image ${i} mode must be FC for a FullColour product`);
    ok(o.src.includes('ver=scale'), `image ${i} ver`);
    ok(!('importAssetRef' in o), `image ${i} marker must be consumed`);
    eq([o.left, o.top, o.width, o.height, o.scaleX, o.scaleY, o.angle, o.opacity],
       [5, 6, 400, 300, 0.84, 0.64, 0, 1], `image ${i} geometry must be untouched`);
    eq(o.crossOrigin, 'anonymous', 'crossOrigin preserved');
  });
  /* the shared bitmap must resolve to ONE key on both pages */
  const keys = new Set(imgs.map((o) => o.imageKey));
  eq(keys.size, 2, 'two unique keys for two unique bitmaps');
  return `3 objects, 2 keys, all geometry identical`;
});

await check('ZERO raster data: URIs reach the database-bound JSON', async () => {
  const blob = JSON.stringify(e2e.response._mockStoredPages);
  ok(!/data:image\/(png|jpe?g|gif|webp|bmp)/i.test(blob), 'no raster data URI in the stored pages');
  ok(!blob.includes('importAssetRef'), 'no leftover markers');
  const manifestBlob = JSON.stringify(e2e.manifest);
  ok(!/data:image\/(png|jpe?g|gif|webp|bmp)/i.test(manifestBlob),
     'the wire manifest carries no raster data URIs either');
  return 'stored pages and wire manifest carry zero raster data URIs';
});

await check('an inline SVG survives the whole round trip byte-identical', async () => {
  const SVG = 'data:image/svg+xml;base64,' + b64('<svg viewBox="0 0 8 8"><circle r="4"/></svg>');
  const template = pkg([[img(SVG), img(bigPng('P', 20)), txt('hi')]]);
  const endpoint = MOCK.createMockImportEndpoint({ product: bcdp });
  const t = new TI.TemplateImportTransport({ baseUrl: BASE, fetchImpl: endpoint });
  const sent = await t.send(template, bcdp);
  eq(sent.stats.inlineObjects, 1, 'one inline object');
  eq(sent.stats.uniqueAssets, 1, 'only the raster was transmitted');
  const objs = sent.response._mockStoredPages[0].canvasJson.objects;
  eq(objs[0].src, SVG, 'the SVG src must be byte-identical after the round trip');
  eq(objs[0].imageKey, undefined, 'an inline object gets no imageKey');
  ok(objs[1].imageKey, 'the raster does get one');
  return 'SVG passes through untouched; PNG becomes an imageKey';
});

await check('every stored page is under the 60,000-byte TEXT limit', async () => {
  e2e.response._mockStoredPages.forEach((p, i) => {
    ok(p.storedBytes < TI.MAX_PAGE_JSON_BYTES,
       `page ${i} is ${p.storedBytes} bytes, over the limit`);
  });
  const sizes = e2e.response._mockStoredPages.map((p) => p.storedBytes);
  return `page sizes ${sizes.join(', ')} bytes (limit ${TI.MAX_PAGE_JSON_BYTES})`;
});

await check('no authoritative product facts are sent to the server', async () => {
  const blob = JSON.stringify(e2e.manifest);
  ['widthIn', 'heightIn', 'widthPx', 'heightPx', 'bleed', 'margins', 'shape',
   'designerMode', 'designerVariationCode', 'minPages', 'maxPages', 'orientation']
    .forEach((k) => ok(!blob.includes(k), `manifest must not carry the product fact "${k}"`));
  eq(Object.keys(e2e.manifest).sort(), ['assets', 'contractVersion', 'pages', 'productId', 'source'],
     'manifest top-level keys');
  ok(!('canvasProperties' in e2e.manifest.pages[0]), 'page canvasProperties are not sent');
  return 'only productId, pages, assets and non-authoritative source metadata travel';
});

/* ==================== failure modes ==================== */
async function expectFail(fn, code, what) {
  try { await fn(); throw new Error(`${what}: expected a failure`); }
  catch (e) {
    if (e.name !== 'TemplateImportError') throw new Error(`${what}: wrong type ${e.name}: ${e.message}`);
    if (e.code !== code) throw new Error(`${what}: expected ${code}, got ${e.code}`);
    return e;
  }
}

await check('a page over 60,000 bytes is refused BEFORE sending', async () => {
  const objects = [];
  for (let i = 0; i < 900; i++) objects.push(txt('padding text object number ' + i + ' — abcdefghijklmnop'));
  const endpoint = MOCK.createMockImportEndpoint({ product: bcdp });
  const t = new TI.TemplateImportTransport({ baseUrl: BASE, fetchImpl: endpoint });
  const e = await expectFail(() => t.send(pkg([objects]), bcdp), 'page-too-large', 'oversized page');
  ok(e.detail.bytes > 60000, 'error carries the measured size');
  eq(endpoint.callCount(), 0, 'nothing may be sent when the pre-flight fails');
  return `refused locally at ${e.detail.bytes} bytes; 0 requests made`;
});

await check('malformed and unsupported assets stop the import', async () => {
  const t = new TI.TemplateImportTransport({ baseUrl: BASE, fetchImpl: MOCK.createMockImportEndpoint({ product: bcdp }) });
  try { await t.send(pkg([[img('data:image/gif;base64,' + b64('GIF89a'))]]), bcdp); throw new Error('expected rejection'); }
  catch (e) { eq(e.code, 'unsupported-mime', 'gif rejected'); }
  try { await t.send(pkg([[img('data:application/pdf;base64,' + b64('%PDF'))]]), bcdp); throw new Error('expected rejection'); }
  catch (e) { eq(e.code, 'unsupported-mime', 'pdf rejected'); }
  try { await t.send(pkg([[img('data:image/png;base64,!!!')]]), bcdp); throw new Error('expected rejection'); }
  catch (e) { eq(e.code, 'malformed-data-uri', 'bad base64 rejected'); }
  return 'unsupported-mime and malformed-data-uri both stop the send';
});

for (const [status, code] of [[400, 'bad-request'], [409, 'page-count-mismatch'],
                              [413, 'payload-too-large'], [422, 'invalid-canvas'],
                              [500, 'server-error']]) {
  await check(`mock ${status} surfaces as ${code}`, async () => {
    const t = new TI.TemplateImportTransport({ baseUrl: BASE,
      fetchImpl: MOCK.createMockImportEndpoint({ product: bcdp, forceStatus: status }) });
    const e = await expectFail(() => t.send(pkg([[txt('x')]]), bcdp), code, `HTTP ${status}`);
    ok(/MOCK/.test(e.message), 'the mock identifies itself in the message');
    eq(e.detail.status, status, 'status carried on the error');
    return `${status} -> ${e.code}`;
  });
}

await check('a network failure surfaces as network, never as a silent fallback', async () => {
  const t = new TI.TemplateImportTransport({ baseUrl: BASE,
    fetchImpl: MOCK.createMockImportEndpoint({ product: bcdp, forceNetwork: true }) });
  const e = await expectFail(() => t.send(pkg([[txt('x')]]), bcdp), 'network', 'dead host');
  ok(/Could not reach/.test(e.message), 'message');
  return 'network failure raises; no localStorage fallback';
});

await check('import never silently falls back to the local transport', async () => {
  /* Scan the CODE, not the comments: the transport's own doc block explains
   * that it must not "quietly become a localStorage handoff", which would be a
   * false positive on a naive text search. */
  const raw = fs.readFileSync(join(ROOT, 'integration/adapters/transport-import.js'), 'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/SMPTransportLocal|localStorage|smpDesignTransfer/.test(code),
     'the import transport must not reference the local transport in code');
  ok(/quietly become a localStorage handoff/.test(raw),
     'sanity: the explanatory comment is still there, so the scan is meaningful');
  return 'no local-transport reference in code; the intent is documented in a comment';
});

await check('the transport refuses to be constructed without an explicit baseUrl', async () => {
  try { new TI.TemplateImportTransport({}); throw new Error('expected a throw'); }
  catch (e) { ok(/explicit baseUrl/.test(e.message), 'message'); }
  const src = fs.readFileSync(join(ROOT, 'integration/adapters/transport-import.js'), 'utf8');
  ok(!/sterling\.ca|portals\.|https?:\/\/(?!\s)/.test(src.replace(/\* .*$/gm, '')),
     'no Sterling hostname may appear in the transport');
  return 'baseUrl required; no hostname hardcoded';
});

await check('no request reached the real network', async () => {
  eq(networkAttempts, [], 'real fetch attempts');
  return '0 real network calls — every request went to the injected mock';
});

console.log('\n=========== IMPORT TRANSPORT TESTS (MOCK) ===========\n');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');
process.exit(failed ? 1 : 0);
