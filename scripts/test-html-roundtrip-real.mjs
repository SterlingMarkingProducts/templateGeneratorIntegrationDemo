/* REAL-UI HTML round-trip test. No internals, no synthetic HTML:
 * real sample/product clicks, the REAL browser download produced by the
 * Download HTML button, and the REAL Upload Design file input.
 *
 *  A: BCDP-CM sample -> download -> switch product to a sign -> upload
 *     -> product restored BEFORE render, bounding boxes identical.
 *  B: DS21218 (sign) + Sign sample -> download -> switch to BCDP-CM -> upload
 *     -> product restored, boxes identical.
 *  C: metadata-less (old) file uploaded on a selected product -> current
 *     product and its locked dimension fields untouched, design loads at its
 *     own size with its aspect preserved, visible toast explains it.
 *
 * Requires the phase4c playwright install (scripts/../node_modules symlink). */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8899;
const TOL = 0.01; // normalized-box tolerance (rounding)
const TYPES = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const CAT_SRC = readFileSync(join(REPO,'scripts/test-product-type.mjs'),'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ')+18, CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const server = createServer(async (req,res)=>{
  const url = new URL(req.url,'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(CATALOGUE)); return; }
  if (url.pathname.indexOf(FOLDER)!==0){res.writeHead(404).end();return;}
  const f = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/,''));
  try { if((await stat(f)).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS ', name + (detail ? ' — ' + detail : '')); }
  else    { failed++; console.log('  FAIL ', name + (detail ? ' — ' + detail : '')); }
}

const dir = mkdtempSync(join(tmpdir(), 'rt-real-'));
const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const ctx = await br.newContext({ acceptDownloads: true, viewport:{width:1500,height:1000} });
const page = await ctx.newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0
  && window.SMPDemoSamples && window.SMPDemoSamples.all().length>0, null, {timeout:20000});
await page.waitForTimeout(400);
if (await page.$('#smpDevKeyDialog')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }

async function pickProduct(q){
  await page.fill('#productSearch', q);
  await page.waitForTimeout(600);
  await page.evaluate(()=>{ const b=document.querySelector('.sp-result'); if(b) b.click(); });
  await page.waitForTimeout(700);
  return page.evaluate(()=>window.SMPProductSelection.get()?.partNumber);
}
function snap(){ return page.evaluate(()=>{
  const f = document.getElementById('previewFrame');
  const doc = f.contentDocument;
  const card = doc && (doc.querySelector('.card, .design, .canvas, [class*="card"]') || doc.body.firstElementChild);
  const cr = card.getBoundingClientRect();
  const els = [...card.querySelectorAll('*')].filter(e=>{
    const r=e.getBoundingClientRect(); return r.width>8 && r.height>8; }).slice(0,25);
  return { part: window.SMPProductSelection.get()?.partNumber || null,
    dims: [document.getElementById('dimWidth').value, document.getElementById('dimHeight').value],
    card: [cr.width, cr.height],
    boxes: els.map(e=>{ const r=e.getBoundingClientRect(); return {
      k:(e.className||e.tagName).toString().slice(0,25),
      x:(r.left-cr.left)/cr.width, y:(r.top-cr.top)/cr.height,
      w:r.width/cr.width, h:r.height/cr.height }; }) };
}); }
function drift(a,b){ let worst=0; const n=Math.min(a.boxes.length,b.boxes.length);
  for(let i=0;i<n;i++) for(const k of ['x','y','w','h']) worst=Math.max(worst,Math.abs(a.boxes[i][k]-b.boxes[i][k]));
  return worst; }
async function realDownload(saveTo){
  const [ dl ] = await Promise.all([ page.waitForEvent('download'), page.click('#downloadHtmlBtn') ]);
  await dl.saveAs(saveTo);
  return readFileSync(saveTo,'utf8');
}

// ---- A ----
console.log('A: business card round trip');
await page.evaluate(()=>[...document.querySelectorAll('button')]
  .find(b=>b.textContent.trim().indexOf('Load sample: Axiom')===0).click());
await page.waitForTimeout(2500);
const aBefore = await snap();
const aFile = join(dir,'a.html');
const aHtml = await realDownload(aFile);
check('A: real download produced a file with metadata', /id="sterling-template-metadata"/.test(aHtml));
check('A: no baked preview decorations in the file', !/id="layout-safety"/.test(aHtml) && !/translate\(-50%,-50%\) scale\(/.test(aHtml));
await pickProduct('DS21218');
await page.setInputFiles('#uploadDesignInput', aFile);
await page.waitForTimeout(3000);
const aAfter = await snap();
check('A: product restored from metadata before render', aAfter.part === 'BCDP-CM' && aAfter.dims.join('x') === '3.5x2', aAfter.part + ' ' + aAfter.dims.join('x'));
check('A: box count identical', aBefore.boxes.length === aAfter.boxes.length, aBefore.boxes.length + '/' + aAfter.boxes.length);
check('A: bounding boxes identical', drift(aBefore,aAfter) <= TOL, 'worst drift ' + drift(aBefore,aAfter).toFixed(4));
check('A: card aspect identical', Math.abs(aBefore.card[0]/aBefore.card[1] - aAfter.card[0]/aAfter.card[1]) < 0.01,
  (aBefore.card[0]/aBefore.card[1]).toFixed(4) + ' -> ' + (aAfter.card[0]/aAfter.card[1]).toFixed(4));

// ---- B ----
console.log('B: large-format round trip');
await pickProduct('DS21218');
await page.evaluate(()=>window.SMPDemoSamples.load('sample-sign')); // stands in for AI generation (needs a key)
await page.waitForTimeout(2500);
const bBefore = await snap();
const bFile = join(dir,'b.html');
const bHtml = await realDownload(bFile);
const bMeta = JSON.parse(/<script[^>]*id="sterling-template-metadata"[^>]*>([\s\S]*?)<\/script>/.exec(bHtml)[1].replace(/<\\\//g,'</'));
check('B: metadata carries the selected sign product', bMeta.partNumber === 'DS21218', bMeta.partNumber);
await pickProduct('BCDP-CM');
await page.setInputFiles('#uploadDesignInput', bFile);
await page.waitForTimeout(3000);
const bAfter = await snap();
check('B: sign product restored before render', bAfter.part === 'DS21218', String(bAfter.part));
check('B: bounding boxes identical', drift(bBefore,bAfter) <= TOL, 'worst drift ' + drift(bBefore,bAfter).toFixed(4));
check('B: card aspect identical', Math.abs(bBefore.card[0]/bBefore.card[1] - bAfter.card[0]/bAfter.card[1]) < 0.01,
  (bBefore.card[0]/bBefore.card[1]).toFixed(4) + ' -> ' + (bAfter.card[0]/bAfter.card[1]).toFixed(4));

// ---- C ----
console.log('C: metadata-less (old) file on a selected product');
const cFile = join(dir,'c.html');
writeFileSync(cFile, aHtml.replace(/<script[^>]*id="sterling-template-metadata"[^>]*>[\s\S]*?<\/script>/,''));
await pickProduct('DS21218');
const cDims = await page.evaluate(()=>[document.getElementById('dimWidth').value, document.getElementById('dimHeight').value]);
await page.setInputFiles('#uploadDesignInput', cFile);
await page.waitForTimeout(3500);
const cAfter = await snap();
const cToast = await page.evaluate(()=>({hidden:document.getElementById('errorToast').classList.contains('hidden'),
  text:document.getElementById('errorMessage').textContent}));
check('C: current product kept', cAfter.part === 'DS21218', String(cAfter.part));
check('C: locked dimension fields untouched', cAfter.dims.join('x') === cDims.join('x'), cDims.join('x') + ' -> ' + cAfter.dims.join('x'));
check('C: design loads at its own size, aspect preserved', Math.abs(cAfter.card[0]/cAfter.card[1] - 360/216) < 0.02,
  'aspect ' + (cAfter.card[0]/cAfter.card[1]).toFixed(4));
check('C: visible toast explains the standalone load', !cToast.hidden && /no Sterling metadata/.test(cToast.text));

await br.close(); server.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
