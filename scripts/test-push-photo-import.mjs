/* Push to Designer for photo-based large-format designs.
   The real browser pipeline (offscreen extraction, raster, asset extraction,
   multipart build) runs against the mock import endpoint, exactly as the
   web03 dev clone runs it against templateImport.cfm.

   The two failure modes this guards:
     1. the 11 MB PNG background raster a busy large-format design produced —
        the payload class web03's gateway kills with a bare 502;
     2. the stock photograph travelling as a URL into the dev clone folder,
        bypassing the asset store every other raster goes through. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8897;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
/* the live catalogue, as test-product-type.mjs captured it from the replica —
   the picker needs a real importable product (DS21218) to select */
const CAT_SRC = await readFile(new URL('./test-product-type.mjs', import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ') + 18,
  CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const ENDPOINT = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === ENDPOINT) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(CATALOGUE));
    return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPPush && window.SMPTransportImport, null,
  { timeout: 15000 });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });
await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('DS21218'));
await page.waitForTimeout(200);
/* the mock endpoint is not part of the page build — inject it for the test */
await page.addScriptTag({ url: FOLDER + 'integration/adapters/mock-template-import.js' });
await page.waitForFunction(() => window.SMPMockTemplateImport, null, { timeout: 5000 });

/* One driver: run the pipeline for a given design against the mock endpoint
   and report what would have gone over the wire. */
const run = (kind) => page.evaluate(async (kind) => {
  const W = 18 * 96, H = 12 * 96;
  const PHOTO = 'assets/stock-photo-library/04-vertical-dentist-with-patient.png';
  const busy = `
    <div class="tex" style="position:absolute;inset:0;background:
      repeating-linear-gradient(45deg,#0002 0 3px,transparent 3px 7px),
      repeating-radial-gradient(circle at 30% 40%,#fff1 0 6px,transparent 6px 14px)"></div>
    ${Array.from({ length: 24 }, (_, i) =>
      `<div style="position:absolute;border-radius:50%;filter:blur(2px);left:${(i * 137) % 1600}px;top:${(i * 89) % 1000}px;width:${120 + i * 13}px;height:${100 + i * 9}px;background:hsla(${i * 37},70%,55%,.5)"></div>`).join('')}`;
  const html = `<!DOCTYPE html><html><head><style>body{margin:0}
    .card{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:Arial;
      background:${kind === 'flat' ? '#f5f1e8'
        : 'conic-gradient(from 20deg,#123a5e,#c46a2b,#e8d9b0,#2b6a4a,#123a5e)'}}
    .photo-panel{position:absolute;left:0;top:0;width:${Math.round(W * 0.38)}px;height:${H}px;overflow:hidden}
    .photo-panel img{width:100%;height:100%;object-fit:cover}
    .head{position:absolute;left:${Math.round(W * 0.42)}px;top:160px;font-size:120px;font-weight:800;color:#fff}
  </style></head><body><div class="card">
    ${kind === 'flat' ? '' : busy}
    <div class="photo-panel"><img src="${PHOTO}"></div>
    <div class="head">Lakeside Dental</div>
  </div></body></html>`;
  generatedHtml = html;
  lastPayload = { templateType: 'Sign', width: 18, height: 12, unit: 'in', doubleSided: false };

  const mock = window.SMPMockTemplateImport.createMockImportEndpoint({});
  const transport = new window.SMPTransportImport.TemplateImportTransport({
    baseUrl: '/mock', fetchImpl: mock });
  window.SMPPush.setTransportMode('import', transport);
  try {
    const out = await window.SMPPush.pushViaImport();
    const srcs = [];
    /* what the manifest is sending, per page object */
    out.manifest.pages.forEach((pg) => pg.canvasJson.objects.forEach((o) => {
      if (o.type === 'image') srcs.push(o.importAssetRef ? 'ref:' + o.importAssetRef : String(o.src).slice(0, 80));
    }));
    return { ok: true, stats: out.stats, srcs,
      templateId: out.response.templateId,
      assetTypes: (out.manifest.assets || []).map((a) => a.mimeType || a.contentType || '') };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  } finally {
    window.SMPPush.setTransportMode('local');
  }
}, kind);

console.log('\n1  a photo panel design imports, with the photo as an ASSET');
const flat = await run('flat');
is(flat.ok === true, 'the push completes against the import contract', flat.error || ('templateId ' + flat.templateId));
is(flat.stats.uniqueAssets === 2, 'two asset parts: the background raster and the photograph',
   flat.stats.uniqueAssets + ' assets');
is(flat.srcs.every((s) => s.startsWith('ref:')), 'every image in the outgoing canvas is an asset reference',
   flat.srcs.join(' | '));
is(!flat.srcs.some((s) => /git|generator|stock-photo-library|http/.test(s)),
   'no clone URL survives into the outgoing canvas');

console.log('\n2  a BUSY large-format design stays under the payload class the gateway kills');
const busy = await run('busy');
is(busy.ok === true, 'the busy design pushes too', busy.error || ('templateId ' + busy.templateId));
console.log('     asset payload: ' + (busy.stats.assetBytes / 1048576).toFixed(2) + ' MB'
  + ' (' + busy.assetTypes.join(', ') + ')');
is(busy.stats.assetBytes < 6 * 1024 * 1024,
   'total asset payload is a fraction of the former 11 MB raster',
   (busy.stats.assetBytes / 1048576).toFixed(2) + ' MB');
is(busy.assetTypes.some((t) => /jpeg/.test(t)),
   'the busy background raster went out as JPEG, not an 11 MB PNG');
is(/png/.test(flat.assetTypes[0]),
   'while a flat/graphic raster stays PNG (asset-1 is the background raster)',
   flat.assetTypes.join(', '));

console.log('\n3  local transport is untouched');
const localSrc = await page.evaluate(async () => {
  const { template } = await window.SMPPush.convertCurrentDesign();
  const imgs = [];
  template.pages.forEach((pg) => pg.canvasData.objects.forEach((o) => {
    if (o.type === 'image') imgs.push(String(o.src).slice(0, 40));
  }));
  return imgs;
});
is(localSrc.some((s) => !s.startsWith('data:')),
   'in local mode the photo keeps its URL src (no localStorage bloat)',
   localSrc.join(' | '));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
