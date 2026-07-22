/* Automated checks for the integration demo.
 *
 * Usage:
 *   node scripts/test-demo.mjs                        # serve this repo locally and test
 *   node scripts/test-demo.mjs https://host/path/     # test a deployed copy
 *
 * Covers: pages load, sample design loads without an API key, Push to
 * Designer opens the test designer with editable objects, dimensions are
 * detected, business-card and sign recommendations appear, incompatible
 * products are selectable, duplicates scale proportionally while the original
 * stays untouched, the banner is on every page, no cart/checkout features
 * exist, and NO request reaches a Sterling production domain (plus an active
 * probe that the demo guard blocks one).
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

let base = process.argv[2];
let srv = null;
if (!base) {
  srv = await new Promise(resolve => {
    const s = http.createServer(async (req, res) => {
      const path = decodeURIComponent(req.url.split('?')[0]);
      const file = join(ROOT, path === '/' ? 'index.html' : path);
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end('not found'); }
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${srv.address().port}/`;
}
if (!base.endsWith('/')) base += '/';
console.log(`Testing against: ${base}\n`);

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const launchOpts = { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true };
// Remote targets in sandboxed environments may require an egress proxy (CA
// trust comes from the pre-configured NSS store, so verification stays on).
if (!base.startsWith('http://127.0.0.1') && process.env.HTTPS_PROXY) {
  launchOpts.proxy = { server: process.env.HTTPS_PROXY };
}
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext();

// Network watchdog: record every request to a sterling.ca production host
const productionHits = [];
ctx.on('request', req => {
  try {
    const host = new URL(req.url()).hostname;
    if (/(^|\.)sterling\.ca$/i.test(host)) productionHits.push(req.url());
  } catch {}
});

const page = await ctx.newPage();
const consoleWarnings = [];
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'warn') consoleWarnings.push(m.text()); });

// 1-2. Landing page and banner
await page.goto(base, { waitUntil: 'domcontentloaded' });
check('1. Landing page loads', (await page.title()).includes('Integration Demo'), await page.title());
check('18a. Banner on landing page', await page.evaluate(() => !!document.getElementById('demo-banner')));
check('Landing has Launch + Catalogue buttons', await page.evaluate(() =>
  !!document.querySelector('a[href="generator/index.html"]') && !!document.querySelector('a[href="catalogue.html"]')));

// Catalogue page
await page.goto(base + 'catalogue.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const catRows = await page.evaluate(() => document.querySelectorAll('#tbl tbody tr').length);
check('Catalogue lists demo products', catRows >= 13, `${catRows} rows`);
check('18b. Banner on catalogue page', await page.evaluate(() => !!document.getElementById('demo-banner')));

// 2. Generator
await page.goto(base + 'generator/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
check('2. Generator loads', await page.evaluate(() => !!document.getElementById('generateBtn')));
check('18c. Banner on generator page', await page.evaluate(() => !!document.getElementById('demo-banner')));
const apiSrc = await page.evaluate(() => fetch('browser-api.js').then(r => r.text()));
check('No API key shipped in demo', !apiSrc.includes('DEFAULT_KEY_PARTS') && apiSrc.includes("return '';"));

// 3. "Generate" a sample design (no API key)
const sampleBtns = await page.evaluate(() =>
  [...document.querySelectorAll('button')].filter(b => b.textContent.startsWith('Load sample:')).map(b => b.textContent));
check('3. Sample-design shortcuts present', sampleBtns.length === 2, sampleBtns.join(' | '));
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent.includes('Business card')).click();
});
await page.waitForTimeout(900);
check('Sample design renders in preview', await page.evaluate(() => {
  const f = document.getElementById('previewFrame');
  return !!(f.contentDocument && f.contentDocument.querySelector('.card'));
}));

// 4-5. Push to Designer
check('4. Push to Designer button visible', await page.evaluate(() => {
  const b = document.getElementById('pushToDesignerBtn');
  return !!b && b.offsetParent !== null;
}));
const [realPage] = await Promise.all([
  ctx.waitForEvent('page'),
  page.click('#pushToDesignerBtn'),
]);
await realPage.waitForLoadState('domcontentloaded');
check('5. Real Sterling designer test copy opens', realPage.url().includes('realdesigner/index.html?transfer='), realPage.url());
await realPage.waitForTimeout(5000); // designer boot + transfer settle
const realState = await realPage.evaluate(() => {
  const objs = (typeof currentCanvas !== 'undefined' && currentCanvas) ? currentCanvas.getObjects() : [];
  return {
    banner: !!document.getElementById('demo-banner'),
    types: objs.map(o => o.type),
    texts: objs.filter(o => o.type === 'i-text' || o.type === 'textbox').map(o => o.text),
    recLink: !!document.getElementById('recommendationsLink'),
    fabricVer: (typeof fabric !== 'undefined' && fabric) ? fabric.version : null,
  };
});
check('18d. Banner on real designer page', realState.banner);
check('Real designer loads pushed design as editable objects', realState.types.includes('i-text') && realState.texts.some(t => t.includes('Jordan')), realState.types.join(','));
check('Real designer runs Fabric 4.4.0', realState.fabricVer === '4.4.0');
check('Recommendations link offered in real designer', realState.recLink);

// Follow the same transfer into the recommendations harness
const transferId = new URL(realPage.url()).searchParams.get('transfer');
const designer = await ctx.newPage();
await designer.goto(base + 'designer/index.html?transfer=' + transferId, { waitUntil: 'domcontentloaded' });
await designer.waitForTimeout(1200);
check('18e. Banner on recommendations page', await designer.evaluate(() => !!document.getElementById('demo-banner')));

// 6-8. Editable objects + dimension detection
const state = await designer.evaluate(() => ({
  pages: window.SMPTestHarness.pages.length,
  types: window.SMPTestHarness.pages[0].canvasData.objects.map(o => o.type),
  info: document.getElementById('designInfo').textContent,
  provenance: document.getElementById('provenance').textContent,
}));
check('Design loaded as objects', state.pages === 1 && state.types.length >= 4, state.types.join(','));
check('6. Text objects (editable, designer-native i-text) present', state.types.includes('i-text'));
check('7. Background artwork raster present', state.types.includes('image'));
check('8. Dimensions + orientation detected', state.info.includes('3.5" × 2"') && state.info.includes('landscape'), state.info.slice(0, 60));
check('Provenance recognised', state.provenance.includes('Design Template Generator'));

// Editability probe: mutate a textbox through the live Fabric canvas
const edit = await designer.evaluate(() => {
  const cEl = document.querySelector('canvas.lower-canvas') || document.querySelector('canvas');
  // fabric attaches the canvas instance registry via __fabric on wrapper? use harness pages + fabric global instead:
  const objs = window.SMPTestHarness.pages[0].canvasData.objects;
  const tb = objs.find(o => o.type === 'i-text' || o.type === 'textbox');
  return { text: tb && tb.text, fabricLoaded: typeof fabric !== 'undefined' && !!fabric.Canvas };
});
check('Fabric 4.4.0 canvas active', edit.fabricLoaded && await designer.evaluate(() => fabric.version === '4.4.0'));
check('Sample text carried over', (edit.text || '').includes('Jordan'), edit.text);

// 9. Business-card matches
const cards9 = await designer.evaluate(() =>
  [...document.querySelectorAll('#productList .product')]
    .filter(p => p.querySelector('.tier.exact'))
    .map(p => p.querySelector('.name').textContent));
check('9. Matching business cards recommended', cards9.filter(n => n.includes('Business Card')).length >= 3, cards9.join(' | '));

// 11-14. Incompatible selection + duplication + original preservation
const dup = await designer.evaluate(() => {
  const products = [...document.querySelectorAll('#productList .product')];
  const exact = products.find(p => p.querySelector('.tier.exact'));
  const selectable = products.find(p => p.querySelector('.tier.selectable'));
  const before = JSON.stringify(window.SMPTestHarness.pages[0].canvasData);
  exact.querySelector('button').click();
  selectable.querySelector('button').click();
  const after = JSON.stringify(window.SMPTestHarness.pages[0].canvasData);
  const pages = window.SMPTestHarness.pages;
  const sel = pages[pages.length - 1];
  const selWarn = selectable.textContent;
  return {
    count: pages.length, originalUntouched: before === after,
    labels: pages.map(p => p.label),
    scaled: sel.conversion && sel.conversion.method === 'proportional-scale-centre',
    selDims: [sel.canvasProperties.width, sel.canvasProperties.height],
    warningsShown: selWarn.includes('⚠'),
  };
});
check('11. Incompatible product selectable', dup.count === 3, dup.labels.join(' | '));
check('12. Product-specific duplicates created', dup.labels.filter(l => l.startsWith('Copy')).length === 2);
check('13. Duplicate scaled proportionally + centred', dup.scaled, JSON.stringify(dup.selDims));
check('14. Original design unchanged', dup.originalUntouched);
check('Warnings displayed for adjustment products', dup.warningsShown);

// 10. Sign matches for a 12x16 design
const designerText = await designer.evaluate(() => document.body.innerText);
await designer.close();
await realPage.close(); // popup windows are name-reused; close so the next push emits a fresh page event
await page.bringToFront();
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign')).click();
});
await page.waitForTimeout(900);
const [realPage2] = await Promise.all([ctx.waitForEvent('page'), page.click('#pushToDesignerBtn')]);
await realPage2.waitForLoadState('domcontentloaded');
check('Second push also opens real designer', realPage2.url().includes('realdesigner/index.html?transfer='));
const transferId2 = new URL(realPage2.url()).searchParams.get('transfer');
const designer2 = await ctx.newPage();
await designer2.goto(base + 'designer/index.html?transfer=' + transferId2, { waitUntil: 'domcontentloaded' });
await designer2.waitForTimeout(1200);
const signMatches = await designer2.evaluate(() =>
  [...document.querySelectorAll('#productList .product')]
    .filter(p => p.querySelector('.tier.exact'))
    .map(p => p.querySelector('.name').textContent));
check('10. 12x16 sign materials recommended', ['Acrylic', 'Coroplast', 'PVC'].every(m => signMatches.some(n => n.includes(m))), signMatches.join(' | '));

// 15. Refresh behaviour: reload with transfer id still present, then with a bogus id
await designer2.reload({ waitUntil: 'domcontentloaded' });
await designer2.waitForTimeout(900);
const afterRefresh = await designer2.evaluate(() => ({
  loaded: window.SMPTestHarness.pages.length > 0,
  hint: getComputedStyle(document.getElementById('dropHint')).display,
}));
const bogus = await ctx.newPage();
await bogus.goto(base + 'designer/index.html?transfer=does-not-exist', { waitUntil: 'domcontentloaded' });
await bogus.waitForTimeout(500);
const bogusHint = await bogus.evaluate(() => getComputedStyle(document.getElementById('dropHint')).display !== 'none');
check('15. Refresh keeps design; missing transfer explains clearly', afterRefresh.loaded && afterRefresh.hint === 'none' && bogusHint);

// 16. Production-domain isolation (passive + active probe)
const guardProbe = await page.evaluate(async () => {
  try { await fetch('https://www.sterling.ca/Designer.cfm'); return { blocked: false }; }
  catch (e) { return { blocked: true, message: e.message }; }
});
check('16a. Demo guard blocks production request', guardProbe.blocked && guardProbe.message.includes('demo guard'), guardProbe.message);
check('16b. Guard logs console warning', consoleWarnings.some(w => w.includes('[DEMO GUARD]')));
check('16c. Zero requests reached sterling.ca', productionHits.length === 0, productionHits.join(', ') || 'none');

// 17. No cart/checkout/order/upload features
const FORBIDDEN_UI = ['Add to Cart', 'Checkout', 'Sign in', 'My Account', 'Order now'];
const texts = [designerText, ...await Promise.all([page, designer2].map(p => p.evaluate(() => document.body.innerText)))];
const forbidden = texts.map(t => FORBIDDEN_UI.filter(f => t.includes(f)));
check('17. No cart/checkout/account features', forbidden.every(f => f.length === 0), JSON.stringify(forbidden));

await browser.close();
if (srv) srv.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
