/* ProductProvider — the replaceable source of PRODUCT FACTS.
 *
 * Today the Generator infers bleed, product mode and page count from the
 * template-type dropdown. Those are Sterling product properties, and the real
 * answers live in Sterling's CMS (designCentral: products / sitefamilyproductmap
 * / stampinfo). Routing them through one interface means the demo values can be
 * swapped for authoritative CMS values without touching the Generator or the
 * adapters.
 *
 *   DemoProductProvider   what ships today — derived from the Generator's own
 *                         template types. DEVELOPMENT VALUES, NOT AUTHORITATIVE.
 *   CmsProductProvider    later — fetches real product records.
 *
 * ---------------------------------------------------------------------------
 * HONESTY NOTE, deliberately load-bearing:
 * Every value the demo provider returns is a development assumption made by
 * this prototype. None of it came from Sterling's product database. Each record
 * carries `authoritative: false` and `source: 'demo-provider'` so nothing
 * downstream can mistake it for a real product specification. A real product id
 * is intentionally left null rather than invented.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DPI = 96;

  /* One controlled error type for every product-source failure, so callers
   * never have to interpret a raw transport exception. `code` is stable:
   *   bad-request | not-found | ambiguous | http-error | network |
   *   invalid-record | no-transport | bad-response */
  function ProductSourceError(code, message, detail) {
    var e = new Error(message);
    e.name = 'ProductSourceError';
    e.code = code;
    e.detail = detail || null;
    Object.setPrototypeOf(e, ProductSourceError.prototype);
    return e;
  }
  ProductSourceError.prototype = Object.create(Error.prototype);
  ProductSourceError.prototype.constructor = ProductSourceError;

  /* Late-bound so load order between the two integration scripts cannot break. */
  function C() {
    var c = root.SMPProductContract;
    if (!c) throw new Error('integration/product-contract.js must load before product-provider.js is used');
    return c;
  }

  /* Demo assumptions, matching the Generator's existing behaviour exactly so
   * this change is behaviour-preserving:
   *   bleed  — app.js BLEED_IN (0.125") applied to BLEED_PRODUCTS
   *   mode   — push-to-designer.js MODE_BY_PRODUCT
   *   pages  — the Generator's own double-sided template types */
  var BLEED_IN = 0.125;
  var BLEED_PRODUCTS = ['Business Card', 'Poster', 'Brochure'];

  var MODE_BY_TEMPLATE_TYPE = {
    'Business Card': 'FullColour',
    'Poster': 'FullColour',
    'Sign': 'FullColour',
    'Brochure': 'FullColour',
    'Stamp': 'SingleColour',
    'Nameplate': 'EngravedPlastic',
    'Name Badge': 'EngravedPlastic',
  };

  function DemoProductProvider() {}

  DemoProductProvider.prototype.id = 'demo-provider';

  /** Bleed per edge, in canvas pixels @96dpi. */
  DemoProductProvider.prototype.bleedPxFor = function (templateType) {
    return BLEED_PRODUCTS.indexOf(templateType) >= 0 ? Math.round(BLEED_IN * DPI) : 0;
  };

  /** Sterling's designerVariationCode equivalent for a template type. */
  DemoProductProvider.prototype.designerModeFor = function (templateType) {
    return MODE_BY_TEMPLATE_TYPE[templateType] || 'FullColour';
  };

  /**
   * Everything an adapter needs to know about the product a design targets.
   * `payload` is the Generator's own form payload — the provider adapts to the
   * Generator, never the other way round.
   */
  DemoProductProvider.prototype.resolve = function (payload) {
    var templateType = (payload && payload.templateType) || '';
    return {
      /* No product identity is invented. The CMS provider will fill these. */
      productId: null,
      productNumber: '',
      productFamily: templateType || null,
      templateType: templateType,

      designerMode: this.designerModeFor(templateType),
      bleedPx: this.bleedPxFor(templateType),
      shape: 'rect',
      pageCount: payload && payload.doubleSided ? 2 : 1,

      source: this.id,
      authoritative: false,
      note: 'Development assumption from the Generator template type — not a '
          + 'Sterling product specification. Replace with a CMS-backed provider.',
    };
  };

  /* ================================================================== *
   * SterlingProductProvider — authoritative product facts from a Sterling
   * read-only API.
   *
   * The API does not exist yet (see docs/product-api-contract.md, written for
   * Jesse/IT). This provider is built and tested against RECORDED responses so
   * that the day the endpoint is provisioned, the only change is configuration.
   *
   * NOTHING is hardcoded: no hostname, no siteFamilyId, no live flag, no
   * credentials. Every one of those is injected by the caller, because
   * - the same part number resolves to DIFFERENT products per siteFamilyId +
   *   live (getStampInfo joins sitefamilyproductmap and then LIMIT 1), so
   *   leaving them implicit would silently return the wrong product; and
   * - this code runs in a public browser app, so it must never be able to
   *   carry a secret.
   *
   *   new SterlingProductProvider({ baseUrl, siteFamilyId, live })
   * ================================================================== */

  function SterlingProductProvider(config) {
    config = config || {};
    if (!config.baseUrl) {
      throw new Error('SterlingProductProvider requires an explicit baseUrl. '
        + 'Sterling hosts are never hardcoded in browser code.');
    }
    if (config.siteFamilyId === undefined || config.siteFamilyId === null) {
      throw new Error('SterlingProductProvider requires an explicit siteFamilyId. '
        + 'A part number resolves differently per site family, so it cannot be inferred.');
    }
    if (typeof config.live !== 'boolean') {
      throw new Error('SterlingProductProvider requires an explicit live flag (boolean).');
    }
    this.baseUrl = String(config.baseUrl).replace(/\/+$/, '');
    this.siteFamilyId = config.siteFamilyId;
    this.live = config.live;
    this.timeoutMs = config.timeoutMs || 10000;
    /* Injectable transport — tests pass a recorded-response fetcher, so no test
     * can ever reach the network by accident. */
    this.fetchImpl = config.fetchImpl || (typeof fetch === 'function' ? fetch.bind(null) : null);
    /* 'clean'  — the documented API shape (primary, preferred)
     * 'stampinfo' — INTERIM only; see normalizeStampInfo below. */
    this.responseFormat = config.responseFormat || 'clean';
  }

  SterlingProductProvider.prototype.id = 'sterling-api';

  /** Build a URL with the explicit context every request must carry. */
  SterlingProductProvider.prototype.buildUrl = function (path, params) {
    var q = [];
    var all = Object.assign({
      siteFamilyId: this.siteFamilyId,
      live: this.live ? 'true' : 'false',
    }, params || {});
    Object.keys(all).forEach(function (k) {
      if (all[k] === undefined || all[k] === null || all[k] === '') return;
      q.push(encodeURIComponent(k) + '=' + encodeURIComponent(all[k]));
    });
    return this.baseUrl + path + (q.length ? '?' + q.join('&') : '');
  };

  SterlingProductProvider.prototype._get = function (url) {
    var self = this;
    if (!self.fetchImpl) {
      return Promise.reject(new ProductSourceError('no-transport',
        'No fetch implementation available for SterlingProductProvider.'));
    }
    return Promise.resolve()
      .then(function () { return self.fetchImpl(url, { method: 'GET', credentials: 'omit' }); })
      .then(function (res) {
        if (!res || typeof res.status !== 'number') {
          throw new ProductSourceError('bad-response', 'Product API returned no response.');
        }
        if (res.status === 404) {
          throw new ProductSourceError('not-found', 'Product not found.', { status: 404 });
        }
        if (res.status < 200 || res.status >= 300) {
          throw new ProductSourceError('http-error',
            'Product API returned HTTP ' + res.status + '.', { status: res.status });
        }
        return res.json();
      })
      .catch(function (e) {
        if (e instanceof ProductSourceError) throw e;
        /* Network failure, DNS, CORS, invalid JSON — one controlled error type
         * so callers never see a raw transport exception. */
        throw new ProductSourceError('network', 'Could not reach the product API: ' + (e && e.message ? e.message : e));
      });
  };

  SterlingProductProvider.prototype._normalize = function (raw) {
    return this.responseFormat === 'stampinfo'
      ? this.normalizeStampInfo(raw)
      : this.normalizeCleanApi(raw);
  };

  /** Look up one product by its Sterling products.id (the canonical key). */
  SterlingProductProvider.prototype.getById = function (id) {
    var self = this;
    if (id === undefined || id === null || id === '') {
      return Promise.reject(new ProductSourceError('bad-request', 'getById requires an id.'));
    }
    return this._get(this.buildUrl('/productLookup.cfm', { id: id })).then(function (raw) {
      return self._finish(raw);
    });
  };

  /** Look up one product by part number. Ambiguity is the API's to resolve —
   *  see docs/product-api-contract.md; a multi-match must be an explicit error,
   *  never a silent LIMIT 1 as the legacy query does. */
  SterlingProductProvider.prototype.getByPartNumber = function (partNumber) {
    var self = this;
    if (!partNumber) {
      return Promise.reject(new ProductSourceError('bad-request', 'getByPartNumber requires a part number.'));
    }
    return this._get(this.buildUrl('/productLookup.cfm', { part: partNumber })).then(function (raw) {
      return self._finish(raw);
    });
  };

  /** Lightweight search. Returns summaries, NOT full product records. */
  SterlingProductProvider.prototype.search = function (query, options) {
    options = options || {};
    return this._get(this.buildUrl('/productSearch.cfm', {
      q: query, limit: options.limit || 25, offset: options.offset || 0,
    })).then(function (raw) {
      var rows = Array.isArray(raw) ? raw : (raw && raw.results) || [];
      return rows.map(function (r) {
        return {
          id: r.id, partNumber: r.partNumber || r.part || '', name: r.name || '',
          productFamily: r.productFamily || null,
          widthIn: r.width !== undefined ? r.width : r.widthIn,
          heightIn: r.height !== undefined ? r.height : r.heightIn,
          unit: r.unit || 'in',
        };
      });
    });
  };

  /** Normalize, validate, and refuse to return a record that would silently
   *  produce a wrongly sized design. */
  SterlingProductProvider.prototype._finish = function (raw) {
    var product = this._normalize(raw);
    var problems = C().validate(product);
    if (problems.length) {
      throw new ProductSourceError('invalid-record',
        'Product record failed contract validation: ' + problems.join('; '), { problems: problems });
    }
    return product;
  };

  /* ---- normalizers -------------------------------------------------- *
   * These are the ONLY places raw source field names are allowed to appear. */

  /** PRIMARY: the clean API shape documented in docs/product-api-contract.md. */
  SterlingProductProvider.prototype.normalizeCleanApi = function (raw) {
    raw = raw || {};
    var d = raw.dimensions || {}, b = raw.bleed || {}, pg = raw.pages || {};
    var o = raw.orientation || {}, l = raw.legacy || {}, st = raw.status || {};
    var m = l.margins || {}, br = l.borders || {}, db = l.daterBox || {};
    var ctx = raw.context || {};
    return C().createProduct({
      id: raw.id, partNumber: raw.partNumber, name: raw.name,
      productFamily: raw.productFamily,
      widthIn: d.widthIn, heightIn: d.heightIn, dpi: d.dpi,
      displayUnit: d.displayUnit, widthDisplay: d.widthDisplay, heightDisplay: d.heightDisplay,
      bleedTop: b.top, bleedRight: b.right, bleedBottom: b.bottom, bleedLeft: b.left,
      minPages: pg.min, maxPages: pg.max,
      shape: raw.shape,
      landscapeAvailable: o.landscapeAvailable, portraitAvailable: o.portraitAvailable,
      maxLines: raw.maxLines,
      active: st.active, retired: st.retired,
      designerVariationCode: l.designerVariationCode,
      designerMode: C().designerModeFromCode(l.designerVariationCode),
      marginTop: m.top, marginRight: m.right, marginBottom: m.bottom, marginLeft: m.left,
      borderTop: br.top, borderRight: br.right, borderBottom: br.bottom, borderLeft: br.left,
      borderWidth: br.width,
      daterBoxWidth: db.width, daterBoxHeight: db.height,
      isProStamp: l.isProStamp, greenInkAvailable: l.greenInkAvailable,
      bandString: l.bandString,
      clipPaths: l.clipPaths, clipPathOverlays: l.clipPathOverlays,
      source: 'sterling-api', authoritative: true,
      fetchedAt: new Date().toISOString(),
      siteFamilyId: ctx.siteFamilyId !== undefined ? ctx.siteFamilyId : this.siteFamilyId,
      live: ctx.live !== undefined ? ctx.live : this.live,
    });
  };

  /** INTERIM ONLY: the legacy getStampInfo.cfm response.
   *
   * Kept narrowly scoped so that IF IT cannot provision the clean endpoint
   * quickly, we can point at getStampInfo without redesigning anything. It is
   * NOT the target architecture:
   *   - it is a legacy-Designer endpoint, which is what Phase 1 decoupled from;
   *   - it returns commercial data (LOWESTPRICE, per-variation prices) that a
   *     public browser app should not receive.
   * Everything it returns beyond the contract — prices, variations, colours,
   * product options, image paths — is DISCARDED here and never travels further.
   * ColdFusion's UPPERCASE naming stops at this function. */
  SterlingProductProvider.prototype.normalizeStampInfo = function (raw) {
    raw = raw || {};
    return C().createProduct({
      id: raw.PRODUCTIDINT, partNumber: raw.PARTNUMBER, name: raw.DESCRIPTION,
      productFamily: null,
      widthIn: raw.WIDTH, heightIn: raw.HEIGHT, dpi: 96,
      displayUnit: raw.DISPLAYUNIT,
      widthDisplay: raw.WIDTHDISPLAY === undefined ? '' : String(raw.WIDTHDISPLAY),
      heightDisplay: raw.HEIGHTDISPLAY === undefined ? '' : String(raw.HEIGHTDISPLAY),
      bleedTop: raw.BLEEDTOP, bleedRight: raw.BLEEDRIGHT,
      bleedBottom: raw.BLEEDBOTTOM, bleedLeft: raw.BLEEDLEFT,
      minPages: raw.MINPAGES, maxPages: raw.MAXPAGES,
      shape: raw.SHAPE,
      /* getStampInfo does not expose orientation availability; the Designer
       * reads landscapeAvailable/portraitAvailable from a separate query. */
      landscapeAvailable: true, portraitAvailable: true,
      maxLines: raw.MAXLINES,
      active: null, retired: null,
      designerVariationCode: raw.DESIGNERVARIATIONCODE,
      designerMode: C().designerModeFromCode(raw.DESIGNERVARIATIONCODE),
      marginTop: raw.MARGINTOP, marginRight: raw.MARGINRIGHT,
      marginBottom: raw.MARGINBOTTOM, marginLeft: raw.MARGINLEFT,
      borderTop: raw.BORDERTOP, borderRight: raw.BORDERRIGHT,
      borderBottom: raw.BORDERBOTTOM, borderLeft: raw.BORDERLEFT,
      borderWidth: raw.BORDERWIDTH,
      daterBoxWidth: raw.DATERBOXWIDTH, daterBoxHeight: raw.DATERBOXHEIGHT,
      isProStamp: raw.ISPROSTAMP, greenInkAvailable: raw.GREENINKAVAILABLE,
      bandString: raw.BANDSTRING,
      clipPaths: raw.CLIPPATHS, clipPathOverlays: raw.CLIPPATHOVERLAYS,
      source: 'sterling-getstampinfo-interim', authoritative: true,
      fetchedAt: new Date().toISOString(),
      siteFamilyId: this.siteFamilyId, live: this.live,
      note: 'Normalized from the legacy getStampInfo.cfm response. Pricing, '
          + 'variations, colours and product options were discarded.',
    });
  };

  /* ================================================================== *
   * CatalogueProductProvider — verified Sterling products, served locally.
   *
   * Phase 2B needs a working product-selection experience before the
   * read-only Sterling API exists. This provider serves records from a
   * verified catalogue (data/sterling-products.json) through the SAME
   * normalizer SterlingProductProvider uses for the clean API shape, so the
   * normalized output is identical either way and swapping to the live API is
   * a provider swap with no Generator change.
   *
   * The catalogue is INJECTED, never imported: this file contains no product
   * data, no hostname and no path. Anything that can produce clean-shaped
   * records — a local file, a spreadsheet export, the future API — can back it.
   *
   *   new CatalogueProductProvider({ records, source, siteFamilyId, live })
   * ================================================================== */

  function CatalogueProductProvider(config) {
    config = config || {};
    if (!Array.isArray(config.records)) {
      throw new Error('CatalogueProductProvider requires an explicit records array. '
        + 'Product data is never embedded in the provider.');
    }
    this.source = config.source || 'sterling-catalogue-local';
    /* Context is carried so a catalogue record and an API record describe the
     * same provenance fields. null means "this catalogue did not say". */
    this.siteFamilyId = config.siteFamilyId === undefined ? null : config.siteFamilyId;
    this.live = typeof config.live === 'boolean' ? config.live : null;
    this.records = config.records.filter(function (r) { return r && typeof r === 'object'; });
  }

  CatalogueProductProvider.prototype.id = 'catalogue-provider';

  /** A product the Generator must refuse to design on. */
  function isSelectable(raw) {
    var st = raw.status || {}, av = raw.availability || {};
    if (st.active === false || st.retired === true) return false;
    /* Absent means the catalogue did not say; only an explicit false blocks. */
    if (av.customizable === false) return false;
    if (av.isAccessory === true) return false;
    return true;
  }

  CatalogueProductProvider.prototype.normalize = function (raw) {
    /* Reuses the clean-API normalizer verbatim — one code path, so a catalogue
     * record and a future API record can never diverge. */
    var product = SterlingProductProvider.prototype.normalizeCleanApi.call(this, raw);
    product.provenance.source = this.source;
    product.provenance.note = 'Verified Sterling product served from a local catalogue. '
      + 'Technical values are real; this is not a live API read.';
    var problems = C().validate(product);
    if (problems.length) {
      throw ProductSourceError('invalid-record',
        'Catalogue record failed contract validation: ' + problems.join('; '), problems);
    }
    return product;
  };

  CatalogueProductProvider.prototype.getById = function (id) {
    var self = this;
    return new Promise(function (resolve) {
      var n = Number(id);
      if (!isFinite(n)) throw ProductSourceError('bad-request', 'Product id must be numeric.');
      var hit = self.records.filter(function (r) { return Number(r.id) === n; });
      if (!hit.length) throw ProductSourceError('not-found', 'No catalogue product with id ' + n + '.');
      if (!isSelectable(hit[0])) {
        throw ProductSourceError('not-found',
          'Product ' + n + ' is not available for design (inactive, retired, non-customizable or an accessory).');
      }
      resolve(self.normalize(hit[0]));
    });
  };

  CatalogueProductProvider.prototype.getByPartNumber = function (part) {
    var self = this;
    return new Promise(function (resolve) {
      var q = String(part == null ? '' : part).trim().toUpperCase();
      if (!q) throw ProductSourceError('bad-request', 'A part number is required.');
      var hit = self.records.filter(function (r) {
        return String(r.partNumber || '').toUpperCase() === q;
      });
      if (!hit.length) throw ProductSourceError('not-found', 'No catalogue product matches part ' + q + '.');
      /* Ambiguity is surfaced, never silently resolved by picking the first —
       * the behaviour docs/product-api-contract.md asks the real API for. */
      if (hit.length > 1) {
        throw ProductSourceError('ambiguous', hit.length + ' catalogue products match part ' + q + '.',
          { candidates: hit.map(function (r) { return r.id; }) });
      }
      if (!isSelectable(hit[0])) {
        throw ProductSourceError('not-found', 'Product ' + q + ' is not available for design.');
      }
      resolve(self.normalize(hit[0]));
    });
  };

  /** Lightweight summaries for a picker. Same shape as the API's search(). */
  CatalogueProductProvider.prototype.search = function (query, opts) {
    var self = this;
    opts = opts || {};
    return new Promise(function (resolve) {
      var q = String(query == null ? '' : query).trim().toLowerCase();
      var limit = opts.limit === undefined ? 25 : Number(opts.limit);
      var matches = self.records.filter(isSelectable).filter(function (r) {
        if (!q) return true;
        return [r.partNumber, r.name, r.productFamily, String(r.id)]
          .some(function (f) { return String(f || '').toLowerCase().indexOf(q) >= 0; });
      });
      resolve({
        results: matches.slice(0, limit).map(function (r) {
          var d = r.dimensions || {}, pg = r.pages || {};
          return {
            id: r.id, partNumber: r.partNumber, name: r.name,
            productFamily: r.productFamily,
            widthIn: d.widthIn, heightIn: d.heightIn, unit: d.displayUnit || 'in',
            pages: pg.min || 1,
          };
        }),
        total: matches.length,
        limit: limit,
        offset: 0,
      });
    });
  };

  /* Active provider. Swapping implementations is a one-line change here (or a
   * call to setProvider) and touches nothing else. The DEMO provider stays the
   * default so the Generator keeps working with no Sterling API at all. */
  var active = new DemoProductProvider();

  root.SMPProductProvider = {
    DemoProductProvider: DemoProductProvider,
    SterlingProductProvider: SterlingProductProvider,
    CatalogueProductProvider: CatalogueProductProvider,
    ProductSourceError: ProductSourceError,
    get: function () { return active; },
    setProvider: function (p) { active = p; return active; },

    /* Convenience passthroughs so callers don't each reach for .get(). These
     * are the synchronous, template-type-based calls the Generator makes today;
     * an authoritative provider is consulted through resolveProduct() instead. */
    bleedPxFor: function (t) {
      return typeof active.bleedPxFor === 'function'
        ? active.bleedPxFor(t) : new DemoProductProvider().bleedPxFor(t);
    },
    designerModeFor: function (t) {
      return typeof active.designerModeFor === 'function'
        ? active.designerModeFor(t) : new DemoProductProvider().designerModeFor(t);
    },
    /* THE PRODUCT-FACT FUNNEL.
     *
     * When the Generator has an authoritative Sterling product selected, that
     * product decides the technical document settings — geometry, bleed, page
     * count, shape, designer mode. A template-type guess must never be able to
     * override a real product record, so the selected product is checked FIRST
     * and returns before any inference runs.
     *
     * With no product selected the Generator stays a standalone design tool and
     * falls back to the demo inference exactly as before. */
    resolve: function (payload) {
      var selected = payload && payload.product;
      if (selected && selected.contractVersion && selected.provenance
          && selected.provenance.authoritative) {
        return C().toDesignProductContext(selected);
      }
      return typeof active.resolve === 'function'
        ? active.resolve(payload) : new DemoProductProvider().resolve(payload);
    },

    /* Bleed for the CURRENT payload. Product first, template type second — the
     * same precedence as resolve(), so the on-screen bleed overlay and the
     * transferred design can never disagree about a selected product. */
    bleedPxForPayload: function (payload) {
      var selected = payload && payload.product;
      if (selected && selected.bleed) return selected.bleed.top;
      return this.bleedPxFor(payload && payload.templateType);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
