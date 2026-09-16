/* LIVE MODE resolves its product from Sterling, never from bundled data.
 *
 * CCA links a person in with the numeric products.id they are working on:
 *   /templateGenerator/generator/index.html?product=6504&mode=live&orientation=landscape
 * 6504 is a valid live Sterling product that was never in the catalogue
 * snapshot shipped with the build, and the Generator answered "not available
 * in this catalogue". This drives the real page against a MOCK of the
 * read-only /templateDesigner/productInfo.cfm endpoint and proves that in live
 * mode the product, and every technical value on it, comes from that live read
 * — with the snapshot neither consulted nor loaded.
 *
 * Served from /templateGenerator/ on a sterling.ca host: the production path,
 * which is NOT a dev clone folder, so the demo guard's live-endpoint exception
 * is exercised too.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const ENDPOINT = '/templateDesigner/productInfo.cfm';
const PORT = 8903;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* One live product record, in the clean shape productInfo.cfm returns. */
const record = (id, part, name, wIn, hIn, extra = {}) => ({
  id, partNumber: part, name,
  dimensions: { widthIn: wIn, heightIn: hIn, displayUnit: 'in',
    widthDisplay: String(wIn), heightDisplay: String(hIn) },
  bleed: { top: 12, right: 12, bottom: 12, left: 12 },
  pages: { min: 2, max: 2 },
  shape: 'rect',
  orientation: { landscapeAvailable: true, portraitAvailable: true },
  maxLines: 0,
  status: { active: true, retired: false },
  legacy: {
    designerVariationCode: 3,
    margins: { top: 6, right: 6, bottom: 6, left: 6 },
    borders: { top: 0, right: 0, bottom: 0, left: 0, width: 0 },
    daterBox: { width: 0, height: 0 },
    isProStamp: false, greenInkAvailable: true, bandString: '',
  },
  classification: { productInformation: [
    { id: 805, productTable: 'business-cards', title: 'Vibrant Colour Business Cards' }] },
  ...extra,
});

/* THE MOCK LIVE SOURCE. Deliberately carries sizes that exist nowhere in the
   bundled catalogue — 6505 is in the snapshot at 3.5 x 2, and this serves it at
   4 x 2.5, so a form showing 4 x 2.5 can only have come from here. */
let LIVE_DB = {
  6504: record(6504, 'BCDP-CG', 'Vibrant Colour Business Cards - Classic Gloss', 3.75, 2.25),
  6505: record(6505, 'BCDP-CM', 'Vibrant Colour Business Cards - Classic Matte', 4, 2.5),
};
let endpointHits = [];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === ENDPOINT) {
    endpointHits.push(url.search);
    const id = Number(url.searchParams.get('product'));
    const hit = LIVE_DB[id];
    res.writeHead(hit ? 200 : 404,
      { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(hit
      ? { found: true, source: 'designCentral (live, read-only)', via: 'products', product: hit }
      : { found: false, error: { code: 'not-found',
          message: 'Sterling holds no active product with id ' + id + '.' } }));
    return;
  }
  const root = url.pathname.indexOf(FOLDER) === 0 ? FOLDER : null;
  if (!root) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(root.length)).replace(/^(\.\.[/\\])+/, '');
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

/* 6504 must genuinely be absent from the bundled data, or the test proves nothing. */
const bundled = [];
for (const f of ['data/sterling-products.json', 'data/sterling-test-catalogue.json']) {
  const doc = JSON.parse(await readFile(join(REPO, f), 'utf8'));
  (doc.products || []).forEach((p) => bundled.push(p.id));
}
console.log('0  fixture sanity');
is(!bundled.includes(6504), '6504 is absent from both bundled catalogue files',
   bundled.length + ' bundled records');
is(bundled.includes(6505), '6505 IS in the bundled data (so a fallback would be visible)');

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const ctx = await br.newContext();
const page = await ctx.newPage();
const requested = [];
page.on('request', (r) => requested.push(new URL(r.url()).pathname));
page.on('console', (m) => { if (/guard|error|fail/i.test(m.text())) console.log('     [c]', m.text().slice(0, 160)); });

const BASE = `http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`;

/** Open a live URL and report what the page ended up with. */
async function open(query) {
  requested.length = 0;
  endpointHits = [];
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const s = window.SMPProductSelection;
    return s && s.get && (s.get() !== null
      || /could not be loaded|did not carry/i.test(
        (document.getElementById('productStatus') || {}).textContent || ''));
  }, null, { timeout: 20000 });
  return page.evaluate(() => {
    const p = window.SMPProductSelection.get();
    const act = document.querySelector('.orient-btn.active');
    return {
      id: p && p.id, part: p && p.partNumber, name: p && p.name,
      w: p && p.dimensions && p.dimensions.widthIn,
      h: p && p.dimensions && p.dimensions.heightIn,
      pages: p && p.pages && p.pages.max, shape: p && p.shape,
      variation: p && p.legacy && p.legacy.designerVariationCode,
      designerMode: p && p.legacy && p.legacy.designerMode,
      bleed: p && p.bleed && p.bleed.left,
      provenance: p && p.provenance && p.provenance.source,
      status: (document.getElementById('productStatus') || {}).textContent || '',
      dims: [document.getElementById('dimWidth').value, document.getElementById('dimHeight').value],
      ttype: document.getElementById('templateType').value,
      locked: document.getElementById('sterlingProductGroup').classList.contains('is-live-locked'),
      orientation: act && act.dataset.orientation,
      catalogueSize: window.SMPProductSelection.catalogueSize(),
    };
  });
}
const readBundled = () => requested.filter((p) => /sterling-products\.json|sterling-test-catalogue\.json/.test(p));

console.log('\n1  6504 — absent from bundled data, resolves live');
const a = await open('?product=6504&mode=live&orientation=landscape');
is(a.id === 6504 && a.part === 'BCDP-CG', 'the live product is selected and locked in', a.part || a.status);
is(a.locked === true, 'the picker is locked for the session');
is(endpointHits.length === 1 && endpointHits[0] === '?product=6504',
   'exactly one read-only GET, carrying only the numeric id', endpointHits.join(' '));

console.log('\n2  6505 — resolves through the SAME server path, not the snapshot');
const b = await open('?product=6505&mode=live&orientation=landscape');
is(b.id === 6505 && b.part === 'BCDP-CM', 'the live product is selected', b.part || b.status);
is(endpointHits.length === 1 && endpointHits[0] === '?product=6505',
   'the same endpoint answered it', endpointHits.join(' '));
is(b.dims.join(' x ') === '4 x 2.5',
   'its size is the LIVE 4 x 2.5, not the snapshot 3.5 x 2', b.dims.join(' x '));

console.log('\n3  no live-mode request touches bundled catalogue data');
is(readBundled().length === 0, 'neither catalogue file was fetched in live mode',
   readBundled().join(', ') || 'none');
is(b.catalogueSize === 0, 'no bundled catalogue was even loaded', String(b.catalogueSize));
is(b.provenance === 'sterling-templatedesigner-live',
   'the record records where it came from', String(b.provenance));

console.log('\n4  orientation=landscape survives');
is(a.orientation === 'landscape' && b.orientation === 'landscape',
   'the URL orientation is the one in force', a.orientation + '/' + b.orientation);
const port = await open('?product=6504&mode=live&orientation=portrait');
is(port.orientation === 'portrait' && port.dims.join(' x ') === '2.25 x 3.75',
   'and portrait is honoured too, with the dimensions rotated', port.dims.join(' x '));

console.log('\n5  every technical value comes from the live response');
is(a.dims.join(' x ') === '3.75 x 2.25', 'dimensions', a.dims.join(' x '));
is(a.pages === 2, 'page count', String(a.pages));
is(a.shape === 'rect', 'shape', String(a.shape));
is(a.variation === 3, 'designer variation code', String(a.variation));
is(a.bleed === 12, 'bleed', String(a.bleed));
is(a.ttype === 'Business Card', 'creative type, derived from the live classification rows', a.ttype);

console.log('\n6  a designCentral change needs no rebuild and no redeploy');
LIVE_DB[6504] = record(6504, 'BCDP-CG', 'Vibrant Colour Business Cards - Classic Gloss', 4.25, 2.75);
LIVE_DB[6504].pages = { min: 1, max: 1 };
LIVE_DB[6504].legacy.designerVariationCode = 4;
const c = await open('?product=6504&mode=live&orientation=landscape');
is(c.dims.join(' x ') === '4.25 x 2.75', 'the next launch has the new dimensions', c.dims.join(' x '));
is(c.pages === 1 && c.variation === 4, 'and the new page count and variation code',
   c.pages + ' page(s), variation ' + c.variation);

console.log('\n7  an unknown or inactive product fails — it never falls back to static data');
delete LIVE_DB[6505];                       // 6505 is still in the bundled snapshot
const d = await open('?product=6505&mode=live&orientation=landscape');
is(d.id === undefined || d.id === null, 'nothing is selected', String(d.id));
is(/could not be loaded from Sterling/i.test(d.status), 'the page says so', d.status.slice(0, 90));
is(readBundled().length === 0, 'and it still did not read the snapshot', readBundled().join(', ') || 'none');

console.log('\n8  standalone/dev mode still uses the bundled catalogue');
requested.length = 0;
/* A standalone origin: not sterling.ca, so nothing is guarded, and not a dev
   clone folder, so the picker reads the two bundled catalogue files. */
await page.goto(`http://127.0.0.1:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 20000 });
const dev = await page.evaluate(() => ({
  size: window.SMPProductSelection.catalogueSize(),
  id: (window.SMPProductSelection.get() || {}).id,
}));
is(dev.size > 0 && readBundled().length > 0, 'the picker loads the snapshot when not in live mode',
   dev.size + ' records');
is(dev.id === 6505, 'and opens on the default product, unchanged', String(dev.id));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
