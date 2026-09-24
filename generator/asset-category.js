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
 *   · guardScript(uploads) — a self-contained script injected into every rendered
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
  };

  /* What an icon STANDS FOR, from its icon-bank name (the manifest's own
   * name, never its artwork). A contact icon is only placed beside a line of
   * that information; every other bank icon is 'generic' and needs a line of
   * text beside it. */
  var ICON_INFO = {
    phone:   ['phone', 'phone-call', 'phone-forwarded', 'phone-frame', 'phone-handset', 'phone-incoming',
              'phone-missed', 'phone-off', 'phone-outgoing', 'phone-ring', 'phone-ring-2',
              'desk-phone', 'mobile-phone', 'smartphone'],
    email:   ['mail', 'mail-closed', 'mail-doc', 'mail-letter', 'mail-open', 'mail-plain', 'mail-unread',
              'envelope-note', 'at-sign', 'at-sign-bold'],
    web:     ['globe', 'globe-sphere', 'globe-sphere-2', 'globe-wire', 'earth', 'desk-globe', 'desk-globe-2',
              'browser-window', 'link', 'link-2', 'chain-link', 'external-link'],
    address: ['map-pin', 'map-pin-2', 'push-pin', 'map', 'folded-map', 'navigation', 'navigation-2',
              'navigation-arrow', 'navigation-circle', 'navigation-circle-round', 'navigation-plain'],
    hours:   ['clock', 'clock-bold'],
    social:  ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'],
  };
  function iconInfoType(name) {
    for (var t in ICON_INFO) if (ICON_INFO[t].indexOf(name) !== -1) return t;
    return 'generic';
  }

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
   *   3. <img src>, svg <image href>, CSS mask or background url under a
   *      library root -> that library
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
    if (tag === 'svg') return el.ownerSVGElement ? null : 'logo';
    if (tag === 'image') {
      var ik = kindFromSrc(el.getAttribute('href') || el.getAttribute('xlink:href') || '', d && d.baseURI);
      if (ik) return ik;
      return null;
    }
    var st = d && d.defaultView ? d.defaultView.getComputedStyle(el) : null;
    if (st) {
      /* mask-image (a recoloured mark) or background-image, whichever names a library file */
      var vals = [st.webkitMaskImage, st.maskImage, st.backgroundImage];
      for (var vi = 0; vi < vals.length; vi++) {
        var re = /url\(\s*["']?([^"')]+)["']?\s*\)/g, m;
        while ((m = re.exec(vals[vi] || ''))) { var mk = kindFromSrc(m[1], d.baseURI); if (mk) return mk; }
      }
    }
    return null;
  }

  /* ── the in-frame guard ──────────────────────────────────────────────────
   * Serialized with .toString() and injected into the design HTML, so it must
   * be a self-contained function: no closures over this file. `cfg` carries
   * the roots, the icon contract, the icon information types, and the
   * Generator's upload tags.
   *
   * Every design surface is judged — both sides of a two-sided card, each
   * against its own size — and judged again whenever the page changes a
   * style or class (the app flips sides by toggling an inline style; the
   * layout scripts move and scale text after load). */
  function guard(cfg) {
    if (window.__smpAssetGuardDone === undefined) window.__smpAssetGuardDone = 0;
    var ROOTS = cfg.roots, ICON = cfg.icon, KINDS = cfg.kinds, INFO = cfg.iconInfo || {};
    var uploads = cfg.uploads || {};
    var ROOT_SEL = '.card, .design, .canvas, [class*="card"], [class*="plate"], [class*="badge"]';
    var SIDE_SEL = '.card--front, .card--back';

    /* What each kind of contact information looks like as text. An icon of
     * that type is only legitimate beside a line that matches. */
    var MATCH = {
      phone: function (t) { return (t.match(/\d/g) || []).length >= 7; },
      email: function (t) { return /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t); },
      web: function (t) { return !/@/.test(t) && /\bwww\.|https?:\/\/|[a-z0-9-]*[a-z][a-z0-9-]*\.[a-z]{2,}(\/|\b)/i.test(t); },
      address: function (t) {
        return /\b\d+[a-z]?\s+[a-z]/i.test(t)
          || /\b[a-z]\d[a-z]\s?\d[a-z]\d\b/i.test(t)
          || (/\d/.test(t) && /\b(street|st|avenue|ave|road|rd|blvd|boulevard|drive|lane|ln|way|suite|ste|unit|crescent|cres|court|ct|place|pl|highway|hwy)\b/i.test(t));
      },
      hours: function (t) { return /\d{1,2}(:\d{2})?\s*(am|pm|a\.m|p\.m)|\b\d{1,2}:\d{2}\b|\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|24\/7/i.test(t); },
      social: function (t) { return /@[a-z0-9_.]{2,}|\/[a-z0-9_.-]{2,}|[a-z0-9-]+\.[a-z]{2,}/i.test(t); },
      generic: function (t) { return /[a-z0-9]/i.test(t); },
    };
    var infoByName = {};
    Object.keys(INFO).forEach(function (type) { INFO[type].forEach(function (n) { infoByName[n] = type; }); });

    function libraryKind(src) {
      if (!src) return null;
      if (/^data:/i.test(src)) return (uploads.photoPrefix && src.indexOf(uploads.photoPrefix) === 0) ? 'photo' : null;
      var path = src; try { path = new URL(src, document.baseURI).pathname; } catch (e) {}
      path = path.replace(/^\/+/, '');
      for (var k in ROOTS) for (var i = 0; i < ROOTS[k].length; i++) {
        var r = ROOTS[k][i];
        if (path.indexOf(r) === 0 || path.indexOf('/' + r) !== -1) return k;
      }
      return null;
    }
    function cssUrls(v) {
      var out = [], re = /url\(\s*["']?([^"')]+)["']?\s*\)/g, m;
      while ((m = re.exec(v || ''))) out.push(m[1]);
      return out;
    }
    /* The library url an element draws, and its category. */
    function source(el) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'img') { var s = el.currentSrc || el.getAttribute('src') || ''; return { url: s, kind: libraryKind(s) }; }
      if (tag === 'image') { var h = el.getAttribute('href') || el.getAttribute('xlink:href') || ''; return { url: h, kind: libraryKind(h) }; }
      var st = getComputedStyle(el);
      var urls = cssUrls(st.webkitMaskImage).concat(cssUrls(st.maskImage), cssUrls(st.backgroundImage));
      for (var i = 0; i < urls.length; i++) { var k = libraryKind(urls[i]); if (k) return { url: urls[i], kind: k }; }
      return null;
    }
    /* Only when some CSS in the page names a library file can a plain element
     * draw one through mask/background; otherwise computing every element's
     * style would be wasted work on every pass. */
    var cssNamesLibrary = false;
    function scanCss() {
      var text = '', i, st = document.querySelectorAll('style'), inl = document.querySelectorAll('[style]');
      for (i = 0; i < st.length; i++) if (st[i].id !== 'asset-category-guard') text += st[i].textContent;
      for (i = 0; i < inl.length; i++) text += inl[i].getAttribute('style');
      cssNamesLibrary = false;
      for (var k in ROOTS) for (var j = 0; j < ROOTS[k].length; j++) {
        if (text.indexOf(ROOTS[k][j]) !== -1) cssNamesLibrary = true;
      }
    }
    function classify(el) {
      var t = el.getAttribute('data-asset-kind');
      if (t && KINDS.indexOf(t) !== -1) return t;
      if (el.hasAttribute('data-icon-name')) return 'icon';
      var tag = el.tagName.toLowerCase();
      if (tag === 'svg') return el.ownerSVGElement ? null : 'logo';
      if (tag !== 'img' && tag !== 'image' && !cssNamesLibrary) return null;
      var src = source(el);
      return src ? src.kind : null;
    }
    function iconName(unit) {
      var n = unit.getAttribute('data-icon-name');
      if (n) return n;
      var src = source(unit), m = src && /icons\/[^/]+\/([^/?#]+)\.svg/i.exec(src.url);
      return m ? decodeURIComponent(m[1]) : '';
    }

    /* The design surfaces: each side of a two-sided card on its own, else the
     * outermost card-like element(s), else the body. */
    function designRoots() {
      var sides = document.querySelectorAll(SIDE_SEL);
      if (sides.length) return Array.prototype.slice.call(sides);
      var all = document.querySelectorAll(ROOT_SEL), out = [];
      for (var i = 0; i < all.length; i++) {
        var p = all[i].parentElement && all[i].parentElement.closest(ROOT_SEL);
        if (!p) out.push(all[i]);
      }
      if (!out.length && document.body) out.push(document.body);
      return out;
    }
    function shown(el) {
      var st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && el.getClientRects().length > 0;
    }

    /* Is the text beside this icon the information the icon stands for?
     * Beside = on the same row (either side, within a small gap) or directly
     * above/below it. Measured in the design's own CSS px (k undoes any scale
     * the preview puts on the whole page). */
    function besideItsInformation(unit, root, type, k, s) {
      var ir = unit.getBoundingClientRect();
      var L = ir.left * k, R = ir.right * k, T = ir.top * k, B = ir.bottom * k;
      var size = Math.max(R - L, B - T);
      /* reach is an icon's reach: a huge icon does not earn a huge one */
      var reach = Math.min(size, ICON.NORMAL_MAX * s);
      var gapRow = Math.max(16 * s, reach), gapCol = Math.max(8 * s, reach * 0.5);
      var test = MATCH[type] || MATCH.generic;
      var left = [], right = [], column = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var n;
      while ((n = walker.nextNode())) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        if (unit.contains(n)) continue;
        var pe = n.parentElement;
        if (!pe || pe.closest('[data-asset-guard="removed"]') || !shown(pe)) continue;
        var range = document.createRange(); range.selectNodeContents(n);
        var rects = range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i]; if (!r.width || !r.height) continue;
          var l = r.left * k, rr = r.right * k, t = r.top * k, b = r.bottom * k;
          var text = (pe.textContent || '').trim();
          var vOver = Math.min(B, b) - Math.max(T, t);
          if (vOver >= 0.5 * Math.min(B - T, b - t)) {
            if (l >= R - 2) right.push({ gap: l - R, x: l, text: text });
            else if (rr <= L + 2) left.push({ gap: L - rr, x: -rr, text: text });
            continue;
          }
          var hOver = Math.min(R, rr) - Math.max(L, l);
          if (hOver > 0) {
            var vGap = t >= B - 2 ? t - B : (b <= T + 2 ? T - b : -1);
            if (vGap >= 0 && vGap <= gapCol) column.push(text);
          }
        }
      }
      function row(side) {
        if (!side.length) return false;
        side.sort(function (a, b) { return a.gap - b.gap; });
        if (side[0].gap > gapRow) return false;
        /* the row's text read outward from the icon, as a person reads it */
        var within = side.filter(function (e) { return e.gap <= 240 * s; })
          .map(function (e) { return e.text; });
        var joined = [], seenT = {};
        within.forEach(function (t) { if (!seenT[t]) { seenT[t] = 1; joined.push(t); } });
        return test(joined.join(' '));
      }
      if (row(right) || row(left)) return true;
      for (var j = 0; j < column.length; j++) if (test(column[j])) return true;
      return false;
    }

    function remove(unit, report, name, reason, w, h) {
      unit.style.setProperty('display', 'none', 'important');
      unit.style.setProperty('visibility', 'hidden', 'important');
      unit.setAttribute('data-asset-guard', 'removed');
      unit.setAttribute('data-asset-guard-reason', reason);
      report.removed.push({ name: name, reason: reason, w: Math.round(w), h: Math.round(h) });
    }
    function clamp(unit, report, name, w, h, normalMax, layoutW) {
      var aspect = (w > 0 && h > 0) ? w / h : 1;
      var nh = normalMax, nw = normalMax * aspect;
      if (nw > normalMax) { nw = normalMax; nh = normalMax / aspect; }
      /* a scale transform is how the icon got big: drop it, size the box */
      if (layoutW > 0 && w / layoutW > 1.05) unit.style.setProperty('transform', 'none', 'important');
      unit.style.setProperty('width', nw.toFixed(2) + 'px', 'important');
      unit.style.setProperty('height', nh.toFixed(2) + 'px', 'important');
      unit.style.setProperty('min-width', '0', 'important');
      unit.style.setProperty('min-height', '0', 'important');
      unit.style.setProperty('flex', 'none', 'important');
      if (getComputedStyle(unit).display === 'inline') unit.style.setProperty('display', 'inline-block', 'important');
      var svgs = unit.tagName.toLowerCase() === 'svg' ? [] : unit.querySelectorAll('svg');
      for (var i = 0; i < svgs.length; i++) {
        svgs[i].style.setProperty('width', '100%', 'important');
        svgs[i].style.setProperty('height', '100%', 'important');
      }
      unit.setAttribute('data-asset-guard', 'clamped');
      report.corrected.push({ name: name, from: [Math.round(w), Math.round(h)], to: [Math.round(nw), Math.round(nh)] });
    }

    function judgeIcon(unit, root, RW, RH, k, s, report) {
      var ir = unit.getBoundingClientRect();
      var w = ir.width * k, h = ir.height * k;
      if (!(w > 0) || !(h > 0)) return;                      // not laid out yet: judged when it is
      var name = iconName(unit), type = infoByName[name] || 'generic';
      var areaFrac = (w * h) / (RW * RH);
      var st = getComputedStyle(unit);
      var z = parseInt(st.zIndex, 10);
      var background = w >= RW * 0.5 || h >= RH * 0.5 || areaFrac >= 0.25
        || (st.position === 'absolute' && st.inset === '0px') || z < 0;
      if (background) return remove(unit, report, name, 'background', w, h);
      if (!besideItsInformation(unit, root, type, k, s)) {
        return remove(unit, report, name, type === 'generic' ? 'no-adjacent-text' : 'no-' + type + '-information', w, h);
      }
      var normalMax = ICON.NORMAL_MAX * s;
      if (w > normalMax + 0.5 || h > normalMax + 0.5 || areaFrac > ICON.AREA_FRACTION_HERO) {
        clamp(unit, report, name, w, h, normalMax, unit.offsetWidth);
        /* Shrunk in place, a big icon can end up floating away from the line
         * it was drawn against. At icon size it must still be beside it. */
        if (!besideItsInformation(unit, root, type, k, s)) {
          report.corrected.pop();
          remove(unit, report, name, 'not-beside-' + (type === 'generic' ? 'text' : type + '-information') + '-at-icon-size', w, h);
        }
      }
    }

    function judgeLogo(unit, report) {
      var tag = unit.tagName.toLowerCase();
      if (tag === 'img') {
        var fit = getComputedStyle(unit).objectFit;
        if (fit === 'cover' || fit === 'fill') {
          unit.style.setProperty('object-fit', 'contain', 'important');
          unit.setAttribute('data-asset-guard', 'logo-contain');
          report.corrected.push({ logo: unit.getAttribute('src'), fix: 'object-fit: contain' });
        } else if (fit !== 'contain' && fit !== 'scale-down') {
          var nw = unit.naturalWidth, nh = unit.naturalHeight, lw = unit.offsetWidth, lh = unit.offsetHeight;
          if (nw && nh && lw && lh && Math.abs(nw / nh - lw / lh) / (nw / nh) > 0.02) {
            unit.style.setProperty('height', 'auto', 'important');
            unit.setAttribute('data-asset-guard', 'logo-aspect');
            report.corrected.push({ logo: unit.getAttribute('src'), fix: 'aspect restored' });
          }
        }
      } else if (tag !== 'svg') {
        var ms = getComputedStyle(unit);
        var msz = ms.webkitMaskSize || ms.maskSize || '';
        if (msz && !/contain/.test(msz) && (cssUrls(ms.webkitMaskImage).length || cssUrls(ms.maskImage).length)) {
          unit.style.setProperty('-webkit-mask-size', 'contain', 'important');
          unit.style.setProperty('mask-size', 'contain', 'important');
          unit.setAttribute('data-asset-guard', 'logo-contain');
          report.corrected.push({ logo: 'mask', fix: 'mask-size: contain' });
        }
      }
    }

    function run() {
      var report = window.__smpAssetGuardReport
        || (window.__smpAssetGuardReport = { corrected: [], removed: [], tagged: 0 });
      scanCss();
      var roots = designRoots();
      for (var ri = 0; ri < roots.length; ri++) {
        var root = roots[ri];
        var RW = root.offsetWidth, RH = root.offsetHeight;
        if (RW < 2 || RH < 2 || !shown(root)) continue;       // a hidden side is judged when it is shown
        var rr = root.getBoundingClientRect();
        var k = rr.width > 0 ? RW / rr.width : 1;
        var s = Math.min(RW / ICON.REF_W, RH / ICON.REF_H); if (!(s > 0)) s = 1;
        var els = root.querySelectorAll(cssNamesLibrary ? '*' : 'img, image, svg, [data-icon-name], [data-asset-kind]');
        var units = [];
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (!el.hasAttribute('data-icon-name') && el.parentElement && el.parentElement.closest('[data-icon-name]')) continue; // the span is the unit
          var kind = classify(el);
          if (!kind) continue;
          if (el.getAttribute('data-asset-kind') !== kind) {
            if (!el.hasAttribute('data-asset-kind')) report.tagged++;
            el.setAttribute('data-asset-kind', kind);
          }
          if (el.hasAttribute('data-asset-guard')) continue;   // already corrected or removed
          units.push([el, kind]);
        }
        for (var u = 0; u < units.length; u++) {
          if (units[u][1] === 'icon') judgeIcon(units[u][0], root, RW, RH, k, s, report);
          else if (units[u][1] === 'logo') judgeLogo(units[u][0], report);
          /* photo and designAsset: hero, background, crop all allowed */
        }
      }
      window.__smpAssetGuardDone++;
    }

    /* Passes: at load, after fonts, and as the layout scripts settle; then,
     * only once the page has loaded, whenever a style or class changes (the
     * app flips sides by toggling an inline style). Nothing runs while the
     * page is still parsing, so the guard never slows the preview's load. */
    var pending = null, loaded = false;
    function soon() { if (pending) return; pending = setTimeout(function () { pending = null; run(); }, 50); }
    function onLoad() {
      if (loaded) return; loaded = true;
      run(); [60, 300, 700, 1500].forEach(function (t) { setTimeout(run, t); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
      if (window.MutationObserver) {
        new MutationObserver(soon).observe(document.documentElement,
          { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
      }
    }
    if (document.readyState === 'complete') onLoad(); else window.addEventListener('load', onLoad);
    window.__smpAssetGuardRun = run;
  }

  /** The script tag to inject into a design's HTML. `uploads.photoPrefix` is
   *  the leading bytes of the user's uploaded-photo data URI, so the guard can
   *  recognise it as a photo without the Generator re-tagging the HTML. */
  function guardScript(uploads) {
    var cfg = { roots: ROOTS, icon: ICON, kinds: KINDS, iconInfo: ICON_INFO, uploads: uploads || {} };
    return '<script id="asset-category-guard">(' + guard.toString() + ')(' + JSON.stringify(cfg) + ');</script>';
  }

  root.SMPAssetCategory = {
    KINDS: KINDS, ROOTS: ROOTS, ICON: ICON, ICON_INFO: ICON_INFO,
    iconInfoType: iconInfoType,
    iconLimits: iconLimits,
    kindFromSrc: kindFromSrc,
    resolveElement: resolveElement,
    guardScript: guardScript,
    GUARD_SCRIPT_ID: 'asset-category-guard',
  };
})(typeof window !== 'undefined' ? window : globalThis);
