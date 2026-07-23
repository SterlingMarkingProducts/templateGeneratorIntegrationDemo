/* Regression test: a double-sided (2-page) pushed design must load as exactly
 * two canvases in the real designer copy — front then back — with no leftover
 * blank page and no duplicated content. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = await new Promise(r => { const s = http.createServer(async (req, res) => {
  const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  try { const b = await readFile(file); res.writeHead(200, {'Content-Type': MIME[extname(file)]||'application/octet-stream'}); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}); s.listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const page = await (await browser.newContext()).newPage();
const mkPage = (n, txt) => ({ page: n, canvasProperties: {}, canvasData: { version: '4.4.0', objects: [
  { type: 'i-text', sterlingType: 'textObject', version: '4.4.0', originX:'left', originY:'top', left: 30, top: 40, width: 200, text: txt, fontSize: 20, fontFamily: 'Arial', fontWeight:'normal', fontStyle:'normal', textAlign:'left', fill:'#111', lineHeight:1.16, charSpacing:0, scaleX:1, scaleY:1, angle:0 },
]}});
const cp = { width: 336, height: 192, dpi: 96, shape:'rect', angle:0, designerVariationCode:'FullColour', bleedTop:12,bleedRight:12,bleedBottom:12,bleedLeft:12,bleedMargin:0, borderTop:0,borderRight:0,borderBottom:0,borderLeft:0,borderWidth:0, marginTop:6,marginRight:6,marginBottom:6,marginLeft:6, sideBorder:0,topBorder:0,sideMargin:6,topMargin:6, daterBoxHeight:0,daterBoxWidth:0,maxLines:0,drawFullBorder:false,greenInkAvailable:false,isProstamp:false, materialColour:'',productNumber:'',productNumberVariation:'', sourceApplication:'templateGenerator' };
const transfer = { id:'tg-2p', format:'sterling-template-1.2', source:'templateGenerator', created:Date.now(), expires:Date.now()+1800000,
  design: { templateNumber:0, templateKey:'TG', version:1.2, canvasProperties: cp, productList:[], pages:[ mkPage(0,'FRONT SIDE'), mkPage(1,'BACK SIDE') ] } };
await page.goto(`${base}/realdesigner/index.html`);
await page.evaluate(t => localStorage.setItem('smpDesignTransfer:'+t.id, JSON.stringify(t)), transfer);
await page.goto(`${base}/realdesigner/index.html?transfer=tg-2p`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(7000);
const res = await page.evaluate(() => ({
  canvases: typeof canvases !== 'undefined' ? canvases.length : -1,
  pageTexts: (typeof canvases !== 'undefined' ? canvases : []).map(c => c.getObjects().filter(o=>o.type==='i-text').map(o=>o.text).join('|')),
  minPages: typeof productInfo !== 'undefined' && productInfo ? productInfo.MINPAGES : '?',
}));
const pass = res.canvases === 2 && res.pageTexts[0] === 'FRONT SIDE' && res.pageTexts[1] === 'BACK SIDE';
console.log((pass ? 'PASS' : 'FAIL') + ' 2-page transfer loads exactly 2 canvases (front+back) — ' + JSON.stringify(res));
await browser.close(); srv.close();
process.exit(pass ? 0 : 1);
