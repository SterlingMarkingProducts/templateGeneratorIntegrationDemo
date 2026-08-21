/* Product-driven blank artboard — PRESENTATION ONLY.
 *
 * As soon as a Sterling product is selected the preview area stops looking
 * empty: it shows a blank white artboard (one per page the product declares)
 * at that product's real aspect ratio, scaled to fit the available space.
 *
 * HARD BOUNDARY — this module draws DOM only. It never:
 *   - creates Fabric objects
 *   - contributes to the normalized design model
 *   - passes through SterlingLegacyAdapter
 *   - participates in asset extraction or the import package
 *   - touches bleed, trim, DPI, export or the generated design
 *
 * It reads the selected product record and writes CSS. That is all. The moment
 * a real design exists, app.js switches the preview to the result state and
 * this state is hidden — the generated artwork replaces it.
 */
(function () {
  'use strict';

  var host, stageEl, captionEl;
  var current = null;   // { widthIn, heightIn, pages, partNumber, ... } or null

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(n) {
    return (Math.round(Number(n) * 1000) / 1000).toString();
  }

  /* Page labels follow the product's own page count. Two pages on a printed
   * product are Front and Back; beyond that they are numbered. Nothing here
   * invents a page the product does not declare. */
  function pageLabels(count) {
    if (count === 2) return ['Front', 'Back'];
    if (count === 1) return ['Design'];
    var out = [];
    for (var i = 1; i <= count; i++) out.push('Page ' + i);
    return out;
  }

  /* Lay the artboards out inside the stage. Each board keeps the product's
   * exact aspect ratio; the whole row is scaled DOWN to fit and never rendered
   * at physical pixel size (a 12x18 poster would otherwise overflow the panel).
   * Boards are never scaled UP past 1in ~ 96px, so a business card does not
   * balloon to fill a large screen. */
  function layout() {
    if (!current || !stageEl || !host || host.classList.contains('hidden')) return;
    var boards = stageEl.querySelectorAll('.ba-board');
    if (!boards.length) return;

    var n = boards.length;
    var gap = 18;
    var avail = stageEl.getBoundingClientRect();
    // The stage can be measured before layout settles; retry on the next frame.
    if (avail.width < 2 || avail.height < 2) {
      requestAnimationFrame(layout);
      return;
    }
    var padX = 32, padY = 44;   // room for the caption + breathing space
    var maxW = Math.max(40, avail.width - padX);
    var maxH = Math.max(40, avail.height - padY);

    var wIn = current.widthIn, hIn = current.heightIn;
    // Native size at the Generator's 96-DPI screen convention.
    var nativeW = wIn * 96, nativeH = hIn * 96;
    var rowNativeW = nativeW * n + gap * (n - 1);
    var scale = Math.min(maxW / rowNativeW, maxH / nativeH, 1);

    var boardW = Math.max(24, Math.round(nativeW * scale));
    var boardH = Math.max(16, Math.round(nativeH * scale));
    boards.forEach(function (b) {
      b.style.width  = boardW + 'px';
      b.style.height = boardH + 'px';
    });
    stageEl.style.setProperty('--ba-gap', gap + 'px');
  }

  /* Populates the artboards. Visibility is owned by app.js's showPanel(): this
   * only ever HIDES itself (when there is nothing to draw), never shows itself,
   * so it can never paint over a design that already owns the preview. */
  function render() {
    if (!host) return;
    if (!current) {
      host.classList.add('hidden');
      if (stageEl) stageEl.innerHTML = '';
      if (captionEl) captionEl.innerHTML = '';
      return;
    }
    var labels = pageLabels(current.pages);
    stageEl.innerHTML = labels.map(function (label) {
      return '<figure class="ba-page">' +
               '<div class="ba-board" role="img" aria-label="' +
                 esc(label + ' — blank ' + num(current.widthIn) + ' by ' +
                     num(current.heightIn) + ' inch artboard') + '"></div>' +
               '<figcaption class="ba-label">' + esc(label) + '</figcaption>' +
             '</figure>';
    }).join('');

    captionEl.innerHTML =
      '<span class="ba-part">' + esc(current.partNumber) + '</span>' +
      '<span class="ba-dims">' + esc(num(current.widthIn) + ' × ' + num(current.heightIn) + ' in') +
        ' · ' + esc(current.pages === 1 ? '1 page' : current.pages + ' pages') + '</span>';

    layout();
  }

  /* ── Public API ──────────────────────────────────────── */

  /* Called with the normalized Product record, or null to clear. Reads only
   * geometry and page count — no creative or print settings are derived here. */
  function setProduct(product) {
    if (!product) {
      current = null;
      render();
      return null;
    }
    var d = product.dimensions || {};
    var pages = (product.pages && product.pages.min) || 1;
    current = {
      partNumber: product.partNumber || '',
      name: product.name || '',
      widthIn: Number(d.widthIn) || 0,
      heightIn: Number(d.heightIn) || 0,
      pages: Math.max(1, Math.min(12, pages)),
    };
    if (!current.widthIn || !current.heightIn) { current = null; }
    render();
    return current;
  }

  function boot() {
    host      = $('blankState');
    stageEl   = $('blankStage');
    captionEl = $('blankCaption');
    if (!host) return;
    window.addEventListener('resize', layout);
  }

  window.SMPBlankArtboard = {
    setProduct: setProduct,
    /** Current blank-artboard state, or null. Presentation state only. */
    state: function () { return current ? JSON.parse(JSON.stringify(current)) : null; },
    /** Number of blank pages currently shown. */
    pageCount: function () { return current ? current.pages : 0; },
    /** width / height of the shown artboard, or 0 when there is none. */
    aspectRatio: function () {
      return current && current.heightIn ? current.widthIn / current.heightIn : 0;
    },
    /** Measured on-screen size of each rendered board, for tests. */
    boardSizes: function () {
      if (!stageEl) return [];
      return Array.prototype.map.call(stageEl.querySelectorAll('.ba-board'), function (b) {
        var r = b.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
    },
    relayout: layout,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
