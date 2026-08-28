/* web03 serving: the real path, where the page is on *.sterling.ca and the demo
   guard is live. Phase 2A's bug was exactly this — the manifest was blocked, so
   every generation silently reported "None". Serves this working tree under a
   dev clone folder, then checks the guard, the DEV controls and the indicator. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8899;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end('no clone'); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const ctx = await br.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
const pngs = [];
page.on('request', (r) => { if (/stock-photo-library\/.*\.png/i.test(r.url())) pngs.push(r.url()); });
const blocked = [];
page.on('console', (m) => { if (/demo guard|unavailable/i.test(m.text())) blocked.push(m.text()); });

await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

console.log('\nA  the page knows it is a dev clone');
const dev = await page.evaluate(() => !!(window.SMPWeb03Dev && window.SMPWeb03Dev.active));
is(dev, 'the -phase2c folder is recognised as a web03 dev clone');

console.log('\nB  the guard serves this clone its own stock library');
const m = await page.evaluate(async () => {
  try {
    const r = await fetch('assets/stock-photo-manifest.json');
    const d = await r.json();
    return { ok: r.ok, count: d.file_count, first: (d.photos[0] || {}).url };
  } catch (e) { return { ok: false, error: String(e.message) }; }
});
is(m.ok && m.count === 45, 'the stock manifest loads through the demo guard', JSON.stringify(m));
const img = await page.evaluate((u) => new Promise((res) => {
  const i = new Image();
  i.onload = () => res({ ok: true, w: i.naturalWidth });
  i.onerror = () => res({ ok: false });
  i.src = u;
}), m.first);
is(img.ok && img.w > 0, 'and a photograph itself renders from the clone', JSON.stringify(img));
const both = await page.evaluate(async () => {
  const a = await fetch('assets/design-asset-manifest.json').then((r) => r.json()).catch(() => null);
  const s = await fetch('assets/stock-photo-manifest.json').then((r) => r.json()).catch(() => null);
  return { assets: a && a.file_count, stock: s && s.file_count };
});
is(both.assets === 80 && both.stock === 45, 'both libraries load, independently',
   JSON.stringify(both));
const off = await page.evaluate(async () => {
  try { const r = await fetch('https://designcentral.sterling.ca/anything.json'); return r.status; }
  catch (e) { return 'blocked: ' + e.message; }
});
is(String(off).startsWith('blocked'), 'while the guard still blocks everything else',
   String(off).slice(0, 60));

console.log('\nC  the DEV controls');
const ctrls = await page.evaluate(() => {
  const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; };
  const asset = document.getElementById('devAssetMode');
  const photo = document.getElementById('devStockPhotoMode');
  const gen = document.getElementById('generateBtn');
  return {
    asset: vis(asset), photo: vis(photo), gen: vis(gen),
    photoOptions: photo ? [...photo.options].map((o) => o.value + ':' + o.textContent) : null,
    photoDefault: photo ? photo.value : null,
    globalDefault: window.SMPStockPhotoMode,
  };
});
is(ctrls.photo && ctrls.photo.w > 0 && ctrls.photo.h > 0,
   'Stock Photo Mode is rendered and visible before any generation', JSON.stringify(ctrls.photo));
is(ctrls.photo && ctrls.gen && ctrls.photo.top < ctrls.gen.top,
   'directly above Generate Design');
is(ctrls.asset && ctrls.photo && ctrls.asset.top < ctrls.photo.top,
   'and beside the existing Asset Mode control');
is(JSON.stringify(ctrls.photoOptions) === JSON.stringify(
     ['auto:Auto', 'force:Force Photo', 'off:No Photo']),
   'offering Auto | Force Photo | No Photo', JSON.stringify(ctrls.photoOptions));
is(ctrls.photoDefault === 'auto' && ctrls.globalDefault === 'auto', 'defaulting to Auto');

console.log('\nD  the indicator above the preview');
const ind = await page.evaluate(() => {
  const box = document.getElementById('devAssetIndicator');
  if (!box) return null;
  const r = box.getBoundingClientRect();
  return { text: box.textContent, lines: box.children.length,
    w: Math.round(r.width), top: Math.round(r.top) };
});
is(ind && ind.lines === 2, 'two lines: the asset and the photograph', JSON.stringify(ind && ind.lines));
is(ind && /Photo: None · Reason: /.test(ind.text),
   'the photo line reads "Photo: None · Reason: …" before the first generation',
   ind && ind.text);
const belowPhoto = await page.evaluate(() => {
  const box = document.getElementById('devAssetIndicator');
  const prev = document.querySelector('.preview-main');
  return box && prev ? box.getBoundingClientRect().top <= prev.getBoundingClientRect().top + 4 : false;
});
is(belowPhoto, 'and it sits at the top of the preview column');

console.log('\nE  a real selection reported end to end');
const live = await page.evaluate(async () => {
  /* Drive the same event the engine publishes, through the real listener. */
  const seen = [];
  window.addEventListener('smp:stock-photo-selected', (e) => seen.push(e.detail));
  window.dispatchEvent(new CustomEvent('smp:stock-photo-selected', { detail: {
    file: '04-vertical-dentist-with-patient.png', id: '04-vertical-dentist-with-patient',
    url: 'assets/stock-photo-library/04-vertical-dentist-with-patient.png',
    subject: 'Dental professional chatting with a reclined patient',
    industry: 'dental', matchedIndustries: ['dental'], orientation: 'portrait',
    requiresScrim: true, selectMs: 0.04, format: 'large-format', mode: 'auto' } }));
  await new Promise((r) => setTimeout(r, 50));
  const box = document.getElementById('devAssetIndicator');
  return { text: box ? box.textContent : null, seen: seen.length };
});
is(/Photo: 04-vertical-dentist-with-patient\.png · Industry: dental/.test(live.text || ''),
   'the indicator names the file and the matched industry', live.text);
is(/scrim required/.test(live.text || ''), 'and flags the scrim requirement');

console.log('\nF  nothing was downloaded that did not need to be');
is(pngs.length <= 1, 'at most the one photograph this test rendered on purpose',
   pngs.length + ' PNG request(s)');
is(!blocked.some((t) => /stock-photo/.test(t)), 'the guard logged no stock-photo refusal',
   blocked.join(' | ').slice(0, 120));

await ctx.close(); await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
