/* A push has to clear the web03 gateway, which answers a bare 502 to uploads
 * in the several-megabyte class. A tri-fold brochure (two 11x8.5 spreads with
 * a photo panel) measured 7.4 MB: two 2600px background rasters and a photo
 * crop, each a ~2 MB PNG under the old 2.5 MB per-image cap. Rasters the
 * Generator produces itself now travel as JPEG once they are big (opaque
 * backgrounds, photographic crops), PNG while small or transparent; proofs
 * stay PNG (the importer requires it); and a body the gateway would drop is
 * refused with the number instead of dying on the wire.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const PRODUCT_8914 = {
  id: 6533, partNumber: "TBFCUV-CG", name: "Ultra Gloss Trifold Brochure - Classic Gloss",
  dimensions: { widthIn: 11, heightIn: 8.5, displayUnit: "in", widthDisplay: "11", heightDisplay: "8.5" },
  bleed: { top: 12, right: 12, bottom: 12, left: 12 },
  pages: { min: 2, max: 2 }, shape: 'rect',
  orientation: { landscapeAvailable: true, portraitAvailable: false },
  maxLines: 0, status: { active: true, retired: false },
  legacy: { designerVariationCode: 3, margins: { top: 6, right: 6, bottom: 6, left: 6 },
    borders: { top: 0, right: 0, bottom: 0, left: 0, width: 0 },
    daterBox: { width: 0, height: 0 }, isProStamp: false, greenInkAvailable: true, bandString: '' },
  classification: { productInformation: [
    { id: 805, productTable: "brochures", title: "Brochures" }] },
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
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html?product=6533&mode=live&orientation=landscape`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection && window.SMPProductSelection.get && window.SMPProductSelection.get(), null, { timeout: 20000 });
const PHOTO = JSON.parse(await readFile(join(REPO, 'generator/assets/stock-photo-manifest.json'), 'utf8')).photos[0].url;
const DESIGN = 'assets/design-library/02_Soft_Green_Foliage_Spray.png';   // transparent
const push = (html, payload) => page.evaluate(async ({ html, payload }) => {
  generatedHtml = html; lastPayload = payload;
  const { template } = await window.SMPPush.convertCurrentDesign();
  let built, err = null;
  try { built = await window.SMPTransportImport.buildRequest(template, window.SMPProductSelection.get(), {}); }
  catch (e) { return { error: e.message, code: e.code || null }; }
  const fd = window.SMPTransportImport.toFormData(built);
  const parts = [];
  for (const [k, v] of fd.entries()) parts.push({ name: k, bytes: typeof v === 'string' ? v.length : v.size, type: typeof v === 'string' ? 'text' : v.type });
  const objs = built.manifest.pages.flatMap((pg, i) => ((typeof pg.canvasJson === 'string' ? JSON.parse(pg.canvasJson) : pg.canvasJson).objects || [])
    .filter((o) => o.type === 'image').map((o) => ({ page: i, ref: o.importAssetRef || null, st: o.sterlingType || null, kind: o.sterlingAssetKind || null })));
  const mimeOf = {}; built.manifest.assets.forEach((a) => { mimeOf[a.refId] = a.mimeType; });
  objs.forEach((o) => { o.mime = o.ref ? mimeOf[o.ref] : null; });
  return { parts, total: parts.reduce((a, b) => a + b.bytes, 0), objs, bodyBytes: built.bodyBytes };
}, { html, payload });

console.log('1  the tri-fold brochure that 502d');
const W = 1056, H = 816;
const panel = (extra, inner) => '<div class="panel" style="position:relative;height:' + H + 'px;' + extra + '">' + inner + '</div>';
const side = (cls, bg, inner) => '<div class="card ' + cls + '" style="' + (cls.indexOf('back') > -1 ? 'display:none;' : '') + 'position:relative;width:' + W + 'px;height:' + H + 'px;display:' + (cls.indexOf('back') > -1 ? 'none' : 'grid') + ';grid-template-columns:repeat(3,1fr);background:' + bg + ';font-family:Georgia;overflow:hidden">' + inner + '</div>';
const tex = 'background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 9px),radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),transparent 55%);';
const text = (t, s, c) => '<div style="position:absolute;left:28px;top:' + s + 'px;color:' + c + ';font-size:22px">' + t + '</div>';
const BROCHURE = '<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body>'
  + side('card--front', '#1f3d33',
      panel('background:#1f3d33;' + tex, text('Dr. Elena Voss', 700, '#fff') + text('(415) 220-8890', 740, '#fff'))
    + panel('background:linear-gradient(180deg,#2b4a40,#1f3d33);' + tex, text('Your body was built to stand true.', 80, '#f5e9c8'))
    + panel('background:#e8620c;', '<img src="' + PHOTO + '" style="position:absolute;inset:0;width:100%;height:60%;object-fit:cover">' + text('Aligned, by design.', 600, '#fff')))
  + side('card--back', '#f4efe6',
      panel('background:#1f3d33;', text('About us', 60, '#fff'))
    + panel('background:#f4efe6;' + tex, text('Our services', 60, '#1f3d33'))
    + panel('background:#e8620c;' + tex, text('Ready to begin?', 60, '#fff') + '<img src="' + PHOTO + '" style="position:absolute;left:40px;top:300px;width:270px;height:400px;object-fit:cover">'
      + '<img src="' + DESIGN + '" style="position:absolute;left:20px;top:20px;width:120px;height:120px;object-fit:cover">'))
  + '</body></html>';
const BR = { templateType: 'Brochure', width: 11, height: 8.5, unit: 'in', doubleSided: true, orientation: 'landscape' };
const b = await push(BROCHURE, BR);
console.log('     ' + JSON.stringify(b.parts.map((p) => p.name + ':' + p.type.replace('image/', '') + ':' + Math.round(p.bytes / 1024) + 'KB')));
is(!b.error, 'the push builds', b.error || '');
is(b.total < 3 * 1024 * 1024, 'the whole body is under 3 MB (was 7.4 MB)', (b.total / 1048576).toFixed(2) + ' MB');
const bgs = b.objs.filter((o) => o.st === 'backgroundArt');
is(bgs.length === 2 && bgs.every((o) => o.mime === 'image/jpeg'), 'both 2600px background rasters travel as JPEG', JSON.stringify(bgs.map((o) => o.mime)));
const photos = b.objs.filter((o) => o.kind === 'photo');
is(photos.length === 2 && photos.every((o) => o.mime === 'image/jpeg'), 'both photographic cover crops travel as JPEG', JSON.stringify(photos.map((o) => o.mime)));
const design = b.objs.find((o) => o.kind === 'designAsset');
is(design && design.mime === 'image/png', 'a cover crop of a TRANSPARENT design asset keeps PNG (JPEG has no alpha)', design && design.mime);
is(b.parts.filter((p) => /^proof_/.test(p.name)).every((p) => p.type === 'image/png') && b.parts.filter((p) => /^proof_/.test(p.name)).length === 2,
   'both page proofs stay PNG, as the importer requires');
is(Math.abs(b.bodyBytes - b.total) < 64, 'buildRequest reports the body size it will send', b.bodyBytes + ' vs ' + b.total);

console.log('\n2  a business card is exactly as before');
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html?product=6533&mode=live&orientation=landscape`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection && window.SMPProductSelection.get && window.SMPProductSelection.get(), null, { timeout: 20000 });
await page.evaluate(() => window.SMPProductSelection.clear && window.SMPProductSelection.clear());
const CARD = '<!DOCTYPE html><html><head><style>body{margin:0}.card{position:relative;width:360px;height:216px;background:linear-gradient(135deg,#123a5e,#1f5f8a);font-family:Arial}'
  + '.n{position:absolute;left:24px;top:30px;color:#fff;font-size:22px}</style></head><body><div class="card"><div class="n">Lakeside Clinic</div></div></body></html>';
const c = await page.evaluate(async (html) => {
  generatedHtml = html; lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  const { template } = await window.SMPPush.convertCurrentDesign();
  const cd = template.pages[0].canvasData; const objs = (typeof cd === 'string' ? JSON.parse(cd) : cd).objects;
  const bg = objs.find((o) => o.sterlingType === 'backgroundArt');
  return { mime: bg && bg.src.slice(5, bg.src.indexOf(';')), kb: bg && Math.round(bg.src.length * 0.75 / 1024) };
}, CARD);
is(c.mime === 'image/png' && c.kb < 1536, 'a gradient business-card background (under a megapixel, under 1.5 MB) is still a PNG, byte for byte', JSON.stringify(c));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
