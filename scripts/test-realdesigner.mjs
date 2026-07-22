/* Boot test for the static real-designer copy: serve repo, open page, verify
 * the genuine SMPdesigner UI initializes with mocked backend, then verify a
 * pushed transfer loads via parseTemplate as editable objects. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = await new Promise(r => { const s = http.createServer(async (req, res) => {
  const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  try { const b = await readFile(file); res.writeHead(200, {'Content-Type': MIME[extname(file)]||'application/octet-stream'}); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
}); s.listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const prodHits = [];
ctx.on('request', r => { try { if (/(^|\.)sterling\.ca$/i.test(new URL(r.url()).hostname)) prodHits.push(r.url()); } catch {} });

// 1. Plain boot (blank template)
await page.goto(`${base}/realdesigner/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const boot = await page.evaluate(() => ({
  hasParse: typeof parseTemplate === 'function',
  canvases: typeof canvases !== 'undefined' ? canvases.length : -1,
  currentCanvas: typeof currentCanvas !== 'undefined' && !!currentCanvas,
  canvasEls: document.querySelectorAll('canvas').length,
  fabricVer: (typeof fabric !== 'undefined' && fabric) ? fabric.version : null,
  banner: !!document.getElementById('demo-banner'),
}));
console.log('BOOT', JSON.stringify(boot));
console.log('page errors:', errors.slice(0, 5));

// 2. Inject a transfer and reload with ?transfer=
const transfer = {
  id: 'tg-test1', format: 'sterling-template-1.2', source: 'templateGenerator',
  created: Date.now(), expires: Date.now() + 1800000,
  design: {
    templateNumber: 0, templateKey: 'TG-TEST', version: 1.2,
    canvasProperties: { width: 336, height: 192, dpi: 96, shape: 'rect', angle: 0,
      designerVariationCode: 'FullColour', bleedTop: 12, bleedRight: 12, bleedBottom: 12, bleedLeft: 12, bleedMargin: 0,
      borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0, borderWidth: 0,
      marginTop: 6, marginRight: 6, marginBottom: 6, marginLeft: 6, sideBorder: 0, topBorder: 0, sideMargin: 6, topMargin: 6,
      daterBoxHeight: 0, daterBoxWidth: 0, maxLines: 0, drawFullBorder: false, greenInkAvailable: false, isProstamp: false,
      materialColour: '', productNumber: '', productNumberVariation: '', sourceApplication: 'templateGenerator' },
    productList: [],
    pages: [
      { page: 0, canvasProperties: {}, canvasData: { version: '4.4.0', objects: [
        { type: 'rect', version: '4.4.0', originX: 'left', originY: 'top', left: 0, top: 0, width: 336, height: 36, fill: '#123c5a', scaleX: 1, scaleY: 1, angle: 0 },
        { type: 'i-text', sterlingType: 'textObject', version: '4.4.0', originX: 'left', originY: 'top', left: 20, top: 56, width: 220, text: 'Avery Example', fontSize: 21, fontFamily: 'Goudy Old Style', fontWeight: 'bold', fontStyle: 'normal', textAlign: 'left', fill: '#123c5a', lineHeight: 1.16, charSpacing: 0, scaleX: 1, scaleY: 1, angle: 0 },
        { type: 'i-text', sterlingType: 'textObject', version: '4.4.0', originX: 'left', originY: 'top', left: 20, top: 140, width: 296, text: '555-0142 - avery@example.test', fontSize: 10, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', fill: '#333333', lineHeight: 1.4, charSpacing: 0, scaleX: 1, scaleY: 1, angle: 0 },
      ] } },
    ],
  },
};
await page.evaluate(t => localStorage.setItem('smpDesignTransfer:' + t.id, JSON.stringify(t)), transfer);
await page.goto(`${base}/realdesigner/index.html?transfer=tg-test1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const loaded = await page.evaluate(() => {
  const objs = (typeof currentCanvas !== 'undefined' && currentCanvas) ? currentCanvas.getObjects() : [];
  return {
    total: objs.length,
    types: objs.map(o => o.type),
    texts: objs.filter(o => o.type === 'i-text' || o.type === 'textbox').map(o => o.text),
    editable: objs.filter(o => o.type === 'i-text' || o.type === 'textbox').every(o => o.selectable !== false),
    placeholders: objs.filter(o => (o.type === 'i-text' || o.type === 'text') && /^(Enter Text|Texte ici)$/.test(o.text)).length,
    badge: !![...document.querySelectorAll('div')].find(d => d.textContent === 'Design imported from the Design Template Generator'),
    registeredText: (currentCanvas.textObjects || []).length,
    canvasDims: [currentCanvas.getWidth ? Math.round(canvasProperties.width) : 0, Math.round(canvasProperties.height)],
  };
});
console.log('TRANSFER', JSON.stringify(loaded));
// 3. A different product size: 12x16 sign transfer
const signTransfer = JSON.parse(JSON.stringify(transfer));
signTransfer.id = 'tg-sign1';
signTransfer.design.canvasProperties.width = 1152;
signTransfer.design.canvasProperties.height = 1536;
signTransfer.design.pages[0].canvasData.objects[1].text = 'GRAND OPENING';
await page.evaluate(t => localStorage.setItem('smpDesignTransfer:' + t.id, JSON.stringify(t)), signTransfer);
await page.goto(`${base}/realdesigner/index.html?transfer=tg-sign1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const sign = await page.evaluate(() => ({
  dims: [Math.round(canvasProperties.width), Math.round(canvasProperties.height)],
  texts: currentCanvas.getObjects().filter(o => o.type === 'i-text').map(o => o.text),
  registeredText: (currentCanvas.textObjects || []).length,
  partNumber: canvasProperties.customerPartNumber,
}));
console.log('SIGN', JSON.stringify(sign));
console.log('production requests:', prodHits.length, prodHits.slice(0,3));
console.log('page errors after transfer:', errors.slice(0, 8));
await browser.close(); srv.close();
