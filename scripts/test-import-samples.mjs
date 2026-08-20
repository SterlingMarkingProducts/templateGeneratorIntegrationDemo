/* Phase 3B-LOCAL — real-sample stress test for the import pipeline.
 *
 * Drives the ACTUAL Generator in a browser, converts each built-in sample
 * through the real adapter, then runs extraction + the import transport
 * against the MOCK endpoint. Reports the size numbers that justify the whole
 * design. No Sterling contact of any kind.
 *
 *   node scripts/test-import-samples.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const { chromium } = require(join(ROOT, 'node_modules/playwright-core/index.js'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = await new Promise((r) => {
  const s = http.createServer(async (q, res) => {
    const f = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''));
    try { const b = await readFile(f);
      res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end('nf'); }
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const base = `http://127.0.0.1:${srv.address().port}`;

const results = [];
let failed = 0;
function record(name, pass, detail) { results.push({ name, pass, detail }); if (!pass) failed++; }
function ok(c, m) { if (!c) throw new Error(m); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`${base}/generator/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

/* Load the mock into the page — it is NOT part of the Generator's own scripts. */
await page.addScriptTag({ url: '/integration/adapters/mock-template-import.js' });
await page.waitForTimeout(200);

const SAMPLES = ['Axiom', 'Atelier Noir', 'Business card', 'Sign 12'];
const rows = [];

for (const sample of SAMPLES) {
  await page.evaluate((s) => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith('Load sample: ' + s))?.click(), sample);
  await page.waitForTimeout(3000);

  const r = await page.evaluate(async (name) => {
    const AE = window.SMPAssetExtract, TI = window.SMPTransportImport, MK = window.SMPMockTemplateImport;
    /* Convert with NO product selected, so the Phase 2B geometry guard does not
     * fire on the samples that are not 3.5x2 (the Sign is 12x16). That guard is
     * a separate, separately-tested concern; this test is about ASSETS. */
    window.SMPProductSelection.clear();
    const { template } = await window.SMPPush.convertCurrentDesign();
    /* Import as the CMS-verified BCDP-CM: the only product with a real
     * designCentral id, and the transport does not re-check geometry. */
    const product = await window.SMPProductSelection.selectByPartNumber('BCDP-CM');

    const before = template.pages.map((p) => JSON.stringify(p.canvasData).length);
    const extracted = await AE.extractAssets(template);
    const after = AE.pageSizes(extracted.pages);

    const endpoint = MK.createMockImportEndpoint({ product });
    const transport = new TI.TemplateImportTransport({ baseUrl: 'https://mock.invalid/x', fetchImpl: endpoint });
    const sent = await transport.send(template, product);

    return {
      name, pages: template.pages.length,
      imageObjects: extracted.stats.imageObjects,
      extractedObjects: extracted.stats.extractedObjects,
      inlineObjects: extracted.stats.inlineObjects,
      inlineBytes: extracted.stats.inlineBytes,
      uniqueAssets: extracted.stats.uniqueAssets,
      duplicatesCollapsed: extracted.stats.duplicatesCollapsed,
      dataUriBytes: extracted.stats.dataUriBytes,
      assetBytes: extracted.stats.assetBytes,
      before, after,
      storedBytes: sent.response._mockStoredPages.map((p) => p.storedBytes),
      openUrl: sent.response.openUrl,
      noRasterDataUris: !/data:image\/(png|jpe?g|gif|webp|bmp)/i
        .test(JSON.stringify(sent.response._mockStoredPages)),
      mimesInline: AE.listDataUriMimes(extracted.pages),
      allKeysUuid: sent.response._mockStoredPages
        .flatMap((p) => p.canvasJson.objects.filter((o) => o.type === 'image' && o.imageKey))
        .every((o) => /^[0-9A-F-]{36}$/.test(o.imageKey) && o.src.startsWith('getImage.cfm?key=')),
      /* the ORIGINAL package must be untouched by extraction */
      originalIntact: template.pages.every((p) => JSON.stringify(p.canvasData).length === before[p.page]),
    };
  }, sample);

  rows.push(r);
  const LIMIT = 60000;
  try {
    ok(r.uniqueAssets <= r.imageObjects, 'unique assets cannot exceed image objects');
    ok(r.noRasterDataUris, 'a raster data: URI survived into the stored pages');
    ok(r.allKeysUuid, 'every stored image needs a UUID imageKey and a getImage src');
    ok(r.originalIntact, 'extraction must not mutate the original package');
    r.storedBytes.forEach((b, i) => ok(b < LIMIT, `page ${i} is ${b} bytes, over ${LIMIT}`));
    ok(/product=6505$/.test(r.openUrl), 'openUrl must target product 6505');
    record(`sample: ${r.name}`, true,
      `${r.pages}p · ${r.extractedObjects} raster -> ${r.uniqueAssets} assets`
      + (r.inlineObjects ? ` · ${r.inlineObjects} SVG inline (${r.inlineBytes}B)` : '') + ' · '
      + `canvas ${r.before.join('/')} -> ${r.storedBytes.join('/')} bytes · `
      + `${(r.assetBytes / 1024 / 1024).toFixed(2)} MB out-of-band`);
  } catch (e) { record(`sample: ${r.name}`, false, e.message); }
}

record('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ') || '0 errors');

console.log('\n=========== IMPORT PIPELINE — REAL SAMPLES (MOCK SERVER) ===========\n');
console.log('sample            pages  raster  uniq  svg  dataURI bytes   before/page       stored/page    % of 60KB');
console.log('─'.repeat(110));
for (const r of rows) {
  const pct = r.storedBytes.map((b) => (b / 60000 * 100).toFixed(1) + '%').join(' ');
  console.log(
    r.name.padEnd(18) + String(r.pages).padEnd(7) + String(r.extractedObjects).padEnd(8)
    + String(r.uniqueAssets).padEnd(6) + String(r.inlineObjects).padEnd(5)
    + r.dataUriBytes.toLocaleString().padStart(13) + '   '
    + r.before.map((b) => b.toLocaleString()).join('/').padEnd(18)
    + r.storedBytes.map((b) => b.toLocaleString()).join('/').padEnd(15) + pct);
}
console.log();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');

fs.writeFileSync(join(ROOT, 'scripts', '__reports__', 'import-sample-sizes.json'),
  JSON.stringify({ generated: 'run scripts/test-import-samples.mjs to regenerate', rows }, null, 1) + '\n');

await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
