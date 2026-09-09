/* The FINAL handoff URL. After the importer creates a template, the Generator
 * must open Jesse's site-independent Template Designer with the REAL numeric
 * template id the server returned and the REAL selected Sterling product id.
 * Small and surgical: no production data is created — the import transport is
 * a mock that returns a templateId, exactly as the real endpoint does. */
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
const PORT = 8908;
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
let pass=0, fail=0;
const is=(c,n,d='')=>{ (c?pass++:fail++); console.log(`  ${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };

const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0 && window.SMPPush, null, {timeout:20000});
await page.waitForTimeout(500);

const SERVER_TEMPLATE_ID = 37884;   // whatever the importer returns, used verbatim
const result = await page.evaluate(async (tid) => {
  await window.SMPProductSelection.selectByPartNumber('BCDP-CM');
  const product = window.SMPProductSelection.get();
  generatedHtml = '<!DOCTYPE html><html><head><style>.card{position:relative;width:360px;height:216px;background:#fff}</style></head><body><div class="card card--front"><h1>Handoff</h1></div></body></html>';
  lastPayload = { templateType:'Business Card', width:3.5, height:2, unit:'in', doubleSided:false };
  showPanel('result');
  document.getElementById('pushToDesignerBtn').disabled = false;
  /* Mock ONLY the transport: it answers exactly like the real import endpoint
     (a numeric templateId) so the redirect builder is the code under test. */
  const transport = { send: async () => ({ response: { templateId: tid } }) };
  window.SMPPush.setTransportMode('import', transport);
  let opened = null;
  const realOpen = window.open;
  window.open = (u) => { opened = u; return { focus(){} }; };
  try {
    document.getElementById('pushToDesignerBtn').click();
    for (let i=0;i<80 && !opened;i++) await new Promise(r=>setTimeout(r,100));
  } finally { window.open = realOpen; window.SMPPush.setTransportMode('local'); }
  return { opened, productId: product && product.id, partNumber: product && product.partNumber,
           dev: window.SMPWeb03Dev && window.SMPWeb03Dev.designerPage };
}, SERVER_TEMPLATE_ID);

console.log('opened URL:', result.opened);
is(!!result.opened, 'the successful import opens a Designer URL');
const u = new URL(result.opened, 'http://web03.sterling.ca');
is(u.pathname === '/templateDesigner/templateDesigner.cfm',
  'it is the site-independent Template Designer', u.pathname);
is(u.searchParams.get('template') === String(SERVER_TEMPLATE_ID),
  'the REAL numeric template id the server returned is passed', u.searchParams.get('template'));
is(/^\d+$/.test(u.searchParams.get('template') || ''), 'template is numeric — never "blank"');
is(u.searchParams.get('product') === String(result.productId) && String(result.productId) === '6505',
  'the REAL selected Sterling product id is passed', u.searchParams.get('product') + ' (' + result.partNumber + ')');
is(!/templateDesignerFullDev|web03-dev-e2e|TD-1|template=blank/i.test(result.opened),
  'no old dev wrapper, TD-1 or template=blank in the final destination');
const SRC = readFileSync(join(REPO,'generator/web03-dev-bootstrap.js'),'utf8');
/* the wrapper may still be NAMED in a comment explaining what replaced it;
   what must not survive is a live path value pointing at it. */
is(!SRC.split('\n').some((l) => /templateDesignerFullDev/.test(l) && /['"]/.test(l)),
  'no live path value points at the old dev wrapper');
is(!/web03\.sterling\.ca/.test(SRC.split('designerPage')[1].split('\n')[0]),
  'the designer page is host-relative — no hostname hardcoded');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
