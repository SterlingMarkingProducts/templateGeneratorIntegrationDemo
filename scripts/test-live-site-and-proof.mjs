/* CCA's site id survives the handoff, and every pushed page carries a proof.
 *
 * Two things a live push was missing:
 *   · the originating CCA site family id, which the Designer needs to
 *     preselect the Sites control on an imported draft;
 *   · a page proof PNG, without which templatepages.proofFileName stays empty
 *     and the CCA template chooser renders a broken image for the template.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8911;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const PRODUCT_8914 = {
  id: 8914, partNumber: 'BCDP-CG', name: 'Vibrant Colour Business Cards - Classic Gloss',
  dimensions: { widthIn: 3.75, heightIn: 2.25, displayUnit: 'in', widthDisplay: '3.75', heightDisplay: '2.25' },
  bleed: { top: 12, right: 12, bottom: 12, left: 12 },
  pages: { min: 2, max: 2 }, shape: 'rect',
  orientation: { landscapeAvailable: true, portraitAvailable: true },
  maxLines: 0, status: { active: true, retired: false },
  legacy: { designerVariationCode: 3, margins: { top: 6, right: 6, bottom: 6, left: 6 },
    borders: { top: 0, right: 0, bottom: 0, left: 0, width: 0 },
    daterBox: { width: 0, height: 0 }, isProStamp: false, greenInkAvailable: true, bandString: '' },
  classification: { productInformation: [
    { id: 805, productTable: 'business-cards', title: 'Vibrant Colour Business Cards' }] },
};
const SITE = 42;                               // the CCA application.SiteFamilyId
let lastImport = null;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/templateDesigner/productInfo.cfm') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ found: true, via: 'products', product: PRODUCT_8914 })); return;
  }
  if (url.pathname === '/templateDesigner/templateImportToken.cfm') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ csrfToken: 'a'.repeat(64) })); return;
  }
  if (url.pathname === '/templateDesigner/templateImport.cfm') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    lastImport = { contentType: req.headers['content-type'] || '', body: Buffer.concat(chunks) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ templateId: 60100, openUrl: 'https://x/y' })); return;
  }
  if (url.pathname === '/templateDesigner/templateDesigner.cfm') {
    /* A stub, so the popup lands on a real page and its URL can be read. */
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>Designer stub</title>'); return;
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

/* Pull the multipart part names, and the bytes of one named part. */
function parts(raw, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  const b = '--' + (m[1] || m[2]).trim();
  const body = raw.toString('latin1');
  const out = [];
  body.split(b).forEach((seg) => {
    const nm = /name="([^"]+)"/.exec(seg);
    if (!nm) return;
    const head = seg.indexOf('\r\n\r\n');
    out.push({ name: nm[1], body: seg.slice(head + 4).replace(/\r\n$/, '') });
  });
  return out;
}

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const ctx = await br.newContext();
const page = await ctx.newPage();
const BASE = `http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`;

console.log('1  CCA passes product + site; the Generator keeps both');
await page.goto(BASE + `?product=8914&site=${SITE}&mode=live&orientation=landscape`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.get && window.SMPProductSelection.get() !== null,
  null, { timeout: 20000 });
const live = await page.evaluate(() => {
  const s = window.SMPProductSelection;
  const act = document.querySelector('.orient-btn.active');
  return { id: (s.get() || {}).id, liveId: s.liveProductId(), siteId: s.liveSiteId(),
    orientation: act && act.dataset.orientation };
});
is(live.liveId === 8914 && live.id === 8914, 'product 8914 still resolves live', String(live.id));
is(live.siteId === SITE, 'the numeric site id is held for the session', String(live.siteId));
is(live.orientation === 'landscape', 'orientation=landscape survives', String(live.orientation));

console.log('\n2  the push carries a page proof, and the Designer URL carries the site');
const pushed = await page.evaluate(async () => {
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}'
    + '.card{position:relative;width:360px;height:216px;background:#123a5e;font-family:Arial}'
    + '.n{position:absolute;left:24px;top:30px;color:#fff;font-size:22px;font-weight:700}'
    + '.t{position:absolute;left:24px;top:120px;color:#e8d9b0;font-size:12px}</style></head>'
    + '<body><div class="card"><div class="n">Lakeside Clinic</div>'
    + '<div class="t">555-0100</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  const { template } = await window.SMPPush.convertCurrentDesign();
  const built = await window.SMPTransportImport.buildRequest(template,
    window.SMPProductSelection.get(), {});
  return {
    pageCount: template.pages.length,
    proofsOnTemplate: (template.pageProofs || []).map((p) => ({ n: p.pageNumber, has: !!p.dataUri })),
    builtProofs: (built.proofs || []).map((p) => ({ n: p.pageNumber, bytes: p.bytes.length })),
    proofSizes: await Promise.all((template.pageProofs || []).map(async (p) => {
      if (!p.dataUri) return null;
      const im = new Image(); im.src = p.dataUri; await im.decode();
      return im.naturalWidth + 'x' + im.naturalHeight;
    })),
  };
});
is(pushed.pageCount === 2, 'the two-page product produced two pages', String(pushed.pageCount));
is(pushed.proofsOnTemplate[0] && pushed.proofsOnTemplate[0].has === true,
   'page 0 rendered a proof', JSON.stringify(pushed.proofsOnTemplate));
is(pushed.builtProofs.length >= 1 && pushed.builtProofs[0].bytes > 1000,
   'the request carries real proof bytes', JSON.stringify(pushed.builtProofs));
/* This design has only a front; the Generator synthesizes page 2 from its
 * background. CCA's chooser draws a two-page template's back from page 2's
 * thumbnail, so that page must carry a proof too. */
is(pushed.proofsOnTemplate[1] && pushed.proofsOnTemplate[1].has === true
   && pushed.builtProofs.some((p) => p.n === 1 && p.bytes > 1000),
   'the synthesized back page carries its own proof as well', JSON.stringify(pushed.builtProofs));
is(pushed.proofSizes[1] && pushed.proofSizes[1] === pushed.proofSizes[0],
   'and it is the same size as the front proof', JSON.stringify(pushed.proofSizes));

/* The real button, so the real multipart body and the real redirect are seen. */
const popupP = ctx.waitForEvent('page', { timeout: 30000 });
await page.evaluate(() => { if (typeof showPanel === 'function') showPanel('result'); });
await page.click('#pushToDesignerBtn');
const designer = await popupP;
const designerUrl = designer.url();
await designer.close().catch(() => {});

const pnames = parts(lastImport.body, lastImport.contentType).map((p) => p.name);
console.log('     parts: ' + pnames.join(', '));
is(pnames.includes('proof_0'), 'the multipart body contains proof_0', pnames.join(', '));
is(pnames.includes('proof_1'), 'and proof_1 for the back page', pnames.join(', '));
const proof0 = parts(lastImport.body, lastImport.contentType).find((p) => p.name === 'proof_0');
is(proof0 && proof0.body.slice(0, 8) === '\x89PNG\r\n\x1a\n',
   'and proof_0 really is a PNG (magic bytes)', proof0 ? proof0.body.slice(1, 4) : 'missing');
is(pnames.includes('manifest'), 'the existing manifest part is unchanged');

console.log('\n3  the final Designer URL carries template, product AND site');
console.log('     ' + designerUrl);
const q = new URL(designerUrl).searchParams;
is(q.get('template') === '60100', 'template id from the server', q.get('template'));
is(q.get('product') === '8914', 'CCA\'s product id', q.get('product'));
is(q.get('site') === String(SITE), 'CCA\'s site id', q.get('site'));

console.log('\n4  no site parameter: behaviour is exactly as before');
lastImport = null;
await page.goto(BASE + '?product=8914&mode=live&orientation=landscape', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.get && window.SMPProductSelection.get() !== null, null, { timeout: 20000 });
const noSite = await page.evaluate(async () => {
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}'
    + '.card{position:relative;width:360px;height:216px;background:#222;font-family:Arial}'
    + '.n{position:absolute;left:24px;top:30px;color:#fff;font-size:22px}</style></head>'
    + '<body><div class="card"><div class="n">No Site</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  if (typeof showPanel === 'function') showPanel('result');
  return window.SMPProductSelection.liveSiteId();
});
is(noSite === null, 'no site id is held', String(noSite));
const popup2 = ctx.waitForEvent('page', { timeout: 30000 });
await page.click('#pushToDesignerBtn');
const d2 = await popup2;
const u2 = new URL(d2.url());
await d2.close().catch(() => {});
is(!u2.searchParams.has('site'), 'and the Designer URL has no site parameter', d2.url());
is(u2.searchParams.get('product') === '8914', 'the product is still carried', u2.searchParams.get('product'));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
