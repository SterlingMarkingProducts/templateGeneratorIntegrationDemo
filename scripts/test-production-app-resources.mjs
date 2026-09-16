/* The PRODUCTION Generator can read its own shipped resources.
 *
 * Live deployment path: https://web03.sterling.ca/templateGenerator/generator/
 * That is not a dev clone folder, so demo-guard.js had no root for it and
 * refused every same-origin fetch the app makes for its own files: the design
 * asset library, the stock photographs, the logo library, the icon bank and
 * the demo samples were all blocked before they left the page.
 *
 * This drives the real page from that exact path and checks both halves —
 * the app's own files load, and nothing else was opened up.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8905;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* The live product endpoint, mocked: this test only has to prove it still
   answers from the production path — test-live-product-lookup.mjs owns it. */
const PRODUCT_6505 = {
  id: 6505, partNumber: 'BCDP-CM', name: 'Vibrant Colour Business Cards - Classic Matte',
  dimensions: { widthIn: 3.5, heightIn: 2, displayUnit: 'in', widthDisplay: '3.5', heightDisplay: '2' },
  bleed: { top: 12, right: 12, bottom: 12, left: 12 },
  pages: { min: 2, max: 2 }, shape: 'rect',
  orientation: { landscapeAvailable: true, portraitAvailable: true },
  maxLines: 0, status: { active: true, retired: false },
  legacy: { designerVariationCode: 3, margins: { top: 6, right: 6, bottom: 6, left: 6 },
    borders: { top: 0, right: 0, bottom: 0, left: 0, width: 0 },
    daterBox: { width: 0, height: 0 }, isProStamp: false, greenInkAvailable: true, bandString: '' },
  classification: { productInformation: [
    { id: 805, productTable: 'business-cards', title: 'Vibrant Colour Business Cards' }] },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/templateDesigner/productInfo.cfm') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ found: true, via: 'products', product: PRODUCT_6505 }));
    return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

/* One real file from each library, read off the shipped manifests so the test
   cannot drift from what is actually in the build. */
const first = async (manifest, key) => {
  const doc = JSON.parse(await readFile(join(REPO, manifest), 'utf8'));
  const list = doc[key] || [];
  return list.length ? String(list[0].url || '') : '';
};
const DESIGN_PNG = await first('generator/assets/design-asset-manifest.json', 'assets');
const STOCK_PNG = await first('generator/assets/stock-photo-manifest.json', 'photos');
const LOGO_PNG = await first('generator/assets/logo-asset-manifest.json', 'logos');

console.log('0  fixture sanity');
is(!!DESIGN_PNG && !!STOCK_PNG && !!LOGO_PNG,
   'one real file read from each shipped manifest',
   [DESIGN_PNG, STOCK_PNG, LOGO_PNG].join(' | '));

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
const noise = [];
page.on('console', (m) => {
  const t = m.text();
  if (/DEMO GUARD|unavailable|IconBank/i.test(t)) noise.push(t);
});

console.log('1  the production path loads without the guard refusing the app its own files');
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.IconBank && window.SMPProductSelection, null, { timeout: 15000 });
await page.waitForTimeout(2500);   // let the libraries and demo samples settle
console.log(noise.length ? noise.map((n) => '     [c] ' + n.slice(0, 120)).join('\n') : '     (no guard/library warnings)');
is(!noise.some((n) => /DEMO GUARD/.test(n)),
   'nothing the page asked for was refused by the guard',
   noise.filter((n) => /DEMO GUARD/.test(n)).join(' | ') || 'none');
is(!noise.some((n) => /library unavailable|Demo samples unavailable|manifest unavailable/i.test(n)),
   'no library reported itself unavailable',
   noise.filter((n) => /unavailable/i.test(n)).join(' | ') || 'none');

/* Probe the guard's decision directly: 'blocked' only when the guard refused,
   so a 404 from this harness cannot be mistaken for a refusal. */
const probe = (list) => page.evaluate((paths) => Promise.all(paths.map((p) =>
  fetch(p).then(function () { return 'allowed'; },
    function (e) { return /demo guard/i.test(e.message) ? 'blocked' : 'allowed'; }))), list);

console.log('\n2-5  each shipped library is reachable from the production path');
const allow = [
  ['design asset manifest', 'assets/design-asset-manifest.json'],
  ['a design library PNG', DESIGN_PNG],
  ['stock photo manifest', 'assets/stock-photo-manifest.json'],
  ['a stock photograph', STOCK_PNG],
  ['logo asset manifest', 'assets/logo-asset-manifest.json'],
  ['a logo library PNG', LOGO_PNG],
  ['icon bank manifest', 'icons/manifest.json'],
  ['an icon bank SVG', 'icons/minimal/phone.svg'],
  ['demo samples', '../data/test-templates.json'],
  ['the bundled catalogue (standalone picker)', '../data/sterling-products.json'],
];
const allowed = await probe(allow.map((a) => a[1]));
allow.forEach((a, i) => is(allowed[i] === 'allowed', a[0] + ' loads', a[1]));

console.log('\n   and the icon bank really resolves artwork, not an empty span');
const icon = await page.evaluate(async () => {
  const svg = await window.IconBank.getSvg('phone');
  return { len: svg ? svg.length : 0, isSvg: /<svg[\s>]/.test(svg || '') };
});
is(icon.isSvg && icon.len > 100, 'IconBank.getSvg("phone") returns real SVG markup',
   icon.len + ' bytes');

console.log('\n6  the live product endpoint still works from this path');
const live = await page.evaluate(() =>
  fetch('/templateDesigner/productInfo.cfm?product=6505')
    .then((r) => r.json()).then((d) => (d.product || {}).partNumber)
    .catch((e) => 'ERROR: ' + e.message));
is(live === 'BCDP-CM', 'the read-only product lookup is reachable and answers', String(live));

console.log('\n7  nothing else was opened up');
const deny = [
  ['a cross-origin Sterling host', 'https://designercentral.sterling.ca/anything.json'],
  ['the dev import endpoint', '/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm'],
  ['the dev product catalogue', '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm'],
  ['the dev AI endpoint', 'api/claude.cfm'],
  ['any other TemplateDesigner page', '/templateDesigner/templateDesigner.cfm'],
  ['a file outside the shipped libraries', '../config/secrets.json'],
  ['a nested data path', '../data/nested/thing.json'],
  ['a non-library file under assets/', 'assets/notes.txt'],
  ['an arbitrary path on this host', '/inetpub/wwwroot/web.config'],
];
const denied = await probe(deny.map((d) => d[1]));
deny.forEach((d, i) => is(denied[i] === 'blocked', d[0] + ' is still blocked', d[1]));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
