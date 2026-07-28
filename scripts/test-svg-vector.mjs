/* Verify inline SVG artwork is carried as a crisp vector (SVG data URI) image
 * object — not rasterized — and lands as a movable object in the designer. */
import http from 'node:http';import {readFile} from 'node:fs/promises';import {extname,join} from 'node:path';import {chromium} from 'playwright-core';
const ROOT=new URL('..',import.meta.url).pathname;const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=await new Promise(r=>{const s=http.createServer(async(rq,rs)=>{const f=join(ROOT,decodeURIComponent(rq.url.split('?')[0]).replace(/^\//,'')||'index.html');try{const b=await readFile(f);rs.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream'});rs.end(b);}catch{rs.writeHead(404);rs.end('nf');}});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${srv.address().port}`;const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
const ctx=await br.newContext({viewport:{width:1400,height:900}});const page=await ctx.newPage();
let pass=0,fail=0;const check=(n,c,d='')=>{(c?pass++:fail++);console.log(`${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);};
await page.goto(`${base}/generator/index.html`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1000);
const html='<!DOCTYPE html><html><head><style>html,body{margin:0}.card{position:relative;width:336px;height:192px;background:#1a2a4f;overflow:hidden;font-family:Arial}.logo{position:absolute;left:20px;top:20px}.n{position:absolute;left:20px;top:120px;color:#fff;font-size:18px}</style></head><body><div class="card"><svg class="logo" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="#3aa5b0" stroke-width="4"/><path d="M14 26 q10 12 20 0" fill="none" stroke="#3aa5b0" stroke-width="4"/></svg><div class="n">BrightSmile</div></div></body></html>';
await page.setInputFiles('#uploadDesignInput',{name:'card.html',mimeType:'text/html',buffer:Buffer.from(html)});
await page.waitForTimeout(2500);
const conv=await page.evaluate(async()=>{const {template}=await window.SMPPush.convertCurrentDesign();const o=template.pages[0].canvasData.objects;const svgImg=o.find(x=>x.type==='image'&&x.sterlingType==='vectorArt');const bg=o.find(x=>x.type==='image'&&x.sterlingType!=='vectorArt');return {types:o.map(x=>x.type+(x.sterlingType?':'+x.sterlingType:'')),hasVector:!!svgImg,vectorSrcPrefix:svgImg?svgImg.src.slice(0,24):null,vectorSvgDecoded:svgImg?atob(svgImg.src.split(',')[1]).slice(0,40):null};});
console.log('convert:',JSON.stringify(conv));
check('SVG logo becomes a vectorArt image (data:image/svg+xml)',conv.hasVector&&(conv.vectorSrcPrefix||'').startsWith('data:image/svg+xml'));
check('vector image contains real SVG markup',/<svg/.test(conv.vectorSvgDecoded||''));
// push and verify movable in designer
const popupP=ctx.waitForEvent('page',{timeout:20000});
await page.getByRole('button',{name:/Push to Designer/i}).click();
const d=await popupP;await d.waitForLoadState('domcontentloaded');await d.waitForTimeout(9000);
const des=await d.evaluate(()=>{const cv=currentCanvas;const imgs=cv.getObjects().filter(o=>o.type==='image');return {imgCount:imgs.length,anySelectable:imgs.some(o=>o.selectable!==false),srcs:imgs.map(o=>(o.getSrc?o.getSrc():o.src||'').slice(0,24))};});
console.log('designer:',JSON.stringify(des));
check('SVG image present & selectable in designer',des.imgCount>=1&&des.anySelectable);
console.log(`\n${pass}/${pass+fail} checks passed`);
await br.close();srv.close();process.exit(fail?1:0);
