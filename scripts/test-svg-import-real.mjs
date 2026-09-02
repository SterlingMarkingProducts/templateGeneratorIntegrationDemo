/* REAL-UI SVG paste/import tests. Real product pick, real paste into #svgPaste,
 * real Generate click. The Anthropic proxy endpoint is mocked with faithful
 * responses (JSON for non-streaming, SSE for streaming) that embed the pasted
 * SVG the way the model does; one case mocks a HUNG proxy to prove the UI can
 * no longer spin forever. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8902;
const TYPES = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const CAT_SRC = readFileSync(join(REPO,'scripts/test-product-type.mjs'),'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ')+18, CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));

let mode = 'ok';           // 'ok' | 'hang'
let aiBodies = [];
const AI_HTML = (svg) => '```html\n<!DOCTYPE html>\n<html><head><style>\n'
  + '.card{position:relative;width:360px;height:216px;background:#fff;overflow:hidden;}\n'
  + '.logo{position:absolute;left:24px;top:24px;width:120px;}\n'
  + '</style></head><body>\n<div class="card card--front">\n  <div class="logo">' + svg
  + '</div>\n  <h1>Demo Co</h1>\n</div>\n</body></html>\n```\n';

const server = createServer(async (req,res)=>{
  const url = new URL(req.url,'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(CATALOGUE)); return; }
  if (url.pathname.endsWith('aiKeyStatus.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end('{"serverKeyConfigured":true}'); return; }
  if (url.pathname.endsWith('/generator/api/claude.cfm')) {
    let body=''; for await (const c of req) body+=c;
    if (mode === 'hang') return;                 // accept and never answer
    let parsed={}; try { parsed=JSON.parse(body); } catch {}
    aiBodies.push(body);
    const flat = body.replace(/\\n/g,'\n').replace(/\\"/g,'"');
    const svgMatch = /<svg[\s\S]*?<\/svg>/.exec(flat);
    if (!parsed.stream) {
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({ content:[{type:'text',text:'STYLE SPEC: clean modern, customer SVG logo leads.'}] }));
      return;
    }
    const answer = AI_HTML(svgMatch ? svgMatch[0] : '<svg viewBox="0 0 10 10"></svg>');
    res.writeHead(200,{'content-type':'text/event-stream'});
    const parts = []; for (let i=0;i<answer.length;i+=400) parts.push(answer.slice(i,i+400));
    let idx=0;
    const t=setInterval(()=>{ if (idx<parts.length)
        res.write('data: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:parts[idx++]}})+'\n\n');
      else { res.write('data: {"type":"message_stop"}\n\n'); clearInterval(t); res.end(); } }, 30);
    return;
  }
  if (url.pathname.indexOf(FOLDER)!==0){res.writeHead(404).end();return;}
  const f = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/,''));
  try { if((await stat(f)).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

let passed=0, failed=0;
function check(name, ok, detail){ (ok?passed++:failed++); console.log((ok?'  PASS  ':'  FAIL  ')+name+(detail?' — '+detail:'')); }

const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext({viewport:{width:1500,height:1000}})).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0, null, {timeout:20000});
await page.waitForTimeout(500);
await page.evaluate(()=>{ window.SMP_AI_TIMEOUTS = { create: 6000, stream: 8000 }; });
await page.fill('#productSearch', 'BCDP-CM');
await page.waitForTimeout(600);
await page.evaluate(()=>{ const b=document.querySelector('.sp-result'); if(b) b.click(); });
await page.waitForTimeout(700);

async function state(){ return page.evaluate(()=>({
  loading: !document.getElementById('loadingState').classList.contains('hidden'),
  result:  !document.getElementById('resultState').classList.contains('hidden'),
  toast:   !document.getElementById('errorToast').classList.contains('hidden')
    ? document.getElementById('errorMessage').textContent : null })); }
async function runSvg(svg, waitMs=6000){
  aiBodies = [];
  await page.evaluate(()=>{ if (typeof hideError==='function') hideError(); });
  await page.fill('#svgPaste', svg);
  await page.click('#generateBtn');
  await page.waitForTimeout(waitMs);
  const st = await state();
  const svgBox = st.result ? await page.evaluate(()=>{
    const doc = document.getElementById('previewFrame').contentDocument;
    const el = doc && doc.querySelector('.logo svg');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w:r.width, h:r.height, outer: el.outerHTML }; }) : null;
  return { st, svgBox, sentToAi: aiBodies.length };
}

// 1. viewBox + width/height
let r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400"><rect width="600" height="400" fill="#f4c542"/><circle cx="180" cy="200" r="110" fill="#2455d6"/><text x="330" y="210" font-size="48" font-weight="700" fill="#111">TEST</text></svg>');
check('viewBox+width/height loads', r.st.result && !r.st.loading && r.svgBox);
check('  aspect preserved (1.5)', r.svgBox && Math.abs(r.svgBox.w/r.svgBox.h - 1.5) < 0.02, r.svgBox && (r.svgBox.w/r.svgBox.h).toFixed(3));
check('  text/geometry kept', r.svgBox && /TEST/.test(r.svgBox.outer) && /circle/.test(r.svgBox.outer));

// 2. viewBox only
r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="#123"/></svg>');
check('viewBox-only loads', r.st.result && !r.st.loading && r.svgBox);
check('  aspect from viewBox (3.0)', r.svgBox && Math.abs(r.svgBox.w/r.svgBox.h - 3) < 0.05, r.svgBox && (r.svgBox.w/r.svgBox.h).toFixed(3));

// 3. width/height only (no viewBox) — gains an equivalent viewBox
r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="90" fill="#2455d6"/></svg>');
check('width/height-only loads', r.st.result && !r.st.loading && r.svgBox);
check('  equivalent viewBox derived', r.svgBox && /viewBox="0 0 200 200"/.test(r.svgBox.outer));

// 4. paths / groups / transforms / gradients, and no xmlns
r = await runSvg('<svg viewBox="0 0 100 50"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><g transform="translate(10,5) scale(0.8)"><path d="M0 0 L80 0 L80 40 Z" fill="url(#g)"/></g></svg>');
check('paths/groups/transforms/gradients load (xmlns added)', r.st.result && r.svgBox && /linearGradient/.test(r.svgBox.outer) && /transform=/.test(r.svgBox.outer) && /xmlns=/.test(r.svgBox.outer));

// 5. malformed SVG — visible error, no backend call, no spin
r = await runSvg('<svg viewBox="0 0 10 10"><rect width="10"', 2500);
check('malformed SVG fails visibly', !!r.st.toast && /Could not import this SVG/.test(r.st.toast), (r.st.toast||'').slice(0,70));
check('  never spins / never reaches the AI', !r.st.loading && r.sentToAi === 0);

// 6. scripts / handlers / external refs stripped, geometry kept
r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><rect width="100" height="100" fill="#0a0" onclick="alert(2)"/><image href="https://evil.example/x.png" width="10" height="10"/><path d="M0 0 H100" stroke="url(#g)"/></svg>');
const sent = aiBodies.join(' ');
check('script/handlers/external refs stripped before use', r.st.result
  && !/alert\(1\)/.test(sent) && !/onclick/.test(sent) && !/evil\.example/.test(sent), 'payload clean');
check('  legitimate geometry survives sanitizing', /M0 0 H100/.test(sent));

// 7. SVG with no usable size
r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>', 2500);
check('no-viewBox no-size SVG fails with a useful reason', !!r.st.toast && /size cannot be determined/.test(r.st.toast||''));

// 8. hung AI proxy — the spinner MUST clear with a visible error
mode = 'hang';
r = await runSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400"><rect width="600" height="400" fill="#f4c542"/></svg>', 8000);
check('hung proxy: spinner cleared', !r.st.loading);
check('hung proxy: visible timeout error', !!r.st.toast && /did not respond within/.test(r.st.toast||''), (r.st.toast||'').slice(0,80));
mode = 'ok';

await br.close(); server.close();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
