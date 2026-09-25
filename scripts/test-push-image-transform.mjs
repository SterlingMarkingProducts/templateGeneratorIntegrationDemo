/* Rotated and mirrored images reach the Designer where, and how, the browser drew them.
 *
 * Recreated references rebuild plant artwork from library files, turned and
 * mirrored to match (two sprigs in opposite corners). Extraction used to hand
 * Fabric a rotated image's enlarged bounding box, and read a CSS mirror
 * (scaleX(-1)) as a 180-degree turn, so it arrived upside down.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8963;
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
const F = 'assets/design-library/02_Soft_Green_Foliage_Spray.png';   // 1024x1536: exactly 40x60
const objs = await page.evaluate(async (F) => {
  const box = 'position:absolute;width:40px;height:60px;';
  generatedHtml = '<!DOCTYPE html><html><head><style>body{margin:0}.card{position:relative;width:360px;height:216px;background:#f6e4e1;font-family:Georgia}</style></head><body><div class="card">'
   + '<img id="plain" src="' + F + '" style="' + box + 'left:10px;top:10px;object-fit:contain">'
   + '<img id="rot" src="' + F + '" style="' + box + 'left:100px;top:20px;object-fit:contain;transform:rotate(30deg)">'
   + '<img id="flip" src="' + F + '" style="' + box + 'left:200px;top:20px;object-fit:contain;transform:scaleX(-1)">'
   + '<img id="fliprot" src="' + F + '" style="' + box + 'left:150px;top:120px;object-fit:contain;transform:scaleX(-1) rotate(-20deg)">'
   + '<div id="mask" style="' + box + 'left:290px;top:120px;background:#4a4a4a;-webkit-mask:url(' + F + ') center/contain no-repeat;mask:url(' + F + ') center/contain no-repeat;transform:rotate(180deg)"></div>'
   + '<svg id="svg" viewBox="0 0 40 60" style="' + box + 'left:40px;top:120px;transform:rotate(90deg)"><rect width="40" height="60" fill="#333"/></svg>'
   + '<div style="position:absolute;left:60px;top:190px;font-size:14px">Olivia</div></div></body></html>';
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  const { template } = await window.SMPPush.convertCurrentDesign();
  const cd = template.pages[0].canvasData;
  const list = (typeof cd === 'string' ? JSON.parse(cd) : cd).objects.filter((o) => o.type === 'image' && o.sterlingType !== 'backgroundArt');
  return list.map((o) => {
    const w = o.width * o.scaleX, h = o.height * o.scaleY, t = o.angle * Math.PI / 180;
    return { kind: o.sterlingAssetKind, vec: o.sterlingType === 'vectorArt', w: Math.round(w), h: Math.round(h), angle: o.angle, flipX: !!o.flipX,
      /* the centre Fabric will draw it at (origin left/top, rotating about that corner) */
      cx: Math.round(o.left + (w / 2) * Math.cos(t) - (h / 2) * Math.sin(t)),
      cy: Math.round(o.top + (w / 2) * Math.sin(t) + (h / 2) * Math.cos(t)) };
  });
}, F);
console.log('     ' + JSON.stringify(objs));
const B = 12;   // bleed: the trim-authored card lands 12 units in
const find = (cx, cy) => objs.find((o) => Math.abs(o.cx - cx) <= 1 && Math.abs(o.cy - cy) <= 1);
const plain = find(10 + 20 + B, 10 + 30 + B), rot = find(100 + 20 + B, 20 + 30 + B), flip = find(200 + 20 + B, 20 + 30 + B);
const fr = find(150 + 20 + B, 120 + 30 + B), mask = find(290 + 20 + B, 120 + 30 + B), svg = find(40 + 20 + B, 120 + 30 + B);
is(plain && plain.w === 40 && plain.h === 60 && plain.angle === 0 && !plain.flipX, 'an untransformed image is unchanged', JSON.stringify(plain));
is(rot && rot.w === 40 && rot.h === 60 && rot.angle === 30 && !rot.flipX,
   'a rotated image keeps its own size and angle, centred where it was drawn (not its enlarged bounding box)', JSON.stringify(rot));
is(flip && flip.flipX && flip.angle === 0 && flip.w === 40, 'a mirrored image is MIRRORED, not turned upside down', JSON.stringify(flip));
is(fr && fr.flipX && Math.abs(fr.angle - 20) < 0.5, 'mirror + rotation decompose into flipX and the matching angle', JSON.stringify(fr));
is(mask && mask.angle === 180 && mask.w === 40 && mask.h === 60, 'a recoloured (mask) mark rotates about its own centre', JSON.stringify(mask));
is(svg && svg.vec && svg.angle === 90 && svg.w === 40 && svg.h === 60, 'an inline SVG rotated 90° keeps 40x60 at 90°', JSON.stringify(svg));
await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
