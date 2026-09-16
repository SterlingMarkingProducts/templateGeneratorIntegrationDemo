/* LIVE MODE: the production CCA -> Generator -> Template Designer handoff.
 * Two cases only.
 *   1. ?product=<numeric id>&mode=live loads and LOCKS that product through the
 *      Generator's existing provider, and hides the temporary dev picker.
 *   2. Push to Designer fetches the CSRF nonce, posts the unchanged multipart
 *      payload with X-CSRF-Token, and redirects carrying the SAME product id.
 * The token and importer are mocked; no production endpoint is contacted and
 * no template is created. */
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
const PORT = 8909;
const TYPES = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const CAT_SRC = readFileSync(join(REPO,'scripts/test-product-type.mjs'),'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ')+18, CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));

/* The one live product this handoff test opens on, in the shape productInfo.cfm
   returns — taken from the catalogue fixture so the two agree. */
const LIVE_PRODUCTS = (function () {
  const out = {};
  (CATALOGUE.products || []).forEach(function (p) { if (p && p.id) out[p.id] = p; });
  return out;
}());
let productHits = 0;

const TOKEN = 'a'.repeat(64);
const SERVER_TEMPLATE_ID = 41022;      // whatever the importer returns, used verbatim
let tokenHits = 0, importReqs = [];

const server = createServer(async (req,res)=>{
  const url = new URL(req.url,'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(CATALOGUE)); return; }
  /* Live mode resolves its product from Sterling on every launch, never from
     the bundled snapshot, so the harness has to answer the read-only product
     lookup the same way productInfo.cfm does. Values are BCDP-CM's real ones;
     test-live-product-lookup.mjs is where the dynamic behaviour is proved. */
  if (url.pathname === '/templateDesigner/productInfo.cfm') {
    productHits++;
    const id = Number(url.searchParams.get('product'));
    const hit = LIVE_PRODUCTS[id];
    res.writeHead(hit ? 200 : 404, {'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(hit
      ? { found: true, source: 'designCentral (live, read-only)', via: 'products', product: hit }
      : { found: false, error: { code: 'not-found',
          message: 'Sterling holds no active product with id ' + id + '.' } }));
    return;
  }
  if (url.pathname === '/templateDesigner/templateImportToken.cfm') {
    tokenHits++;
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ csrfToken: TOKEN })); return;
  }
  if (url.pathname === '/templateDesigner/templateImport.cfm') {
    let body=''; for await (const c of req) body += c;
    importReqs.push({ method: req.method, headers: req.headers, body });
    res.writeHead(200,{'content-type':'application/json'});
    /* The real endpoint returns BOTH. openUrl points at the production page;
       the Generator deliberately builds its own URL instead, asserted below. */
    res.end(JSON.stringify({ templateId: SERVER_TEMPLATE_ID,
      openUrl: 'https://designercentral.sterling.ca/legacy/openTemplate.cfm?t=' + SERVER_TEMPLATE_ID })); return;
  }
  if (url.pathname.indexOf(FOLDER)!==0){res.writeHead(404).end();return;}
  const f = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/,''));
  try { if((await stat(f)).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
let pass=0, fail=0;
const is=(c,n,d='')=>{ (c?pass++:fail++); console.log(`  ${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };

/* The asset-hash step uses WebCrypto, which browsers expose only in a secure
   context. Production is HTTPS; this harness serves plain HTTP, so the origin
   is marked trustworthy for the test run only. */
const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
        '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const ctx = await br.newContext();
const page = await ctx.newPage();
page.on('console', m => { if (/error|blocked|guard|fail/i.test(m.text())) console.log('   [c]', m.text().slice(0,180)); });
page.on('pageerror', e => console.log('   [pageerror]', e.message.slice(0,180)));
const BASE = `http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`;

console.log('1  live-mode URL: product loaded, locked, picker hidden');
await page.goto(BASE + '?product=6505&mode=live', { waitUntil:'domcontentloaded' });
await page.waitForFunction(()=>window.SMPProductSelection
  && window.SMPProductSelection.get && window.SMPProductSelection.get() !== null, null, {timeout:20000});
const live = await page.evaluate(()=>{
  const sel = window.SMPProductSelection;
  const p = sel.get();
  const grp = document.getElementById('sterlingProductGroup');
  const search = document.getElementById('productSearch');
  const vis = (el)=> !!(el && el.offsetParent !== null);
  return {
    isLive: sel.isLiveMode(), liveId: sel.liveProductId(),
    id: p && p.id, part: p && p.partNumber,
    searchVisible: vis(search), searchDisabled: !!(search && search.disabled),
    clearVisible: vis(document.getElementById('spClear')),
    locked: grp.classList.contains('is-live-locked'),
    dims: [document.getElementById('dimWidth').value, document.getElementById('dimHeight').value],
    dimsReadOnly: document.getElementById('dimWidth').readOnly,
    ttype: document.getElementById('templateType').value,
    ttypeLocked: document.getElementById('templateType').disabled,
    target: window.SMPDesignerTarget && window.SMPDesignerTarget.designerPage,
    mode: window.SMPPush.transportMode(),
  };
});
is(live.isLive === true && live.liveId === 6505, 'live mode is active for the numeric id', String(live.liveId));
is(live.id === 6505 && live.part === 'BCDP-CM', 'the REAL product is resolved via the existing provider', live.part);
is(productHits === 1, 'resolved by ONE read-only live product lookup, not the bundled catalogue', String(productHits));
is(!live.searchVisible && live.searchDisabled, 'the temporary product search is hidden and disabled');
is(!live.clearVisible, 'Clear Product is not available');
is(live.locked === true, 'the selection is locked for this session');
is(live.dims.join('x') === '3.5x2' && live.dimsReadOnly, 'dimensions come from the product and are locked', live.dims.join('x'));
is(live.ttype === 'Business Card' && live.ttypeLocked, 'template type comes from the product and is locked', live.ttype);
is(live.target === '/templateDesigner/templateDesigner.cfm', 'the live Designer is the handoff target', String(live.target));
is(live.mode === 'import', 'Push to Designer uses the import transport', live.mode);

console.log('2  push: token GET -> X-CSRF-Token POST -> redirect keeps the product');
tokenHits = 0; importReqs = [];
const pushed = await page.evaluate(async () => {
  generatedHtml = '<!DOCTYPE html><html><head><style>.card{position:relative;width:360px;height:216px;background:#fff}</style></head><body><div class="card card--front"><h1>Live</h1></div></body></html>';
  lastPayload = { templateType:'Business Card', width:3.5, height:2, unit:'in', doubleSided:false };
  showPanel('result');
  document.getElementById('pushToDesignerBtn').disabled = false;
  let opened = null;
  const realOpen = window.open;
  window.open = (u) => { opened = u; return { focus(){} }; };
  try {
    document.getElementById('pushToDesignerBtn').click();
    for (let i=0;i<150 && !opened;i++) await new Promise(r=>setTimeout(r,100));
  } finally { window.open = realOpen; }
  return { opened, toast: document.getElementById('errorMessage').textContent,
           toastShown: !document.getElementById('errorToast').classList.contains('hidden'),
           btnLabel: document.getElementById('pushToDesignerBtn').textContent };
});
console.log('  opened:', pushed.opened, '| toast:', pushed.toastShown ? pushed.toast.slice(0,150) : '(none)', '| btn:', pushed.btnLabel);
is(tokenHits >= 1, 'the CSRF nonce was fetched from templateImportToken.cfm', tokenHits + ' GET(s)');
is(importReqs.length === 1 && importReqs[0].method === 'POST',
  'exactly one POST reached templateImport.cfm', importReqs.length + ' request(s)');
const req = importReqs[0] || { headers:{}, body:'' };
is(req.headers['x-csrf-token'] === TOKEN, 'it carried X-CSRF-Token with the fetched nonce',
  String(req.headers['x-csrf-token']).slice(0,12) + '…');
is(/multipart\/form-data/.test(req.headers['content-type']||'') && /name="manifest"/.test(req.body),
  'the existing multipart manifest contract is unchanged');
is(!/sk-ant|x-api-key|authorization/i.test(JSON.stringify(req.headers)),
  'no server or API credential is present in the request');
const u = new URL(pushed.opened, 'http://web03.sterling.ca');
is(u.pathname === '/templateDesigner/templateDesigner.cfm', 'the redirect is the live Designer', u.pathname);
is(u.searchParams.get('template') === String(SERVER_TEMPLATE_ID),
  'it carries the numeric template id the importer returned', u.searchParams.get('template'));
is(u.searchParams.get('product') === '6505',
  'and the SAME product id that entered from CCA', u.searchParams.get('product'));
is(!/template=blank/.test(pushed.opened), 'template=blank is never used');
is(!/designercentral|openTemplate\.cfm/.test(pushed.opened),
  "the server's own openUrl is ignored in favour of the site-independent Designer");

console.log('3  standalone/dev mode is unchanged');
const dev = await ctx.newPage();
await dev.goto(BASE, { waitUntil:'domcontentloaded' });
await dev.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0, null, {timeout:20000});
await dev.waitForTimeout(600);
const devState = await dev.evaluate(()=>({
  isLive: window.SMPProductSelection.isLiveMode(),
  searchVisible: !!document.getElementById('productSearch').offsetParent,
  searchDisabled: document.getElementById('productSearch').disabled,
  locked: document.getElementById('sterlingProductGroup').classList.contains('is-live-locked'),
  liveTarget: !!window.SMPDesignerTarget,
}));
is(devState.isLive === false && !devState.locked, 'no live mode without the parameter');
is(devState.searchVisible && !devState.searchDisabled, 'the dev picker still works');
is(devState.liveTarget === false, 'live wiring stays inert');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
