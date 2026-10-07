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
    /* HOW THE LIMITS GROW WITH THE CANVAS. A hand-held piece — anything up to
     * about 13in on its short side: cards, badges, postcards, flyers, tri-fold
     * brochures — is read at arm's length, so an icon on it is the same
     * physical thing it is on a card, however big the sheet: the scale stops
     * at 1.25 (36px -> 45px normal, 48px -> 60px absolute). Scaling straight
     * with the canvas gave an 11x8.5 brochure 105px/141px icons — a third of
     * a panel's width. Only distance-read large format (signs, posters,
     * banners, beyond 13in) keeps scaling with the canvas. In share-of-the-
     * graphic terms: on a card a normal icon is at most 1/6 of the short
     * side; on a brochure at most 1/18. */
    HANDHELD_MAX_SHORT_SIDE: 1300,
    HANDHELD_MAX_SCALE: 1.25,
    /* An icon in a ROW beside its information — the phone before a phone
     * number — is sized to that line, not to the sheet: at most this many
     * times the line's height (about two cap-heights of the text), and never
     * above NORMAL_MAX or below NORMAL_MIN. A 15px contact line gets an icon
     * of about 30px, not a 45px one three times taller than its text. An
     * icon above or below a heading (a feature icon) keeps the sheet limit. */
    LINE_RATIO: 1.75,
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
    if (!(isFinite(s) && s > 0)) return 1;
    if (Math.min(canvasW, canvasH) <= ICON.HANDHELD_MAX_SHORT_SIDE) s = Math.min(s, ICON.HANDHELD_MAX_SCALE);
    return s;
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
          var box = { l: l, r: rr, t: t, b: b };
          var vOver = Math.min(B, b) - Math.max(T, t);
          if (vOver >= 0.5 * Math.min(B - T, b - t)) {
            if (l >= R - 2) right.push({ gap: l - R, x: l, text: text, box: box });
            else if (rr <= L + 2) left.push({ gap: L - rr, x: -rr, text: text, box: box });
            continue;
          }
          var hOver = Math.min(R, rr) - Math.max(L, l);
          if (hOver > 0) {
            var vGap = t >= B - 2 ? t - B : (b <= T + 2 ? T - b : -1);
            if (vGap >= 0 && vGap <= gapCol) column.push({ text: text, box: box, side: t >= B - 2 ? 'below' : 'above' });
          }
        }
      }
      /* Returns WHERE the information sits — { side, box } — or null. */
      function row(side, name) {
        if (!side.length) return null;
        side.sort(function (a, b) { return a.gap - b.gap; });
        if (side[0].gap > gapRow) return null;
        /* the row's text read outward from the icon, as a person reads it */
        var within = side.filter(function (e) { return e.gap <= 240 * s; })
          .map(function (e) { return e.text; });
        var joined = [], seenT = {};
        within.forEach(function (t) { if (!seenT[t]) { seenT[t] = 1; joined.push(t); } });
        return test(joined.join(' ')) ? { side: name, box: side[0].box } : null;
      }
      var hit = row(right, 'right') || row(left, 'left');
      if (hit) return hit;
      for (var j = 0; j < column.length; j++) if (test(column[j].text)) return { side: column[j].side, box: column[j].box };
      return null;
    }

    /* Does the information line at `info.box` already have an icon beside it
     * (another visible icon unit on its row, within an icon's reach)? */
    function lineHasIcon(unit, root, info, k, s) {
      var b = info.box, reach = Math.max(16 * s, ICON.NORMAL_MAX * s) * 2;
      var others = root.querySelectorAll('[data-icon-name]');
      for (var i = 0; i < others.length; i++) {
        var o = others[i];
        if (o === unit || !shown(o) || o.getAttribute('data-asset-guard') === 'removed') continue;
        var r = o.getBoundingClientRect();
        /* a hero-sized icon not judged yet is no line's icon: it is about to
           be removed, and must not get the real one removed as a duplicate */
        if (Math.max(r.width, r.height) * k > ICON.ABSOLUTE_MAX * s + 0.5) continue;
        var l = r.left * k, rr = r.right * k, t = r.top * k, bt = r.bottom * k;
        var vOver = Math.min(bt, b.b) - Math.max(t, b.t);
        if (vOver <= 0) continue;
        var hGap = l >= b.r ? l - b.r : (rr <= b.l ? b.l - rr : 0);
        if (hGap <= reach) return true;
      }
      return false;
    }

    /* A shrunk icon that was drawn against a line is moved back beside it:
     * its box was its own, the gap it leaves is not. Only an absolutely
     * positioned unit needs this — one in a flex/grid row closes up by itself. */
    function nudgeBeside(unit, info, k, s) {
      var st = getComputedStyle(unit);
      if (st.position !== 'absolute' && st.position !== 'fixed') return false;
      var r = unit.getBoundingClientRect();
      var ul = r.left * k, ut = r.top * k, uw = r.width * k, uh = r.height * k;
      var b = info.box, gap = 8 * s, wantL = ul, wantT = ut;
      if (info.side === 'right') { wantL = b.l - gap - uw; wantT = (b.t + b.b) / 2 - uh / 2; }
      else if (info.side === 'left') { wantL = b.r + gap; wantT = (b.t + b.b) / 2 - uh / 2; }
      else if (info.side === 'below') { wantL = (b.l + b.r) / 2 - uw / 2; wantT = b.t - gap - uh; }
      else if (info.side === 'above') { wantL = (b.l + b.r) / 2 - uw / 2; wantT = b.b + gap; }
      var dx = wantL - ul, dy = wantT - ut;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return false;
      unit.style.setProperty('left', (unit.offsetLeft + dx).toFixed(2) + 'px', 'important');
      unit.style.setProperty('top', (unit.offsetTop + dy).toFixed(2) + 'px', 'important');
      unit.style.setProperty('right', 'auto', 'important');
      unit.style.setProperty('bottom', 'auto', 'important');
      unit.style.setProperty('transform', 'none', 'important');
      return [Math.round(dx), Math.round(dy)];
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
      var before = besideItsInformation(unit, root, type, k, s);
      if (!before) {
        return remove(unit, report, name, type === 'generic' ? 'no-adjacent-text' : 'no-' + type + '-information', w, h);
      }
      var normalMax = ICON.NORMAL_MAX * s;
      if (before.side === 'left' || before.side === 'right') {
        var lineH = before.box.b - before.box.t;
        if (lineH > 0) normalMax = Math.min(normalMax, Math.max(ICON.NORMAL_MIN * s, lineH * (ICON.LINE_RATIO || 1.75)));
      }
      if (w > normalMax + 0.5 || h > normalMax + 0.5 || areaFrac > ICON.AREA_FRACTION_HERO) {
        clamp(unit, report, name, w, h, normalMax, unit.offsetWidth);
        /* Shrunk in place, a big icon can end up floating away from the line
         * it was drawn against. Move it back beside that line; at icon size
         * it must still be beside it, or it has no placement. */
        if (!besideItsInformation(unit, root, type, k, s)) {
          /* the line it was drawn against may already have its own icon:
             a second one shrunk and moved in beside it is a duplicate */
          if (lineHasIcon(unit, root, before, k, s)) {
            report.corrected.pop();
            return remove(unit, report, name, 'duplicate-icon-for-line', w, h);
          }
          var moved = nudgeBeside(unit, before, k, s);
          if (moved) report.corrected[report.corrected.length - 1].moved = moved;
          if (!besideItsInformation(unit, root, type, k, s)) {
            report.corrected.pop();
            remove(unit, report, name, 'not-beside-' + (type === 'generic' ? 'text' : type + '-information') + '-at-icon-size', w, h);
          }
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
        if (Math.min(RW, RH) <= ICON.HANDHELD_MAX_SHORT_SIDE) s = Math.min(s, ICON.HANDHELD_MAX_SCALE);   // hand-held: card-scale icons
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

  /* ── hand-drawn plant artwork ─────────────────────────────────────────────
   * The HARD RULE says the model never draws flowers or foliage; plant artwork
   * comes only from the botanical design-asset files. The prompt is not
   * trusted with it any more than with icon sizes: every inline <svg> the
   * MODEL wrote (not an icon-bank icon, not the customer's own SVG) whose own
   * markup names plant artwork — in its class/id/aria-label/title/desc, its
   * children's ids/classes, a comment just before it, or the class/id of the
   * wrapper around it — is removed before the design is shown or pushed. The
   * same goes for an element drawing an SVG data URI under such a name.
   * Library files (<img src="assets/design-library/...">) are never touched. */
  var BOTANICAL_NAME = /(^|[^a-z])(flowers?|floral|florals|blooms?|blossoms?|petals?|peon(y|ies)|hydrangeas?|tulips?|dais(y|ies)|lotus|wildflowers?|bouquets?|leaf|leaves|leafy|foliage|sprigs?|branch(es)?|twigs?|vines?|ferns?|fronds?|eucalyptus|laurels?|wreaths?|garlands?|greenery|botanic(al|als)?|stems?|pampas|ivy|plants?)(?![a-z])/i;
  function namesOf(el) {
    if (!el || !el.getAttribute) return '';
    return [el.getAttribute('class'), el.getAttribute('id'), el.getAttribute('aria-label'),
      el.getAttribute('data-name'), el.getAttribute('data-role'), el.getAttribute('title')]
      .filter(Boolean).join(' ').replace(/[_-]+/g, ' ');
  }
  function labelledBotanical(svg) {
    var text = namesOf(svg);
    var t = svg.querySelector('title, desc'); if (t) text += ' ' + t.textContent;
    var inner = svg.querySelectorAll('[id], [class]');
    for (var i = 0; i < inner.length && i < 60; i++) text += ' ' + namesOf(inner[i]);
    var p = svg.previousSibling, hops = 0;
    while (p && hops < 3) { if (p.nodeType === 8) text += ' ' + p.nodeValue; if (p.nodeType === 1) break; p = p.previousSibling; hops++; }
    var w = svg.parentElement;
    for (var up = 0; w && up < 2; up++, w = w.parentElement) {
      if (/^(body|html)$/i.test(w.tagName) || /(^|\s)card(\s|$|--)/.test(w.getAttribute('class') || '')) break;
      text += ' ' + namesOf(w);
    }
    return BOTANICAL_NAME.test(text);
  }
  /* The customer's SVG is recognised by its GEOMETRY — the drawing elements
   * and their shape attributes in order — because the model may re-serialize
   * it or add a class/style to the <svg> when it embeds it. */
  function geometryOf(svg) {
    var parts = [], els = svg.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line, text');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      parts.push(e.tagName.toLowerCase() + ':' + ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2']
        .map(function (a) { return (e.getAttribute(a) || '').replace(/\s+/g, ' ').trim(); }).join('|'));
    }
    return parts.join(';');
  }
  /** Remove model-drawn plant artwork from a design's HTML. Returns
   *  { html, removed: [label, ...] }. `opts.customerSvg` is the customer's own
   *  SVG, which is theirs to place and is never removed. */
  function stripDrawnBotanicals(html, opts) {
    var out = { html: html, removed: [] };
    if (!html || typeof DOMParser === 'undefined') return out;
    if (!/<svg|image\/svg\+xml/i.test(html)) return out;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var customer = '';
    if (opts && opts.customerSvg && /<svg/i.test(opts.customerSvg)) {
      var cs = new DOMParser().parseFromString(opts.customerSvg, 'text/html').querySelector('svg');
      if (cs) customer = geometryOf(cs);
    }
    var svgs = doc.querySelectorAll('svg');
    var victims = [];
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      if (svg.parentElement && svg.parentElement.closest('svg')) continue;          // nested: judged with its outer svg
      if (svg.closest('[data-icon-name]')) continue;                                // icon bank
      if (customer && geometryOf(svg) === customer) continue;                        // the customer's own artwork
      if (labelledBotanical(svg)) victims.push(svg);
    }
    var dataEls = doc.querySelectorAll('[style*="image/svg+xml"], img[src^="data:image/svg+xml"]');
    for (var j = 0; j < dataEls.length; j++) {
      var el = dataEls[j];
      if (BOTANICAL_NAME.test(namesOf(el) + ' ' + namesOf(el.parentElement))) victims.push(el);
    }
    if (!victims.length) return out;
    victims.forEach(function (v) {
      out.removed.push((namesOf(v) || namesOf(v.parentElement) || v.tagName.toLowerCase()).trim());
      var parent = v.parentElement;
      v.remove();
      /* an emptied botanical wrapper goes too, so no sized hole is left */
      if (parent && !parent.closest('svg') && !parent.textContent.trim() && !parent.querySelector('img, svg, video, canvas')
          && BOTANICAL_NAME.test(namesOf(parent))) parent.remove();
    });
    var doctype = /^\s*<!doctype[^>]*>/i.exec(html);
    out.html = (doctype ? doctype[0] : '') + doc.documentElement.outerHTML;
    return out;
  }

  /* ── hand-drawn PICTURES ───────────────────────────────────────────────────
   * The model may draw abstract geometry inline (a rule, a bar, a diagonal
   * split, a ring, concentric arcs, a chevron pair). It may NOT draw a
   * picture of anything — a person, a figure, a spine, an animal, an object,
   * a device, or an icon — those come only from the libraries. Every inline
   * <svg> the model wrote (not an icon-bank icon, not the customer's own SVG)
   * is read for what it is:
   *
   *   pictorial  — curves plus several parts, or several parts of mixed kinds
   *                (a circle head on four line limbs): a drawing of something
   *   icon-like  — two or three parts of mixed kinds sitting beside a short
   *                label (a drawn check in a drawn circle next to "Experienced
   *                team"): an icon the bank should have supplied
   *   abstract   — everything else: one rule, one polygon, one swoosh, a set
   *                of rings or stripes of one kind
   *
   * A pictorial or icon-like drawing is swapped for the icon-bank icon its
   * label (or its own class/title) names, when one fits, and otherwise
   * removed; abstract geometry is left alone. Runs on the HTML string before
   * the design is rendered, so the download, the preview and the push all
   * see the same thing; the icon token it writes is inlined by IconBank. */
  var DRAWN_PARTS = 'path, circle, ellipse, rect, line, polyline, polygon, text, image, use, foreignObject';
  var PICTURE_NAME = /(^|[^a-z])(figures?|persons?|people|man|woman|body|bodies|silhouettes?|spines?|skeletons?|vertebrae?|bones?|anatomy|animals?|dogs?|cats?|mascots?|illustrations?|drawings?|characters?|avatars?|portraits?|faces?|hands?|scenes?|objects?|devices?|buildings?|vehicles?|cars?)(?![a-z])/i;
  function drawnSvgShape(svg) {
    var parts = svg.querySelectorAll(DRAWN_PARTS);
    var kinds = {}, n = 0, curves = 0, arcs = 0, foreign = false;
    for (var i = 0; i < parts.length; i++) {
      var tag = parts[i].tagName.toLowerCase();
      if (tag === 'text' || tag === 'image' || tag === 'use' || tag === 'foreignobject') foreign = true;
      kinds[tag] = (kinds[tag] || 0) + 1; n++;
      if (tag === 'path') {
        var d = parts[i].getAttribute('d') || '';
        curves += (d.match(/[CcSsQqTt]/g) || []).length;
        arcs += (d.match(/[Aa]/g) || []).length;
      }
    }
    return { parts: n, kinds: Object.keys(kinds).length, curves: curves, arcs: arcs, foreign: foreign };
  }
  function classifyDrawnSvg(svg) {
    var sh = drawnSvgShape(svg);
    if (sh.foreign) return 'pictorial';
    if (sh.curves && sh.parts >= 2) return 'pictorial';
    if (sh.curves >= 3) return 'pictorial';                       // one path, but a shape drawn with several curves
    if (sh.parts >= 4 && sh.kinds >= 2) return 'pictorial';       // a head on limbs, a body of mixed parts
    if (sh.parts >= 2 && sh.kinds >= 2) return 'icon-like';       // a check in a circle, a bar in a ring
    return 'abstract';
  }
  /* Words a label or a class may use, mapped to icon-bank names in order of
   * preference; the first name the bank actually has wins. */
  var ICON_SYNONYMS = [
    [/\b(phone|call|tel|telephone)\b/, ['phone', 'phone-call']],
    [/\b(e-?mail|envelope|inbox)\b/, ['mail', 'mail-closed']],
    [/\b(web|website|online|www|globe|internet)\b/, ['globe', 'globe-sphere']],
    [/\b(address|location|map|directions|clinic location|find us|visit)\b/, ['map-pin', 'map']],
    [/\b(hours|time|open|schedule|clock|appointment|booking|book)\b/, ['clock', 'calendar']],
    [/\b(calendar|date|events?)\b/, ['calendar']],
    [/\b(team|people|patients|clients|families|family|group|community|staff|everyone)\b/, ['users', 'people-group', 'team']],
    [/\b(person|individual|personal|you|user|member)\b/, ['user', 'person']],
    [/\b(care|caring|heart|love|wellness|wellbeing|compassion|support|kind)\b/, ['heart', 'hands-heart', 'hand-heart']],
    [/\b(check|checked|verified|experienced|licensed|certified|qualified|trusted|quality|guarantee|approved|proven|accredited)\b/, ['check-circle', 'shield-check', 'award']],
    [/\b(award|awards|winner|best|excellence|top rated|rated)\b/, ['award', 'trophy', 'star']],
    [/\b(star|stars|modern|premium|featured|new)\b/, ['star', 'stars']],
    [/\b(shield|safe|safety|protect|protection|prevention|secure|insured)\b/, ['shield', 'shield-check']],
    [/\b(posture|spine|spinal|back|alignment|aligned|adjust|adjustment|chiropractic|mobility|movement|motion|activity|active)\b/, ['activity', 'pulse-line']],
    [/\b(assessment|analysis|diagnos\w*|screening|evaluation|exam|examination|assess|search|find)\b/, ['search', 'magnifier', 'clipboard']],
    [/\b(progress|results|growth|improve\w*|recovery|performance|measured|track\w*)\b/, ['trending-up', 'growth-chart', 'chart-rising']],
    [/\b(target|goal|goals|precision|precise|focus|accuracy|aim)\b/, ['target', 'crosshair']],
    [/\b(plan|plans|list|checklist|notes|report|form|clipboard)\b/, ['clipboard', 'list', 'document']],
    [/\b(idea|insight|knowledge|learn|education|tip|tips)\b/, ['lightbulb', 'book-open']],
    [/\b(energy|fast|quick|power|strength|strong)\b/, ['zap', 'dumbbell']],
    [/\b(exercise|fitness|training|workout|gym|rehab\w*|therapy)\b/, ['dumbbell', 'activity']],
    [/\b(medical|health|doctor|physician|nurse|clinic|hospital|treatment|cross)\b/, ['medical-cross', 'stethoscope', 'heart-pulse']],
    [/\b(dental|dentist|tooth|teeth|smile)\b/, ['tooth', 'smile']],
    [/\b(home|house|household|residential)\b/, ['home', 'house']],
    [/\b(building|office|offices|commercial|business)\b/, ['buildings', 'briefcase']],
    [/\b(tools?|repair|service|maintenance|fix)\b/, ['tool', 'wrench', 'gear']],
    [/\b(settings|process|system|systems|gear|gears)\b/, ['gear', 'settings']],
    [/\b(money|price|pricing|cost|affordable|dollar|payment|pay|finance|financing)\b/, ['dollar', 'credit-card', 'coins']],
    [/\b(gift|gifts|reward|rewards|offer|promo)\b/, ['gift', 'tag']],
    [/\b(delivery|shipping|truck|transport)\b/, ['truck', 'package']],
    [/\b(car|auto|vehicle|parking)\b/, ['car']],
    [/\b(coffee|cafe|drink)\b/, ['coffee']],
    [/\b(camera|photo|photos|photography)\b/, ['camera']],
    [/\b(music|audio|sound)\b/, ['music', 'headphones']],
    [/\b(leaf|natural|nature|organic|eco|green|plant)\b/, ['hand-leaf', 'plant-growth']],
    [/\b(sun|sunny|light|bright|day)\b/, ['sun']],
    [/\b(water|drop|hydration|clean)\b/, ['droplet', 'water-drop']],
    [/\b(fire|flame|hot|heat)\b/, ['flame']],
    [/\b(lock|private|privacy|confidential)\b/, ['lock', 'padlock']],
    [/\b(chat|message|messages|talk|consult\w*|conversation|contact)\b/, ['message-circle', 'chat-bubble']],
    [/\b(document|documents|file|files|paperwork|records)\b/, ['document', 'file']],
    [/\b(handshake|partner\w*|agreement|deal|welcome)\b/, ['handshake']],
    [/\b(thumbs? ?up|like|recommend\w*|satisfaction|satisfied|happy)\b/, ['thumbs-up', 'smile']],
    [/\b(eye|vision|see|sight|look)\b/, ['eye']],
    [/\b(brain|mind|mental|focus)\b/, ['lightbulb']],
    [/\b(wheelchair|accessible|accessibility|disability)\b/, ['wheelchair']],
    [/\b(pill|medication|pharmacy|prescription)\b/, ['pill']],
    [/\b(flag|goal|milestone|start)\b/, ['flag']],
    [/\b(rocket|launch|growth|startup)\b/, ['rocket']],
    [/\b(compass|guide|guidance|navigate|direction)\b/, ['compass', 'navigation']],
    [/\b(layers|range|options|variety|multiple)\b/, ['layers', 'grid']],
    [/\b(package|box|product|products|supplies)\b/, ['package', 'box']],
    [/\b(arrow|next|more|go)\b/, ['arrow-right', 'chevron-right']],
  ];
  function iconNameFor(text, has) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    /* the word that comes FIRST in the label leads: "Experienced, caring
       team" is about being experienced, "Family-friendly care" about families */
    var best = null;
    for (var i = 0; i < ICON_SYNONYMS.length; i++) {
      var m = ICON_SYNONYMS[i][0].exec(t);
      if (!m) continue;
      var names = ICON_SYNONYMS[i][1], pick = null;
      for (var j = 0; j < names.length; j++) if (has(names[j])) { pick = names[j]; break; }
      if (pick && (!best || m.index < best.at)) best = { at: m.index, name: pick };
    }
    return best ? best.name : null;
  }
  /* The short label a drawing sits beside: the text of its OWN container (a
   * feature block, a list row), or of the element right next to it. Never a
   * design surface (the card, a panel, a column): its text is the whole
   * design, not a label. */
  var SURFACE_CLASS = /(^|\s)(card|panel|page|canvas|design|spread|inside|outside|column|col|grid|section|body|wrap|wrapper|container|content|main)(\s|$|--|-|_)/i;
  function textOf(el, skip) {
    var out = '', walker = el.ownerDocument.createTreeWalker(el, 4 /* TEXT */), n;
    while ((n = walker.nextNode())) {
      if (skip && skip.contains(n)) continue;
      if (n.parentElement && n.parentElement.closest('svg, script, style')) continue;
      var v = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (v) { out += (out ? ' ' : '') + v; if (out.length > 160) break; }
    }
    return out.slice(0, 160);
  }
  function labelNear(svg) {
    var p = svg.parentElement;
    if (!p || /^(body|html)$/i.test(p.tagName)) return '';
    if (!SURFACE_CLASS.test(p.getAttribute('class') || '') && p.children.length <= 8) {
      var own = textOf(p, svg);
      if (own) return own;
    }
    var sibs = [svg.nextElementSibling, svg.previousElementSibling];
    for (var i = 0; i < sibs.length; i++) {
      var sib = sibs[i];
      if (!sib || sib.querySelector('svg, img') || SURFACE_CLASS.test(sib.getAttribute('class') || '')) continue;
      var t = textOf(sib);
      if (t && t.length <= 120) return t;
    }
    return '';
  }
  function svgSizeAttrs(svg) {
    var st = svg.getAttribute('style') || '';
    var w = svg.getAttribute('width'), h = svg.getAttribute('height');
    if (w && !/(^|;)\s*width\s*:/.test(st)) st += ';width:' + (/^\d+$/.test(w) ? w + 'px' : w);
    if (h && !/(^|;)\s*height\s*:/.test(st)) st += ';height:' + (/^\d+$/.test(h) ? h + 'px' : h);
    return st.replace(/^;/, '');
  }
  /** Remove, or swap for a bank icon, every picture the model drew itself.
   *  `opts.iconNames`: a Set (or array) of icon-bank names, so a swap only
   *  names an icon the bank has; without it, drawings are removed, never
   *  swapped. `opts.customerSvg`: the customer's own SVG, never touched.
   *  Returns { html, replaced:[{label, icon}], removed:[label], kept }. */
  function enforceLibraryArtwork(html, opts) {
    var out = { html: html, replaced: [], removed: [], kept: 0 };
    if (!html || typeof DOMParser === 'undefined' || !/<svg/i.test(html)) return out;
    opts = opts || {};
    var names = opts.iconNames ? (opts.iconNames.has ? opts.iconNames : new Set(opts.iconNames)) : null;
    var has = function (n) { return !!(names && names.has(n)); };
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var customer = '';
    if (opts.customerSvg && /<svg/i.test(opts.customerSvg)) {
      var cs = new DOMParser().parseFromString(opts.customerSvg, 'text/html').querySelector('svg');
      if (cs) customer = geometryOf(cs);
    }
    var svgs = doc.querySelectorAll('svg'), changed = false;
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      if (svg.parentElement && svg.parentElement.closest('svg')) continue;
      if (svg.closest('[data-icon-name]')) continue;
      if (customer && geometryOf(svg) === customer) continue;
      var cls = classifyDrawnSvg(svg);
      if (cls === 'abstract') { out.kept++; continue; }
      var label = labelNear(svg);
      var own = namesOf(svg) + ' ' + (svg.querySelector('title') ? svg.querySelector('title').textContent : '');
      var depicts = BOTANICAL_NAME.test(own) || PICTURE_NAME.test(own);
      /* a drawn check used as a bullet, with no label and no picture name: left alone */
      if (cls === 'icon-like' && !label.trim() && !depicts) { out.kept++; continue; }
      /* a labelled drawing becomes the icon its label names; one named for
         what it depicts (a figure, a spine) is a picture, never an icon */
      var icon = label.trim() ? iconNameFor(label, has) : null;
      if (!icon && !depicts) icon = iconNameFor(own, has);
      var parent = svg.parentElement;
      if (icon) {
        var tok = doc.createElement('i');
        tok.setAttribute('data-icon', icon);
        if (svg.getAttribute('class')) tok.setAttribute('class', svg.getAttribute('class'));
        var st = svgSizeAttrs(svg); if (st) tok.setAttribute('style', st);
        svg.replaceWith(tok);
        out.replaced.push({ label: (label || own).trim().slice(0, 60), icon: icon });
      } else {
        svg.remove();
        out.removed.push((label || own).trim().slice(0, 60) || cls);
        if (parent && !parent.closest('svg') && !parent.textContent.trim()
            && !parent.querySelector('img, svg, i[data-icon], [data-icon-name], video, canvas')
            && /\b(figure|illustration|drawing|graphic|mascot|artwork|hero|art|visual|picture|image)\b/i.test(namesOf(parent))) parent.remove();
      }
      changed = true;
    }
    if (!changed) return out;
    var doctype = /^\s*<!doctype[^>]*>/i.exec(html);
    out.html = (doctype ? doctype[0] : '') + doc.documentElement.outerHTML;
    return out;
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
    stripDrawnBotanicals: stripDrawnBotanicals,
    classifyDrawnSvg: classifyDrawnSvg,
    iconNameFor: iconNameFor,
    enforceLibraryArtwork: enforceLibraryArtwork,
    GUARD_SCRIPT_ID: 'asset-category-guard',
  };
})(typeof window !== 'undefined' ? window : globalThis);
