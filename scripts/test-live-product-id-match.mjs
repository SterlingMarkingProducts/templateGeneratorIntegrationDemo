/* The requested products.id is the only product that may ever be used.
 *
 * ?product=8914&mode=live opened a Generator that ended up selected on 6505,
 * and Push to Designer only noticed AFTER the importer had already created a
 * draft for the wrong product. Three defences are pinned here:
 *   1. the live lookup's answer must BE the product that was asked for;
 *   2. a mismatched answer selects nothing;
 *   3. a drifted product makes ZERO importer calls — no token, no POST, no
 *      draft, no redirect.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8907;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const record = (id, part, wIn, hIn) => ({
  id, partNumber: part, name: 'Business Cards ' + part,
  dimensions: { widthIn: wIn, heightIn: hIn, displayUnit: 'in',
    widthDisplay: String(wIn), heightDisplay: String(hIn) },
  bleed: { top: 12, right: 12, bottom: 12, left: 12 },
  pages: { min: 2, max: 2 }, shape: 'rect',
  orientation: { landscapeAvailable: true, portraitAvailable: true },
  maxLines: 0, status: { active: true, retired: false },
  legacy: { designerVariationCode: 3, margins: { top: 6, right: 6, bottom: 6, left: 6 },
    borders: { top: 0, right: 0, bottom: 0, left: 0, width: 0 },
    daterBox: { width: 0, height: 0 }, isProStamp: false, greenInkAvailable: true, bandString: '' },
  classification: { productInformation: [
    { id: 805, productTable: 'business-cards', title: 'Vibrant Colour Business Cards' }] },
});

/* THE EXACT PRODUCTION FAILURE: asked for 8914, answered with 6505. */
let ANSWER_WITH = null;              // id the endpoint answers with, whatever was asked
const LIVE_DB = { 8914: record(8914, 'BCDP-CG', 3.75, 2.25), 6505: record(6505, 'BCDP-CM', 3.5, 2) };
let hits = { product: 0, token: 0, import: 0 };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/templateDesigner/productInfo.cfm') {
    hits.product++;
    const asked = Number(url.searchParams.get('product'));
    const give = LIVE_DB[ANSWER_WITH === null ? asked : ANSWER_WITH];
    res.writeHead(give ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(give
      ? { found: true, via: 'products', product: give }
      : { found: false, error: { code: 'not-found', message: 'no active product' } }));
    return;
  }
  if (url.pathname === '/templateDesigner/templateImportToken.cfm') {
    hits.token++;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ csrfToken: 'a'.repeat(64) })); return;
  }
  if (url.pathname === '/templateDesigner/templateImport.cfm') {
    hits.import++;
    for await (const c of req) { void c; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ templateId: 55001, openUrl: 'https://x/y' })); return;
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
const ctx = await br.newContext();
const page = await ctx.newPage();
const BASE = `http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`;

async function open(query) {
  hits = { product: 0, token: 0, import: 0 };
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const s = window.SMPProductSelection;
    return s && s.get && (s.get() !== null
      || /mismatch|could not be loaded|did not carry/i.test(
        (document.getElementById('productStatus') || {}).textContent || ''));
  }, null, { timeout: 20000 });
  return page.evaluate(() => ({
    id: (window.SMPProductSelection.get() || {}).id ?? null,
    liveId: window.SMPProductSelection.liveProductId(),
    status: (document.getElementById('productStatus') || {}).textContent || '',
    locked: document.getElementById('sterlingProductGroup').classList.contains('is-live-locked'),
  }));
}

console.log('1  the live lookup answers with a DIFFERENT product (the 8914 -> 6505 failure)');
ANSWER_WITH = 6505;
const bad = await open('?product=8914&mode=live&orientation=landscape');
is(bad.id === null, 'nothing is selected', String(bad.id));
is(/mismatch/i.test(bad.status) && /8914/.test(bad.status),
   'the page reports a product mismatch naming the requested id', bad.status.slice(0, 110));
is(bad.locked === true, 'live mode stays locked');
is(bad.liveId === 8914, 'CCA\'s id remains authoritative', String(bad.liveId));

console.log('\n2  the matching product still resolves normally');
ANSWER_WITH = null;
const good = await open('?product=8914&mode=live&orientation=landscape');
is(good.id === 8914, 'product 8914 is selected', String(good.id));
is(hits.product === 1, 'one live lookup', String(hits.product));

console.log('\n3  Push on a drifted product makes ZERO importer calls');
/* Force the exact production state: live id 8914, selection replaced with 6505.
   Nothing in the shipped UI can do this any more — which is the point — so the
   test installs the drifted selection directly and then uses the real button. */
const drift = await page.evaluate(async () => {
  const sel = window.SMPProductSelection;
  const real = sel.get();
  /* a genuine normalized record for the OTHER product, via the same provider */
  const other = await new window.SMPProductProvider.CatalogueProductProvider({
    records: [JSON.parse(JSON.stringify(Object.assign({}, real, { id: 6505, partNumber: 'BCDP-CM' })))],
    source: 'test-drift' }).getById(6505).catch(() => null);
  if (!other) return { installed: false };
  sel.get = function () { return other; };
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}'
    + '.card{position:relative;width:336px;height:192px;background:#123a5e;font-family:Arial}'
    + '.n{position:absolute;left:24px;top:30px;color:#fff;font-size:20px}</style></head>'
    + '<body><div class="card"><div class="n">Drift Test</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in', doubleSided: false };
  if (typeof showPanel === 'function') showPanel('result');   // reveal the real button
  return { installed: true, selected: sel.get().id, liveId: sel.liveProductId() };
});
is(drift.installed && drift.selected === 6505 && drift.liveId === 8914,
   'the exact production state is in place (live 8914, selected 6505)',
   JSON.stringify(drift));

hits = { product: 0, token: 0, import: 0 };
const before = page.url();
await page.click('#pushToDesignerBtn');   // the real button, real handler
await page.waitForTimeout(4000);
const after = await page.evaluate(() => ({
  url: window.location.href,
  toast: (document.body.innerText.match(/Push to Designer failed:[^\n]*/) || [''])[0],
  pages: 0,
}));
is(hits.token === 0, 'ZERO token requests', String(hits.token));
is(hits.import === 0, 'ZERO import POSTs — no draft could have been created', String(hits.import));
is(ctx.pages().length === 1 && after.url === before, 'ZERO redirect and no Designer window opened');
is(/expected 8914, found 6505/.test(after.toast)
   && /no draft was created/i.test(after.toast),
   'an explicit mismatch error is shown', after.toast.slice(0, 140));

console.log('\n4  a matching product still hands off end to end');
ANSWER_WITH = null;
await open('?product=8914&mode=live&orientation=landscape');
const ok = await page.evaluate(async () => {
  /* 8914's own size in the fixture: 3.75 x 2.25in = 360 x 216px. */
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}'
    + '.card{position:relative;width:360px;height:216px;background:#123a5e;font-family:Arial}'
    + '.n{position:absolute;left:24px;top:30px;color:#fff;font-size:20px}</style></head>'
    + '<body><div class="card"><div class="n">Match Test</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  try {
    const out = await window.SMPPush.pushViaImport();
    return { ok: true, templateId: out.response.templateId, productId: out.manifest.productId };
  } catch (e) { return { ok: false, error: e.message }; }
});
is(ok.ok === true, 'the import runs for the matching product', ok.error || ('template ' + ok.templateId));
is(ok.productId === 8914, 'and it carries CCA\'s product id, not another', String(ok.productId));
is(hits.import === 1, 'exactly one import POST', String(hits.import));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
