/* HTML Download -> Upload Design round-trip: the export is the INTRINSIC
   design plus a machine-readable Sterling identity block; uploading it
   restores the real product first and reproduces the exact geometry. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8895;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CAT_SRC = await readFile(new URL('./test-product-type.mjs', import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ') + 18,
  CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const ENDPOINT = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === ENDPOINT) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(CATALOGUE)); return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    if ((await stat(file)).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });

/* Simulate the real post-generation state for the SELECTED product: raw AI
   html goes through renderPreviewHtml (which bakes the preview layers into
   generatedHtml, as the live flow does), then export via prepareDownloadHtml. */
const makeExport = (part, payload, rawHtml) => page.evaluate(async ([part, payload, rawHtml]) => {
  await window.SMPProductSelection.selectByPartNumber(part);
  await new Promise((r) => setTimeout(r, 150));
  lastPayload = payload;
  generatedHtml = window.SMPGen.renderPreviewHtml(rawHtml, payload);
  return {
    export: prepareDownloadHtml(generatedHtml, payload.doubleSided, payload.templateType),
    decorated: /id="layout-safety"/.test(generatedHtml),
  };
}, [part, payload, rawHtml]);

const CARD_RAW = `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:360px;height:216px;background:#123a5e;overflow:hidden}
  .card--front{}
  .name{position:absolute;left:30px;top:80px;font:700 34px Arial;color:#fff}</style></head>
  <body><div class="card card--front"><div class="name">Camille Rousseau</div></div>
  <div class="card card--back" style="display:none"><div class="name">Back</div></div></body></html>`;
const cardPayload = { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in',
  doubleSided: true, businessName: 'Camille', orientation: 'landscape' };

console.log('\n1  the export is intrinsic + identified');
const cardExp = await makeExport('BCDP-CM', cardPayload, CARD_RAW);
is(cardExp.decorated, 'the in-app generatedHtml really carries the preview layers (the bug\'s raw material)');
is(!/id="layout-safety"/.test(cardExp.export) && !/layout-safety-script/.test(cardExp.export)
   && !/translate\(-50%,-50%\) scale\(/.test(cardExp.export),
   'the DOWNLOAD carries none of them — no trim body box, no cover scale, no fit scripts');
const metaM = /<script[^>]*id="sterling-template-metadata"[^>]*>([\s\S]*?)<\/script>/.exec(cardExp.export);
is(!!metaM, 'a sterling-template-metadata block is embedded');
const meta = JSON.parse(metaM[1]);
is(meta.schemaVersion === 1 && meta.partNumber === 'BCDP-CM' && meta.productId === 6505,
   'identifying the REAL selected product', meta.partNumber + ' / ' + meta.productId);
is(meta.trimWidthPx === 336 && meta.trimHeightPx === 192 && meta.bleedPx === 12
   && meta.canvasWidthPx === 360 && meta.canvasHeightPx === 216
   && meta.widthIn === 3.5 && meta.heightIn === 2 && meta.pages === 2,
   'with the full trim/bleed/canvas coordinate system', JSON.stringify({
     t: [meta.trimWidthPx, meta.trimHeightPx], c: [meta.canvasWidthPx, meta.canvasHeightPx] }));
is(/class="card card--back"(?![^>]*display:\s*none)/.test(cardExp.export)
   && /id="download-both-sides"/.test(cardExp.export),
   'both sides render in the portable file');

console.log('\n2  uploading restores the product FIRST, then the geometry');
const afterUpload = await page.evaluate(async (exportHtml) => {
  await window.SMPProductSelection.selectByPartNumber('DS21218');   // a 18x12 sign
  await new Promise((r) => setTimeout(r, 200));
  const before = window.SMPProductSelection.get().partNumber;
  const file = new File([exportHtml], 'business-card-design.html', { type: 'text/html' });
  await handleUploadedFile(file);
  await new Promise((r) => setTimeout(r, 800));
  const p = window.SMPProductSelection.get();
  const frame = document.getElementById('previewFrame');
  return {
    before, after: p && p.partNumber, id: p && p.id,
    templateType: document.getElementById('templateType').value,
    w: document.getElementById('dimWidth').value, h: document.getElementById('dimHeight').value,
    frameW: parseFloat(frame.style.width), frameH: parseFloat(frame.style.height),
    payload: { w: lastPayload.width, h: lastPayload.height, ds: lastPayload.doubleSided },
  };
}, cardExp.export);
is(afterUpload.before === 'DS21218' && afterUpload.after === 'BCDP-CM' && afterUpload.id === 6505,
   'a sign was selected; the upload switched back to BCDP-CM automatically',
   afterUpload.before + ' -> ' + afterUpload.after);
is(afterUpload.templateType === 'Business Card'
   && Number(afterUpload.w) === 3.5 && Number(afterUpload.h) === 2,
   'Template Type and dimensions restored', afterUpload.w + 'x' + afterUpload.h);
is(afterUpload.payload.ds === true, 'front/back page state restored');
/* Before the iframe's load event the frame holds the TRIM box; after it, the
   bleed canvas. Both are uniform, undistorted boxes for this design — the
   card-aspect assertion below is the actual distortion check. */
const fr = afterUpload.frameW / afterUpload.frameH;
is(Math.abs(fr - 360 / 216) < 0.01 || Math.abs(fr - 336 / 192) < 0.01,
   'the preview frame is one of the design\'s own uniform boxes — never a stretched one',
   afterUpload.frameW + 'x' + afterUpload.frameH);
const cardRect = await page.evaluate(() => new Promise((res) => {
  const f = document.getElementById('previewFrame');
  const read = () => {
    const el = f.contentDocument && f.contentDocument.querySelector('.card');
    if (!el) return res(null);
    const r = el.getBoundingClientRect();
    res({ w: r.width, h: r.height });
  };
  setTimeout(read, 700);
}));
is(!!cardRect && Math.abs(cardRect.w / cardRect.h - 360 / 216) < 0.02,
   'and the card itself renders at its authored aspect ratio',
   cardRect && (cardRect.w + 'x' + cardRect.h));

console.log('\n3  the same round-trip on a large-format product');
const SIGN_RAW = `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:1728px;height:1152px;background:#c45a1f}</style></head>
  <body><div class="card"></div></body></html>`;
const signExp = await makeExport('DS21218', { templateType: 'Sign', width: 18, height: 12,
  unit: 'in', doubleSided: false, orientation: 'landscape' }, SIGN_RAW);
const signMeta = JSON.parse(/<script[^>]*id="sterling-template-metadata"[^>]*>([\s\S]*?)<\/script>/.exec(signExp.export)[1]);
is(signMeta.partNumber === 'DS21218' && signMeta.trimWidthPx === 1728 && signMeta.bleedPx === 0,
   'the sign export identifies DS21218 with its own coordinate system');
const signBack = await page.evaluate(async (exportHtml) => {
  await window.SMPProductSelection.selectByPartNumber('BCDP-CM');
  await new Promise((r) => setTimeout(r, 200));
  await handleUploadedFile(new File([exportHtml], 'sign.html', { type: 'text/html' }));
  await new Promise((r) => setTimeout(r, 800));
  const p = window.SMPProductSelection.get();
  return { part: p && p.partNumber, type: document.getElementById('templateType').value,
    w: lastPayload.width, h: lastPayload.height };
}, signExp.export);
is(signBack.part === 'DS21218' && signBack.type === 'Sign'
   && signBack.w === 18 && signBack.h === 12,
   'uploading the sign HTML while on BCDP-CM switches to the sign', JSON.stringify(signBack));

console.log('\n4  an OLD export without metadata — and with baked preview layers');
const OLD_STYLE = await page.evaluate(([raw, payload]) =>
  window.SMPGen.renderPreviewHtml(raw, payload), [CARD_RAW, cardPayload]);
const oldResult = await page.evaluate(async (oldHtml) => {
  await window.SMPProductSelection.selectByPartNumber('DS21218');
  await new Promise((r) => setTimeout(r, 200));
  await handleUploadedFile(new File([oldHtml], 'legacy.html', { type: 'text/html' }));
  await new Promise((r) => setTimeout(r, 900));
  const frame = document.getElementById('previewFrame');
  return {
    toast: document.getElementById('errorMessage') ? document.getElementById('errorMessage').textContent : '',
    part: window.SMPProductSelection.get()?.partNumber || null,
    w: lastPayload.width, h: lastPayload.height,
    ratio: parseFloat(frame.style.width) / parseFloat(frame.style.height),
    stripped: !/id="layout-safety-script"/.test(generatedHtml),
  };
}, OLD_STYLE);
is(oldResult.stripped, 'its baked preview layers are stripped on upload — it cannot arrive pre-squished');
is(Math.abs(oldResult.ratio - (oldResult.w + 0.25) * 96 / ((oldResult.h + 0.25) * 96)) < 0.05
   || Math.abs(oldResult.ratio - oldResult.w / oldResult.h) < 0.05,
   'and it renders at ITS OWN measured aspect, not the selected product\'s',
   oldResult.w + 'x' + oldResult.h + ' ratio ' + oldResult.ratio.toFixed(3));
is(oldResult.w > 3 && oldResult.w < 4.1 && oldResult.h > 1.9 && oldResult.h < 2.4,
   'measured close to its authored size — never rewritten to the sign\'s 18x12',
   oldResult.w + 'x' + oldResult.h + ' toast: ' + oldResult.toast);

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
