/* Verify the design-photo upload: embeds as a data: URI (no backend), keeps full
 * resolution for large-format products, compresses only small ones, and swaps
 * the AI sentinel URL for the real image. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png' };
const srv = await new Promise(r => { const s = http.createServer(async (rq,rs)=>{
  const f = join(ROOT, decodeURIComponent(rq.url.split('?')[0]).replace(/^\//,'')||'index.html');
  try { const b = await readFile(f); rs.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream'}); rs.end(b); }
  catch { rs.writeHead(404); rs.end('nf'); }
}); s.listen(0,'127.0.0.1',()=>r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true });
const page = await (await browser.newContext({ viewport:{width:1400,height:900} })).newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let pass=0, fail=0;
const check=(n,c,d='')=>{ (c?pass++:fail++); console.log(`${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };

await page.goto(`${base}/generator/index.html`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

// Build a 2000x1500 PNG in-page and hand it to the file input as a File.
async function uploadTestPhoto() {
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width=2000; c.height=1500;
    const x = c.getContext('2d'); x.fillStyle='#3366cc'; x.fillRect(0,0,2000,1500);
    x.fillStyle='#ffcc00'; x.fillRect(200,200,600,600);
    const blob = await new Promise(r => c.toBlob(r,'image/png'));
    const file = new File([blob], 'photo.png', { type:'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById('designPhotoFile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await page.waitForTimeout(600);
}

function dataUrlDims(page) {
  return page.evaluate(() => new Promise(res => {
    const d = window.SMPGen.photo.data;
    if (!d) return res(null);
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight, isJpeg: d.startsWith('data:image/jpeg'), isPng: d.startsWith('data:image/png'), bytes: Math.round(d.length*0.75) });
    img.onerror = () => res(null);
    img.src = d;
  }));
}

// 1) Business Card (small format) → compressed to <=1600px JPEG
await page.selectOption('#templateType', 'Business Card');
await uploadTestPhoto();
const bc = await dataUrlDims(page);
check('Small format: photo embedded as data URI', !!bc, JSON.stringify(bc));
check('Small format: downscaled to <=1600px + JPEG', bc && Math.max(bc.w,bc.h)<=1600 && bc.isJpeg);
check('Small format: image-URL field cleared', (await page.inputValue('#imageUrl'))==='' );
check('Small format: preview shown', await page.isVisible('#designPhotoPreview'));

// 2) Switch to Sign (large format) → full resolution kept (2000px, original PNG)
await page.selectOption('#templateType', 'Sign');
await page.waitForTimeout(500);
const sign = await dataUrlDims(page);
check('Large format: full resolution kept (2000px)', sign && Math.max(sign.w,sign.h)===2000, JSON.stringify(sign));
check('Large format: original format preserved (PNG)', sign && sign.isPng);

// 3) Sentinel swap: AI-produced HTML with the sentinel URL → data URI embedded
const swapped = await page.evaluate(() => {
  const html = '<!DOCTYPE html><html><head><style>.card{width:1152px;height:1536px}</style></head><body><div class="card"><img src="'+window.SMPGen.photo.sentinel+'"></div></body></html>';
  const out = window.SMPGen.renderPreviewHtml(html, { templateType:'Sign', width:12, height:16, unit:'in' });
  return { hasSentinel: out.includes(window.SMPGen.photo.sentinel), hasDataImg: /<img src="data:image\//.test(out) };
});
check('Sentinel URL is swapped for the data URI', !swapped.hasSentinel && swapped.hasDataImg, JSON.stringify(swapped));

// 4) Clear removes the photo
await page.click('#designPhotoClear');
await page.waitForTimeout(200);
check('Clear removes the photo', (await page.evaluate(()=>window.SMPGen.photo.data))===null && !(await page.isVisible('#designPhotoPreview')));

console.log('page errors:', errors.slice(0,5));
console.log(`\n${pass}/${pass+fail} checks passed`);
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
