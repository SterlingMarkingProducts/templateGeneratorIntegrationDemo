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
    ['postcard',      'Postcard'],
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

  /* ── LIVE MODE: Sterling's CURRENT product data, queried every load ──────
   *
   * The two catalogue files above are a SNAPSHOT, and a snapshot is
   * DEV/STANDALONE DATA ONLY. It is fine for the temporary picker, where a
   * person browses whatever it happens to hold — it is not a source of truth
   * for production. CCA links here with whatever active products.id the person
   * is working on, most of Sterling's catalogue was never in the snapshot, and
   * a product whose size, pages, orientation, bleed or designer variation
   * changed in designCentral would keep the stale value until somebody rebuilt
   * and redeployed a JSON file. Resolving a live handoff against it is exactly
   * how ?product=6504&mode=live answered "not available in this catalogue" for
   * a perfectly valid product.
   *
   * So in live mode the snapshot is NOT CONSULTED AT ALL — not as a source, not
   * as a fallback. The numeric id is queried against Sterling's live product
   * data on every launch, through a read-only GET beside the Designer's other
   * two integration endpoints (same origin, same internal-network protection,
   * site-family-free Foundry product model). Change a value in designCentral
   * and the next launch has it; nothing is rebuilt and nothing is redeployed.
   *
   * The record it returns is the SAME clean shape the catalogue files carry, so
   * it goes through the SAME normalizer, the SAME contract validation and the
   * SAME select() call a manual pick makes. There is no second product model
   * and nothing is invented: if the live source has no active product for that
   * id, nothing is selected and the page says so.
   *
   * A CONSTANT, like every other integration endpoint in this build. Nothing is
   * read from the URL or the page, and demo-guard.js holds the same path a
   * second time so both have to agree. */
  var LIVE_PRODUCT_URL = '/templateDesigner/productInfo.cfm';

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

  /* ── Excluded product families ───────────────────────────────────────────
   *
   * Seals and embossers — every kind: corporate/notary/common seals, desk and
   * pocket embossers, embossing seals, seal presses, foil label seals — are
   * not offered by this Generator at all. They are excluded HERE, at the one
   * point every catalogue source passes through, so search, browse, the
   * default selection, selectByPartNumber and the size-match on upload all
   * agree. The record's own name, part number and authoritative
   * classification titles are all read; "self-seal(ing)" envelopes and
   * similar are NOT seals and stay. */
  function isSealOrEmbosser(raw) {
    var texts = [raw && raw.name, raw && raw.partNumber];
    var cls = (raw && raw.classification && raw.classification.productInformation) || [];
    for (var i = 0; i < cls.length; i++) texts.push(cls[i] && cls[i].title);
    var hay = texts.filter(Boolean).join(' ').toLowerCase()
      .replace(/self[- ]?seal(ing|ed)?/g, ' ');
    return /\bseals?\b|emboss/.test(hay);
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

    /* LIVE MODE takes no part in any of this. The picker is hidden and locked,
     * the one product comes from Sterling's live data, and the bundled
     * snapshot is never read — not for the selection, not for a fallback, not
     * even loaded. Everything below is the standalone/dev picker. */
    if (isLiveMode()) {
      input.disabled = true;
      applyLiveSelection();
      return;
    }

    /* The catalogue is FETCHED, not embedded — the same way the future API
     * provider will obtain records. */
    var loadRecords = IMPORTABLE_ONLY ? loadLiveRecords() : loadFileRecords();

    loadRecords.then(function (loaded) {
      var records = loaded.records;
      if (!records.length) throw new Error('no catalogue records');
      var beforeExclusions = records.length;
      records = records.filter(function (r) { return !isSealOrEmbosser(r); });
      if (records.length !== beforeExclusions) {
        console.info('[product-select] excluded ' + (beforeExclusions - records.length)
          + ' seal/embosser products from the picker');
      }
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
      applyDefaultSelection();   // live mode returned above; this is dev/standalone only
    }).catch(function (e) {
      input.disabled = true;
      setStatus(IMPORTABLE_ONLY
        ? 'Live designCentral-dev catalogue unavailable — no products can be offered.'
        : 'Product catalogue unavailable — the Generator still works without a product.', true);
      console.warn('[product-select] catalogue load failed', e);
    });
  }

  /* ── LIVE MODE (?product=<numeric products.id>&mode=live) ───────────────
   *
   * The production entry: CCA links here with the product the person is
   * already working on, so the Generator must open on THAT product and must
   * not let it be changed. The id is resolved through the SAME provider a
   * manual pick uses (provider.getById) — there is no second lookup path and
   * nothing is invented: an id the catalogue does not carry selects nothing
   * and says so.
   *
   * Nothing here runs unless mode=live is present, so the standalone/dev
   * picker behaves exactly as it always has. */
  function liveRequest() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return null; }
    if (String(q.get('mode') || '').toLowerCase() !== 'live') { return null; }
    var raw = String(q.get('product') || '').trim();
    /* products.id is numeric. A non-numeric value is refused rather than
     * guessed at — never a part-number fallback, never a default product. */
    if (!/^[0-9]+$/.test(raw)) { return { id: null, orientation: null, invalid: raw }; }
    var o = String(q.get('orientation') || '').trim().toLowerCase();
    return { id: parseInt(raw, 10), invalid: null,
      orientation: (o === 'landscape' || o === 'portrait') ? o : null };
  }
  var LIVE = liveRequest();
  /* applyLiveSelection() is reachable from boot() directly now, not only from
   * the catalogue load; it must still run exactly once. */
  var liveSelectionRan = false;

  /** True when this page was opened as the production CCA handoff. */
  function isLiveMode() { return !!LIVE; }

  /* The temporary dev picker is presentation only; live mode hides it and
   * locks the selection for the life of the page. The product-driven form
   * locking (dimensions, template type, pages) already happens inside
   * applyProductToForm() the moment a product is selected — live mode adds
   * only the "and it cannot be swapped" half. */
  function applyLiveLock() {
    if (!LIVE) return;
    if (groupEl) { groupEl.classList.add('is-live-locked'); }
    if (input) { input.disabled = true; }
    hideResults();
    /* Clear Product must not exist in live mode: the product came from CCA
     * and the rest of the flow (import, Designer URL) depends on it. */
    var clear = cardEl ? cardEl.querySelector('.sp-clear') : null;
    if (clear) { clear.remove(); }
  }

  /** One product, queried live from Sterling on every call. Resolves to a
   *  NORMALIZED product record. Rejects for every other outcome — no active
   *  product, endpoint unreachable, unexpected shape — because live mode has
   *  no second source to fall back to and must never show stale or invented
   *  product facts. */
  function fetchLiveProduct(id) {
    return fetch(LIVE_PRODUCT_URL + '?product=' + encodeURIComponent(id),
                 { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.text().then(function (body) {
          var doc = null;
          try { doc = JSON.parse(body); } catch (e) { doc = null; }
          if (!doc || typeof doc !== 'object') {
            throw new Error('live product lookup returned a non-JSON response (HTTP '
              + res.status + ')');
          }
          if (doc.found === false || (doc.error && doc.error.code === 'not-found')) {
            throw new Error('Sterling holds no active product with id ' + id + '.');
          }
          if (!res.ok) {
            throw new Error('live product lookup HTTP ' + res.status
              + (doc.error && doc.error.message ? ': ' + doc.error.message : ''));
          }
          var raw = doc.product || doc;
          if (!raw || raw.id === undefined || raw.id === null) {
            throw new Error('live product lookup returned no product record');
          }
          /* CCA's numeric products.id is AUTHORITATIVE. A record for any other
           * product is refused here, before it can be normalized or selected:
           * a Generator opened for one product must never quietly become a
           * Generator for another, and nothing downstream re-checks the id
           * against the URL. */
          if (Number(raw.id) !== Number(id)) {
            throw new Error('The live product lookup answered with product '
              + raw.id + ' for a request for product ' + id + '.');
          }
          /* THE SAME normalizer, contract validation and selectability rules a
           * catalogue record goes through — one product model, one code path.
           * The provider is built around this ONE live record; the bundled
           * catalogue is not involved and is not even loaded in live mode. */
          var one = new window.SMPProductProvider.CatalogueProductProvider({
            records: [raw], source: 'sterling-templatedesigner-live' });
          return one.getById(id).then(function (p) {
            /* Checked again on the NORMALIZED record — the one select() would
             * receive — so no step between here and the selection can change
             * which product this is. */
            if (!p || Number(p.id) !== Number(id)) {
              throw new Error('The live product lookup resolved to product '
                + (p && p.id) + ' for a request for product ' + id + '.');
            }
            return p;
          });
        });
      });
  }

  function applyLiveSelection() {
    /* Deliberately NOT gated on `provider`: live mode never loads the bundled
     * catalogue, so there is no provider to wait for. */
    if (!LIVE || liveSelectionRan) return;
    liveSelectionRan = true;
    if (LIVE.id === null) {
      setStatus('This link did not carry a valid product id, so no product was '
        + 'preselected. Open the Generator from the product page again.', true);
      applyLiveLock();
      return;
    }
    userChose = true;               // never let the default selection win
    setStatus('Loading product ' + LIVE.id + ' from Sterling…');
    fetchLiveProduct(LIVE.id).then(function (p) {
      select(p);                    // the SAME call a manual pick makes
      setStatus('Product ' + LIVE.id + (p.partNumber ? ' — ' + p.partNumber : '')
        + ', read live from Sterling.');
      applyLiveLock();
      if (LIVE.orientation && typeof window.setGeneratorOrientation === 'function') {
        /* Only ever a PREFERENCE: setOrientation clamps it to what the
         * product actually supports, so an unsupported value cannot produce
         * an impossible canvas. */
        try { window.setGeneratorOrientation(LIVE.orientation); } catch (e) { /* keep product default */ }
      }
    }).catch(function (e) {
      /* No fallback, by design. Static catalogue data must never stand in for
       * a live product fact, and neither may a DIFFERENT live product. */
      var mismatch = /answered with product|resolved to product/.test(e && e.message || '');
      setStatus(mismatch
        ? 'Product mismatch: this Generator was opened for product ' + LIVE.id
          + ', but Sterling answered with a different product. Nothing was '
          + 'preselected. Open the Generator from the product page again.'
        : 'Product ' + LIVE.id + ' could not be loaded from Sterling, so no '
          + 'product was preselected. Open the Generator from the product page again.', true);
      applyLiveLock();
      console.warn('[product-select] live product ' + LIVE.id + ' unavailable', e);
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
    /** True when this page was opened as the production CCA handoff
     *  (?product=<id>&mode=live). Read by the Generator to use the live
     *  importer and to keep the product locked. */
    isLiveMode: isLiveMode,
    /** The numeric products.id this page was opened with in live mode, or
     *  null. This is the id that must survive all the way to the Designer. */
    liveProductId: function () { return LIVE ? LIVE.id : null; },
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
