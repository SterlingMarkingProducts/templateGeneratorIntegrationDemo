/* Sterling Product selection — Phase 2B.
 *
 * Adds ONE control to the Generator: pick a real Sterling product, and let that
 * product decide the technical document settings. Everything creative stays
 * exactly as it was.
 *
 * Design rules this file follows:
 *   - The Generator remains a standalone design tool. With no product selected
 *     nothing here participates and the previous behaviour is untouched.
 *   - It talks only to the ProductProvider interface. It does not know whether
 *     the records behind it come from a local catalogue, a spreadsheet export
 *     or the future read-only Sterling API.
 *   - It never invents a product fact. Everything shown comes from the
 *     normalized Product record.
 *   - Sellable variations (lots, ink colours, SKUs) are deliberately absent.
 *     The Generator designs the BASE part; the Designer handles the rest.
 */
(function () {
  'use strict';

  /* Sterling product family -> the Generator's creative template type.
   * This is a CREATIVE category mapping, not a product fact: it decides which
   * prompt/layout family the Generator designs with. Geometry, bleed, pages,
   * shape and designer mode all come from the product record itself, never
   * from this table. Unknown families leave the existing selection alone. */
  var TEMPLATE_TYPE_BY_FAMILY = {
    'business cards': 'Business Card',
    'business card': 'Business Card',
    'signs': 'Sign',
    'sign': 'Sign',
    'posters': 'Poster',
    'poster': 'Poster',
    'brochures': 'Brochure',
    'brochure': 'Brochure',
    'stamps': 'Stamp',
    'stamp': 'Stamp',
    'self-inking stamps': 'Stamp',
    'nameplates': 'Nameplate',
    'nameplate': 'Nameplate',
    'name badges': 'Name Badge',
    'name badge': 'Name Badge',
    /* Families the test inventory adds. Each maps to the nearest creative
     * template the Generator already knows how to design for. */
    'banner': 'Poster',
    'decal': 'Sign',
    'label': 'Name Badge',
    'magnet': 'Sign',
    'postcard': 'Business Card',
  };

  /* Two catalogues, one picker. The CMS-verified records load first so an
   * exact part number always resolves to the verified record when both
   * contain it. Both are FETCHED, exactly as the future API provider will
   * obtain records — nothing is embedded here. */
  var CATALOGUE_URLS = [
    '../data/sterling-products.json',        // CMS-verified
    '../data/sterling-test-catalogue.json',  // spreadsheet-inferred TEST inventory
  ];

  var selected = null;      // normalized Product record, or null
  var catalogueSize = 0;
  var provider = null;
  var listeners = [];

  /* ── DOM ─────────────────────────────────────────────── */
  var input, resultsEl, cardEl, clearBtn, statusEl, groupEl;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 3.5 -> "3.5", 2 -> "2" (no trailing .0 noise in the summary line) */
  function num(n) {
    return (Math.round(Number(n) * 1000) / 1000).toString();
  }

  function summaryLine(p) {
    var d = p.dimensions;
    var pages = p.pages.min === p.pages.max
      ? p.pages.min + (p.pages.min === 1 ? ' page' : ' pages')
      : p.pages.min + '–' + p.pages.max + ' pages';
    return num(d.widthIn) + ' × ' + num(d.heightIn) + ' ' + (d.displayUnit || 'in')
      + ' · ' + pages;
  }

  /* ── Selection ───────────────────────────────────────── */
  function notify() {
    listeners.forEach(function (fn) {
      try { fn(selected); } catch (e) { console.error('[product-select] listener failed', e); }
    });
  }

  function renderSelected() {
    if (!cardEl) return;
    if (!selected) {
      cardEl.classList.add('hidden');
      cardEl.innerHTML = '';
      if (groupEl) groupEl.classList.remove('has-product');
      return;
    }
    var p = selected;
    var verified = p.provenance.technicalDataStatus === 'cms-verified';
    cardEl.classList.remove('hidden');
    cardEl.innerHTML =
      '<div class="sp-card-head">' +
        '<span class="sp-part">' + esc(p.partNumber) + '</span>' +
        '<button type="button" class="sp-clear" id="spClear" title="Clear the selected product">Clear</button>' +
      '</div>' +
      '<div class="sp-name">' + esc(p.name) + '</div>' +
      '<div class="sp-spec">' + esc(summaryLine(p)) + '</div>' +
      /* Where these numbers came from. Quiet, but never absent: an inferred
       * size must not be mistaken for a Sterling specification. */
      '<div class="sp-conf ' + (verified ? 'is-verified' : 'is-test') + '" ' +
        'title="' + (verified
          ? 'Technical values read from Sterling CMS data.'
          : 'Dimensions and print settings inferred from the product spreadsheets for testing. Not Sterling specifications.') + '">' +
        '<span class="sp-conf-dot"></span>' +
        (verified ? 'CMS-verified' : 'Test data &mdash; inferred size') +
      '</div>';
    if (groupEl) groupEl.classList.add('has-product');
    var btn = $('spClear');
    if (btn) btn.addEventListener('click', function () { select(null); });
  }

  function select(product) {
    selected = product || null;
    renderSelected();
    hideResults();
    if (input) input.value = '';
    notify();
  }

  /* ── Search ──────────────────────────────────────────── */
  function hideResults() {
    if (!resultsEl) return;
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('hidden', !msg);
    statusEl.classList.toggle('is-error', !!isError);
  }

  function renderResults(list) {
    if (!resultsEl) return;
    if (!list.length) {
      resultsEl.innerHTML = '<div class="sp-empty">No matching Sterling product.</div>';
      resultsEl.classList.remove('hidden');
      return;
    }
    resultsEl.innerHTML = list.map(function (r) {
      var pages = r.pages === 1 ? '1 page' : r.pages + ' pages';
      var verified = r.technicalDataStatus === 'cms-verified';
      var round = r.shape === 'circle' ? ' · round' : '';
      return '<button type="button" class="sp-result" data-id="' + esc(r.id) + '" ' +
        'data-part="' + esc(r.partNumber) + '">' +
        '<span class="sp-result-part">' + esc(r.partNumber) +
          '<span class="sp-dot ' + (verified ? 'is-verified' : 'is-test') + '" title="' +
          (verified ? 'CMS-verified' : 'Test data — inferred size') + '"></span></span>' +
        '<span class="sp-result-name">' + esc(r.name) + '</span>' +
        '<span class="sp-result-spec">' + esc(num(r.widthIn) + ' × ' + num(r.heightIn) + ' ' + r.unit + ' · ' + pages + round) + '</span>' +
        '</button>';
    }).join('');
    resultsEl.classList.remove('hidden');
    resultsEl.querySelectorAll('.sp-result').forEach(function (b) {
      b.addEventListener('click', function () { choose(b.dataset.id); });
    });
    if (lastTotal > list.length) {
      var more = document.createElement('div');
      more.className = 'sp-empty';
      more.textContent = 'Showing ' + list.length + ' of ' + lastTotal
        + ' matches — keep typing to narrow.';
      resultsEl.appendChild(more);
    }
  }

  function choose(id) {
    setStatus('');
    provider.getById(id).then(select).catch(function (e) {
      setStatus(e.message || 'Could not load that product.', true);
      hideResults();
    });
  }

  var lastTotal = 0;
  var searchTimer = null;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 140);
  }

  function runSearch() {
    if (!provider) return;
    setStatus('');
    provider.search(input.value, { limit: 25 })
      .then(function (r) { lastTotal = r.total; renderResults(r.results); })
      .catch(function (e) { setStatus(e.message || 'Product search failed.', true); });
  }

  /* ── Boot ────────────────────────────────────────────── */
  function boot() {
    groupEl   = $('sterlingProductGroup');
    input     = $('productSearch');
    resultsEl = $('productResults');
    cardEl    = $('productSelectedCard');
    statusEl  = $('productStatus');
    if (!input || !window.SMPProductProvider) return;

    input.addEventListener('input', onSearchInput);
    input.addEventListener('focus', runSearch);
    document.addEventListener('click', function (e) {
      if (groupEl && !groupEl.contains(e.target)) hideResults();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideResults(); input.blur(); }
    });

    /* The catalogue is FETCHED, not embedded — the same way the future API
     * provider will obtain records. */
    Promise.all(CATALOGUE_URLS.map(function (u) {
      return fetch(u).then(function (r) { return r.json(); })
        .catch(function (e) {
          console.warn('[product-select] catalogue unavailable: ' + u, e);
          return { products: [] };
        });
    })).then(function (docs) {
      var records = docs.reduce(function (all, d) {
        return all.concat((d && d.products) || []);
      }, []);
      if (!records.length) throw new Error('no catalogue records');
      provider = new window.SMPProductProvider.CatalogueProductProvider({
        records: records,
        source: 'sterling-catalogue-local',
      });
      /* After de-duplication, not before — the two catalogues overlap. */
      catalogueSize = provider.records.length;
      input.disabled = false;
      input.placeholder = 'Search ' + catalogueSize + ' Sterling products…';
    }).catch(function (e) {
      input.disabled = true;
      setStatus('Product catalogue unavailable — the Generator still works without a product.', true);
      console.warn('[product-select] catalogue load failed', e);
    });
  }

  window.SMPProductSelection = {
    /** The selected normalized Product record, or null. */
    get: function () { return selected; },
    /** Creative template type implied by the product family, or '' if unknown. */
    templateTypeFor: function (p) {
      if (!p) return '';
      return TEMPLATE_TYPE_BY_FAMILY[String(p.productFamily || '').toLowerCase()] || '';
    },
    /** Subscribe to selection changes. Called with the record or null. */
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    /** Programmatic selection by part number — used by tests and previews. */
    selectByPartNumber: function (part) {
      if (!provider) return Promise.reject(new Error('Product catalogue not loaded yet.'));
      return provider.getByPartNumber(part).then(function (p) { select(p); return p; });
    },
    clear: function () { select(null); },
    /** Exposed so tests can assert which source is backing the picker. */
    providerId: function () { return provider ? provider.id : null; },
    /** Number of records the picker is searching. */
    catalogueSize: function () { return catalogueSize; },
    /** Raw search passthrough, for tests and the preview harness. */
    search: function (q, opts) {
      return provider ? provider.search(q, opts)
        : Promise.reject(new Error('Product catalogue not loaded yet.'));
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
