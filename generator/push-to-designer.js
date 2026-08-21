/* Push to Designer — reads the generated design out of the preview DOM,
 * normalizes it (integration/normalized-design.js), and hands it to an adapter
 * for translation and transport.
 *
 * The Generator owns GENERATION; this file owns MEASUREMENT + orchestration;
 * integration/adapters/ owns everything a specific designer needs to be told.
 * Sterling's "version 1.2" envelope is produced by the legacy adapter, not
 * here — see integration/adapters/sterling-legacy.js.
 *
 * TEST-ENVIRONMENT MODULE. It ships disabled against production: the designer
 * URL below intentionally points at a test harness page, never at
 * www.sterling.ca. Configure SMP_CONFIG when Sterling IT provisions staging.
 *
 * Transfer transports, tried in order:
 *   1. POST to a staging-only endpoint (SMP_CONFIG.transferEndpoint) which
 *      stores the JSON server-side and returns the designer URL to open.
 *   2. localStorage handoff — works when the generator and the designer are
 *      hosted on the same test origin (no server code needed).
 *   3. Download of template.json with instructions — always available.
 */

const SMP_CONFIG = {
  // Set by IT once a staging receiveTransfer.cfm exists, e.g.
  // 'https://staging.sterling.ca/designer/receiveTransfer.cfm'
  transferEndpoint: '',
  // Designer page to open. Defaults to the bundled test harness, which lives
  // on the same origin as this generator in the test deployment.
  designerUrl: '../realdesigner/index.html',
  transferKey: 'smpDesignTransfer',
  transferTtlMs: 30 * 60 * 1000, // stored transfers expire after 30 minutes
};

/* The designer loads its full type library from this stylesheet. The generator
 * and the designer must agree on it exactly so a pushed design renders in the
 * SAME font it was measured in — otherwise the browser substitutes a fallback
 * with different metrics and text shifts / overlaps on transfer. */
const FONTS_CSS_URL = 'https://saturn.sterling.ca/cdn/hteng/fonts/fonts.css';

/* Every font-family the designer's fonts.css actually provides (derived from
 * that stylesheet). Because this now matches the designer's real library, a
 * design authored in e.g. Montserrat / Poppins / Roboto maps to itself rather
 * than collapsing to Arial, so metrics are preserved end to end. */
const STERLING_FONTS = ["Adobe Arabic","Adobe Caslon Pro","Adobe Caslon Pro Semibold","Agenda SemiBold","Akkurat","Akkurat-Light","Aktiv Grotesk","Alright Sans","Alright Sans Black","Alright Sans Medium","Aptos","Aptos Narrow","Aptos SemiBold","Arial","Arial Black","Arial GEO","Arial Narrow","Arial Rounded","Arial Unicode MS","Arimo","Arvo","ATB TT Norms","ATB TT Norms DemiBold","ATBTTNorms DemiBold","Atlanta","Atlantic Inline","Avant Garde","Avant Garde Light","Avenir","Avenir Black","Avenir Book","Avenir Heavy","Avenir Light","Avenir LT Std 45 Book","Avenir LT Std 65 Medium","Avenir LT Std 85 Heavy","Avenir LT Std 95 Black","Avenir Medium","Avenir Next Cyr Medium","Avenir Next LT Pro","Avenir Next LT Pro Demi","Avenir Roman","Bai Jamjuree","Bai Jamjuree Medium","Ballinger","Ballinger Medium","Bebas Neue","Belgium","Bentham","Bermuda Script","Berthold Akzidenz Grotesk","Berthold Akzidenz Grotesk Medium","Bliss 2","Bliss 2 Light","Bliss Pro","Bliss Pro ExtraBold","Bliss Pro Light","Bodega Sans Black","Bodega Sans Black Oldstyle","Bodega Sans Light","Bodega Sans Light Oldstyle","Bodega Sans Light Smallcaps","Bodega Sans Medium","Bodega Sans Medium Smallcaps","Bombshell Pro","Boton","Boton Medium","Brandon Text","Brenntag Sans","BrownLL","BrownLL Light","BrownLL Medium","BrownLL Thin","BrushScriptStd","Calibri","Calibri Light","Cambria","Caslon Openface","Castle Com","Castle Com Light","Castle Com Ultra","CastleT","Century Gothic","Cera Pro","Cera Pro Black","Cera Pro Medium","Channel","Charter","Charter BT Pro","Charter BT Pro Black","Circular Pro","Clarendon BT","ClassicGrotesquePro Book","ClassicGrotesquePro Light","ClassicGrotesquePro Medium","Cooper BT for WFM Medium","Cooper Md BT","Copperplate","Corporate Traveller","Courier New","D-DIN","DIN Alternate","DIN Next LT Pro","DIN Next LT Pro Medium","DINPro","DINPro Black","DINPro Medium","DINSerifNoLigatures","DTL Haarlemmer SD","Elston Pro","Elston Pro Light","Engravers MT","EvoBQ","EvoBQ Medium","FleurishScript","Ford Antenna","Ford Antenna Comp","Forma DJR Display","Franklin Gothic Demi Cond","Franklin Gothic ITC Bk BT","Franklin Gothic Medium Cond","FreightBigPro Light","FrutigerLinotype","Futura Bk BT","Futura Hv BT","Futura Md BT","Futura PT Book","Futura PT Demi","Futura PT Light","Futura PT Medium","Futura Std","Futura Std Heavy","Futura Std Medium","Garamond","Geometria Light","Geometric Slabserif 703","Georgia","Germany","GerTT","Gill Sans MT","Gill Sans MT Pro ExtraBold","Gill Sans MT Std","Gill Sans MT Std Condensed","Gill Sans MT Std Light","Gill Sans MT Std Medium","Gilroy","Gilroy ExtraBold","Gilroy Light","Gilroy Medium","Gilroy SemiBold","Giovanni Book","Giovanni LT Book","GiovanniStd Black","Gontserrat","Gotham","Gotham Light","Gotham Narrow Book","Gotham Narrow Medium","Gotham-Book","GothamHTFBlack","GothamMedium","GothamMedium-Italic","GothamRounded Medium","GothamRounded-Book","Goudy Old Style","GoudySwa","Graphik Light","Graphik Medium","Greycliff CF Demi Bold","GT Walsheim","Heebo","Heebo Medium","Helsinki Narrow","Helvetica","Helvetica Condensed","Helvetica Light","Helvetica LT Std","Helvetica Neue LT Pro 45 Light","Helvetica Neue LT Pro 55 Roman","HelveticaNeue","HelveticaNeue Condensed","HelveticaNeue Light","HelveticaNeue Medium Condensed","Hilti","IBM Plex Sans","IBM Plex Sans Medium","IBM Plex Sans SemiBold","Inter","Interstate Black","Interstate Light","Istanbul","ITC Bradley Hand Com","ITC Charter Com","JDSans","JDSans Book","JDSans Light","Josefin Sans Light","KGAllThingsNew","Klavika","Klavika Condensed","Klavika Light Condensed","Klavika Medium","Klavika Medium Condensed","Knockout-HTF69-FullLiteweight","Kozuka Gothic Pr6N R","Larken Medium","Lato","League Gothic","LeawoodBook","LeviathanHTFBlack","Lincoln Proxima Nova","Lota Grotesque","Lucida Handwriting","Lufga","Lufga SemiBold","Malgun Gothic","Marine","Marine Black","Marine Light","Marine UP","Marine UP Black","Marine UP Light","Market Deco","MarkOT CondMedium","MarkOT Medium","MarkPro","MarkPro Light","MarkPro NarrowLight","Marsfont","Marsfont Light","Marsfont Medium","MCQ Global","MCQ Global Condensed","MCQ Global Light","MCQ Global Medium","MetaPlusBook Roman","MetaPlusMedium Caps","MetaPlusMedium Roman","MetaPro","MICR","Microsoft Sans Serif","Minion Pro","Moderat","Montserrat","Montserrat Light","Montserrat Medium","Montserrat SemiBold","Montserrat-Light","Montserrat-LightItalic","Montserrat-Medium","MrsEavesAllSmallCap","MrsEavesPetiteCaps","MrsEavesSmallCaps","Museo Sans 100","Museo Sans 300","Museo Sans 500","Museo Sans 700","Museo Sans 900","Myriad Pro","Myriad Pro Black","Myriad Pro Condensed","Myriad Pro Light","Myriad Pro SemiBold","Neue Haas Unica","Neue Haas Unica Black","Neutra Text Book","Nexa","Nexa Black","NHaasGroteskDSPro-35XLt","NHaasGroteskDSPro-55Rg","NotoSans SemiBold","Nunito Sans","Nunito Sans ExtraBold","Nunito Sans SemiBold","Oaksans","Oaksans Medium","Oaksans SemiBold","Objektiv Mk2","Objektiv Mk2 Medium","Old Claude LP SmallCap","Open Sans","Open Sans Light","Open Sans SemiBold","Optima","Orbitron","Orbitron Black","Orbitron Medium","Outfit","Outfit Light","Outfit SemiBold","P22 Mackinac Pro","P22 Mackinac Pro Medium","Palatino Linotype","Peoni Pro","Photina MT Pro","Poppins","Poppins Light","Poppins Medium","Poppins SemiBold","PP Neue Montreal","PP Neue Montreal Medium","Precision Sans","Precision Sans Light","Precision Sans Medium","Produkt Semibold","Proxima Soft","Proxima Soft Light","Proxima Soft Medium","ProximaNova","ProximaNova Extrabold","ProximaNova Light","ProximaNova Medium","ProximaNova SemiBold","PT Sans","Raleway","Raleway Light","Raleway Medium","Raleway-style1-lining","Rescue","RNS Camelia","Roboto","Roboto Black","Roboto Light","Roboto Medium","Roboto Thin","Rockwell","Sail","San Diego","Sanchez Niu","SangBleu Sunrise","SangBleu Sunrise Medium","SansaPro","SansaPro SemiBold","SansaPro-Bold","SchibstedGrotesk","SchibstedGrotesk SemiBold","Seitu","Seitu ExtraBold","Sentinel Book","SephoraSans","SephoraSans Light","SephoraSerif Book","SephoraSerif Light","Sharp Sans Medium","Sharp Sans No1 Book","Sharp Sans No1 Light","Sharp Sans No1 Medium","Sharp Sans No1 Semibold","Sharp Sans Semibold","SimSun","Sloop Scriptone","Sora","Sora SemiBold","Source Sans Pro","Source Sans Pro Semibold","St Nicholas","Stem","Stem Hairline","Stem Light","SterlingText Roman","Studio6","Studio6 Medium","Styrene A","Styrene A Light","Styrene A Medium","Suisse Intl","Suisse Intl SemiBold","Swis721 Black","Swis721 BT","Swis721 BT Condensed","Swis721 BT Light","Swis721 Heavy","Tahoma","TD Graphik Medium","TD Graphik Semibold","Times New Roman","Times New Roman Condensed","Titillium Web","Titillium Web SemiBold","TodaySans Serif Medium","Tondo","Trade Gothic Next","Trade Gothic Next Condensed","Trade Gothic Next Light","Trebuchet MS","Ubuntu","Uni Sans Heavy","Uni Sans Regular","Uni Sans Semibold","Univers LT Pro 47 Light Condensed","Univers LT Pro 57 Condensed","UniversCondensed","URWDIN","URWDIN Black","URWDIN Medium","US Roman","Utah","Value","Verdana","Verlag Condensed Book","Weiss Std","Zapf Chancery"];

/* Steer a few common web/system fonts the designer does NOT carry toward the
 * closest library match. Exact matches are resolved before this table, so
 * families the designer DOES have (Georgia, Roboto, Lato, …) map to themselves
 * and never reach here. */
const FONT_FALLBACKS = {
  // CSS generic families (guarded here so e.g. "sans-serif" is not caught by the
  // substring "serif" in the category heuristic below).
  'sans-serif': 'Arial', 'serif': 'Times New Roman', 'monospace': 'Courier New',
  'ui-sans-serif': 'Arial', 'ui-serif': 'Times New Roman', 'ui-monospace': 'Courier New',
  'cursive': 'BrushScriptStd', 'fantasy': 'Arial', 'system-ui': 'Arial', '-apple-system': 'Arial',
  // Common web fonts the designer does NOT carry, steered to the closest match.
  'playfair display': 'Georgia', 'merriweather': 'Georgia', 'pt serif': 'Georgia',
  'oswald': 'League Gothic', 'anton': 'League Gothic', 'archivo narrow': 'Trade Gothic Next Condensed',
  'segoe ui': 'Arial', 'work sans': 'Open Sans', 'noto sans': 'Open Sans',
  'brush script mt': 'BrushScriptStd', 'pacifico': 'BrushScriptStd', 'dancing script': 'Bermuda Script',
};

function normFont(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
const STERLING_NORM = STERLING_FONTS.map(f => ({ f, n: normFont(f) }));

/* Resolve a CSS font-family stack to an exact designer family name (pure). */
function mapFontName(cssFontFamily) {
  const requested = (cssFontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!requested) return { used: 'Arial', requested: '' };
  const rn = normFont(requested);
  const exact = STERLING_NORM.find(x => x.n === rn);
  if (exact) return { used: exact.f, requested };
  const fb = FONT_FALLBACKS[requested.toLowerCase()];
  if (fb) return { used: fb, requested };
  if (rn.length >= 4) {
    const partial = STERLING_NORM.find(x => x.n.startsWith(rn) || rn.startsWith(x.n));
    if (partial) return { used: partial.f, requested };
  }
  const lc = requested.toLowerCase();
  const used = /script|hand|brush|cursive|calligraph/.test(lc) ? 'BrushScriptStd'
    : /slab|rockwell|clarendon|arvo/.test(lc) ? 'Clarendon BT'
    : /serif|times|georgia|garamond|caslon|minion|didot|bodoni|playfair|merriweather/.test(lc) ? 'Times New Roman'
    : /mono|courier|consol/.test(lc) ? 'Courier New'
    : 'Arial';
  return { used, requested };
}

function mapFont(cssFontFamily, substitutions) {
  const { used, requested } = mapFontName(cssFontFamily);
  if (requested && normFont(requested) !== normFont(used) && substitutions) {
    substitutions.push({ requested, used });
  }
  return used;
}

/* Attach the designer's fonts.css to a document so text measures/renders in the
 * real library fonts (idempotent). */
function ensureFontsCss(doc) {
  try {
    if (!doc || doc.querySelector('link[data-tg-fonts]')) return;
    const l = doc.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS_CSS_URL;
    l.setAttribute('data-tg-fonts', '1');
    (doc.head || doc.documentElement).appendChild(l);
  } catch (e) { /* non-fatal: fall back to whatever fonts are present */ }
}

/* Wait (bounded) for pending web-font loads so measurement is not taken against
 * a fallback face that the designer will later replace. */
function fontsReady(doc, ms) {
  try {
    if (doc && doc.fonts && doc.fonts.ready) {
      return Promise.race([doc.fonts.ready, new Promise(r => setTimeout(r, ms))]);
    }
  } catch (e) { /* ignore */ }
  return new Promise(r => setTimeout(r, ms));
}

/* Before measuring, pin every text element to the exact designer family it will
 * be pushed as, so the box we measure is the box the designer will render. This
 * only changes the typeface (never size, colour, position, bleed, or raster
 * output), so it cannot affect print-production characteristics. */
function snapFontsToDesigner(doc, rootEl, substitutions) {
  try {
    const view = doc.defaultView;
    const els = [rootEl];
    const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) els.push(walker.currentNode);
    for (const el of els) {
      if (!hasDirectText(el)) continue;
      const cs = view.getComputedStyle(el);
      const { used, requested } = mapFontName(cs.fontFamily);
      if (requested && normFont(requested) !== normFont(used) && substitutions) {
        substitutions.push({ requested, used });
      }
      el.style.setProperty('font-family', '"' + used + '"', 'important');
    }
    void rootEl.getBoundingClientRect(); // force reflow with the pinned fonts
  } catch (e) { /* leave original fonts if anything goes wrong */ }
}

/* Product mode now comes from integration/product-provider.js, so it can be
 * sourced from Sterling's CMS later instead of the template-type dropdown. */


function mapFont(cssFontFamily, substitutions) {
  const requested = (cssFontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!requested) return 'Arial';
  const exact = STERLING_FONTS.find(f => f.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const partial = STERLING_FONTS.find(f => requested.toLowerCase().startsWith(f.toLowerCase())
                                        || f.toLowerCase().startsWith(requested.toLowerCase()));
  const mapped = partial || FONT_FALLBACKS[requested.toLowerCase()] || 'Arial';
  substitutions.push({ requested, used: mapped });
  return mapped;
}

function cssColorToHex(cssColor, doc) {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return cssColor; // already hex or named
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  const hex = n => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

function isVisible(el, style) {
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0.5 && r.height > 0.5;
}

function rotationOf(style) {
  const t = style.transform;
  if (!t || t === 'none') return 0;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(parseFloat);
  return Math.round(Math.atan2(b, a) * (180 / Math.PI) * 100) / 100;
}

/* True when a computed transform is at most a pure rotation (uniform, no
 * mirror/scale/skew/translate) — the only case an axis-anchored i-text overlay
 * can reproduce faithfully. Anything else (scaleX(-1), skew, translate) stays
 * baked in the raster. */
function isSimpleTransform(t) {
  if (!t || t === 'none') return true;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return true;
  const [a, b, c, d, e, f] = m[1].split(',').map(parseFloat);
  const sx = Math.hypot(a, b), sy = Math.hypot(c, d);
  const det = a * d - b * c;
  return det > 0 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02
      && Math.abs(e) < 0.5 && Math.abs(f) < 0.5;
}

function hasDirectText(el) {
  return Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
}

/* Bounding box (viewport px) of an element's DIRECT text — the union of its text
 * nodes' client rects — rather than its border box. The container box can be
 * wider/taller than the text (a leading inline mark like a bullet/square,
 * padding, or vertical centering), which would otherwise place the i-text on top
 * of neighbouring elements. Positioning at the real text keeps the import
 * aligned. Returns null when there's no measurable text. */
function directTextRect(el, doc) {
  let rect = null;
  const range = doc.createRange();
  for (const node of el.childNodes) {
    if (node.nodeType !== 3 || !node.textContent || !node.textContent.trim()) continue;
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (const r of rects) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      if (!rect) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      else {
        rect.left = Math.min(rect.left, r.left);
        rect.top = Math.min(rect.top, r.top);
        rect.right = Math.max(rect.right, r.right);
        rect.bottom = Math.max(rect.bottom, r.bottom);
      }
    }
  }
  return rect;
}

/* An element must be "clean" to become a native editable shape: a single solid
 * fill, no gradient/photo background, no shadow/filter/blend. Anything richer is
 * left for the flattened raster. */
function isCleanSolid(style) {
  const bgImg = style.backgroundImage || 'none';
  if (bgImg !== 'none') return false;                       // gradients / textures / photos
  if ((style.boxShadow || 'none') !== 'none') return false; // drop shadows
  if ((style.filter || 'none') !== 'none') return false;    // blur etc.
  const blend = style.mixBlendMode || 'normal';
  if (blend !== 'normal') return false;
  const bc = style.backgroundColor || '';
  if (!bc || bc === 'transparent' || /rgba\(0,\s*0,\s*0,\s*0\)/.test(bc)) return false;
  return true;
}

/* Parse `clip-path: polygon(x% y%, ...)` into points in element-local pixels. */
function parseClipPolygon(clip, w, h) {
  const m = (clip || '').match(/polygon\(([^)]*)\)/i);
  if (!m) return null;
  const pts = m[1].split(',').map(pair => {
    const [xs, ys] = pair.trim().split(/\s+/);
    const x = xs.endsWith('%') ? parseFloat(xs) / 100 * w : parseFloat(xs);
    const y = ys.endsWith('%') ? parseFloat(ys) / 100 * h : parseFloat(ys);
    return { x, y };
  });
  return pts.length >= 3 ? pts : null;
}

/* Read the four corner radii (px) from computed style. */
function cornerRadii(style, w, h) {
  const px = (v, base) => v.endsWith('%') ? parseFloat(v) / 100 * base : parseFloat(v) || 0;
  return {
    tl: px(style.borderTopLeftRadius, Math.min(w, h)),
    tr: px(style.borderTopRightRadius, Math.min(w, h)),
    br: px(style.borderBottomRightRadius, Math.min(w, h)),
    bl: px(style.borderBottomLeftRadius, Math.min(w, h)),
  };
}

/* Classify a clean-solid element into a native shape element, in canvas
 * pixels. Returns null when the geometry isn't cleanly representable (left for
 * the raster). left/top/w/h are already in canvas px. */
function classifyNativeShape(style, left, top, w, h, angle, fill, factor) {
  /* Common style for every shape kind. Geometry is supplied per branch below.
   * NOTE: this now yields NORMALIZED elements (integration/normalized-design.js);
   * the Fabric dialect is added by the Sterling adapter. The measurement and
   * classification logic below is unchanged. */
  const N = window.SMPNormalized;
  const base = {
    fill, stroke: null, strokeWidth: 0,
    rotation: angle, opacity: parseFloat(style.opacity),
  };
  // clip-path polygon wedge/band → real polygon
  const poly = parseClipPolygon(style.clipPath, w, h);
  if (poly) {
    /* Fabric positions a polygon by its points' BOUNDING BOX, not the source
     * element's box. Set left/top to the bbox corner in canvas coords and make
     * the points relative to that corner, or the shape lands in the wrong place
     * (e.g. a bottom band rendering at the top). */
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    return N.polygon({ ...base,
      points: poly.map(p => ({ x: round2(p.x - minX), y: round2(p.y - minY) })),
      x: round2(left + minX), y: round2(top + minY),
      width: round2(maxX - minX), height: round2(maxY - minY) });
  }
  const rad = cornerRadii(style, w, h);
  const allEqual = Math.abs(rad.tl - rad.tr) < 0.5 && Math.abs(rad.tr - rad.br) < 0.5 && Math.abs(rad.br - rad.bl) < 0.5;
  // "circle-ish" requires a REAL corner radius that reaches the half-extent — a
  // plain rectangle (radius 0) must never qualify, or thin bars/lines where
  // min(w,h)/2 ≈ 0 would be misread as flat ellipses.
  const isCircleish = allEqual && rad.tl > 1 && rad.tl >= Math.min(w, h) / 2 - 1;
  if (isCircleish && Math.abs(w - h) < 1.5) {
    return N.circle({ ...base, radius: round2(w / 2), x: round2(left), y: round2(top) });
  }
  if (isCircleish) {
    return N.ellipse({ ...base, x: round2(left), y: round2(top), radiusX: round2(w / 2), radiusY: round2(h / 2) });
  }
  // quarter/half disc: exactly one corner fully rounded → circle centred on the
  // opposite corner (the canvas edge clips the rest, reproducing the arc)
  const corners = [rad.tl, rad.tr, rad.br, rad.bl];
  const bigCorners = corners.filter(c => c >= Math.min(w, h) - 2);
  if (bigCorners.length === 1 && Math.abs(w - h) < 2) {
    const R = w; // radius spans the box
    let cx = left, cy = top;
    if (rad.tl >= w - 2) { cx = left + w; cy = top + h; }        // rounded TL → centre BR
    else if (rad.tr >= w - 2) { cx = left; cy = top + h; }       // rounded TR → centre BL
    else if (rad.br >= w - 2) { cx = left; cy = top; }           // rounded BR → centre TL
    else { cx = left + w; cy = top; }                            // rounded BL → centre TR
    return N.circle({ ...base, radius: round2(R), x: round2(cx - R), y: round2(cy - R) });
  }
  // plain rectangle (optionally uniformly rounded)
  return N.rect({ ...base, x: round2(left), y: round2(top),
                  width: round2(w), height: round2(h),
                  cornerRadiusX: round2(allEqual ? rad.tl : 0),
                  cornerRadiusY: round2(allEqual ? rad.tl : 0) });
}

/* True when text is painted with a gradient/image clipped to the glyphs
 * (background-clip:text + transparent text fill) — the "gradient text" effect a
 * flat i-text fill can't reproduce, so it must stay in the raster. */
function isGradientFilledText(style) {
  const clip = ((style.webkitBackgroundClip || '') + ' ' + (style.backgroundClip || '')).toLowerCase();
  if (!clip.includes('text')) return false;
  const fill = (style.webkitTextFillColor || style.color || '').replace(/\s+/g, '');
  const transparentFill = fill === 'transparent' || fill === 'rgba(0,0,0,0)';
  const hasImage = (style.backgroundImage || 'none') !== 'none';
  return transparentFill && hasImage;
}

/* Extract NORMALIZED design elements from one rendered document. rootEl is the design
 * surface (the card element); factor rescales its pixels to canvas pixels. */
function extractObjectsFromDoc(doc, rootEl, factor, substitutions) {
  const rootRect = rootEl.getBoundingClientRect();
  const objects = [];
  const textOwners = new Set();

  const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
  const els = [rootEl];
  while (walker.nextNode()) els.push(walker.currentNode);

  const candidates = []; // {el, obj} for text; images/svg push directly

  for (const el of els) {
    const style = doc.defaultView.getComputedStyle(el);
    if (!isVisible(el, style)) continue;
    const r = el.getBoundingClientRect();
    // skip decorations fully clipped outside the design surface
    if (r.right < rootRect.left - 1 || r.left > rootRect.right + 1 ||
        r.bottom < rootRect.top - 1 || r.top > rootRect.bottom + 1) continue;
    if (parseFloat(style.opacity) < 0.05) continue;
    const left = (r.left - rootRect.left) * factor;
    const top = (r.top - rootRect.top) * factor;
    const width = r.width * factor;
    const height = r.height * factor;
    const angle = rotationOf(style);

    /* Classification (Tier 1):
     *  - text            → editable i-text
     *  - clean solid shape (rect / rounded / circle / ellipse / clip-polygon /
     *                       quarter-disc) → NATIVE editable shape element
     *  - inline SVG, gradients, shadows, blends, textures, photos → flattened
     *    into the raster (rasterizeBackground), which is clip-path aware.
     * Native objects are marked data-tg-extract so the raster skips them. */

    if (el.tagName === 'svg') {
      /* Carry LOGO/ICON-sized vector artwork as a crisp SVG image so it stays
       * sharp at any size and remains a separate movable object. Large or
       * full-card SVGs (backgrounds, big decorative waves) are left in the
       * raster — vectorizing them whole can misrender and flood the card. */
      const areaFrac = (r.width * r.height) / Math.max(1, rootRect.width * rootRect.height);
      const logoSized = areaFrac <= 0.22 &&
        r.width <= rootRect.width * 0.5 && r.height <= rootRect.height * 0.6;
      if (logoSized) {
        try {
          if (r.width > 1 && r.height > 1) {
            const uri = svgElementToDataUri(el, doc, r.width, r.height);
            if (uri) {
              el.setAttribute('data-tg-extract', '1');
              const obj = makeImageObject(uri, round2(r.width), round2(r.height),
                left, top, width, height, angle, style);
              /* Inline SVG kept as vector art rather than rasterized. The
               * adapter maps this role onto whatever the target designer calls
               * it (Sterling: sterlingType 'vectorArt'). */
              obj.role = 'vector';
              objects.push(obj);
              continue;
            }
          }
        } catch (e) { /* fall back to rasterizing the SVG */ }
      }
      el.querySelectorAll('*').forEach(c => textOwners.add(c)); // stays in raster
      continue;
    }
    if (el.tagName === 'IMG' && el.currentSrc && !el.currentSrc.startsWith('data:image/svg')) {
      el.setAttribute('data-tg-extract', '1');
      objects.push(makeImageObject(el.currentSrc, el.naturalWidth || r.width, el.naturalHeight || r.height,
                                   left, top, width, height, angle, style));
      continue;
    }

    // Native solid shape (not the card root, not a text-owner)
    if (el !== rootEl && !hasDirectText(el) && isCleanSolid(style)) {
      const fill = cssColorToHex(style.backgroundColor, doc);
      if (fill) {
        const shape = classifyNativeShape(style, left, top, width, height, angle, fill, factor);
        if (shape) {
          el.setAttribute('data-tg-extract', '1');
          objects.push(shape);
          continue;
        }
      }
    }

    /* Text extraction is limited to axis-aligned, non-mirrored, non-vertical
     * text so overlays land exactly where the raster shows them. Vertical
     * monograms, mirrored, or skewed text stay baked in the raster (visible but
     * not editable) rather than being lifted to the wrong place. */
    const wm = style.writingMode || '';
    const transformOK = isSimpleTransform(style.transform);
    if (hasDirectText(el) && !textOwners.has(el) && !wm.startsWith('vertical') && transformOK) {
      /* Gradient-/clip-filled text (background-clip:text with a transparent text
       * fill) can't be reproduced by a flat i-text colour — lifting it would drop
       * the gradient to solid black. Leave it in the rasterized background so it
       * transfers pixel-perfectly (it just isn't separately editable). */
      if (isGradientFilledText(style)) { textOwners.add(el); continue; }
      textOwners.add(el);
      el.setAttribute('data-tg-extract', '1');
      const fontSize = parseFloat(style.fontSize) * factor;
      const letterPx = parseFloat(style.letterSpacing);
      /* Anchor to the real text box, not the container box — see directTextRect.
       * Falls back to the element box when the text isn't measurable. */
      const tr = directTextRect(el, doc);
      const tLeft = tr ? (tr.left - rootRect.left) * factor : left;
      const tTop = tr ? (tr.top - rootRect.top) * factor : top;
      const tWidth = tr ? (tr.right - tr.left) * factor : width;
      /* NORMALIZED text element. Letter spacing stays in pixels here; the
       * Sterling adapter converts it to Fabric's 1/1000-em charSpacing. */
      candidates.push({ el, obj: window.SMPNormalized.text({
        x: round2(tLeft), y: round2(tTop), width: round2(Math.max(tWidth, 10)),
        text: getWrappedText(el, doc),
        fontSizePx: round2(fontSize),
        fontFamily: mapFont(style.fontFamily, substitutions),
        fontWeight: normalizeWeight(style.fontWeight),
        fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
        underline: (style.textDecorationLine || '').includes('underline'),
        align: ['left','center','right','justify'].includes(style.textAlign) ? style.textAlign : 'left',
        color: cssColorToHex(style.color, doc) || '#000000',
        lineHeightRatio: normalizeLineHeight(style, fontSize / factor),
        letterSpacingPx: Number.isFinite(letterPx) ? letterPx * factor : 0,
        rotation: angle, opacity: parseFloat(style.opacity),
      }) });
    }
  }

  /* Deduplicate glow/shadow clones: designs often layer the same text several
   * times for effects. Keep the topmost (last in DOM order) of any copies with
   * identical text at nearly the same position; every copy stays hidden in the
   * raster so nothing doubles up. */
  const deduped = [];
  for (const c of candidates) {
    const dup = deduped.findIndex(d => d.obj.text === c.obj.text
      && Math.abs(d.obj.x - c.obj.x) < Math.max(8, c.obj.font.sizePx * 0.6)
      && Math.abs(d.obj.y - c.obj.y) < Math.max(8, c.obj.font.sizePx * 0.6));
    if (dup >= 0) deduped[dup] = c; else deduped.push(c);
  }
  deduped.forEach(c => objects.push(c.obj));

  return objects;
}

/* Serialize an inline <svg> into a self-contained, correctly-sized SVG data URI
 * (vector — stays crisp at any scale). Returns null if it can't be serialized. */
function svgElementToDataUri(el, doc, cssW, cssH) {
  const clone = el.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('viewBox')) {
    const vw = parseFloat(clone.getAttribute('width')) || cssW;
    const vh = parseFloat(clone.getAttribute('height')) || cssH;
    if (vw > 0 && vh > 0) clone.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  }
  clone.setAttribute('width', Math.round(cssW));
  clone.setAttribute('height', Math.round(cssH));
  const markup = new XMLSerializer().serializeToString(clone);
  if (!markup || markup.length > 500000) return null; // guard runaway markup
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
}

function makeImageObject(src, naturalW, naturalH, left, top, width, height, angle, style) {
  /* NORMALIZED image element: intrinsic size and target size are kept separate;
   * the adapter derives Fabric's width/height + scaleX/scaleY from them. */
  return window.SMPNormalized.image({
    x: round2(left), y: round2(top),
    width, height,
    naturalWidth: naturalW, naturalHeight: naturalH,
    rotation: angle, src, opacity: parseFloat(style.opacity),
  });
}

function normalizeText(el) {
  // innerText preserves line breaks the way the user sees them
  return (el.innerText || el.textContent || '').replace(/ /g, ' ').trim();
}

/* Preserve the design's VISUAL line wrapping. innerText only inserts breaks for
 * <br>/block boundaries, not soft wraps, so a paragraph that wraps to two lines
 * would become one long i-text line that overflows. This measures each word and
 * starts a new line whenever the vertical position jumps, reproducing exactly
 * the line breaks the customer sees. */
function getWrappedText(el, doc) {
  const lines = [];
  let curTop = null, curLine = '';
  const flush = () => { if (curLine.trim()) lines.push(curLine.trim()); curLine = ''; };
  const walk = (node) => {
    if (node.nodeType === 3) {
      const parts = node.textContent.split(/(\s+)/);
      let idx = 0;
      for (const w of parts) {
        const start = idx; idx += w.length;
        if (!w) continue;
        if (!w.trim()) { curLine += ' '; continue; }
        let top = curTop;
        try {
          const range = doc.createRange();
          range.setStart(node, start); range.setEnd(node, idx);
          top = Math.round(range.getBoundingClientRect().top);
        } catch (e) { /* keep current line */ }
        if (curTop !== null && top !== null && Math.abs(top - curTop) > 3) flush();
        if (top !== null) curTop = top;
        curLine += w;
      }
    } else if (node.nodeType === 1 && node.tagName === 'BR') {
      flush(); curTop = null;
    } else if (node.nodeType === 1) {
      node.childNodes.forEach(walk);
    }
  };
  el.childNodes.forEach(walk);
  flush();
  return lines.join('\n') || normalizeText(el);
}

function normalizeWeight(w) {
  const n = parseInt(w, 10);
  if (Number.isFinite(n)) return n >= 600 ? 'bold' : 'normal';
  return w === 'bold' ? 'bold' : 'normal';
}

function normalizeLineHeight(style, fontSizePx) {
  const lh = parseFloat(style.lineHeight);
  if (!Number.isFinite(lh) || !fontSizePx) return 1.16;
  return round2(lh / fontSizePx);
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

/* Render everything EXCEPT the extracted elements (marked data-tg-extract) into
 * a PNG that becomes a locked background layer, while the extracted text/images
 * sit on top as editable objects.
 *
 * Primary path: a single SVG-foreignObject snapshot of the whole card — captures
 * CSS gradients, patterns, grids, blends, and inline SVG pixel-perfectly when it
 * decodes. Some designs (blend-modes + conic-gradient + SVG <defs>/<use>) can't
 * be decoded that way; for those we fall back to a COMPOSITIONAL raster: paint
 * the card's real background, then draw each decorative block and each inline
 * SVG individually (standalone SVGs decode reliably). Worst case still yields a
 * legible, on-brand background instead of white. */
async function rasterizeBackground(doc, rootEl, targetWidthPx, targetHeightPx) {
  const rect = rootEl.getBoundingClientRect();
  /* Render at ~300 dpi (print standard) so the background stays crisp when the
   * designer is zoomed in — targetWidthPx is at 96 dpi, so 300/96 ≈ 3.125x.
   * Cap the longest side (keeps large signs from producing a huge data URL
   * that would overflow the browser's transfer storage); never below 2x. */
  const DPI_SCALE = 300 / 96, MAX_SIDE = 2600;
  const scale = Math.max(2, Math.min(DPI_SCALE, MAX_SIDE / Math.max(targetWidthPx, targetHeightPx)));
  const cw = Math.round(targetWidthPx * scale), ch = Math.round(targetHeightPx * scale);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  /* Selectable/movable: the background artwork is a normal image element so it
   * can be selected, dragged, and scaled in the designer. It renders behind the
   * text purely by array order (first element = bottom of the stack). The
   * 'background' role records its provenance without locking it, and tells the
   * adapter this is the artwork that must bleed off every edge. */
  const toObj = () => window.SMPNormalized.image({
    role: 'background',
    x: 0, y: 0,
    width: targetWidthPx, height: targetHeightPx,
    naturalWidth: cw, naturalHeight: ch,
    rotation: 0, src: cv.toDataURL('image/png'), opacity: 1,
  });

  // --- Primary: whole-card foreignObject snapshot ---
  try {
    const clone = rootEl.cloneNode(true);
    clone.querySelectorAll('[data-tg-extract]').forEach(el => { el.style.visibility = 'hidden'; });
    clone.querySelectorAll('img, link, script').forEach(el => {
      if (el.tagName === 'IMG' && (el.getAttribute('src') || '').startsWith('data:')) return;
      el.remove();
    });
    const styles = [...doc.querySelectorAll('style')].map(st => st.textContent).join('\n');
    /* Wrap CSS in CDATA so characters that are illegal in XML — `&` in font
     * URLs, `>` child combinators, `<` — pass through literally instead of
     * breaking the SVG parse (which silently fell back to a blank raster). */
    const cssSafe = styles.replace(/@import[^;]+;/g, '').replace(/\]\]>/g, ']]&gt;');
    /* The design's `:root` custom properties (var(--x)) don't resolve inside
     * the foreignObject, so decorative elements using var() colours would render
     * empty. Read their resolved values off the real root and set them inline on
     * the wrapper so var() works. */
    const cs = doc.defaultView.getComputedStyle(rootEl);
    const varDecls = [...new Set(styles.match(/--[\w-]+/g) || [])]
      .map(n => [n, cs.getPropertyValue(n).trim()])
      .filter(([, v]) => v)
      .map(([n, v]) => n + ':' + v).join(';');
    const wrapStyle = 'width:' + rect.width + 'px;height:' + rect.height + 'px;overflow:hidden;' + varDecls;
    const html = '<div xmlns="http://www.w3.org/1999/xhtml" style="' + wrapStyle + '">'
      + '<style><![CDATA[' + cssSafe + ']]></style>'
      + new XMLSerializer().serializeToString(clone) + '</div>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + rect.width + '" height="' + rect.height + '">'
      + '<foreignObject width="100%" height="100%">' + html + '</foreignObject></svg>';
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    ctx.drawImage(img, 0, 0, cw, ch);
    return toObj();
  } catch (e) {
    console.warn('Whole-card raster failed; using compositional fallback:', e.message);
  }

  // --- Fallback: paint background + decorative blocks + standalone SVGs ---
  try {
    const f = cw / rect.width; // root px -> canvas px
    paintCssBackground(ctx, cw, ch, doc.defaultView.getComputedStyle(rootEl));
    // decorative blocks (solid or gradient painted divs), back-to-front
    const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
    const els = [];
    while (walker.nextNode()) els.push(walker.currentNode);
    for (const el of els) {
      if (el.hasAttribute('data-tg-extract') || el.tagName === 'svg' || el === rootEl) continue;
      const st = doc.defaultView.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) continue;
      if (hasDirectText(el)) continue; // text handled by overlay
      const r = el.getBoundingClientRect();
      const x = (r.left - rect.left) * f, y = (r.top - rect.top) * f, w = r.width * f, h = r.height * f;
      if (w < 1 || h < 1) continue;
      const rot = rotationOf(st);
      ctx.save();
      if (rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot * Math.PI / 180); ctx.translate(-(x + w / 2), -(y + h / 2)); }
      /* Clip to the element's real silhouette so clipped bands/wedges and
       * rounded/quarter-circle corners don't paint as full rectangles. */
      clipToElementShape(ctx, st, x, y, w, h);
      const painted = paintCssBackground(ctx, w, h, st, x, y, parseFloat(st.opacity));
      if (!painted) {
        const bg = cssColorToHex(st.backgroundColor, doc);
        if (bg) { ctx.globalAlpha = parseFloat(st.opacity); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
      }
      ctx.restore();
      continue;
    }
    // inline SVGs, standalone (they decode even when the whole-card snapshot won't)
    for (const svgEl of rootEl.querySelectorAll('svg')) {
      try {
        const r = svgEl.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const clone = svgEl.cloneNode(true);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        if (!clone.getAttribute('width')) clone.setAttribute('width', r.width);
        if (!clone.getAttribute('height')) clone.setAttribute('height', r.height);
        const s = new XMLSerializer().serializeToString(clone);
        const im = new Image();
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
        await im.decode();
        const st = doc.defaultView.getComputedStyle(svgEl);
        const rot = rotationOf(st);
        const x = (r.left - rect.left) * f, y = (r.top - rect.top) * f, w = r.width * f, h = r.height * f;
        ctx.save();
        ctx.globalAlpha = parseFloat(st.opacity);
        if (rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot * Math.PI / 180); ctx.drawImage(im, -w / 2, -h / 2, w, h); }
        else ctx.drawImage(im, x, y, w, h);
        ctx.restore();
      } catch (svgErr) { /* skip an undecodable ornament */ }
    }
    return toObj();
  } catch (e2) {
    console.warn('Compositional raster failed; transferring objects only:', e2.message);
    return null;
  }
}

/* Paint a CSS background (linear-gradient or solid) into ctx at (x,y,w,h).
 * Returns true if it painted a gradient/color, false if there was nothing to
 * paint. Radial/conic gradients fall back to their first colour stop. */
function paintCssBackground(ctx, w, h, style, x = 0, y = 0, alpha = 1) {
  const bgImg = style.backgroundImage || 'none';
  const stops = parseGradientStops(bgImg);
  ctx.save();
  ctx.globalAlpha = alpha;
  let painted = false;
  const lin = bgImg.match(/linear-gradient\(([^]*)\)/i);
  if (lin && stops.length) {
    const angleMatch = lin[1].match(/^\s*(-?[\d.]+)deg/);
    const ang = (angleMatch ? parseFloat(angleMatch[1]) : 180) * Math.PI / 180;
    const cx = x + w / 2, cy = y + h / 2;
    const len = Math.abs(w * Math.sin(ang)) + Math.abs(h * Math.cos(ang));
    const dx = Math.sin(ang) * len / 2, dy = -Math.cos(ang) * len / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    stops.forEach(s => g.addColorStop(s.pos, s.color));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); painted = true;
  } else if (/radial-gradient|conic-gradient/i.test(bgImg) && stops.length) {
    ctx.fillStyle = stops[0].color; ctx.fillRect(x, y, w, h); painted = true;
  } else {
    const bc = style.backgroundColor;
    if (bc && bc !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(bc)) {
      ctx.fillStyle = bc; ctx.fillRect(x, y, w, h); painted = true;
    }
  }
  ctx.restore();
  return painted;
}

/* Clip the current canvas path to an element's real silhouette: a clip-path
 * polygon, or its rounded/quarter-circle corners. No-op for a plain rectangle.
 * (Caller has already applied rotation, so work in axis-aligned x,y,w,h.) */
function clipToElementShape(ctx, style, x, y, w, h) {
  const poly = parseClipPolygon(style.clipPath, w, h);
  if (poly) {
    ctx.beginPath();
    poly.forEach((p, i) => i ? ctx.lineTo(x + p.x, y + p.y) : ctx.moveTo(x + p.x, y + p.y));
    ctx.closePath(); ctx.clip();
    return;
  }
  const rad = cornerRadii(style, w, h);
  if (rad.tl || rad.tr || rad.br || rad.bl) {
    const tl = Math.min(rad.tl, w, h), tr = Math.min(rad.tr, w, h),
          br = Math.min(rad.br, w, h), bl = Math.min(rad.bl, w, h);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath(); ctx.clip();
  }
}

/* Extract {color,pos} stops from a computed gradient string. */
function parseGradientStops(bgImg) {
  const inner = bgImg.match(/gradient\(([^]*)\)/i);
  if (!inner) return [];
  const parts = splitTopLevel(inner[1]);
  const stops = [];
  for (const p of parts) {
    const m = p.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})\s*([\d.]+)%?/i);
    if (m) stops.push({ color: m[1], pos: Math.max(0, Math.min(1, parseFloat(m[2]) / 100 || 0)) });
  }
  if (stops.length && stops.every((s, i) => s.pos === 0)) stops.forEach((s, i) => s.pos = i / (stops.length - 1 || 1));
  return stops;
}

/* Split a comma list, ignoring commas inside parentheses (rgb(...)). */
function splitTopLevel(str) {
  const out = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* Build the version 1.2 envelope around extracted pages. */

/* Cover-scale a single object so a trim-sized element grows to cover the full
 * bleed canvas (edges extend past the trim, like a print "scale to bleed"). */
/* Bleed / cover-scale geometry now lives in
 * integration/adapters/sterling-legacy.js — it operates in the Designer's
 * coordinate space, so it belongs with the Designer's dialect. Moved verbatim.
 */

function buildSterlingTemplate(pages, payload) {
  /* THE INTEGRATION BOUNDARY.
   *
   * Everything above produced a design description. This assembles it into the
   * normalized model and hands it to an adapter. The Generator knows nothing
   * about Fabric or Sterling past this line; swapping the Designer means
   * swapping the adapter, not editing the Generator.
   *
   * Product facts (bleed, designer mode, page count) come from the
   * ProductProvider, so they can later be sourced from Sterling's CMS instead
   * of being inferred from the template-type dropdown.
   */
  const N = window.SMPNormalized;

  /* The selected Sterling product is a DOCUMENT setting, not a generation-time
   * input, so it is read live rather than trusted to be on `payload` — sample
   * designs build their own payload and never go through buildPayload(). */
  const selected = payload.product
    || (window.SMPProductSelection && window.SMPProductSelection.get())
    || null;

  const trimW = Math.round(toPx(payload.width, payload.unit));
  const trimH = Math.round(toPx(payload.height, payload.unit));

  /* A selected product and the canvas must never disagree in silence. The
   * Generator locks Dimensions while a product is selected, so this can only
   * happen if a design of a different size was loaded afterwards (a sample,
   * say). Fail loudly rather than emit a package that claims product 6505 at
   * the wrong size — a wrongly sized package is a wrongly printed job. */
  if (selected) {
    /* The product's pixel size, ordered for the orientation this design was
     * composed in. Orientation only ever SWAPS the two numbers — the check
     * itself stays exact, so a real size disagreement is refused as loudly as
     * before. */
    const ov = (window.SMPOrientation && payload.orientation)
      ? window.SMPOrientation.orientProduct(selected, payload.orientation)
      : null;
    const pw = ov ? ov.widthPx : selected.dimensions.widthPx;
    const ph = ov ? ov.heightPx : selected.dimensions.heightPx;
    if (pw !== trimW || ph !== trimH) {
      throw new Error(
        `The design is ${trimW}×${trimH}px but the selected Sterling product `
        + `${selected.partNumber} is ${pw}×${ph}px`
        + (ov ? ` in ${ov.orientation} orientation` : '')
        + `. Regenerate the design with the `
        + `product selected, or clear the product, before pushing to the Designer.`);
    }
  }

  const productContext = window.SMPProductProvider.resolve(
    Object.assign({}, payload, { product: selected }));

  const doc = N.createDocument({
    trimWidthPx: trimW,
    trimHeightPx: trimH,
    bleedPx: productContext.bleedPx,
    dpi: 96,
    unit: payload.unit,
    widthIn: round2(trimW / 96),
    heightIn: round2(trimH / 96),
    productContext,
    pages: pages.map((pg, i) => ({
      index: i,
      bleedAuthored: pg.bleedAuthored,
      elements: pg.objects,
    })),
    provenance: {
      sourceApplication: 'templateGenerator',
      sourceVersion: 1,
      /* Orientation INTENT. The oriented geometry above already reflects it;
       * this states it explicitly so the future Sterling import endpoint can
       * validate that the product supports this orientation and derive the
       * authoritative oriented geometry itself — client values stay untrusted. */
      orientation: (window.SMPOrientation && window.SMPOrientation.isOrientation(payload.orientation))
        ? payload.orientation
        : (trimH > trimW ? 'portrait' : 'landscape'),
      businessName: payload.businessName || '',
    },
  });

  const problems = N.validate(doc);
  if (problems.length) console.warn('[integration] normalized model problems:', problems);

  /* Keep the last normalized document available for inspection/tests and for a
   * future adapter to consume without re-extracting. */
  window.SMPPush = window.SMPPush || {};
  window.SMPPush.lastNormalizedDesign = doc;

  return window.SterlingLegacyAdapter.toSterlingTemplate(doc);
}

/* Preview-only decorations the generator injects for ON-SCREEN fitting. They
 * MUST be removed before extraction so we measure the design's true geometry —
 * never the cover-scaled (body{transform:scale()}) or fit-shrunk
 * (.zone-copy{transform:scale()}) preview. `thumb-side-only` is deliberately
 * NOT stripped: it hides the opposite side and must stay for per-side capture. */
const PREVIEW_DECORATION_IDS = ['layout-safety', 'layout-fix-applied', 'download-both-sides', 'layout-safety-script', 'layout-universal-fit'];

/* Pins the design surface to its intrinsic size at the origin, so a design
 * whose own <body> uses flex / padding / centring can't shrink or shift the
 * artboard during measurement. Only touches the container and the card box —
 * never the exported objects' own styles, so it cannot change appearance. */
const EXTRACT_NORMALIZE_CSS = '<style id="tg-extract-normalize">html,body{margin:0!important;padding:0!important;background:transparent!important;display:block!important;width:auto!important;height:auto!important;transform:none!important;}.card,.design,.canvas,[class*="card"],[class*="plate"],[class*="badge"]{flex:none!important;margin:0!important;}</style>';

function stripPreviewDecorations(html) {
  let out = html;
  for (const id of PREVIEW_DECORATION_IDS) {
    out = out.replace(new RegExp('<style id="' + id + '">[\\s\\S]*?<\\/style>', 'g'), '')
             .replace(new RegExp('<script id="' + id + '">[\\s\\S]*?<\\/script>', 'g'), '');
  }
  return out;
}

/* Strip preview decorations and pin the artboard to intrinsic geometry. */
function normalizeHtmlForExtraction(html) {
  const clean = stripPreviewDecorations(html);
  return clean.includes('</head>')
    ? clean.replace('</head>', EXTRACT_NORMALIZE_CSS + '</head>')
    : EXTRACT_NORMALIZE_CSS + clean;
}

/* Locate the design surface inside a preview document. Must return the first
 * VISIBLE candidate: a double-sided design renders both .card--front and
 * .card--back in every frame, with one hidden via display:none. Returning the
 * first match by DOM order would pick the hidden front card in the back frame
 * (width 0), silently dropping the back page. */
function findDesignRoot(doc) {
  const candidates = doc.querySelectorAll('.card, .design, .canvas, [class*="card"], [class*="plate"], [class*="badge"]');
  for (const el of candidates) {
    const style = doc.defaultView.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.getBoundingClientRect().width > 2) return el;
  }
  return candidates[0] || doc.body?.firstElementChild;
}

/* Extract one page. `trimW/trimH` are the finished (trim) size; `bleedPx` the
 * per-edge bleed. The designer's canvas is trim+bleed, so objects must land in
 * that full "bleed canvas" coordinate space.
 *
 * Designs come in two shapes and we detect which by measuring the artboard:
 *   • bleed-authored — the card IS the full bleed canvas (art already runs to
 *     the bleed edge). Map the card 1:1 onto the bleed canvas; NO applyBleed.
 *   • trim-authored  — the card is the trim rectangle. Map it to trim size and
 *     let applyBleed translate content in and cover-scale the background.
 * Either way canvasProperties stays trim+declared-bleed, so production export,
 * sizing, and bleed handling are unchanged. */
async function extractPage(frame, trimW, trimH, bleedPx, substitutions) {
  const doc = frame?.contentDocument;
  if (!doc || !doc.body || !doc.body.firstElementChild) return null;
  const rootEl = findDesignRoot(doc);
  if (!rootEl) return null;
  /* Render/measure in the designer's real fonts so the box we lift is the box
   * the designer will draw. fonts.css is attached, its faces are awaited, then
   * each text run is pinned to the exact family it will be pushed as. */
  ensureFontsCss(doc);
  await fontsReady(doc, 1500);
  snapFontsToDesigner(doc, rootEl, substitutions);
  await fontsReady(doc, 800);
  const rootRect = rootEl.getBoundingClientRect();
  if (rootRect.width < 2) return null;

  const bleedW = trimW + 2 * bleedPx, bleedH = trimH + 2 * bleedPx;
  const bleedAuthored = bleedPx > 0 &&
    Math.abs(rootRect.width - bleedW) <= Math.abs(rootRect.width - trimW);
  const targetW = bleedAuthored ? bleedW : trimW;
  const targetH = bleedAuthored ? bleedH : trimH;
  const factor = targetW / rootRect.width;

  const objects = extractObjectsFromDoc(doc, rootEl, factor, substitutions);
  const bg = await rasterizeBackground(doc, rootEl, targetW, targetH);
  rootEl.querySelectorAll('[data-tg-extract]').forEach(el => el.removeAttribute('data-tg-extract'));
  return { objects: bg ? [bg, ...objects] : objects, bleedAuthored };
}

/* Public: convert the current generated design. Returns {template, substitutions}. */
/* Render an HTML string in a temporary, laid-out (but off-screen) iframe and
 * extract one page from it. Used for reliable double-sided extraction. */
async function extractFromOffscreen(html, trimW, trimH, bleedPx, substitutions) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  const bleedW = trimW + 2 * bleedPx, bleedH = trimH + 2 * bleedPx;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;border:0;'
    + 'width:' + bleedW + 'px;height:' + (bleedH * 2) + 'px;';
  document.body.appendChild(frame);
  try {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.srcdoc = html;
    });
    await new Promise(r => setTimeout(r, 250)); // let fonts/layout settle
    return await extractPage(frame, trimW, trimH, bleedPx, substitutions);
  } finally {
    frame.remove();
  }
}

async function convertCurrentDesign() {
  if (!generatedHtml || !lastPayload) {
    throw new Error('Generate a design first, then push it to the designer.');
  }
  const trimW = Math.round(toPx(lastPayload.width, lastPayload.unit));
  const trimH = Math.round(toPx(lastPayload.height, lastPayload.unit));
  const bleedPx = bleedPxFor(lastPayload.templateType);
  const substitutions = [];
  const pages = [];

  /* Extraction ALWAYS runs on decoration-free, intrinsic-geometry HTML rendered
   * in a clean offscreen iframe — never the visible preview / thumbnails, which
   * carry the on-screen fit transforms (body cover-scale, .zone-copy scale) that
   * would otherwise be baked into positions and the raster. */
  const clean = normalizeHtmlForExtraction(generatedHtml);

  if (lastPayload.doubleSided && /card--back/i.test(generatedHtml)) {
    for (const side of ['front', 'back']) {
      const html = (typeof injectThumbSideCss === 'function') ? injectThumbSideCss(clean, side) : clean;
      const p = await extractFromOffscreen(html, trimW, trimH, bleedPx, substitutions);
      if (p) pages.push(p);
    }
  }
  if (!pages.length) {
    const single = await extractFromOffscreen(clean, trimW, trimH, bleedPx, substitutions);
    if (single) pages.push(single);
  }
  if (!pages.length || !pages[0].objects || !pages[0].objects.length) {
    throw new Error('Could not read any design elements from the preview. Try regenerating the design.');
  }
  return { template: buildSterlingTemplate(pages, lastPayload), substitutions };
}

/* ── Transfer transports ─────────────────────────────── */

/* Transport now lives in integration/adapters/transport-local.js. These thin
 * wrappers keep the existing call sites and the window.SMPPush API unchanged. */
const recompressDataUriToJpeg = (...a) => window.SMPTransportLocal.recompressDataUriToJpeg(...a);
const compressTemplateForDemoTransport = (...a) => window.SMPTransportLocal.compressTemplateForDemoTransport(...a);
const storeTransferLocally = (...a) => window.SMPTransportLocal.storeTransferLocally(...a);
const storeTransferLocallyWithFallback = (...a) => window.SMPTransportLocal.storeTransferLocallyWithFallback(...a);

/* ── Transport modes ──────────────────────────────────────────────────
 *
 *   'local'  the existing same-origin localStorage handoff to realdesigner.
 *            THE DEFAULT, and the one every regression test exercises.
 *   'import' the Sterling templateImport bridge. Requires an INJECTED
 *            endpoint, because templateImport.cfm does not exist yet — there
 *            is no production import mode to select.
 *
 * Deliberately not a Generator UI control: it is an implementation choice, not
 * a creative one. Tests and the preview harness set it through
 * window.SMPPush.setTransportMode(). */
let transportMode = 'local';
let importTransport = null;

function setTransportMode(mode, transport) {
  if (mode !== 'local' && mode !== 'import') {
    throw new Error(`Unknown transport mode "${mode}". Use 'local' or 'import'.`);
  }
  if (mode === 'import' && !transport) {
    throw new Error('Import mode requires an explicit transport. There is no production '
      + 'import endpoint yet — inject a TemplateImportTransport (mock or otherwise).');
  }
  transportMode = mode;
  importTransport = mode === 'import' ? transport : null;
  return transportMode;
}

/* Push the current design through the IMPORT transport. Returns the server's
 * response. Never falls back to the local transport: a failed import must
 * surface as a failure, not quietly become a localStorage handoff. */
async function pushViaImport() {
  if (transportMode !== 'import' || !importTransport) {
    throw new Error('Import transport is not configured.');
  }
  const product = window.SMPProductSelection?.get?.() || null;
  const { template } = await convertCurrentDesign();
  return importTransport.send(template, product);
}
const postTransfer = (...a) => window.SMPTransportLocal.postTransfer(...a);

function downloadTemplateJson(template) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Button wiring ───────────────────────────────────── */

let pushInFlight = false;

async function pushToDesigner() {
  const btn = document.getElementById('pushToDesignerBtn');
  if (pushInFlight) return;
  pushInFlight = true;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Transferring…';
  try {
    const { template, substitutions } = await convertCurrentDesign();
    let url;
    if (SMP_CONFIG.transferEndpoint) {
      url = await postTransfer(template);
    } else {
      const id = await storeTransferLocallyWithFallback(template);
      url = `${SMP_CONFIG.designerUrl}?transfer=${encodeURIComponent(id)}`;
    }
    if (substitutions.length) {
      const list = [...new Set(substitutions.map(s => `${s.requested} → ${s.used}`))].join(', ');
      showError(`Note: some fonts were substituted with Sterling designer fonts: ${list}`);
    }
    window.open(url, 'sterlingDesignerTest');
  } catch (err) {
    showError(`Push to Designer failed: ${err.message}`);
  } finally {
    pushInFlight = false;
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('pushToDesignerBtn');
  if (btn) btn.addEventListener('click', pushToDesigner);
});

/* Expose for the test harness and unit tests */
window.SMPPush = { convertCurrentDesign, buildSterlingTemplate, extractObjectsFromDoc, mapFont, SMP_CONFIG, downloadTemplateJson, compressTemplateForDemoTransport, storeTransferLocallyWithFallback, setTransportMode, pushViaImport, transportMode: () => transportMode };
