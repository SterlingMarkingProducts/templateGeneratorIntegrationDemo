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
    'banner': 'Banner',
    'banners': 'Banner',
    'decal': 'Sign',
    'label': 'Name Badge',
    'magnet': 'Sign',
    'postcard': 'Business Card',
  };

  /* The live designCentral-dev catalogue carries no family string — it
   * carries `classification.productInformation`: the product-group rows the
   * database itself maps the part to (products.id -> productinformationmap ->
   * productinformation), verbatim. This resolves those AUTHORITATIVE titles
   * and slugs to the Generator's creative template type by phrase, most
   * specific first, so "Light Gauge Plastic Signs" is a Sign and "Name Badges"
   * is a Name Badge rather than a Nameplate. It reads nothing but the
   * database's own words: no part-number guessing, no geometry. An unmatched
   * or absent classification returns '' — unknown, never Business Card. */
  var TEMPLATE_TYPE_BY_PHRASE = [
    ['business card', 'Business Card'],
    ['name badge',    'Name Badge'],
    ['name tag',      'Name Badge'],
    ['nameplate',     'Nameplate'],
    ['name plate',    'Nameplate'],
    ['stamp',         'Stamp'],
    ['brochure',      'Brochure'],
    ['banner',        'Banner'],
    ['poster',        'Poster'],
    ['sign',          'Sign'],
    ['decal',         'Sign'],
    ['magnet',        'Sign'],
    ['postcard',      'Business Card'],
    ['label',         'Name Badge'],
  ];

  function typeFromText(text) {
    var hay = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    for (var i = 0; i < TEMPLATE_TYPE_BY_PHRASE.length; i++) {
      if (hay.indexOf(TEMPLATE_TYPE_BY_PHRASE[i][0]) !== -1) return TEMPLATE_TYPE_BY_PHRASE[i][1];
    }
    return '';
  }

  /* The PRODUCT'S OWN NAME is the most specific authoritative words the
   * database holds for a part: "Light Gauge Plastic Sign" IS a sign whatever
   * broader page it is merchandised under. DS21824 proved the need — its
   * product-group chain does not name a type its own description states
   * plainly. Order: the part's own name; then its product groups; both are
   * designCentral's own text, and nothing here reads part numbers or
   * dimensions. */
  function templateTypeFromClassification(p) {
    var fromName = typeFromText(p && p.name);
    if (fromName) return fromName;
    var groups = (p && p.classification && p.classification.productInformation) || [];
    for (var g = 0; g < groups.length; g++) {
      var t = typeFromText((groups[g].title || '') + ' ' + (groups[g].productTable || ''));
      if (t) return t;
    }
    return '';
  }

  /* Two catalogues, one picker. The CMS-verified records load first so an
   * exact part number always resolves to the verified record when both
   * contain it. Both are FETCHED, exactly as the future API provider will
   * obtain records — nothing is embedded here. */
  var CATALOGUE_URLS = [
    '../data/sterling-products.json',        // CMS-verified
    '../data/sterling-test-catalogue.json',  // spreadsheet-inferred TEST inventory
  ];

  /* The approved default product: BCDP-CM, products.id 6505. The Generator
   * opens on it so the artboard size, orientation options, product context and
   * Push-to-Designer productId are right without anyone searching first.
   *
   * It is a REAL catalogue id, resolved through the SAME provider call a manual
   * pick makes, so no product fact is invented here and nothing is selected at
   * all if the catalogue does not contain it. */
  var DEFAULT_PRODUCT_ID = 6505;

  /* ── web03 DEV only: the LIVE designCentral-dev catalogue ────────────────
   *
   * Off the dev clone the picker searches the two files above, and that is
   * unchanged. On the dev clone it searches designCentral-dev itself, through a
   * read-only endpoint in the oldDesigner dev folder.
   *
   * WHY. The spreadsheet-inferred TEST inventory carries SYNTHETIC ids — "1-31"
   * and its 443 neighbours have a real Sterling part number but no
   * authoritative designCentral products.id. Push to Designer already knew it:
   * sterling-legacy.js refuses to put such an id in productList, so those
   * products reached the Template Designer with no product at all. The live
   * endpoint returns only products designCentral-dev really holds, with the
   * values it really holds, so anything offered here can complete the workflow
   * with its own id.
   *
   * There is deliberately NO fallback to the files: a dev picker that silently
   * reverts to synthetic ids is exactly what this replaces. If the endpoint
   * cannot be reached the picker says so and stays empty. */
  /* The cfGitPuller folders that get dev behaviour. The approved integration
   * clone, and the experimental design-quality clone alongside it, so the two
   * can be compared on web03 without either one being redeployed over the
   * other. Longest first, and each is matched with its trailing slash, so
   * '/generator-web03-dev-e2e/' cannot match the '-phase1' folder by accident.
   * These are CONSTANTS: nothing is read from the URL or the query string, so
   * no crafted link can turn dev behaviour on anywhere else. */
  var DEV_CLONE_FOLDERS = ['/generator-web03-dev-e2e-phase2c/', '/generator-web03-dev-e2e-phase1/',
    '/generator-web03-dev-e2e/'];
  var IMPORTABLE_ONLY = (function () {
    var here = (window.location && window.location.pathname) || '';
    return DEV_CLONE_FOLDERS.some(function (f) { return here.indexOf(f) !== -1; });
  }());
  /* A CONSTANT, like every other dev endpoint in this build. Nothing is read
   * from the URL or the page, and demo-guard.js holds the same path a second
   * time so both have to agree. */
  var LIVE_CATALOGUE_URL = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';

  /* Belt and braces over the live source. The rule sterling-legacy.js applies
   * before an id may travel:
   *   productList: (pc.authoritative && typeof pc.productId === 'number'
   *                 && pc.productId > 0) ? [pc.productId] : []
   * read here against the RAW catalogue record, where `authoritative` is
   * product-provider.js's own honesty switch — false exactly when the record is
   * flagged 'inferred-test'. */
  function hasAuthoritativeProductId(raw) {
    var inferred = !!(raw && raw.test && raw.test.technicalDataStatus === 'inferred-test');
    return !inferred && typeof raw.id === 'number' && isFinite(raw.id) && raw.id > 0;
  }

  var selected = null;      // normalized Product record, or null
  var catalogueSize = 0;
  var provider = null;
  var listeners = [];
  /* Set the moment a person picks, clears, or a caller selects explicitly.
   * The default below never overrides any of those. */
  var userChose = false;

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
    if (btn) btn.addEventListener('click', function () { userChose = true; select(null); });
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
    /* Only when the operator has actually typed something. On an empty box the
     * list is a browse, not a narrowed search, so a "keep typing to narrow"
     * count is noise rather than help. */
    if (lastQuery && lastTotal > list.length) {
      var more = document.createElement('div');
      more.className = 'sp-empty';
      more.textContent = 'Showing ' + list.length + ' of ' + lastTotal
        + ' matches — keep typing to narrow.';
      resultsEl.appendChild(more);
    }
  }

  function choose(id) {
    userChose = true;
    setStatus('');
    provider.getById(id).then(select).catch(function (e) {
      setStatus(e.message || 'Could not load that product.', true);
      hideResults();
    });
  }

  /* THE BROWSE ORDER IS THE SERVER'S. devProductCatalogue.cfm returns the
   * requested parts first, after its own templateImport eligibility filtering,
   * and the picker renders what it is given in the order it is given. There is
   * deliberately no list of part numbers on this side any more: two copies of
   * an ordering rule is one too many, and the client copy could only ever
   * reorder the window the provider happened to return. */

  var BROWSE_LIMIT = 25;
  var lastTotal = 0;
  var lastQuery = '';
  var searchTimer = null;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 140);
  }

  function runSearch() {
    if (!provider) return;
    setStatus('');
    var q = (input.value || '').trim();
    provider.search(input.value, { limit: BROWSE_LIMIT })
      .then(function (r) {
        lastTotal = r.total;
        lastQuery = q;
        renderResults(r.results);
      })
      .catch(function (e) { setStatus(e.message || 'Product search failed.', true); });
  }

  /* The two committed catalogue files: every deployment except the dev clone. */
  function loadFileRecords() {
    return Promise.all(CATALOGUE_URLS.map(function (u) {
      return fetch(u).then(function (r) { return r.json(); })
        .catch(function (e) {
          console.warn('[product-select] catalogue unavailable: ' + u, e);
          return { products: [] };
        });
    })).then(function (docs) {
      return {
        source: 'sterling-catalogue-local',
        records: docs.reduce(function (all, d) {
          return all.concat((d && d.products) || []);
        }, []),
      };
    });
  }

  /* designCentral-dev itself, read-only. No fallback on purpose — see above. */
  function loadLiveRecords() {
    return fetch(LIVE_CATALOGUE_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('live catalogue HTTP ' + r.status);
        return r.json();
      })
      .then(function (doc) {
        var records = (doc && doc.products) || [];
        console.info('[product-select] web03 dev: ' + records.length
          + ' live products from ' + ((doc && doc.datasource) || 'designCentral-dev')
          + (doc && doc.truncated ? ' (TRUNCATED at the endpoint row cap)' : ''));
        return { source: 'sterling-designcentral-dev', records: records };
      });
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
    var loadRecords = IMPORTABLE_ONLY ? loadLiveRecords() : loadFileRecords();

    loadRecords.then(function (loaded) {
      var records = loaded.records;
      if (!records.length) throw new Error('no catalogue records');
      if (IMPORTABLE_ONLY) {
        records = records.filter(hasAuthoritativeProductId);
        if (!records.length) throw new Error('no importable catalogue records');
      }
      provider = new window.SMPProductProvider.CatalogueProductProvider({
        records: records,
        source: loaded.source,
      });
      /* After de-duplication, not before — the two catalogues overlap. */
      catalogueSize = provider.records.length;
      input.disabled = false;
      input.placeholder = 'Search ' + catalogueSize + ' Sterling products…';
      if (IMPORTABLE_ONLY) {
        /* Say where the list came from, in the picker's own status line, so a
         * shorter list reads as the live dev database rather than a failure. */
        setStatus('Dev clone: ' + catalogueSize + ' live product'
          + (catalogueSize === 1 ? '' : 's') + ' from designCentral-dev.');
      }
      applyDefaultSelection();
    }).catch(function (e) {
      input.disabled = true;
      setStatus(IMPORTABLE_ONLY
        ? 'Live designCentral-dev catalogue unavailable — no products can be offered.'
        : 'Product catalogue unavailable — the Generator still works without a product.', true);
      console.warn('[product-select] catalogue load failed', e);
    });
  }

  /* Open on BCDP-CM. Runs once, only after the catalogue is really available,
   * and only into an EMPTY selection: if a person picked something while the
   * catalogue was loading, or a demo shortcut bound its own product first,
   * whoever got there first keeps it. Failure is a console warning and no
   * selection — never an invented product. */
  function applyDefaultSelection() {
    if (!provider || userChose || selected) return;
    provider.getById(DEFAULT_PRODUCT_ID).then(function (p) {
      if (userChose || selected) return;   // re-checked: getById is async
      select(p);                           // the same call a manual pick makes
    }).catch(function (e) {
      console.warn('[product-select] default product ' + DEFAULT_PRODUCT_ID
        + ' is not in this catalogue — opening with no product selected', e);
    });
  }

  window.SMPProductSelection = {
    /** The selected normalized Product record, or null. */
    get: function () { return selected; },
    /** Creative template type implied by the product family, or '' if unknown. */
    templateTypeFor: function (p) {
      if (!p) return '';
      /* The database's own product groups first; the catalogue-file family
       * string second (the committed files still carry one). '' means the
       * source did not say — the caller shows unknown, it never invents. */
      return templateTypeFromClassification(p)
        || TEMPLATE_TYPE_BY_FAMILY[String(p.productFamily || '').toLowerCase()] || '';
    },
    /** Subscribe to selection changes. Called with the record or null. */
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    /** Programmatic selection by part number — used by tests and previews. */
    selectByPartNumber: function (part) {
      if (!provider) return Promise.reject(new Error('Product catalogue not loaded yet.'));
      userChose = true;
      return provider.getByPartNumber(part).then(function (p) { select(p); return p; });
    },
    clear: function () { userChose = true; select(null); },
    /** The product the Generator opens on. Published so a test asserts the
     *  real constant rather than repeating the number. */
    defaultProductId: function () { return DEFAULT_PRODUCT_ID; },
    /** Exposed so tests can assert which source is backing the picker. */
    providerId: function () { return provider ? provider.id : null; },
    /** Number of records the picker is searching. */
    catalogueSize: function () { return catalogueSize; },
    /** True where the picker reads designCentral-dev live and is limited to
     *  records Push to Designer can carry an id for (web03 dev clone only).
     *  Published so a test asserts the real gate rather than repeating the
     *  path. */
    importableOnly: function () { return IMPORTABLE_ONLY; },
    /** Where the records actually came from, as the provider records it. */
    sourceId: function () { return provider ? provider.source : null; },
    /** Raw search passthrough, for tests and the preview harness. */
    search: function (q, opts) {
      return provider ? provider.search(q, opts)
        : Promise.reject(new Error('Product catalogue not loaded yet.'));
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
