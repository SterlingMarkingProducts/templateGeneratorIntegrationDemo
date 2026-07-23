/* End-to-end screenshot: load the Business card sample, push to designer,
 * capture the designer canvas. Proves the bleed + wrap fixes visually. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png' };
const srv = await new Promise(r => { const s = http.createServer(async (req,res)=>{
  const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html');
  try { const b = await readFile(file); res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream'}); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
}); s.listen(0,'127.0.0.1',()=>r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true });
const ctx = await browser.newContext({ viewport:{ width:1400, height:900 } });
const page = await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));

await page.goto(`${base}/generator/index.html`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1500);
// click the first "Load sample" button (Business card)
await page.getByRole('button', { name:/Load sample: Business card/i }).click();
await page.waitForTimeout(2500);
// screenshot the preview
await page.screenshot({ path: join(ROOT,'scripts/_shot_gen.png') });

// Push opens the designer in a popup (window.open). Catch it.
const popupP = ctx.waitForEvent('page', { timeout: 20000 });
await page.getByRole('button', { name:/Push to Designer/i }).click();
const designer = await popupP;
await designer.waitForLoadState('domcontentloaded');
designer.on('pageerror', e=>errors.push('designer:'+e.message));
await designer.waitForTimeout(9000);
console.log('designer url:', designer.url());

// inspect designer state
const st = await designer.evaluate(()=>{
  const cp = (typeof canvasProperties!=='undefined'&&canvasProperties)||{};
  const objs = (typeof currentCanvas!=='undefined'&&currentCanvas)?currentCanvas.getObjects():[];
  return {
    canvas:[Math.round(cp.width),Math.round(cp.height)],
    bleed:[cp.bleedTop,cp.bleedRight,cp.bleedBottom,cp.bleedLeft],
    total:objs.length,
    types:objs.map(o=>o.type),
    texts:objs.filter(o=>o.type==='i-text'||o.type==='textbox').map(o=>({t:(o.text||'').slice(0,40),left:Math.round(o.left),top:Math.round(o.top),fs:Math.round(o.fontSize)})),
    imgs:objs.filter(o=>o.type==='image').map(o=>({left:Math.round(o.left),top:Math.round(o.top),w:Math.round((o.width||0)*(o.scaleX||1)),h:Math.round((o.height||0)*(o.scaleY||1))})),
  };
});
console.log('DESIGNER', JSON.stringify(st,null,1));

// fit-to-view then screenshot the designer
try { await designer.evaluate(()=>{ if(typeof zoomFit==='function') zoomFit(); }); } catch{}
await designer.waitForTimeout(1200);
await designer.screenshot({ path: join(ROOT,"scripts/_shot_designer.png") });
console.log('page errors:', errors.slice(0,6));
await browser.close(); srv.close();
