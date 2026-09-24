/* Asset categories — the ONE place the Generator knows what a library asset IS.
 *
 * Four categories, kept distinct from selection through the Sterling handoff:
 *
 *   photo        photographic content — may be hero, background or content;
 *                crop/cover allowed
 *   icon         a supporting semantic symbol — never background, never hero,
 *                never dominant decoration; beside the information it stands
 *                for; small; omitted if there is nowhere sensible to put it
 *   logo         brand identity — aspect preserved, never cropped or stretched,
 *                never decorative artwork
 *   designAsset  decorative/artistic material (watercolour, sketch, texture,
 *                flourish, abstract shape) — may be large, background, accent
 *                or hero
 *
 * The category comes from the SOURCE, never from how an element looks or how
 * big the model drew it: the icon bank's manifest (`data-icon-name` on the span
 * IconBank.inline() writes, or an icons/<collection>/<name>.svg path), and the
 * three library manifests' own base paths for photos, logos and design assets.
 * A user-uploaded photograph and a user-supplied SVG logo are tagged by the
 * Generator at the point it places them.
 *
 * Two consumers:
 *   · guardSource(cfg) — a self-contained script injected into every rendered
 *     design (preview, side previews, offscreen extraction frames, downloaded
 *     HTML). It classifies every library-backed element, writes
 *     data-asset-kind on it, and ENFORCES the category rules deterministically
 *     — the prompt alone is not trusted.
 *   · resolveElement(el) — used by extraction so every normalized image element
 *     carries the same category the guard decided.
 *
 * Plain script, no fetch: nothing here depends on the network or the demo guard.
 */
(function (root) {
  'use strict';

  var KINDS = ['photo', 'icon', 'logo', 'designAsset'];

  /* Library roots, exactly as the manifests declare them (their `url`/`file`
   * fields are relative to the generator page). Order matters only for
   * readability; the prefixes are disjoint. */
  var ROOTS = {
    photo:       ['assets/stock-photo-library/'],
    logo:        ['assets/logo-library/'],
    designAsset: ['assets/design-library/'],
    icon:        ['icons/'],
  };

  /* ICON size contract, in px on the reference 360x216 business-card canvas;
   * scaled by the canvas's short side for other products. */
  var ICON = {
    REF_W: 360, REF_H: 216,
    NORMAL_MIN: 16, NORMAL_MAX: 36, ABSOLUTE_MAX: 48,
    /* An icon covering more of the card than this is being used as artwork. */
    AREA_FRACTION_HERO: 0.04,
    /* A text run this close (in icon heights) counts as "the information it
     * represents". Beyond it, an oversized icon has no legitimate placement. */
    BESIDE_TEXT_FACTOR: 1.5,
  };

  function scaleFor(canvasW, canvasH) {
    var s = Math.min(canvasW / ICON.REF_W, canvasH / ICON.REF_H);
    return isFinite(s) && s > 0 ? s : 1;
  }

  function iconLimits(canvasW, canvasH) {
    var s = scaleFor(canvasW, canvasH);
    return { normalMin: ICON.NORMAL_MIN * s, normalMax: ICON.NORMAL_MAX * s, absoluteMax: ICON.ABSOLUTE_MAX * s, scale: s };
  }

  /** Category of a src/url by its library root, or null when it is not a
   *  library file. `pageUrl` resolves relative srcs; a data: URI resolves to
   *  nothing here (uploads are tagged by the Generator instead). */
  function kindFromSrc(src, pageUrl) {
    if (!src || typeof src !== 'string') return null;
    if (/^data:/i.test(src)) return null;
    var path = src;
    try { path = new URL(src, pageUrl || (root.location && root.location.href) || 'http://x/').pathname; }
    catch (e) { /* keep the raw string */ }
    path = path.replace(/^\/+/, '');
    var k, i, r;
    for (k in ROOTS) {
      for (i = 0; i < ROOTS[k].length; i++) {
        r = ROOTS[k][i];
        if (path.indexOf(r) === 0 || path.indexOf('/' + r) !== -1 || path.indexOf('generator/' + r) !== -1) return k;
      }
    }
    return null;
  }

  /** The category of a rendered element, from authoritative marks only:
   *   1. data-asset-kind already written (by the guard, or by the Generator
   *      when it placed an upload)
   *   2. inside an icon-bank span (data-icon-name)  -> icon
   *   3. <img src> / CSS mask url under a library root -> that library
   *   4. an inline <svg> that is NOT an icon-bank icon -> logo (the prompt
   *      reserves hand-drawn/user SVG for the brand mark)
   *  Returns one of KINDS, or null for an element that is not a library asset
   *  (a snapshot raster, a plain colour block, text). Never inferred from size
   *  or appearance. */
  function resolveElement(el, doc) {
    if (!el) return null;
    var d = doc || el.ownerDocument;
    var tagged = el.getAttribute && el.getAttribute('data-asset-kind');
    if (tagged && KINDS.indexOf(tagged) !== -1) return tagged;
    var span = el.closest && el.closest('[data-icon-name]');
    if (span) return 'icon';
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'img') {
      var k = kindFromSrc(el.currentSrc || el.getAttribute('src') || '', d && d.baseURI);
      if (k) return k;
      return null;
    }
    if (tag === 'svg') return 'logo';
    var st = d && d.defaultView ? d.defaultView.getComputedStyle(el) : null;
    if (st) {
      var mask = (st.webkitMaskImage && st.webkitMaskImage !== 'none') ? st.webkitMaskImage
               : (st.maskImage && st.maskImage !== 'none') ? st.maskImage : '';
      var m = /url\("?([^")]+)"?\)/.exec(mask || '');
      if (m) { var mk = kindFromSrc(m[1], d.baseURI); if (mk) return mk; }
    }
    return null;
  }

  /* ── the in-frame guard ──────────────────────────────────────────────────
   * Serialized with .toString() and injected into the design HTML, so it must
   * be a self-contained function: no closures over this file. `cfg` carries
   * the roots, the icon contract, and the Generator's upload tags. */
  function guard(cfg) {
    if (window.__smpAssetGuardDone === undefined) window.__smpAssetGuardDone = 0;
    var ROOTS = cfg.roots, ICON = cfg.icon, KINDS = cfg.kinds;
    var uploads = cfg.uploads || {};
    function kindFromSrc(src) {
      if (!src || /^data:/i.test(src)) {
        if (src && uploads.photoPrefix && src.indexOf(uploads.photoPrefix) === 0) return 'photo';
        return null;
      }
      var path = src; try { path = new URL(src, document.baseURI).pathname; } catch (e) {}
      path = path.replace(/^\/+/, '');
      for (var k in ROOTS) for (var i = 0; i < ROOTS[k].length; i++) {
        var r = ROOTS[k][i];
        if (path.indexOf(r) === 0 || path.indexOf('/' + r) !== -1 || path.indexOf('generator/' + r) !== -1) return k;
      }
      return null;
    }
    function classify(el) {
      var t = el.getAttribute('data-asset-kind');
      if (t && KINDS.indexOf(t) !== -1) return t;
      if (el.closest('[data-icon-name]')) return 'icon';
      var tag = el.tagName.toLowerCase();
      if (tag === 'img') return kindFromSrc(el.currentSrc || el.getAttribute('src') || '');
      if (tag === 'svg') return el.closest('[data-icon-name]') ? 'icon' : 'logo';
      var st = getComputedStyle(el);
      var mask = (st.webkitMaskImage && st.webkitMaskImage !== 'none') ? st.webkitMaskImage
               : (st.maskImage && st.maskImage !== 'none') ? st.maskImage : '';
      var m = /url\("?([^")]+)"?\)/.exec(mask || '');
      return m ? kindFromSrc(m[1]) : null;
    }
    function card() {
      return document.querySelector('.card, .design, .canvas, [class*="card"], [class*="plate"], [class*="badge"]')
        || (document.body && document.body.firstElementChild);
    }
    function hasTextNear(el, reach) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var walker = document.createTreeWalker(card() || document.body, NodeFilter.SHOW_TEXT);
      var n;
      while ((n = walker.nextNode())) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        if (el.contains(n)) continue;
        var range = document.createRange(); range.selectNodeContents(n);
        var tr = range.getBoundingClientRect();
        if (!tr.width && !tr.height) continue;
        var dx = Math.max(tr.left - r.right, r.left - tr.right, 0);
        var dy = Math.max(tr.top - r.bottom, r.top - tr.bottom, 0);
        if (Math.sqrt(dx * dx + dy * dy) <= reach) return true;
      }
      return false;
    }
    /* Layout size in CSS px. The preview scales the whole body to fit its
     * frame, so bounding rects there are transformed; offset sizes are what
     * the design's own CSS says, and what extraction lifts. */
    function cssSize(el) {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!(w > 0) || !(h > 0)) { var r = el.getBoundingClientRect(); w = r.width; h = r.height; }
      return { w: w, h: h };
    }
    function run() {
      var c = card(); if (!c) return;
      var cs = cssSize(c), cw = cs.w, chh = cs.h; if (cw < 2 || chh < 2) return;
      var s = Math.min(cw / ICON.REF_W, chh / ICON.REF_H); if (!(s > 0)) s = 1;
      var normalMax = ICON.NORMAL_MAX * s, absMax = ICON.ABSOLUTE_MAX * s;
      /* cumulative across the settle passes: a judged element is not re-judged */
      var report = window.__smpAssetGuardReport
        || (window.__smpAssetGuardReport = { corrected: [], removed: [], tagged: 0 });
      var els = c.querySelectorAll('img, svg, [data-icon-name], [style*="mask"], [class]');
      var seen = [];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.closest('[data-icon-name]') && el.tagName.toLowerCase() !== 'span' && !el.hasAttribute('data-icon-name')) continue; // the svg inside the icon span: the span is the unit
        var kind = classify(el);
        if (!kind) continue;
        if (seen.indexOf(el) !== -1) continue; seen.push(el);
        /* the icon unit is the IconBank span; an icon <svg> is judged via its span */
        var unit = kind === 'icon' ? (el.closest('[data-icon-name]') || el) : el;
        if (seen.indexOf(unit) === -1) seen.push(unit);
        if (unit.hasAttribute('data-asset-guard')) continue;
        if (!unit.hasAttribute('data-asset-kind')) report.tagged++;
        unit.setAttribute('data-asset-kind', kind);
        if (kind === 'icon') {
          var us = cssSize(unit);
          var w = us.w, h = us.h;
          var name = unit.getAttribute('data-icon-name') || '';
          var areaFrac = (w * h) / (cw * chh);
          var covers = w >= cw * 0.5 || h >= chh * 0.5 || areaFrac >= 0.25;
          var st = getComputedStyle(unit);
          var isBackground = covers || (st.position === 'absolute' && st.inset === '0px') || st.zIndex === '-1';
          if (isBackground) {
            /* an icon used as background/hero artwork: no legitimate placement */
            report.removed.push({ name: name, reason: 'background', w: Math.round(w), h: Math.round(h) });
            unit.setAttribute('data-asset-guard', 'removed'); unit.style.display = 'none'; continue;
          }
          if (w > absMax || h > absMax || areaFrac > ICON.AREA_FRACTION_HERO) {
            var ur = unit.getBoundingClientRect();
            var beside = hasTextNear(unit, Math.max(ur.width, ur.height) * ICON.BESIDE_TEXT_FACTOR);
            if (!beside) {
              report.removed.push({ name: name, reason: 'oversized-no-placement', w: Math.round(w), h: Math.round(h) });
              unit.setAttribute('data-asset-guard', 'removed'); unit.style.display = 'none'; continue;
            }
            /* beside its information: shrink to a normal icon, aspect kept */
            var aspect = (w > 0 && h > 0) ? w / h : 1;
            var nh = normalMax, nw = normalMax * aspect;
            if (nw > normalMax) { nw = normalMax; nh = normalMax / aspect; }
            unit.style.setProperty('width', nw.toFixed(2) + 'px', 'important');
            unit.style.setProperty('height', nh.toFixed(2) + 'px', 'important');
            unit.style.setProperty('display', 'inline-block', 'important');
            unit.style.setProperty('flex', 'none', 'important');
            unit.setAttribute('data-asset-guard', 'clamped');
            report.corrected.push({ name: name, from: [Math.round(w), Math.round(h)], to: [Math.round(nw), Math.round(nh)] });
          }
        } else if (kind === 'logo') {
          var tag = unit.tagName.toLowerCase();
          if (tag === 'img') {
            var lcs = getComputedStyle(unit);
            var fit = lcs.objectFit;
            if (fit === 'cover' || fit === 'fill') {
              unit.style.setProperty('object-fit', 'contain', 'important');
              unit.setAttribute('data-asset-guard', 'logo-contain');
              report.corrected.push({ logo: unit.getAttribute('src'), fix: 'object-fit: contain' });
            } else if (fit !== 'contain' && fit !== 'scale-down') {
              var nw2 = unit.naturalWidth, nh2 = unit.naturalHeight, ls = cssSize(unit);
              if (nw2 && nh2 && ls.w && ls.h) {
                var want = nw2 / nh2, have = ls.w / ls.h;
                if (Math.abs(want - have) / want > 0.02) {
                  unit.style.setProperty('height', 'auto', 'important');
                  unit.setAttribute('data-asset-guard', 'logo-aspect');
                  report.corrected.push({ logo: unit.getAttribute('src'), fix: 'aspect restored' });
                }
              }
            }
          } else if (tag !== 'svg') {
            var ms = getComputedStyle(unit);
            var msz = ms.webkitMaskSize || ms.maskSize || '';
            if (msz && msz !== 'contain' && !/contain/.test(msz)) {
              unit.style.setProperty('-webkit-mask-size', 'contain', 'important');
              unit.style.setProperty('mask-size', 'contain', 'important');
              unit.setAttribute('data-asset-guard', 'logo-contain');
              report.corrected.push({ logo: 'mask', fix: 'mask-size: contain' });
            }
          }
        }
        /* photo and designAsset: no constraint — hero, background, crop all allowed */
      }
      window.__smpAssetGuardDone++;
    }
    function all() { run(); setTimeout(run, 60); setTimeout(run, 300); setTimeout(run, 700); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(all); else all();
    if (document.readyState === 'complete') all(); else window.addEventListener('load', all);
    window.__smpAssetGuardRun = run;
  }

  /** The script tag to inject into a design's HTML. `uploads.photoPrefix` is
   *  the leading bytes of the user's uploaded-photo data URI, so the guard can
   *  recognise it as a photo without the Generator re-tagging the HTML. */
  function guardScript(uploads) {
    var cfg = { roots: ROOTS, icon: ICON, kinds: KINDS, uploads: uploads || {} };
    return '<script id="asset-category-guard">(' + guard.toString() + ')(' + JSON.stringify(cfg) + ');</script>';
  }

  root.SMPAssetCategory = {
    KINDS: KINDS, ROOTS: ROOTS, ICON: ICON,
    iconLimits: iconLimits,
    kindFromSrc: kindFromSrc,
    resolveElement: resolveElement,
    guardScript: guardScript,
    GUARD_SCRIPT_ID: 'asset-category-guard',
  };
})(typeof window !== 'undefined' ? window : globalThis);
