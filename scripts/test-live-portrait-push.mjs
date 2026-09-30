/* A VERTICAL design on a landscape product reaches the importer as PORTRAIT.
 *
 * Feedback: a business card designed vertically opened in the Template
 * Designer as a landscape canvas with the design squeezed into one side. The
 * importer now records such a page as turned (angle 90), which both Designer
 * engines read as a portrait canvas; this proves the Generator's half: the
 * orientation intent and the page geometry it sends are both portrait, and a
 * horizontal design still sends landscape.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8965;
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
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1', '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html?product=8914&mode=live&orientation=landscape`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection && window.SMPProductSelection.get && window.SMPProductSelection.get(), null, { timeout: 20000 });
const run = (orientation) => page.evaluate(async (orientation) => {
  const portrait = orientation === 'portrait';
  const W = portrait ? 216 : 360, H = portrait ? 360 : 216;
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}.card{position:relative;width:' + W + 'px;height:' + H + 'px;background:#f1ece2;font-family:Arial}'
    + '.n{position:absolute;left:20px;top:40px;font-size:22px;color:#1f5f4a}</style></head><body>'
    + '<div class="card card--front"><div class="n">Alana Rae\'s</div></div>'
    + '<div class="card card--back" style="display:none"><div class="n">Yoga Studio</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: portrait ? 2.25 : 3.75, height: portrait ? 3.75 : 2.25,
    unit: 'in', doubleSided: true, orientation };
  const { template } = await window.SMPPush.convertCurrentDesign();
  const built = await window.SMPTransportImport.buildRequest(template, window.SMPProductSelection.get(), {});
  const cd = (pg) => (typeof pg.canvasJson === 'string' ? JSON.parse(pg.canvasJson) : pg.canvasJson);
  return { intent: built.manifest.source.orientationRequested,
    cp: { w: template.canvasProperties.width, h: template.canvasProperties.height },
    pages: built.manifest.pages.length,
    textTop: (() => { const o = (cd(built.manifest.pages[0]).objects || []).find((x) => x.type === 'i-text' || x.type === 'textbox' || x.type === 'text'); return o ? Math.round(o.left) + ',' + Math.round(o.top) : null; })() };
}, orientation);
const v = await run('portrait');
console.log('     portrait: ' + JSON.stringify(v));
is(v.intent === 'portrait', 'a vertical design sends orientationRequested "portrait"', String(v.intent));
is(v.cp.w < v.cp.h, 'and portrait page geometry (taller than wide)', v.cp.w + 'x' + v.cp.h);
is(v.pages === 2, 'on both pages of the two-page product');
const h = await run('landscape');
console.log('     landscape: ' + JSON.stringify(h));
is(h.intent === 'landscape' && h.cp.w > h.cp.h, 'a horizontal design still sends landscape, with landscape geometry', h.intent + ' ' + h.cp.w + 'x' + h.cp.h);
await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
