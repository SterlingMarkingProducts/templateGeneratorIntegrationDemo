/* Push to Designer must not squish images. The preview crops with
   object-fit: cover; the Designer's Fabric sizes an image by naturals x
   independent scaleX/scaleY. This drives the REAL extraction pipeline in a
   browser and asserts that every pushed image object is distortion-free:
   scaleX equals scaleY wherever the browser cropped or contained. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8896;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CAT_SRC = await readFile(new URL('./test-product-type.mjs', import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ') + 18,
  CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));
const ENDPOINT = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === ENDPOINT) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(CATALOGUE)); return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
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
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });
await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('DS21218'));
await page.waitForTimeout(200);
await page.addScriptTag({ url: FOLDER + 'integration/adapters/mock-template-import.js' });

const result = await page.evaluate(async () => {
  const W = 18 * 96, H = 12 * 96;
  /* Portrait 1024x1536 photo forced through FOUR fits the model actually
     writes: a cover side-panel, a cover wide band, a contain inset, and a
     plain fill. Plus a mask-recoloured mark in a WIDE div (center/contain). */
  const PHOTO = 'assets/stock-photo-library/04-vertical-dentist-with-patient.png';
  const LOGO = 'assets/logo-library/22_dental_tooth.png';
  const html = `<!DOCTYPE html><html><head><style>body{margin:0}
    .card{position:relative;width:${W}px;height:${H}px;background:#f5f1e8;overflow:hidden;font-family:Arial}
    img{display:block}
    .p1{position:absolute;left:0;top:0;width:400px;height:${H}px;overflow:hidden}
    .p1 img{width:100%;height:100%;object-fit:cover}
    .p2{position:absolute;left:420px;top:0;width:700px;height:300px;overflow:hidden}
    .p2 img{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
    .p3{position:absolute;left:420px;top:340px;width:500px;height:280px}
    .p3 img{width:100%;height:100%;object-fit:contain}
    .p4{position:absolute;left:980px;top:340px;width:420px;height:200px}
    .p4 img{width:100%;height:100%}
    .mark{position:absolute;right:60px;bottom:60px;width:300px;height:140px;
      background:#c46a2b;-webkit-mask:url('${LOGO}') center/contain no-repeat;
      mask:url('${LOGO}') center/contain no-repeat}
    .head{position:absolute;left:440px;top:700px;font-size:90px;font-weight:800;color:#123a5e}
  </style></head><body><div class="card">
    <div class="p1"><img src="${PHOTO}"></div>
    <div class="p2"><img src="${PHOTO}"></div>
    <div class="p3"><img src="${PHOTO}"></div>
    <div class="p4"><img src="${PHOTO}"></div>
    <div class="mark"></div>
    <div class="head">Lakeside Dental</div>
  </div></body></html>`;
  generatedHtml = html;
  lastPayload = { templateType: 'Sign', width: 18, height: 12, unit: 'in', doubleSided: false };
  const mock = window.SMPMockTemplateImport.createMockImportEndpoint({});
  const transport = new window.SMPTransportImport.TemplateImportTransport({ baseUrl: '/mock', fetchImpl: mock });
  window.SMPPush.setTransportMode('import', transport);
  try {
    const { template } = await window.SMPPush.convertCurrentDesign();
    const out = await window.SMPPush.pushViaImport();
    const objs = template.pages[0].canvasData.objects
      .filter((o) => o.type === 'image' && o.sterlingType !== 'backgroundArt')
      .map((o) => ({
        left: o.left, top: o.top, w: o.width, h: o.height,
        scaleX: o.scaleX, scaleY: o.scaleY,
        dispW: Math.round(o.width * o.scaleX), dispH: Math.round(o.height * o.scaleY),
        aspect: Math.round((o.width / o.height) * 1000) / 1000,
        dataUri: String(o.src).startsWith('data:'),
      }));
    return { ok: true, objs, natural: { w: 1024, h: 1536 } };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally { window.SMPPush.setTransportMode('local'); }
});
is(result.ok === true, 'the pipeline ran', result.error || (result.objs.length + ' image objects'));
const o = result.objs;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const byPos = (x, y) => o.find((k) => near(k.left, x, 8) && near(k.top, y, 8));

console.log('\n1  object-fit: cover -> a cropped derivative, no axis distortion');
const p1 = byPos(0, 0);
is(!!p1 && p1.dataUri, 'the cover side-panel became a cropped derivative image');
is(!!p1 && near(p1.scaleX, p1.scaleY, 0.01),
   'with EQUAL x/y scale — no stretching', p1 && p1.scaleX + ' vs ' + p1.scaleY);
is(!!p1 && near(p1.aspect, 400 / 1152, 0.02),
   'and the derivative\'s own aspect matches the panel', p1 && String(p1.aspect));
const p2 = byPos(420, 0);
is(!!p2 && p2.dataUri && near(p2.scaleX, p2.scaleY, 0.01),
   'the wide cover band too — cropped, not squished');
is(!!p2 && near(p2.aspect, 700 / 300, 0.05), 'to the band\'s aspect', p2 && String(p2.aspect));

console.log('\n2  object-fit: contain -> the content box, no crop, no stretch');
const p3 = o.find((k) => near(k.top, 340, 8) && k.left > 400 && k.left < 700);
/* import mode inlines same-origin library files as data URIs (the 502 fix);
   the point here is the naturals stay the FULL image — nothing was cropped. */
is(!!p3 && near(p3.w, 1024, 2) && near(p3.h, 1536, 2),
   'the contained inset keeps the FULL image (no crop needed)', p3 && p3.w + 'x' + p3.h);
is(!!p3 && near(p3.scaleX, p3.scaleY, 0.001), 'equal scales', p3 && p3.scaleX + '/' + p3.scaleY);
is(!!p3 && near(p3.dispW, 280 * (1024 / 1536), 4) && near(p3.dispH, 280, 4),
   'sized to the letterboxed content, centred in its box', p3 && p3.dispW + 'x' + p3.dispH);

console.log('\n3  fill stays faithful to the (stretched) preview');
const p4 = byPos(980, 340);
is(!!p4 && near(p4.w, 1024, 2) && near(p4.dispW, 420, 3) && near(p4.dispH, 200, 3),
   'a fill image still maps to its box uncropped — the browser stretched it, so Fabric matching it is correct',
   p4 && p4.dispW + 'x' + p4.dispH);

console.log('\n4  the mask-recoloured mark keeps the silhouette\'s aspect');
const mk = o.find((k) => k.top > 900 && k.dataUri);
is(!!mk && near(mk.scaleX, mk.scaleY, 0.01),
   'contain geometry: equal scales inside the wide div', mk && mk.scaleX + '/' + mk.scaleY);
is(!!mk && mk.dispW <= 302 && mk.dispH <= 142,
   'inside the div box, not stretched across it', mk && mk.dispW + 'x' + mk.dispH);

console.log('\n5  every pushed image object is distortion-free');
const distorted = o.filter((k) => !near(k.scaleX, k.scaleY, 0.011)
  /* the deliberate fill case may differ — identify it by its box */
  && !(near(k.left, 980, 8) && near(k.top, 340, 8)));
is(distorted.length === 0, 'scaleX equals scaleY on every cropped/contained image',
   JSON.stringify(distorted));

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
