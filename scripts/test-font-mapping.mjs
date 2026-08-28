/* Font preservation through the REAL push pipeline. Two layers:
 *   1. the resolver (window.SMPPush.mapFont as loaded in the real page):
 *      stacks, quotes, generics, categories, weight hints;
 *   2. the real extraction (SMPPush.convertCurrentDesign) on a design whose
 *      elements use distinct faces — asserting the pushed text objects carry
 *      the intended family, weight, style and letter spacing, and that Arial
 *      appears ONLY where it is genuinely the right last resort. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8903;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CAT_SRC = await readFile(new URL('./test-product-type.mjs', import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ') + 18,
  CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.endsWith('devProductCatalogue.cfm')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(CATALOGUE)); return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const file = join(REPO, normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, ''));
  try {
    if ((await stat(file)).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });

const map = (stack, weight) => page.evaluate(([s, w]) => window.SMPPush.mapFont(s, [], { weight: w }), [stack, weight || 400]);

console.log('resolver: exact families are preserved');
is(await map('Montserrat, sans-serif') === 'Montserrat', 'Montserrat → Montserrat');
is(await map('"Bebas Neue", sans-serif') === 'Bebas Neue', 'quoted Bebas Neue → Bebas Neue');
is(await map('Inter, "Helvetica Neue", Arial, sans-serif') === 'Inter', 'Inter stack → Inter (first entry wins)');
is(await map('Georgia, serif') === 'Georgia', 'Georgia → Georgia');

console.log('resolver: unsupported faces map by voice, never blanket Arial');
is(await map('"Playfair Display", Georgia, serif') === 'Bentham', 'Playfair Display → elegant serif (Bentham)', await map('"Playfair Display", Georgia, serif'));
is(await map('"Bodoni Moda", serif') === 'Bentham', 'Bodoni Moda → elegant serif');
is((await map('"Unknown Didone Display", serif')) !== 'Arial', 'unknown didone name stays serif-side', await map('"Unknown Didone Display", serif'));
is(await map('"Merriweather", serif') === 'Georgia', 'Merriweather → classic serif (Georgia)');
is(await map('"EB Garamond", serif') === 'Garamond', 'EB Garamond → Garamond');
is(await map('"Space Grotesk", sans-serif') === 'SchibstedGrotesk', 'Space Grotesk → a real grotesk', await map('"Space Grotesk", sans-serif'));
is(await map('"Some Grotesque Face", sans-serif') === 'Aktiv Grotesk', 'unknown grotesque → grotesk category');
is(await map('"DM Sans", sans-serif') === 'Poppins', 'DM Sans → geometric sans');
is(await map('"Jost", sans-serif') === 'Futura PT Book', 'Jost → Futura-class geometric');
is(await map('Barlow, sans-serif') === 'DIN Next LT Pro', 'Barlow → DIN-class sans');
is(await map('"Oswald", sans-serif') === 'League Gothic', 'Oswald → condensed display');
is(await map('"Barlow Condensed", sans-serif') === 'Trade Gothic Next Condensed', 'Barlow Condensed → condensed');
is(await map('"Space Mono", monospace') === 'Courier New', 'Space Mono → monospace');
is(await map('"Dancing Script", cursive') === 'Bermuda Script', 'Dancing Script → supported script');
is(await map('"Roboto Slab", serif') === 'Rockwell', 'Roboto Slab → slab');

console.log('resolver: stacks, generics and weight participate');
is(await map('"TotallyUnknownFace", Georgia, serif') === 'Georgia', 'unknown first entry falls to a later supported entry');
is(await map('"Unknownface One", "Unknownface Two", serif') === 'Times New Roman', 'generic serif tail is the last clue');
is(await map('"Unknownface", monospace') === 'Courier New', 'generic monospace tail respected');
is(await map('"Unknownface Sans", sans-serif', 900) === 'Swis721 Black', 'unknown heavy sans → a real black face, not faux-bold Arial');
is(await map('sans-serif') === 'Arial', 'bare generic sans → Arial (the correct last resort)');
is(await map('"Unknownface", sans-serif') === 'Arial', 'unknown regular-weight generic sans → Arial as last resort');

console.log('real pipeline: a multi-font card pushes with intent preserved');
await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
await page.waitForTimeout(300);
const result = await page.evaluate(async () => {
  const html = `<!DOCTYPE html><html><head><style>body{margin:0}
    .card{position:relative;width:360px;height:216px;background:#fff;overflow:hidden;font-family:Arial}
    .h{position:absolute;left:20px;top:16px;font-family:"Playfair Display",Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px}
    .s{position:absolute;left:20px;top:56px;font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:500}
    .b{position:absolute;left:20px;top:84px;font-family:Inter,"Helvetica Neue",Arial,sans-serif;font-size:11px;font-style:italic}
    .t{position:absolute;left:20px;top:112px;font-family:"Bebas Neue",sans-serif;font-size:15px}
    .m{position:absolute;left:20px;top:140px;font-family:"Space Mono",monospace;font-size:10px}
    .x{position:absolute;left:20px;top:166px;font-family:"Mystery Heavy Sans",sans-serif;font-weight:900;font-size:14px}
  </style></head><body><div class="card">
    <div class="h">Meridian &amp; Sloane</div>
    <div class="s">Design Studio</div>
    <div class="b">Considered branding for considered brands</div>
    <div class="t">EST 2020</div>
    <div class="m">hello@meridian.co</div>
    <div class="x">BOLD CLAIM</div>
  </div></body></html>`;
  generatedHtml = html;
  lastPayload = { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in', doubleSided: false };
  try {
    const { template } = await window.SMPPush.convertCurrentDesign();
    const texts = template.pages[0].canvasData.objects
      .filter((o) => /text/i.test(o.type))
      .map((o) => ({ text: (o.text || '').slice(0, 14), family: o.fontFamily,
        weight: o.fontWeight, style: o.fontStyle, charSpacing: o.charSpacing }));
    return { ok: true, texts };
  } catch (e) { return { ok: false, error: e.message }; }
});
is(result.ok, 'the real conversion ran', result.error || (result.texts.length + ' text objects'));
const t = (frag) => (result.texts || []).find((x) => x.text.indexOf(frag) === 0);
const headline = t('Meridian');
is(!!headline && headline.family === 'Bentham', 'serif headline → Bentham (NOT Arial)', headline && headline.family);
is(!!headline && headline.weight === 'bold', 'headline bold weight survives', headline && String(headline.weight));
is(!!headline && Math.abs((headline.charSpacing || 0)) > 0, 'headline letter-spacing survives', headline && String(headline.charSpacing));
const sub = t('Design Studio');
is(!!sub && sub.family === 'SchibstedGrotesk', 'grotesk subline → SchibstedGrotesk', sub && sub.family);
const body = t('Considered');
is(!!body && body.family === 'Inter', 'clean sans body → Inter exactly', body && body.family);
is(!!body && body.style === 'italic', 'italic survives', body && body.style);
const tag = t('EST 2020');
is(!!tag && tag.family === 'Bebas Neue', 'display condensed → Bebas Neue exactly', tag && tag.family);
const mono = t('hello@');
is(!!mono && mono.family === 'Courier New', 'monospace → Courier New', mono && mono.family);
const heavy = t('BOLD CLAIM');
is(!!heavy && (heavy.family === 'Nexa Black' || heavy.family === 'Swis721 Black'), 'unknown heavy sans → a real black face', heavy && heavy.family);
const arialCount = (result.texts || []).filter((x) => x.family === 'Arial').length;
is(arialCount === 0, 'NO text object collapsed to Arial in this design', arialCount + ' Arial objects');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
