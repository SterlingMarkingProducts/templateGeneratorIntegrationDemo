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

  /* Active provider. Swapping implementations is a one-line change here (or a
   * call to setProvider) and touches nothing else. */
  var active = new DemoProductProvider();

  root.SMPProductProvider = {
    DemoProductProvider: DemoProductProvider,
    get: function () { return active; },
    setProvider: function (p) { active = p; return active; },

    /* Convenience passthroughs so callers don't each reach for .get(). */
    bleedPxFor: function (t) { return active.bleedPxFor(t); },
    designerModeFor: function (t) { return active.designerModeFor(t); },
    resolve: function (payload) { return active.resolve(payload); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
