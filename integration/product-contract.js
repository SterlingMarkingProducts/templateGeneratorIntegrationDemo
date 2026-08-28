/* Normalized PRODUCT contract — the second stable boundary in this project.
 *
 * normalized-design.js answers "what is this design?".
 * This file answers "what is the product it is being made for?".
 *
 * ---------------------------------------------------------------------------
 * THE CENTRAL RULE
 *
 * Genuine PRODUCT facts live at the TOP LEVEL. Facts that exist only because
 * of the current legacy Fabric Designer live under `legacy`.
 *
 * The Generator reads the top level. Only an adapter reads `legacy`. When
 * Sterling replaces the Designer, the top level survives untouched and the
 * `legacy` block is replaced or ignored by the new adapter.
 *
 * Why the split is real, not cosmetic (from the Phase 2 source investigation):
 *   - width/height in inches are a manufacturing fact; the 96-DPI pixel canvas
 *     is a rendering convention — getStampInfo COMPUTES it as inches * 96
 *     (oldDesigner/functions.cfc:528-535), it is not stored in the database.
 *   - bleed is a print fact; margins/borders as consumed by SMPdesigner.js are
 *     editor guide settings.
 *   - designerVariationCode is a 4-row lookup table describing how the LEGACY
 *     editor behaves. A replacement Designer will very likely have other modes,
 *     so it must never reach the Generator.
 * ---------------------------------------------------------------------------
 *
 * ColdFusion's serializeJSON() UPPERCASES every key, so raw Sterling responses
 * look like CANVASWIDTH / PRODUCTIDINT / DESIGNERVARIATIONCODE. Those names are
 * normalized away ONCE, at the provider boundary, and must never appear
 * anywhere else in the Generator.
 *
 * Plain script (no modules), matching the rest of the integration layer.
 */
(function (root) {
  'use strict';

  var CONTRACT_VERSION = 1;
  var DEFAULT_DPI = 96;

  var num = function (v, d) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : (d === undefined ? null : d);
  };
  var bool = function (v, d) {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true' || v === 'yes') return true;
    if (v === 0 || v === '0' || v === 'false' || v === 'no') return false;
    return d === undefined ? null : d;
  };
  var str = function (v, d) {
    return (typeof v === 'string' && v !== '') ? v : (d === undefined ? '' : d);
  };

  /* The four legacy designer modes. designervariationcodes is a 4-row table
   * (designCentral.sql, AUTO_INCREMENT=5) whose `designerVariationCode` column
   * holds the string; products.designerVariationCode is the int FK into it
   * (proven by the join `t3.id = t1.designerVariationCode`,
   * oldDesigner/templateDesigner.cfm:141).
   *
   * Codes 3 and 4 are PROVEN from Sterling's own source — oldDesigner
   * gettemplateJson.cfm:163-167 and getFormJson.cfm:444-448 both branch:
   *     <cfif  partinfo.designerVariationCode eq "3"> format = "FullColour"
   *     <cfelseif partinfo.designerVariationCode eq "4"> format = "EngravedPlastic"
   *
   * Codes 1 and 2 are NOT proven. Those same files never map them: when the
   * code is neither 3 nor 4 the mode falls back to SingleColour, or Grayscale
   * if isProStamp — so the id is not consulted at all on that path. No
   * `INSERT INTO designervariationcodes` exists in any Sterling repository, so
   * the table's actual rows cannot be read from source. The two strings below
   * are INFERRED from the literals the legacy Designer branches on and must be
   * confirmed by IT — see docs/product-api-contract.md. */
  var DESIGNER_MODE_BY_CODE = {
    1: 'SingleColour',      // INFERRED — not proven
    2: 'Grayscale',         // INFERRED — not proven
    3: 'FullColour',        // PROVEN (gettemplateJson.cfm:163-164)
    4: 'EngravedPlastic',   // PROVEN (gettemplateJson.cfm:165-166)
  };
  var PROVEN_MODE_CODES = [3, 4];

  function designerModeFromCode(code) {
    var n = num(code);
    if (n === null) return null;
    return DESIGNER_MODE_BY_CODE[n] || null;
  }

  /**
   * Build a normalized Product record.
   *
   * Callers pass already-extracted values; this performs no source-format
   * parsing of its own — that belongs in a provider's normalizer, so a new
   * product source never requires editing this file.
   */
  function createProduct(o) {
    var dpi = num(o.dpi, DEFAULT_DPI);
    var widthIn = num(o.widthIn);
    var heightIn = num(o.heightIn);

    return {
      contractVersion: CONTRACT_VERSION,

      /* ---- identity ------------------------------------------------- */
      id: o.id === null || o.id === undefined ? null : o.id,
      partNumber: str(o.partNumber),
      name: str(o.name),
      productFamily: o.productFamily === undefined ? null : o.productFamily,
      /* The database's own product-group rows (productinformation via
       * productinformationmap), carried verbatim from the source. null = the
       * source did not say. This is a PRODUCT FACT, not a creative category:
       * mapping it to a template type happens in the consumer, and an
       * unmapped classification stays visibly unknown. */
      classification: (o.classification && typeof o.classification === 'object')
        ? o.classification : null,

      /* ---- PRODUCT FACTS -------------------------------------------- */
      dimensions: {
        widthIn: widthIn,
        heightIn: heightIn,
        /* Derived, not authoritative: the 96-DPI canvas is a rendering
         * convention. Kept because every current consumer needs it. */
        widthPx: widthIn === null ? null : Math.round(widthIn * dpi),
        heightPx: heightIn === null ? null : Math.round(heightIn * dpi),
        dpi: dpi,
        displayUnit: str(o.displayUnit, 'in'),
        widthDisplay: str(o.widthDisplay),
        heightDisplay: str(o.heightDisplay),
      },
      /* Bleed per edge, in px at `dpi`. A print/manufacturing fact. */
      bleed: {
        top: num(o.bleedTop, 0),
        right: num(o.bleedRight, 0),
        bottom: num(o.bleedBottom, 0),
        left: num(o.bleedLeft, 0),
      },
      pages: {
        min: num(o.minPages, 1),
        max: num(o.maxPages, 1),
      },
      shape: str(o.shape, 'rect'),
      orientation: {
        landscapeAvailable: bool(o.landscapeAvailable, true),
        portraitAvailable: bool(o.portraitAvailable, true),
      },
      maxLines: num(o.maxLines, 0),
      /* Availability, where the source exposes it. null = source did not say. */
      status: {
        active: bool(o.active, null),
        retired: bool(o.retired, null),
      },

      /* ---- LEGACY DESIGNER FACTS ------------------------------------ *
       * Only integration/adapters/sterling-legacy.js should read this.  */
      legacy: {
        designerMode: str(o.designerMode, '') || null,
        designerVariationCode: num(o.designerVariationCode),
        /* True when the mode came from a code we have actually verified. */
        designerModeProven: PROVEN_MODE_CODES.indexOf(num(o.designerVariationCode)) >= 0,
        margins: {
          top: num(o.marginTop, 0), right: num(o.marginRight, 0),
          bottom: num(o.marginBottom, 0), left: num(o.marginLeft, 0),
        },
        borders: {
          top: num(o.borderTop, 0), right: num(o.borderRight, 0),
          bottom: num(o.borderBottom, 0), left: num(o.borderLeft, 0),
          width: num(o.borderWidth, 0),
        },
        daterBox: { width: num(o.daterBoxWidth, 0), height: num(o.daterBoxHeight, 0) },
        isProStamp: bool(o.isProStamp, false),
        greenInkAvailable: bool(o.greenInkAvailable, false),
        bandString: str(o.bandString),
        clipPaths: Array.isArray(o.clipPaths) ? o.clipPaths : [],
        clipPathOverlays: Array.isArray(o.clipPathOverlays) ? o.clipPathOverlays : [],
      },

      /* ---- provenance ------------------------------------------------ *
       * `authoritative` is the honesty switch: false means these numbers are
       * development assumptions, not Sterling product specifications. Nothing
       * downstream may present a non-authoritative record as a real spec. */
      provenance: {
        source: str(o.source, 'unknown'),
        authoritative: bool(o.authoritative, false),
        /* How much to trust the TECHNICAL values (size, bleed, pages, mode):
         *   'cms-verified'  — read from Sterling's own data
         *   'inferred-test' — inferred by a test-only rule from a spreadsheet
         *   'demo-assumed'  — the Generator's own template-type assumption
         * Never let an inferred record be presented as a Sterling specification. */
        technicalDataStatus: str(o.technicalDataStatus,
          bool(o.authoritative, false) ? 'cms-verified' : 'demo-assumed'),
        fetchedAt: o.fetchedAt || null,
        siteFamilyId: o.siteFamilyId === undefined ? null : o.siteFamilyId,
        live: o.live === undefined ? null : o.live,
        note: str(o.note),
      },
    };
  }

  /**
   * Validate a normalized Product. Returns an array of human-readable problems;
   * empty means valid. Deliberately strict about the things that would silently
   * produce a wrongly sized design.
   */
  function validate(p) {
    var problems = [];
    if (!p || typeof p !== 'object') return ['not an object'];
    if (p.contractVersion !== CONTRACT_VERSION) {
      problems.push('contractVersion is ' + p.contractVersion + ', expected ' + CONTRACT_VERSION);
    }
    if (p.id === null || p.id === undefined || p.id === '') problems.push('id is missing');
    if (!p.partNumber) problems.push('partNumber is missing');

    var d = p.dimensions || {};
    if (!(d.widthIn > 0)) problems.push('dimensions.widthIn must be > 0');
    if (!(d.heightIn > 0)) problems.push('dimensions.heightIn must be > 0');
    if (!(d.dpi > 0)) problems.push('dimensions.dpi must be > 0');

    var b = p.bleed || {};
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      if (!(b[k] >= 0)) problems.push('bleed.' + k + ' must be >= 0');
    });

    var pg = p.pages || {};
    if (!(pg.min >= 1)) problems.push('pages.min must be >= 1');
    if (!(pg.max >= 1)) problems.push('pages.max must be >= 1');
    if (pg.min > pg.max) problems.push('pages.min (' + pg.min + ') > pages.max (' + pg.max + ')');

    if (!p.shape) problems.push('shape is missing');
    if (!p.legacy) problems.push('legacy block is missing');
    if (!p.provenance) problems.push('provenance block is missing');
    else if (typeof p.provenance.authoritative !== 'boolean') {
      problems.push('provenance.authoritative must be an explicit boolean');
    }
    return problems;
  }

  /**
   * Project a Product onto the shape the design pipeline consumes
   * (integration/normalized-design.js -> productContext). This is the ONLY
   * thing the Generator's conversion path needs from a product.
   */
  function toDesignProductContext(p) {
    return {
      productId: p.id,
      productNumber: p.partNumber,
      /* How far the technical values below can be trusted. Travels with the
       * context so downstream code never has to guess. */
      technicalDataStatus: (p.provenance && p.provenance.technicalDataStatus) || 'demo-assumed',
      productFamily: p.productFamily,
      templateType: p.productFamily || '',
      designerMode: (p.legacy && p.legacy.designerMode) || 'FullColour',
      bleedPx: p.bleed.top,          // adapters that need per-edge read p.bleed
      shape: p.shape,
      pageCount: p.pages.min,
      maxLines: p.maxLines,
      source: p.provenance.source,
      authoritative: p.provenance.authoritative,
      /* keep the full record reachable without flattening it everywhere */
      product: p,
    };
  }

  root.SMPProductContract = {
    CONTRACT_VERSION: CONTRACT_VERSION,
    DEFAULT_DPI: DEFAULT_DPI,
    DESIGNER_MODE_BY_CODE: DESIGNER_MODE_BY_CODE,
    PROVEN_MODE_CODES: PROVEN_MODE_CODES,
    designerModeFromCode: designerModeFromCode,
    createProduct: createProduct,
    validate: validate,
    toDesignProductContext: toDesignProductContext,
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SMPProductContract;
})(typeof globalThis !== 'undefined' ? globalThis : this);
