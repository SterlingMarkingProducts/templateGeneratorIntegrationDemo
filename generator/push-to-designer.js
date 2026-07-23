/* Push to Designer — converts the generated HTML design into Sterling's
 * "version 1.2" template JSON (the format served by gettemplateJson.cfm and
 * consumed by SMPdesigner.js / parseTemplate) and hands it to a designer
 * instance.
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

/* Fonts available in the live designer (fontlist in Designer.cfm). */
const STERLING_FONTS = ['Arial','Arial Narrow','Aptos','Atlanta','Atlantic Inline','Belgium','Bentham','Bermuda Script','BrushScriptStd','Castle Com','Calibri','Clarendon BT','Cooper Md BT','Courier New','FleurishScript','Franklin Gothic ITC Bk BT','Futura Md BT','Futura Hv BT','Futura Bk BT','Germany','Gill Sans MT','Goudy Old Style','Helsinki Narrow','Helvetica','Istanbul','Myriad Pro','Myriad Pro Condensed','Open Sans','Open Sans Light','Open Sans SemiBold','Optima','Palatino Linotype','San Diego','Swis721 BT','Times New Roman','Trade Gothic Next','Trade Gothic Next Condensed','Trade Gothic Next Light','Trebuchet MS','US Roman','Utah','Verdana','Zapf Chancery'];

const FONT_FALLBACKS = {
  'sans-serif': 'Arial', 'system-ui': 'Arial', 'segoe ui': 'Arial', 'roboto': 'Arial',
  'helvetica neue': 'Helvetica', 'inter': 'Open Sans', 'lato': 'Open Sans',
  'serif': 'Times New Roman', 'georgia': 'Goudy Old Style', 'garamond': 'Goudy Old Style',
  'playfair display': 'Goudy Old Style', 'monospace': 'Courier New', 'futura': 'Futura Md BT',
  'gill sans': 'Gill Sans MT', 'optima': 'Optima', 'palatino': 'Palatino Linotype',
  'brush script mt': 'BrushScriptStd', 'trade gothic': 'Trade Gothic Next',
};

const MODE_BY_PRODUCT = {
  'Business Card': 'FullColour', 'Poster': 'FullColour', 'Sign': 'FullColour',
  'Brochure': 'FullColour', 'Stamp': 'SingleColour',
  'Nameplate': 'EngravedPlastic', 'Name Badge': 'EngravedPlastic',
};

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

/* Classify a clean-solid element into a native Fabric shape descriptor, in
 * canvas pixels. Returns null when the geometry isn't cleanly representable
 * (left for the raster). left/top/w/h are already in canvas px. */
function classifyNativeShape(style, left, top, w, h, angle, fill, factor) {
  const base = {
    version: '4.4.0', originX: 'left', originY: 'top',
    left: round2(left), top: round2(top), fill,
    stroke: null, strokeWidth: 0, angle, scaleX: 1, scaleY: 1,
    opacity: parseFloat(style.opacity), sterlingType: 'shape', typeImage: 'shapes',
  };
  // clip-path polygon wedge/band → real polygon
  const poly = parseClipPolygon(style.clipPath, w / 1, h / 1);
  if (poly) {
    // element-local px are already at canvas scale (w,h are scaled); points too
    return { ...base, type: 'polygon', points: poly.map(p => ({ x: round2(p.x), y: round2(p.y) })),
             width: round2(w), height: round2(h) };
  }
  const rad = cornerRadii(style, w, h);
  const allEqual = Math.abs(rad.tl - rad.tr) < 0.5 && Math.abs(rad.tr - rad.br) < 0.5 && Math.abs(rad.br - rad.bl) < 0.5;
  const isCircleish = allEqual && rad.tl >= Math.min(w, h) / 2 - 1;
  if (isCircleish && Math.abs(w - h) < 1.5) {
    return { ...base, type: 'circle', radius: round2(w / 2), left: round2(left), top: round2(top) };
  }
  if (isCircleish) {
    return { ...base, type: 'ellipse', rx: round2(w / 2), ry: round2(h / 2) };
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
    return { ...base, type: 'circle', radius: round2(R), left: round2(cx - R), top: round2(cy - R) };
  }
  // plain rectangle (optionally uniformly rounded)
  return { ...base, type: 'rect', width: round2(w), height: round2(h),
           rx: round2(allEqual ? rad.tl : 0), ry: round2(allEqual ? rad.tl : 0) };
}

/* Extract Fabric v4 objects from one rendered document. rootEl is the design
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
     *                       quarter-disc) → NATIVE editable Fabric shape
     *  - inline SVG, gradients, shadows, blends, textures, photos → flattened
     *    into the raster (rasterizeBackground), which is clip-path aware.
     * Native objects are marked data-tg-extract so the raster skips them. */

    if (el.tagName === 'svg') {
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
      textOwners.add(el);
      el.setAttribute('data-tg-extract', '1');
      const fontSize = parseFloat(style.fontSize) * factor;
      const letterPx = parseFloat(style.letterSpacing);
      candidates.push({ el, obj: {
        type: 'i-text', version: '4.4.0', originX: 'left', originY: 'top',
        sterlingType: 'textObject',
        left: round2(left), top: round2(top), width: round2(Math.max(width, 10)),
        text: normalizeText(el),
        fontSize: round2(fontSize),
        fontFamily: mapFont(style.fontFamily, substitutions),
        fontWeight: normalizeWeight(style.fontWeight),
        fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
        underline: (style.textDecorationLine || '').includes('underline'),
        textAlign: ['left','center','right','justify'].includes(style.textAlign) ? style.textAlign : 'left',
        fill: cssColorToHex(style.color, doc) || '#000000',
        lineHeight: normalizeLineHeight(style, fontSize / factor),
        charSpacing: Number.isFinite(letterPx) && fontSize > 0 ? Math.round((letterPx * factor) / fontSize * 1000) : 0,
        angle, scaleX: 1, scaleY: 1, opacity: parseFloat(style.opacity),
      } });
    }
  }

  /* Deduplicate glow/shadow clones: designs often layer the same text several
   * times for effects. Keep the topmost (last in DOM order) of any copies with
   * identical text at nearly the same position; every copy stays hidden in the
   * raster so nothing doubles up. */
  const deduped = [];
  for (const c of candidates) {
    const dup = deduped.findIndex(d => d.obj.text === c.obj.text
      && Math.abs(d.obj.left - c.obj.left) < Math.max(8, c.obj.fontSize * 0.6)
      && Math.abs(d.obj.top - c.obj.top) < Math.max(8, c.obj.fontSize * 0.6));
    if (dup >= 0) deduped[dup] = c; else deduped.push(c);
  }
  deduped.forEach(c => objects.push(c.obj));

  return objects;
}

function makeImageObject(src, naturalW, naturalH, left, top, width, height, angle, style) {
  return {
    type: 'image', version: '4.4.0', originX: 'left', originY: 'top',
    left: round2(left), top: round2(top),
    width: round2(naturalW), height: round2(naturalH),
    scaleX: round4(width / naturalW), scaleY: round4(height / naturalH),
    angle, src, crossOrigin: 'anonymous', opacity: parseFloat(style.opacity),
  };
}

function normalizeText(el) {
  // innerText preserves line breaks the way the user sees them
  return (el.innerText || el.textContent || '').replace(/ /g, ' ').trim();
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
  const toObj = () => ({
    type: 'image', version: '4.4.0', originX: 'left', originY: 'top',
    left: 0, top: 0, width: cw, height: ch,
    scaleX: round4(targetWidthPx / cw), scaleY: round4(targetHeightPx / ch),
    angle: 0, src: cv.toDataURL('image/png'), crossOrigin: 'anonymous', opacity: 1,
    /* Selectable/movable: the background artwork is a normal image object (not
     * fixedImage) so it can be selected, dragged, and scaled in the designer.
     * It renders behind the text purely by array order (first object = bottom
     * of the stack). sterlingType marks its provenance without locking it. */
    sterlingType: 'backgroundArt',
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
function buildSterlingTemplate(pages, payload) {
  const widthPx = Math.round(toPx(payload.width, payload.unit));
  const heightPx = Math.round(toPx(payload.height, payload.unit));
  const bleedPx = bleedPxFor(payload.templateType);
  const mode = MODE_BY_PRODUCT[payload.templateType] || 'FullColour';

  const canvasProperties = {
    width: widthPx, height: heightPx, dpi: 96, shape: 'rect', angle: 0,
    designerVariationCode: mode,
    bleedTop: bleedPx, bleedRight: bleedPx, bleedBottom: bleedPx, bleedLeft: bleedPx, bleedMargin: 0,
    borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0, borderWidth: 2,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    sideBorder: 0, topBorder: 0, sideMargin: 0, topMargin: 0,
    daterBoxHeight: 0, daterBoxWidth: 0, maxLines: 0,
    drawFullBorder: false, greenInkAvailable: false, isProstamp: false,
    materialColour: '', productNumber: '', productNumberVariation: '',
    /* provenance — lets the designer recognise generator designs */
    sourceApplication: 'templateGenerator',
    sourceVersion: 1,
    sourceMeta: {
      templateType: payload.templateType,
      widthIn: payload.unit === 'in' ? payload.width : round2(widthPx / 96),
      heightIn: payload.unit === 'in' ? payload.height : round2(heightPx / 96),
      businessName: payload.businessName || '',
    },
  };

  return {
    templateNumber: 0,
    templateKey: 'TG-' + Date.now().toString(36).toUpperCase(),
    version: 1.2,
    canvasProperties,
    productList: [],
    pages: pages.map((objects, i) => ({
      page: i,
      canvasProperties: { ...canvasProperties },
      canvasData: { version: '4.4.0', objects },
    })),
  };
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

async function extractPage(frame, targetWidthPx, targetHeightPx, substitutions) {
  const doc = frame?.contentDocument;
  if (!doc || !doc.body || !doc.body.firstElementChild) return null;
  const rootEl = findDesignRoot(doc);
  if (!rootEl) return null;
  const rootRect = rootEl.getBoundingClientRect();
  if (rootRect.width < 2) return null;
  const factor = targetWidthPx / rootRect.width;
  const objects = extractObjectsFromDoc(doc, rootEl, factor, substitutions);
  const bg = await rasterizeBackground(doc, rootEl, targetWidthPx, targetHeightPx);
  rootEl.querySelectorAll('[data-tg-extract]').forEach(el => el.removeAttribute('data-tg-extract'));
  return bg ? [bg, ...objects] : objects;
}

/* Public: convert the current generated design. Returns {template, substitutions}. */
/* Render an HTML string in a temporary, laid-out (but off-screen) iframe and
 * extract one page from it. Used for reliable double-sided extraction. */
async function extractFromOffscreen(html, widthPx, heightPx, substitutions) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;border:0;'
    + 'width:' + widthPx + 'px;height:' + (heightPx * 2) + 'px;';
  document.body.appendChild(frame);
  try {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.srcdoc = html;
    });
    await new Promise(r => setTimeout(r, 250)); // let fonts/layout settle
    return await extractPage(frame, widthPx, heightPx, substitutions);
  } finally {
    frame.remove();
  }
}

async function convertCurrentDesign() {
  if (!generatedHtml || !lastPayload) {
    throw new Error('Generate a design first, then push it to the designer.');
  }
  const widthPx = Math.round(toPx(lastPayload.width, lastPayload.unit));
  const heightPx = Math.round(toPx(lastPayload.height, lastPayload.unit));
  const substitutions = [];
  const pages = [];

  if (lastPayload.doubleSided) {
    const front = await extractPage(document.getElementById('thumbFrontFrame'), widthPx, heightPx, substitutions);
    const back = await extractPage(document.getElementById('thumbBackFrame'), widthPx, heightPx, substitutions);
    if (front) pages.push(front);
    if (back) pages.push(back);
    /* Robust path: if the app's side thumbnails weren't laid out (so a side
     * came back empty) but the design markup has a back side, render each side
     * in a temporary offscreen iframe and extract from there. Independent of
     * the app's preview UI, so double-sided always transfers both pages. */
    if (pages.length < 2 && /card--back/i.test(generatedHtml)) {
      pages.length = 0;
      for (const side of ['front', 'back']) {
        const html = (typeof injectThumbSideCss === 'function') ? injectThumbSideCss(generatedHtml, side) : generatedHtml;
        const p = await extractFromOffscreen(html, widthPx, heightPx, substitutions);
        if (p) pages.push(p);
      }
    }
  }
  if (!pages.length) {
    const single = await extractPage(document.getElementById('previewFrame'), widthPx, heightPx, substitutions);
    if (single) pages.push(single);
  }
  if (!pages.length || !pages[0].length) {
    throw new Error('Could not read any design elements from the preview. Try regenerating the design.');
  }
  return { template: buildSterlingTemplate(pages, lastPayload), substitutions };
}

/* ── Transfer transports ─────────────────────────────── */

function storeTransferLocally(template) {
  const id = 'tg-' + Math.random().toString(36).slice(2, 10);
  const record = {
    id, format: 'sterling-template-1.2', source: 'templateGenerator',
    created: Date.now(), expires: Date.now() + SMP_CONFIG.transferTtlMs,
    design: template,
  };
  // prune expired transfers so localStorage cannot fill up
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(SMP_CONFIG.transferKey + ':')) {
      try {
        const old = JSON.parse(localStorage.getItem(key));
        if (!old.expires || old.expires < Date.now()) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  }
  localStorage.setItem(`${SMP_CONFIG.transferKey}:${id}`, JSON.stringify(record));
  return id;
}

async function postTransfer(template) {
  const res = await fetch(SMP_CONFIG.transferEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'templateGenerator', design: template }),
  });
  if (!res.ok) throw new Error(`Transfer endpoint returned ${res.status}`);
  const data = await res.json();
  if (!data.designerUrl) throw new Error('Transfer endpoint did not return a designer URL.');
  return data.designerUrl;
}

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
      const id = storeTransferLocally(template);
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
window.SMPPush = { convertCurrentDesign, buildSterlingTemplate, extractObjectsFromDoc, mapFont, SMP_CONFIG, downloadTemplateJson };
