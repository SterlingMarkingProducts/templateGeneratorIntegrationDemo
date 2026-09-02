/* Sterling server-side AI endpoint transition. A REAL browser drives the REAL
 * Generator; the harness serves the repo at the clone path and stands in for
 * generator/api/claude.cfm, in BOTH transports the server might use:
 *   'sse'      — relays Anthropic SSE events (content-type text/event-stream)
 *   'buffered' — answers with ONE complete Anthropic message JSON body
 * plus an error case and a hang case. Every case must end visibly. */
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
const PORT = 8905;
const TYPES = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const CAT_SRC = readFileSync(join(REPO,'scripts/test-product-type.mjs'),'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ')+18, CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));

let mode = 'sse';   // sse | sse-plain | sse-json-header | buffered-sse | buffered | error | err-plain | malformed | hang
let requests = [];                // { path, headers, body }
const AI_HTML = '```html\n<!DOCTYPE html>\n<html><head><style>.card{position:relative;width:360px;height:216px;background:#fff}</style></head><body><div class="card card--front"><h1>Endpoint Co</h1></div></body></html>\n```';

const server = createServer(async (req,res)=>{
  const url = new URL(req.url,'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(CATALOGUE)); return; }
  if (url.pathname.endsWith('/generator/api/claude.cfm')) {
    let body=''; for await (const c of req) body+=c;
    requests.push({ path: url.pathname, headers: req.headers, body });
    if (mode === 'hang') return;
    if (mode === 'error') { res.writeHead(500,{'content-type':'application/json'});
      res.end(JSON.stringify({ error:{ message:'The server could not reach Anthropic (test error).' } })); return; }
    if (mode === 'err-plain') { res.writeHead(500,{'content-type':'text/html'});
      res.end('<html><body><h1>Lucee 5 Error</h1><p>could not read ANTHROPIC key sk-ant-api03-FAKEFAKEFAKE from environment</p></body></html>'); return; }
    if (mode === 'malformed') { res.writeHead(200,{'content-type':'application/json'});
      res.end('<<<not json, not sse>>>'); return; }
    let parsed={}; try { parsed=JSON.parse(body); } catch {}
    const sseBody = (payloadText) => {
      const mid = [];
      for (let i=0;i<payloadText.length;i+=300) mid.push(payloadText.slice(i,i+300));
      return 'event: message_start\ndata: ' + JSON.stringify({type:'message_start',message:{id:'msg_b',type:'message',role:'assistant'}})
        + '\n\nevent: content_block_start\ndata: {"type":"content_block_start","index":0}\n\n'
        + mid.map(t=>'event: content_block_delta\ndata: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:t}})).join('\n\n')
        + '\n\nevent: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n'
        + 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
        + 'event: message_stop\ndata: {"type":"message_stop"}\n';
    };
    if (!parsed.stream) {
      // the live claude.cfm was seen returning SSE text even for non-stream
      // calls, under a JSON content-type — reproduce that in the SSE modes
      if (mode === 'sse-json-header') { res.writeHead(200,{'content-type':'application/json'});
        res.end(sseBody('STYLE SPEC: clean modern grid.')); return; }
      if (mode === 'sse-plain') { res.writeHead(200,{'content-type':'text/plain'});
        res.end(sseBody('STYLE SPEC: clean modern grid.')); return; }
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({ content:[{type:'text',text:'STYLE SPEC: clean modern grid.'}] })); return;
    }
    if (mode === 'buffered') {   // complete Anthropic message body for a stream:true request
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({ id:'msg_test', type:'message', role:'assistant',
        content:[{type:'text',text:AI_HTML}] })); return;
    }
    if (mode === 'sse-json-header') { res.writeHead(200,{'content-type':'application/json'});
      res.end(sseBody(AI_HTML)); return; }
    if (mode === 'sse-plain' || mode === 'buffered-sse') { res.writeHead(200,{'content-type':'text/plain'});
      res.end(sseBody(AI_HTML)); return; }
    res.writeHead(200,{'content-type':'text/event-stream'});
    const parts=[]; for (let i=0;i<AI_HTML.length;i+=300) parts.push(AI_HTML.slice(i,i+300));
    let idx=0;
    const t=setInterval(()=>{ if (idx<parts.length)
        res.write('data: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:parts[idx++]}})+'\n\n');
      else { res.write('data: {"type":"message_stop"}\n\n'); clearInterval(t); res.end(); } }, 25);
    return;
  }
  if (url.pathname.indexOf(FOLDER)!==0){res.writeHead(404).end();return;}
  const f = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/,''));
  try { if((await stat(f)).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

let pass=0, fail=0;
const is=(c,n,d='')=>{ (c?pass++:fail++); console.log(`  ${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };

const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext()).newPage();   // FRESH context: no storage of any kind
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0, null, {timeout:20000});
await page.waitForTimeout(800);

console.log('1  fresh browser: no key UI of any kind');
is(!(await page.$('#smpDevKeyDialog')), 'no API-key dialog appears');
is(!(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>/api key/i.test(b.textContent)))),
  'no "API key" button exists');
is(await page.evaluate(()=>{ try { return !localStorage.getItem('anthropic_api_key'); } catch(e){ return true; } }),
  'nothing key-shaped in storage');

async function generate(instr){
  await page.evaluate(()=>{ if (typeof hideError==='function') hideError(); });
  await page.evaluate(()=>window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
  await page.waitForTimeout(300);
  if (instr !== undefined) await page.fill('#svgPaste', instr);
  await page.click('#generateBtn');
  await page.waitForFunction(()=>{
    const loading=!document.getElementById('loadingState').classList.contains('hidden');
    const result=!document.getElementById('resultState').classList.contains('hidden');
    const toast=!document.getElementById('errorToast').classList.contains('hidden');
    return !loading && (result || toast);
  }, null, { timeout: 30000 });
  return page.evaluate(()=>({
    result:!document.getElementById('resultState').classList.contains('hidden'),
    toast:!document.getElementById('errorToast').classList.contains('hidden')
      ? document.getElementById('errorMessage').textContent : null }));
}

console.log('2  SSE-relay transport');
requests=[]; mode='sse';
let r = await generate();
is(r.result && !r.toast, 'generation completes', r.toast || 'result shown');
is(requests.length === 2, 'two calls: spec (non-stream) + design (stream)', requests.length + ' calls');
is(requests.every(q=>q.path === FOLDER.replace(/\/$/,'') + '/generator/api/claude.cfm'),
  'every AI request goes to the clone-relative claude.cfm', requests[0] && requests[0].path);
is(requests.every(q=>!q.headers['x-api-key'] && !q.headers['x-dev-anthropic-key'] && !q.headers['authorization']),
  'NO credential header of any kind leaves the browser');
const b0=JSON.parse(requests[0].body), b1=JSON.parse(requests[1].body);
is(!!b0.model && Array.isArray(b0.messages) && b0.max_tokens>0 && !b0.stream,
  'spec call is a plain Anthropic Messages body', b0.model);
is(!!b1.model && Array.isArray(b1.messages) && b1.max_tokens>0 && b1.stream===true && typeof b1.system==='string',
  'design call is the same body with stream:true and the system prompt');
is(!JSON.stringify(requests.map(q=>q.body)).includes('sk-ant'),
  'no key material anywhere in the payloads');

console.log('3  buffered-JSON transport (server buffers Anthropic)');
requests=[]; mode='buffered';
r = await generate();
is(r.result && !r.toast, 'generation completes when the server buffers', r.toast || 'result shown');

console.log('4  SVG paste + regenerate through the endpoint');
requests=[]; mode='sse';
r = await generate('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#26c"/></svg>');
is(r.result, 'pasted-SVG generation works', r.toast || 'ok');
is(requests.length && requests.some(q=>q.body.includes('circle cx')), 'the SVG rides in the same body');
r = await generate('');
is(r.result, 'regeneration works', r.toast || 'ok');

console.log('4b  SSE bodies under WRONG or missing stream headers (the live bug)');
for (const m of ['sse-json-header', 'sse-plain', 'buffered-sse']) {
  requests=[]; mode=m;
  r = await generate('');
  is(r.result && !r.toast, m + ': generation completes (no JSON.parse of "event:")', r.toast || 'result shown');
}

console.log('5  failures stay visible — never an infinite spinner');
requests=[]; mode='err-plain';
r = await generate('');
is(!!r.toast && /failed \(500\)/.test(r.toast||'') && /Lucee 5 Error/.test(r.toast||''),
  'a 500 with a plain CFML body shows the server\'s own words', (r.toast||'').slice(0,90));
is(!!r.toast && !(r.toast||'').includes('FAKEFAKEFAKE') && /sk-ant-\[redacted\]/.test(r.toast||''),
  'anything key-shaped in the server body is REDACTED before display');
mode='malformed';
r = await generate('');
is(!!r.toast && /unreadable response/.test(r.toast||''), 'a malformed 200 body fails visibly with a safe snippet', (r.toast||'').slice(0,80));
mode='error';
r = await generate();
is(!r.result || r.toast, 'server error surfaces');
is(!!r.toast && /could not reach Anthropic/.test(r.toast), 'with the server\'s own message', (r.toast||'').slice(0,70));
mode='hang';
await page.evaluate(()=>{ window.SMP_AI_TIMEOUTS = { create: 5000, stream: 6000 }; });
await page.evaluate(()=>{ if (typeof hideError==='function') hideError(); });
await page.click('#generateBtn');
await page.waitForFunction(()=>!document.getElementById('loadingState').classList.contains('hidden'), null, {timeout:5000});
await page.waitForFunction(()=>{
  const loading=!document.getElementById('loadingState').classList.contains('hidden');
  const toast=!document.getElementById('errorToast').classList.contains('hidden');
  return !loading && toast;
}, null, { timeout: 20000 });
const hung = await page.evaluate(()=>document.getElementById('errorMessage').textContent);
is(/did not respond within/.test(hung), 'a hung endpoint times out into a visible error', hung.slice(0,70));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
