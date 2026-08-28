/* Seals and embossers must never appear in the product picker. The live
 * catalogue fixture is extended with realistic seal/embosser records (plus a
 * self-seal envelope control that must SURVIVE) and the REAL picker is
 * loaded in a browser to prove every path excludes them. */
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
const PORT = 8904;
const TYPES = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const CAT_SRC = readFileSync(join(REPO,'scripts/test-product-type.mjs'),'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ')+18, CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const baseCount = CATALOGUE.products.length;
const mk = (id, part, name, cls) => ({ id, partNumber: part, name,
  dimensions: { widthIn: 2, heightIn: 2 }, pages: { min: 1, max: 1 },
  classification: { productInformation: (cls || []).map((t, i) => ({ slug: 's' + id + i, title: t })) } });
CATALOGUE.products = CATALOGUE.products.concat([
  mk(90001, 'CS158', 'Corporate Seal 1 5/8"', ['Seals']),
  mk(90002, 'NS-DELUXE', 'Notary Public Seal - Deluxe', ['Seals', 'Notary Supplies']),
  mk(90003, 'DE-200', 'Desk Embosser', ['Embossers']),
  mk(90004, 'PE-100', 'Pocket Embossing Seal', []),
  mk(90005, 'GFS-24', 'Gold Foil Embossed Label Seals (pack of 24)', []),
  mk(90006, 'HQ-77', 'Heritage Press', ['Common Seals & Embossers']),   // only the classification says so
  mk(90007, 'ENV-SS', 'Self-Seal Envelope #10', ['Envelopes']),          // control: must SURVIVE
]);
const server = createServer(async (req,res)=>{
  const url = new URL(req.url,'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(CATALOGUE)); return; }
  if (url.pathname.indexOf(FOLDER)!==0){res.writeHead(404).end();return;}
  const f = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/,''));
  try { if((await stat(f)).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true,
  args:['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SMPProductSelection && window.SMPProductSelection.catalogueSize()>0, null, {timeout:15000});

const size = await page.evaluate(()=>window.SMPProductSelection.catalogueSize());
is(size === baseCount + 1, 'exactly the six seal/embosser records are excluded; the self-seal envelope stays',
  size + ' of ' + (baseCount + 7) + ' served records offered');

// real search box: "seal" finds only the envelope; "embosser" finds nothing
await page.fill('#productSearch', 'seal');
await page.waitForTimeout(400);
let rows = await page.evaluate(()=>[...document.querySelectorAll('.sp-result')].map(b=>b.textContent));
is(rows.length === 1 && /Self-Seal Envelope/.test(rows[0]),
  'searching "seal" offers only the self-seal envelope', rows.length + ' rows');
await page.fill('#productSearch', 'embosser');
await page.waitForTimeout(400);
rows = await page.evaluate(()=>[...document.querySelectorAll('.sp-result')].map(b=>b.textContent));
is(rows.length === 0, 'searching "embosser" offers nothing', rows.length + ' rows');

// programmatic selection paths agree
for (const part of ['CS158', 'NS-DELUXE', 'DE-200', 'PE-100', 'GFS-24', 'HQ-77']) {
  const rejected = await page.evaluate((p)=>window.SMPProductSelection.selectByPartNumber(p)
    .then(()=>false).catch(()=>true), part);
  is(rejected, 'selectByPartNumber refuses ' + part);
}
const envOk = await page.evaluate(()=>window.SMPProductSelection.selectByPartNumber('ENV-SS')
  .then(()=>true).catch(()=>false));
is(envOk, 'the self-seal envelope remains fully selectable');
const bcOk = await page.evaluate(()=>window.SMPProductSelection.selectByPartNumber('BCDP-CM')
  .then(()=>true).catch(()=>false));
is(bcOk, 'ordinary products are untouched (BCDP-CM still selects)');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
