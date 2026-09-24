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
  return {
    guardInPreview: out.includes('id="asset-category-guard"'),
    guardSurvivesStrip: stripped.includes('id="asset-category-guard"'),
    layoutScriptStripped: !stripped.includes('id="layout-safety-script"'),
    once: out.split('id="asset-category-guard"').length - 1,
  };
});
is(rendered.guardInPreview, 'renderPreviewHtml injects the asset-category guard');
is(rendered.once === 1, 'exactly once', String(rendered.once));
is(rendered.guardSurvivesStrip && rendered.layoutScriptStripped,
   'the guard is not a preview decoration: it survives stripping while layout scripts are removed');

/* ───────────────────────────────────────────────────────────────────────── */
/* The design under test: a business card at the reference 360x216 with
 *   · a HERO phone icon (160px, top-right, no text within reach)  -> must go
 *   · a 90px phone icon glued to the e-mail line                   -> clamped
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
  .big{position:absolute;left:140px;top:128px;width:90px;height:90px;color:#123a5e}
  .p{position:absolute;left:164px;top:100px;color:#123a5e;font-size:11px;line-height:18px}
  .e{position:absolute;left:236px;top:164px;color:#123a5e;font-size:11px;line-height:18px}
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
  <span class="ico" style="left:214px;top:164px" data-icon-name="mail">${MAIL_SVG}</span>
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
   'the 90px phone beside a contact line is shrunk to the 16-36px band', JSON.stringify(big));
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
    .replace('class="p"', 'class="p" style="left:344px;top:200px"');
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

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
