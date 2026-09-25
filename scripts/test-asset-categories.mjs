/* Asset categories survive the whole pipeline, and an ICON can never be artwork.
 *
 * Four immutable categories — photo, icon, logo, designAsset — are decided by
 * the SOURCE (library manifests / icon bank), never by how big the model drew
 * an element. The bug this guards against: a telephone icon from the icon
 * bank enlarged into hero artwork on all four generated business cards.
 *
 * Exercised end to end on the production app path with a live product:
 *   manifests → category resolver → rendered HTML (guard injected) → offscreen
 *   extraction → normalized design (assetKind) → Sterling adapter
 *   (sterlingAssetKind) → asset extraction → multipart manifest.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/templateGenerator/';
const PORT = 8917;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const PRODUCT_8914 = {
  id: 8914, partNumber: 'BCDP-CG', name: 'Vibrant Colour Business Cards - Classic Gloss',
  dimensions: { widthIn: 3.75, heightIn: 2.25, displayUnit: 'in', widthDisplay: '3.75', heightDisplay: '2.25' },
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
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ found: true, via: 'products', product: PRODUCT_8914 })); return;
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

/* ── fixtures: one real file from each library, straight from the manifests ── */
const logoMan = JSON.parse(await readFile(join(REPO, 'generator/assets/logo-asset-manifest.json'), 'utf8'));
const photoMan = JSON.parse(await readFile(join(REPO, 'generator/assets/stock-photo-manifest.json'), 'utf8'));
const designMan = JSON.parse(await readFile(join(REPO, 'generator/assets/design-asset-manifest.json'), 'utf8'));
const iconMan = JSON.parse(await readFile(join(REPO, 'generator/icons/manifest.json'), 'utf8'));
const LOGO = logoMan.logos[0].url;                 // assets/logo-library/01_orbital_loop.png (square)
const PHOTO = photoMan.photos[0].url;              // assets/stock-photo-library/…
const DESIGN = designMan.assets[0].url;            // assets/design-library/…
const PHONE_SVG = await readFile(join(REPO, 'generator/icons/minimal/phone.svg'), 'utf8');
const MAIL_SVG = await readFile(join(REPO, 'generator/icons/minimal/mail.svg'), 'utf8');
const sig = (svg) => (/ d="M\s*([-\d.]+,[-\d.]+)/.exec(String(svg || '')) || [, ''])[1];
const SIG_PHONE = sig(PHONE_SVG), SIG_MAIL = sig(MAIL_SVG);

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
page.on('pageerror', (e) => console.log('     [pageerror] ' + e.message));
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html?product=8914&mode=live&orientation=landscape`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection && window.SMPProductSelection.get
  && window.SMPProductSelection.get() !== null && window.SMPPush && window.SMPAssetCategory
  && window.SMPTransportImport, null, { timeout: 20000 });

/* ───────────────────────────────────────────────────────────────────────── */
console.log('1  the category comes from the manifests, and only from them');
const unit = await page.evaluate(({ logoUrls, photoUrls, designUrls, iconFiles }) => {
  const AC = window.SMPAssetCategory;
  const k = (s) => AC.kindFromSrc(s);
  const wrong = (urls, want) => urls.filter((u) => k(u) !== want).slice(0, 3);
  return {
    kinds: AC.KINDS.slice(),
    manifests: {
      logo: wrong(logoUrls, 'logo'), photo: wrong(photoUrls, 'photo'),
      design: wrong(designUrls, 'designAsset'), icon: wrong(iconFiles, 'icon'),
      counts: [logoUrls.length, photoUrls.length, designUrls.length, iconFiles.length],
    },
    absolute: k(location.origin + '/templateGenerator/generator/assets/design-library/x.png'),
    nonLibrary: [k('assets/other/thing.png'), k('data:image/png;base64,AAAA'), k(''), k(null)],
    rootsDisjoint: (() => {
      const all = [].concat(...Object.values(AC.ROOTS));
      return all.every((a) => all.every((b) => a === b || (!a.startsWith(b) && !b.startsWith(a))));
    })(),
  };
}, {
  logoUrls: logoMan.logos.map((l) => l.url),
  photoUrls: photoMan.photos.map((p) => p.url),
  designUrls: designMan.assets.map((a) => a.url),
  iconFiles: iconMan.icons.map((i) => 'icons/' + i.collection + '/' + i.name + '.svg'),
});
is(JSON.stringify(unit.kinds) === JSON.stringify(['photo', 'icon', 'logo', 'designAsset']),
   'exactly the four categories exist', unit.kinds.join(','));
is(unit.rootsDisjoint, 'the four library roots are disjoint (no path can be two things)');
is(unit.manifests.logo.length === 0, 'every logo-manifest url resolves to logo',
   unit.manifests.counts[0] + ' logos ' + unit.manifests.logo.join(','));
is(unit.manifests.photo.length === 0, 'every stock-photo-manifest url resolves to photo',
   unit.manifests.counts[1] + ' photos ' + unit.manifests.photo.join(','));
is(unit.manifests.design.length === 0, 'every design-asset-manifest url resolves to designAsset',
   unit.manifests.counts[2] + ' assets ' + unit.manifests.design.join(','));
is(unit.manifests.icon.length === 0, 'every icon-bank file resolves to icon',
   unit.manifests.counts[3] + ' icons ' + unit.manifests.icon.join(','));
is(unit.absolute === 'designAsset', 'an absolute URL under the production app path still resolves by root');
is(unit.nonLibrary.every((v) => v === null), 'a non-library path / data URI / empty src is NOT categorised (no fallback)',
   JSON.stringify(unit.nonLibrary));

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n2  the prompt states the contract and every render carries the guard');
const engineSrc = await readFile(join(REPO, 'generator/engine.js'), 'utf8');
is(/ASSET CATEGORIES ARE FIXED/.test(engineSrc), 'engine.js tells the model the four categories are fixed');
is(/never .*background|never as .*hero|never as background/i.test(engineSrc.slice(engineSrc.indexOf('ASSET CATEGORIES ARE FIXED'), engineSrc.indexOf('ASSET CATEGORIES ARE FIXED') + 1500)),
   'and that an icon is never hero/background artwork');
const rendered = await page.evaluate(() => {
  const html = '<!DOCTYPE html><html><head></head><body><div class="card"></div></body></html>';
  const out = renderPreviewHtml(html, { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in' });
  const stripped = window.SMPPush.stripPreviewDecorations(out);
  const two = renderPreviewHtml('<!DOCTYPE html><html><head></head><body>'
    + '<div class="card card--front"><div>Camille Rousseau</div></div>'
    + '<div class="card card--back" style="display:none"><div>Back</div></div></body></html>',
    { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in', doubleSided: true });
  const gi = out.indexOf('id="asset-category-guard"');
  return {
    inHead: gi > -1 && gi < out.indexOf('</head>'),
    /* the same rendered card with and without the guard must read the same */
    contactSide: detectContactDomSideFromHtml(two) === detectContactDomSideFromHtml(
      two.replace(/<script id="asset-category-guard">[\s\S]*?<\/script>/, '')) ? 'unchanged' : 'changed',
    guardInPreview: out.includes('id="asset-category-guard"'),
    guardSurvivesStrip: stripped.includes('id="asset-category-guard"'),
    layoutScriptStripped: !stripped.includes('id="layout-safety-script"'),
    once: out.split('id="asset-category-guard"').length - 1,
  };
});
is(rendered.guardInPreview, 'renderPreviewHtml injects the asset-category guard');
is(rendered.once === 1, 'exactly once', String(rendered.once));
is(rendered.inHead, 'the guard lives in <head>, outside every card\'s markup');
is(rendered.contactSide === 'unchanged',
   'the guard\'s own source never tips contact-side detection toward the back card', rendered.contactSide);
is(rendered.guardSurvivesStrip && rendered.layoutScriptStripped,
   'the guard is not a preview decoration: it survives stripping while layout scripts are removed');

/* ───────────────────────────────────────────────────────────────────────── */
/* The design under test: a business card at the reference 360x216 with
 *   · a HERO phone icon (160px, top-right, no text within reach)  -> must go
 *   · a 60px phone icon beside a second phone number               -> clamped
 *   · an 18px phone icon beside the phone number                   -> kept as is
 *   · an 18px mail icon beside the e-mail                          -> kept as is
 *   · the library logo in a 120x40 box with object-fit: cover       -> contain
 *   · a stock photo as a cover-cropped left panel                    -> untouched
 *   · a design asset as a large translucent accent                   -> untouched
 *   · the library logo again as a CSS-mask mark                      -> logo    */
const DESIGN_HTML = `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:360px;height:216px;background:#f4efe6;overflow:hidden;font-family:Arial}
  .photo{position:absolute;left:0;top:0;width:120px;height:216px;object-fit:cover}
  .accent{position:absolute;left:100px;top:-20px;width:300px;height:200px;opacity:.35}
  .logo{position:absolute;left:140px;top:16px;width:120px;height:40px;object-fit:cover}
  .mark{position:absolute;left:300px;top:170px;width:40px;height:40px;background:#123a5e;
        -webkit-mask:url(${LOGO}) no-repeat center;mask:url(${LOGO}) no-repeat center;
        -webkit-mask-size:100% 100%;mask-size:100% 100%}
  .hero{position:absolute;right:8px;top:8px;width:160px;height:160px;color:#c98a2b}
  .name{position:absolute;left:140px;top:64px;color:#123a5e;font-size:16px;font-weight:700}
  .ico{position:absolute;width:18px;height:18px;color:#123a5e}
  .big{position:absolute;left:140px;top:124px;width:60px;height:60px;color:#123a5e}
  .p{position:absolute;left:164px;top:100px;color:#123a5e;font-size:11px;line-height:18px}
  .p2{position:absolute;left:206px;top:146px;color:#123a5e;font-size:11px;line-height:18px}
  .e{position:absolute;left:164px;top:192px;color:#123a5e;font-size:11px;line-height:18px}
</style></head><body><div class="card">
  <img class="photo" src="${PHOTO}" alt="">
  <img class="accent" src="${DESIGN}" alt="">
  <img class="logo" src="${LOGO}" alt="">
  <div class="mark"></div>
  <span class="hero" data-icon-name="phone">${PHONE_SVG}</span>
  <div class="name">Lakeside Clinic</div>
  <span class="ico" style="left:140px;top:100px" data-icon-name="phone">${PHONE_SVG}</span>
  <div class="p">555-0100</div>
  <span class="big" data-icon-name="phone">${PHONE_SVG}</span>
  <div class="p2">555-0199</div>
  <span class="ico" style="left:140px;top:192px" data-icon-name="mail">${MAIL_SVG}</span>
  <div class="e">hello@lakeside.ca</div>
</div></body></html>`;

console.log('\n3  the in-frame guard: what the preview shows is already corrected');
const guard = await page.evaluate(async (html) => {
  const out = renderPreviewHtml(html, { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in' });
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-5000px;top:0;width:400px;height:300px;border:0';
  document.body.appendChild(f);
  await new Promise((r) => { f.addEventListener('load', r, { once: true }); f.srcdoc = out; });
  await new Promise((r) => setTimeout(r, 900));
  const w = f.contentWindow, d = f.contentDocument;
  /* CSS layout sizes: the preview cover-scales the body to its frame, so
   * bounding rects are transformed; offsetWidth is what the design says. */
  const icons = [...d.querySelectorAll('[data-icon-name]')].map((s) => ({
    name: s.getAttribute('data-icon-name'), cls: s.className, kind: s.getAttribute('data-asset-kind'),
    guard: s.getAttribute('data-asset-guard'), w: s.offsetWidth, h: s.offsetHeight,
    shown: getComputedStyle(s).display !== 'none' }));
  const img = (sel) => { const e = d.querySelector(sel);
    return { kind: e.getAttribute('data-asset-kind'), fit: getComputedStyle(e).objectFit,
      w: e.offsetWidth, h: e.offsetHeight, nat: [e.naturalWidth, e.naturalHeight] }; };
  const mark = d.querySelector('.mark');
  const ms = getComputedStyle(mark);
  const res = { report: w.__smpAssetGuardReport, runs: w.__smpAssetGuardDone, icons,
    photo: img('.photo'), accent: img('.accent'), logo: img('.logo'),
    mark: { kind: mark.getAttribute('data-asset-kind'), maskSize: ms.webkitMaskSize || ms.maskSize } };
  f.remove();
  return res;
}, DESIGN_HTML);
console.log('     report: ' + JSON.stringify(guard.report));
console.log('     icons:  ' + JSON.stringify(guard.icons));
is(guard.runs > 0, 'the guard ran in the frame', String(guard.runs));
const hero = guard.icons.find((i) => i.cls === 'hero');
const big = guard.icons.find((i) => i.cls === 'big');
const small = guard.icons.filter((i) => /\bico\b/.test(i.cls));
is(hero && hero.guard === 'removed' && !hero.shown, 'the 160px hero PHONE is removed (an icon has no hero placement)', JSON.stringify(hero));
is(big && big.guard === 'clamped' && big.shown && big.w <= 36 && big.h <= 36 && big.w >= 16,
   'the 60px phone beside its phone number is shrunk to the 16-36px band', JSON.stringify(big));
is(small.length === 2 && small.every((i) => i.guard === null && i.shown && i.w === 18 && i.h === 18),
   'the 18px phone + mail beside their lines are left exactly as drawn', JSON.stringify(small));
is(guard.icons.every((i) => i.kind === 'icon'), 'every icon-bank span is tagged data-asset-kind="icon"');
is(guard.icons.every((i) => !i.shown || (i.w <= 48 && i.h <= 48)), 'no visible icon exceeds the 48px absolute maximum on 360x216');
is(guard.logo.kind === 'logo' && guard.logo.fit === 'contain', 'the logo <img> is tagged logo and object-fit: cover became contain', JSON.stringify(guard.logo));
is(guard.mark.kind === 'logo' && /contain/.test(guard.mark.maskSize), 'the CSS-mask logo is tagged logo and its mask-size became contain', JSON.stringify(guard.mark));
is(guard.photo.kind === 'photo' && guard.photo.fit === 'cover' && guard.photo.w === 120 && guard.photo.h === 216,
   'the photo panel is tagged photo and its cover crop is untouched', JSON.stringify(guard.photo));
is(guard.accent.kind === 'designAsset' && guard.accent.w === 300 && guard.accent.h === 200,
   'the design asset is tagged designAsset and its hero size is untouched', JSON.stringify(guard.accent));
is(guard.report && guard.report.removed.length === 1 && guard.report.removed[0].name === 'phone',
   'the report names the one removed icon', JSON.stringify(guard.report && guard.report.removed));

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n4  the category rides the normalized design into the Sterling handoff');
const handoff = await page.evaluate(async (html) => {
  generatedHtml = html;                       // raw: extraction must add the guard itself
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: false };
  const { template } = await window.SMPPush.convertCurrentDesign();
  const built = await window.SMPTransportImport.buildRequest(template, window.SMPProductSelection.get(), {});
  const fd = window.SMPTransportImport.toFormData(built);
  const mp = fd.get('manifest');
  const manifestPart = JSON.parse(typeof mp === 'string' ? mp : await mp.text());
  const pick = (objs) => (objs || []).filter((o) => o.type === 'image').map((o) => ({
    kind: o.sterlingAssetKind || null, st: o.sterlingType || null,
    w: o.width * (o.scaleX || 1), h: o.height * (o.scaleY || 1), x: o.left, y: o.top,
    ref: o.importAssetRef || null,
    src: typeof o.src === 'string' ? o.src.slice(0, 80) : null,
    sig: (typeof o.src === 'string' && o.src.indexOf('data:image/svg+xml;base64,') === 0)
      ? atob(o.src.slice('data:image/svg+xml;base64,'.length)) : null }));
  return {
    canvasW: template.pages[0].canvasProperties ? template.pages[0].canvasProperties.width : null,
    props: Object.keys(template.pages[0]),
    fromTemplate: pick((typeof template.pages[0].canvasData === 'string'
      ? JSON.parse(template.pages[0].canvasData) : (template.pages[0].canvasData || {})).objects),
    fromWire: pick(manifestPart.pages[0].canvasJson.objects),
  };
}, DESIGN_HTML);
const wire = handoff.fromWire.map((o) => ({ ...o, sig: o.sig ? sig(o.sig) : null }));
console.log('     canvas width: ' + handoff.canvasW + '  page keys: ' + handoff.props.join(','));
console.log('     wire objects: ' + JSON.stringify(wire.map((o) => ({ k: o.kind, st: o.st, w: Math.round(o.w), h: Math.round(o.h), sig: o.sig, ref: o.ref }))));
const factor = handoff.canvasW ? handoff.canvasW / 360 : null;   // canvas units per CSS px of the 360px trim-authored card
const icons = wire.filter((o) => o.kind === 'icon');
const phones = icons.filter((o) => o.sig === SIG_PHONE);
const mails = icons.filter((o) => o.sig === SIG_MAIL);
is(icons.length === 3, 'three icon objects reach the wire (hero phone gone; two phones + mail kept)', icons.length + ' icons');
is(phones.length === 2 && mails.length === 1, 'they are two PHONES and one ENVELOPE, each carrying its own artwork');
is(icons.every((o) => o.st === 'vectorArt'), 'icons still travel as vectorArt');
const ABS_MAX_UNITS = 48 * (factor || 1);
is(factor && icons.every((o) => o.w <= ABS_MAX_UNITS + 0.5 && o.h <= ABS_MAX_UNITS + 0.5),
   'no icon on the wire exceeds the 48px absolute maximum (canvas units)',
   icons.map((o) => Math.round(o.w) + 'x' + Math.round(o.h)).join(', ') + ' vs max ' + Math.round(ABS_MAX_UNITS));
is(factor && phones.some((o) => Math.abs(o.w - 18 * factor) < 1.5), 'the small phone beside the number is at its drawn 18px');
is(factor && phones.some((o) => o.w > 20 * factor && o.w <= 36 * factor + 0.5), 'the clamped phone lands inside the 16-36px band');
const logos = wire.filter((o) => o.kind === 'logo');
const photos = wire.filter((o) => o.kind === 'photo');
const designs = wire.filter((o) => o.kind === 'designAsset');
is(logos.length === 2, 'both logo placements (img + mask) carry sterlingAssetKind "logo"', logos.length + ' logos');
is(logos.every((o) => Math.abs(o.w / o.h - 1) < 0.05), 'the square logo keeps its aspect (object-fit cover did not crop it)',
   logos.map((o) => (o.w / o.h).toFixed(3)).join(', '));
is(photos.length === 1 && factor && Math.abs(photos[0].w - 120 * factor) < 1.5 && Math.abs(photos[0].h - 216 * factor) < 1.5,
   'the photo carries "photo" and keeps its cover-cropped panel box', JSON.stringify(photos.map((o) => [Math.round(o.w), Math.round(o.h)])));
is(designs.length === 1 && factor && Math.abs(designs[0].w - 300 * factor) < 1.5,
   'the design asset carries "designAsset" at its full hero width', JSON.stringify(designs.map((o) => [Math.round(o.w), Math.round(o.h)])));
is(wire.every((o) => ['icon', 'logo', 'photo', 'designAsset', 'raster'].includes(o.kind)),
   'every image object carries one of the four library categories or is the Generator\'s own raster snapshot',
   wire.map((o) => o.kind).join(','));
is(wire.filter((o) => o.kind === 'raster').every((o) => o.st === 'backgroundArt'),
   'the only uncategorised object is the background snapshot (never a library asset)');
is(wire.filter((o) => !o.kind || o.kind === 'raster').every((o) => o.st !== 'vectorArt' || !o.sig || (o.sig !== SIG_PHONE && o.sig !== SIG_MAIL)),
   'no icon artwork escaped its category (nothing untagged carries a phone/envelope)');
is(JSON.stringify(handoff.fromTemplate.map((o) => o.kind)) === JSON.stringify(handoff.fromWire.map((o) => o.kind)),
   'the category on the wire equals the category the adapter wrote (asset extraction preserved it)');
is(photos.every((o) => o.ref) && designs.every((o) => o.ref) && icons.every((o) => !o.ref),
   'raster library assets go out as asset refs, icons stay inline vectors');

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n5  the model refuses to guess a category, and nothing substitutes across categories');
const model = await page.evaluate(() => {
  const N = window.SMPNormalized;
  const base = { x: 0, y: 0, width: 10, height: 10, naturalWidth: 10, naturalHeight: 10, src: 'data:,' };
  const out = { dflt: N.image(base).assetKind, icon: N.image({ ...base, assetKind: 'icon' }).assetKind };
  try { N.image({ ...base, assetKind: 'hero' }); out.bogus = 'accepted'; } catch (e) { out.bogus = e.message; }
  try { N.image({ ...base, assetKind: 'clipart' }); out.bogus2 = 'accepted'; } catch (e) { out.bogus2 = e.message; }
  const A = window.SterlingLegacyAdapter || window.SMPSterlingLegacy;
  return out;
});
is(model.dflt === 'raster', 'an image without a source category is a plain raster, never guessed into a library kind', model.dflt);
is(model.icon === 'icon', 'a declared category is kept verbatim');
is(/assetKind must be one of/.test(model.bogus) && /assetKind must be one of/.test(model.bogus2),
   'an unknown category is refused, not coerced', model.bogus);
const resolve = await page.evaluate(({ LOGO, DESIGN, PHOTO }) => {
  const AC = window.SMPAssetCategory;
  const d = document.implementation.createHTMLDocument('x');
  const mk = (html) => { const w = d.createElement('div'); w.innerHTML = html; d.body.appendChild(w); return w.firstElementChild; };
  const bigDesign = mk(`<img src="${DESIGN}" style="width:16px;height:16px">`);   // tiny design asset: still NOT an icon
  const hugeIconWrap = mk(`<span data-icon-name="phone" style="width:300px;height:300px"><svg viewBox="0 0 24 24"><path d="M1,1"/></svg></span>`);
  const logoImg = mk(`<img src="${LOGO}" style="width:340px;height:200px">`);      // big logo: still a logo
  const photo = mk(`<img src="${PHOTO}" style="width:12px;height:12px">`);
  const svgLogo = mk('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
  const tagged = mk('<img src="data:image/png;base64,AAAA" data-asset-kind="photo">');
  const badTag = mk('<img src="data:image/png;base64,AAAA" data-asset-kind="hero">');
  return {
    tinyDesign: AC.resolveElement(bigDesign, d),
    hugeIcon: AC.resolveElement(hugeIconWrap, d), hugeIconSvg: AC.resolveElement(hugeIconWrap.firstElementChild, d),
    bigLogo: AC.resolveElement(logoImg, d), tinyPhoto: AC.resolveElement(photo, d),
    svgLogo: AC.resolveElement(svgLogo, d), tagged: AC.resolveElement(tagged, d), badTag: AC.resolveElement(badTag, d),
  };
}, { LOGO, DESIGN, PHOTO });
is(resolve.tinyDesign === 'designAsset', 'a 16px design-library file is a designAsset, not an icon (size is not a category)', resolve.tinyDesign);
is(resolve.hugeIcon === 'icon' && resolve.hugeIconSvg === 'icon', 'a 300px icon-bank icon is still an icon (so the size rule applies to it)', resolve.hugeIcon);
is(resolve.bigLogo === 'logo' && resolve.tinyPhoto === 'photo', 'a huge logo is a logo, a tiny photo is a photo');
is(resolve.svgLogo === 'logo', 'a hand-drawn/user SVG outside the icon bank is the brand mark');
is(resolve.tagged === 'photo', 'the Generator\'s own upload tag is authoritative');
is(resolve.badTag === null, 'an unknown tag is ignored rather than trusted', String(resolve.badTag));

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n6  the guard scales with the canvas and leaves non-icon products alone');
const scaled = await page.evaluate(async (html) => {
  /* the same card at 2x: a 60px icon there is a 30px icon on the reference canvas */
  const big = html.replace('width:360px;height:216px', 'width:720px;height:432px')
    .replace('class="big"', 'class="big" style="width:60px;height:60px;left:280px;top:256px"')
    .replace('class="p2"', 'class="p2" style="left:344px;top:276px"');
  const out = renderPreviewHtml(big, { templateType: 'Business Card', width: 7.5, height: 4.5, unit: 'in' });
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-5000px;top:0;width:800px;height:500px;border:0';
  document.body.appendChild(f);
  await new Promise((r) => { f.addEventListener('load', r, { once: true }); f.srcdoc = out; });
  await new Promise((r) => setTimeout(r, 900));
  const d = f.contentDocument;
  const el = d.querySelector('.big');
  const res = { guard: el.getAttribute('data-asset-guard'), w: el.offsetWidth, limits: window.SMPAssetCategory.iconLimits(720, 432) };
  f.remove(); return res;
}, DESIGN_HTML);
is(scaled.limits.absoluteMax === 96 && scaled.limits.normalMax === 72, 'limits scale with the canvas short side', JSON.stringify(scaled.limits));
is(scaled.guard === null && scaled.w === 60, 'a 60px icon on a 720x432 canvas is within band and untouched', JSON.stringify(scaled));

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n7  an icon must sit beside the information it stands for — on either side of the card');
/* Render `html` exactly as the preview does, optionally flip to the back the
 * way the app does (inline display toggle, no reload), and report every icon. */
async function renderIcons(html, opts = {}) {
  return page.evaluate(async ({ html, opts }) => {
    const out = renderPreviewHtml(html, { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in' });
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-5000px;top:0;width:' + (opts.frameW || 400) + 'px;height:300px;border:0';
    document.body.appendChild(f);
    await new Promise((r) => { f.addEventListener('load', r, { once: true }); f.srcdoc = out; });
    await new Promise((r) => setTimeout(r, 900));
    const d = f.contentDocument;
    if (opts.flip) {
      d.querySelector('.card--front').style.display = 'none';
      d.querySelector('.card--back').style.display = 'block';
      await new Promise((r) => setTimeout(r, 900));
    }
    const icons = [...d.querySelectorAll('[data-icon-name]')].map((s) => {
      const r = s.getBoundingClientRect(), root = s.closest('.card') || d.body, rr = root.getBoundingClientRect();
      const k = rr.width ? root.offsetWidth / rr.width : 1;         // undo the preview's body scale only
      return { id: s.id || s.className, name: s.getAttribute('data-icon-name'),
        guard: s.getAttribute('data-asset-guard'), reason: s.getAttribute('data-asset-guard-reason'),
        shown: getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden',
        vw: Math.round(r.width * k), vh: Math.round(r.height * k) };
    });
    const report = f.contentWindow.__smpAssetGuardReport;
    f.remove();
    return { icons, report };
  }, { html, opts });
}
const ico = (name, svg, id, style) => `<span id="${id}" data-icon-name="${name}" style="position:absolute;display:inline-block;color:#333;${style}">${svg}</span>`;
const GLOBE_SVG = await readFile(join(REPO, 'generator/icons/minimal/globe.svg'), 'utf8');
const PIN_SVG = await readFile(join(REPO, 'generator/icons/minimal/map-pin.svg'), 'utf8');
const STAR_SVG = await readFile(join(REPO, 'generator/icons/minimal/star.svg'), 'utf8');
const CARD = (inner, extraCss = '') => `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:360px;height:216px;background:#f3eee4;overflow:hidden;font-family:Georgia}
  .t{position:absolute;color:#333;white-space:nowrap}${extraCss}</style></head><body><div class="card">${inner}</div></body></html>`;

/* 7a — the reported card: a ~64px phone beside the NAME/TITLE, no phone number anywhere */
const shot = await renderIcons(CARD(`
  <div class="t" style="left:120px;top:30px;font-size:26px">Eleanor Vance</div>
  <div class="t" style="left:120px;top:66px;font-size:13px;font-style:italic">Doctor of Chiropractic</div>
  ${ico('phone', PHONE_SVG, 'shotPhone', 'left:20px;top:84px;width:64px;height:56px')}`));
const sp = shot.icons.find((i) => i.id === 'shotPhone');
is(sp && sp.guard === 'removed' && !sp.shown,
   'a 64px phone next to "Doctor of Chiropractic" with no phone number is REMOVED, not merely shrunk', JSON.stringify(sp));

/* 7b — even a correctly-sized phone is not placed beside the wrong information */
const wrong = await renderIcons(CARD(`
  <div class="t" style="left:44px;top:66px;font-size:13px">Doctor of Chiropractic</div>
  ${ico('phone', PHONE_SVG, 'smallWrong', 'left:20px;top:66px;width:18px;height:18px')}
  <div class="t" style="left:44px;top:120px;font-size:12px">www.vancechiro.ca</div>
  ${ico('mail', MAIL_SVG, 'mailWrong', 'left:20px;top:120px;width:18px;height:18px')}`));
is(wrong.icons.every((i) => i.guard === 'removed' && !i.shown),
   'an 18px phone beside a job title, and an 18px envelope beside a web address, are both removed',
   JSON.stringify(wrong.icons.map((i) => [i.id, i.guard, i.reason])));

/* 7c — contact rows: each small icon beside ITS OWN line is kept exactly as drawn */
const rows = await renderIcons(CARD(`
  ${ico('phone', PHONE_SVG, 'rPhone', 'left:20px;top:40px;width:16px;height:16px')}
  <div class="t" style="left:42px;top:40px;font-size:12px">(416) 555-0100</div>
  ${ico('mail', MAIL_SVG, 'rMail', 'left:20px;top:70px;width:16px;height:16px')}
  <div class="t" style="left:42px;top:70px;font-size:12px">eleanor@vancechiro.ca</div>
  ${ico('globe', GLOBE_SVG, 'rWeb', 'left:20px;top:100px;width:16px;height:16px')}
  <div class="t" style="left:42px;top:100px;font-size:12px">vancechiro.ca</div>
  ${ico('map-pin', PIN_SVG, 'rPin', 'left:20px;top:130px;width:16px;height:16px')}
  <div class="t" style="left:42px;top:130px;font-size:12px">12 King St W, Toronto ON M5H 1A1</div>
  ${ico('star', STAR_SVG, 'rStar', 'left:20px;top:160px;width:16px;height:16px')}
  <div class="t" style="left:42px;top:160px;font-size:12px">Sports injury care</div>`));
is(rows.icons.length === 5 && rows.icons.every((i) => i.guard === null && i.shown && i.vw === 16),
   'phone, envelope, globe, pin and a generic star beside their own lines are all kept at 16px',
   JSON.stringify(rows.icons.map((i) => [i.id, i.guard, i.reason, i.vw])));

/* 7d — an icon made large by transform, or shown by an !important rule, cannot slip past */
const sneaky = await renderIcons(CARD(`
  ${ico('phone', PHONE_SVG, 'scaled', 'left:40px;top:90px;width:18px;height:18px;transform:scale(3.5)')}
  <div class="t" style="left:112px;top:90px;font-size:12px">416-555-0100</div>
  <span id="forced" class="forced" data-icon-name="phone" style="position:absolute;left:180px;top:20px;width:150px;height:150px">${PHONE_SVG}</span>`,
  '.forced{display:inline-block!important;visibility:visible!important}'));
const sc = sneaky.icons.find((i) => i.id === 'scaled'), fo = sneaky.icons.find((i) => i.id === 'forced');
is(sc && sc.shown && sc.vw <= 36 && sc.vh <= 36, 'a phone blown up with transform:scale(3.5) is measured as drawn and brought back to ≤36px',
   JSON.stringify(sc));
is(fo && !fo.shown && fo.guard === 'removed', 'a hero phone forced visible with display/visibility !important is still removed', JSON.stringify(fo));

/* 7e — two-sided product: the BACK is judged too, including after the app flips to it */
const TWO_SIDED = `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:360px;height:216px;background:#f3eee4;overflow:hidden;font-family:Georgia}
  .t{position:absolute;color:#333;white-space:nowrap}</style></head><body>
  <div class="card card--front">
    <div class="t" style="left:120px;top:30px;font-size:26px">Eleanor Vance</div>
    <div class="t" style="left:120px;top:66px;font-size:13px">Doctor of Chiropractic</div>
    ${ico('phone', PHONE_SVG, 'frontPhone', 'left:20px;top:84px;width:64px;height:56px')}
  </div>
  <div class="card card--back" style="display:none">
    <div class="t" style="left:120px;top:40px;font-size:18px">Vance Chiropractic</div>
    ${ico('phone', PHONE_SVG, 'backHero', 'left:16px;top:60px;width:90px;height:90px')}
    ${ico('phone', PHONE_SVG, 'backOk', 'left:120px;top:120px;width:16px;height:16px')}
    <div class="t" style="left:142px;top:120px;font-size:12px">(416) 555-0100</div>
  </div></body></html>`;
const back = await renderIcons(TWO_SIDED, { flip: true });
const byId = Object.fromEntries(back.icons.map((i) => [i.id, i]));
is(byId.frontPhone && byId.frontPhone.guard === 'removed', 'front: the phone beside the title is removed', JSON.stringify(byId.frontPhone));
is(byId.backHero && byId.backHero.guard === 'removed' && !byId.backHero.shown,
   'back: the 90px phone is removed once the back is shown', JSON.stringify(byId.backHero));
is(byId.backOk && byId.backOk.guard === null && byId.backOk.shown && byId.backOk.vw === 16,
   'back: the 16px phone beside the number is kept', JSON.stringify(byId.backOk));

/* 7g — the second live report (build tier1-30): a two-sided 8914 card whose
 * front has a cream copy panel and a photo panel, the phone number wrapped in a
 * narrow column at the bottom right of the copy panel, and a huge phone icon at
 * the bottom left running off the card. Both a ~150px and a ~100px version. */
const PHOTO_PANEL = `<img src="${PHOTO}" style="position:absolute;left:248px;top:0;width:112px;height:216px;object-fit:cover" alt="">`;
const SECOND = (iconStyle) => `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:360px;height:216px;background:#f1ece2;overflow:hidden;font-family:Georgia}
  .t{position:absolute;color:#2f3a34}</style></head><body>
  <div class="card card--front">
    <div class="t" style="left:18px;top:66px;font-size:16px;white-space:nowrap">Dr. Elena Marsh</div>
    <div class="t" style="left:18px;top:96px;font-size:8px;letter-spacing:3px;white-space:nowrap">DOCTOR OF CHIROPRACTIC</div>
    <div class="t" style="left:182px;top:176px;width:30px;font-size:9px;line-height:12px">+1 415 208 7740</div>
    ${ico('phone', PHONE_SVG, 'liveHero', iconStyle)}
    ${PHOTO_PANEL}
  </div>
  <div class="card card--back" style="display:none"><div class="t" style="left:120px;top:90px;font-size:18px">MERIDIAN</div></div>
  </body></html>`;
for (const [label, st] of [['150px', 'left:18px;top:117px;width:150px;height:130px'],
                           ['100px', 'left:18px;top:110px;width:100px;height:100px']]) {
  const r = await renderIcons(SECOND(st));
  const hero = r.icons.find((i) => i.id === 'liveHero');
  is(hero && hero.guard === 'removed' && !hero.shown,
     `the ${label} phone at the bottom left of the reported card is removed`, JSON.stringify(hero));
}

/* 7f — and the push of that two-sided design carries neither misplaced phone */
const twoPush = await page.evaluate(async (html) => {
  generatedHtml = html;
  lastPayload = { templateType: 'Business Card', width: 3.75, height: 2.25, unit: 'in', doubleSided: true };
  const { template } = await window.SMPPush.convertCurrentDesign();
  return template.pages.map((pg) => {
    const objs = (typeof pg.canvasData === 'string' ? JSON.parse(pg.canvasData) : pg.canvasData).objects || [];
    return objs.filter((o) => o.sterlingAssetKind === 'icon').map((o) => Math.round(o.width * (o.scaleX || 1)));
  });
}, TWO_SIDED);
is(twoPush.length === 2, 'both sides are pushed', JSON.stringify(twoPush));
is(twoPush.flat().length === 1 && twoPush.flat()[0] <= 17,
   'across both pages exactly one icon is pushed: the 16px phone beside the number', JSON.stringify(twoPush));

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n8  plant artwork the model drew itself never reaches the preview');
const FOLIAGE = 'assets/design-library/02_Soft_Green_Foliage_Spray.png';
const botan = await page.evaluate(({ FOLIAGE, PHONE_SVG }) => {
  const customer = '<svg class="leaf-logo" viewBox="0 0 10 10"><path d="M1 9 C 3 1, 7 1, 9 9"/></svg>';
  document.getElementById('svgPaste').value = customer;
  const html = '<!DOCTYPE html><html><head><style>.card{position:relative;width:360px;height:216px}</style></head><body>'
    + '<div class="card card--front">'
    + '<div class="sprig sprig--tl"><svg viewBox="0 0 40 80"><path d="M20 80 C 20 40, 20 20, 20 0"/><ellipse cx="14" cy="20" rx="6" ry="3"/></svg></div>'
    + '<svg class="corner" viewBox="0 0 10 10"><!-- leaf spray --><g id="leaf-3"><ellipse cx="5" cy="5" rx="3" ry="1"/></g></svg>'
    + '<div class="botanical-border" style="background:url(&quot;data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'/>&quot;)"></div>'
    + '<svg class="arc-rule" viewBox="0 0 100 10"><path d="M0 10 Q 50 0 100 10"/></svg>'
    + '<span data-icon-name="leaf">' + PHONE_SVG + '</span>'
    + customer
    + '<img class="spray" src="' + FOLIAGE + '" style="position:absolute;width:60px">'
    + '<div class="name">Olivia Wilson</div></div>'
    + '<div class="card card--back" style="display:none"><div class="name">Back</div></div></body></html>';
  const out = renderPreviewHtml(html, { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in', doubleSided: true });
  const d = new DOMParser().parseFromString(out, 'text/html');
  document.getElementById('svgPaste').value = '';
  return {
    removed: window.SMPLastBotanicalStrip,
    sprig: !!d.querySelector('.sprig'), leafGroup: !!d.querySelector('#leaf-3'),
    border: !!d.querySelector('.botanical-border'), arc: !!d.querySelector('.arc-rule'),
    icon: !!d.querySelector('[data-icon-name="leaf"] svg'), customer: !!d.querySelector('svg.leaf-logo'),
    library: !!d.querySelector('img.spray[src="' + FOLIAGE + '"]'),
    back: /class="card card--back" style="display:none"/.test(out), doctype: /^<!DOCTYPE html>/i.test(out),
    name: /Olivia Wilson/.test(out),
  };
}, { FOLIAGE, PHONE_SVG });
console.log('     removed: ' + JSON.stringify(botan.removed));
is(!botan.sprig, 'an inline SVG in a "sprig" wrapper is removed, wrapper and all');
is(!botan.leafGroup, 'an SVG whose own parts are named leaf / commented "leaf spray" is removed');
is(!botan.border, 'an SVG data-URI background named botanical is removed');
is(botan.arc, 'an unlabelled decorative arc SVG stays (recreations may draw shapes)');
is(botan.icon, 'an icon-bank icon stays (the icon rules judge it)');
is(botan.customer, 'the customer\'s own SVG stays, even a leaf logo');
is(botan.library, 'the botanical LIBRARY file stays — that is where plant artwork comes from');
is(botan.back && botan.doctype && botan.name, 'the rest of the design is untouched (doctype, text, hidden back card)');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
