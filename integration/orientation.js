/* Orientation — one model for "which way round is this design".
 *
 * Orientation reorders the SAME physical product dimensions. It never creates a
 * product, changes products.id, changes the physical size, scales one dimension
 * independently, or alters DPI, bleed amounts or production settings. A 3.5x2in
 * business card is 3.5x2 landscape and 2x3.5 portrait — the same card, turned.
 *
 * Three questions live here and nowhere else:
 *   1. Which orientation should a product START in?  defaultOrientationFor()
 *   2. Which orientations may the user CHOOSE?       capabilitiesOf()
 *   3. What are the oriented numbers?                orientDimensions/orientEdges
 */
(function (root) {
  'use strict';

  var LANDSCAPE = 'landscape';
  var PORTRAIT = 'portrait';
  var ORIENTATIONS = [LANDSCAPE, PORTRAIT];

  /* Product families with a Sterling-specified default orientation. Anything
   * NOT in this table keeps its own native orientation — the ordering already
   * recorded in the product's dimensions — rather than being pushed into an
   * invented default. Keys are lower-cased family names and the Generator's own
   * template types, because the standalone (no product) path uses the same
   * table. */
  var FAMILY_DEFAULTS = {
    'business card': LANDSCAPE,
    'business cards': LANDSCAPE,
    'stamp': LANDSCAPE,
    'stamps': LANDSCAPE,
    'self-inking stamps': LANDSCAPE,
    'name badge': LANDSCAPE,
    'name badges': LANDSCAPE,
    'nameplate': LANDSCAPE,
    'nameplates': LANDSCAPE,
    'brochure': LANDSCAPE,
    'brochures': LANDSCAPE,
    'sign': PORTRAIT,
    'signs': PORTRAIT,
    'banner': LANDSCAPE,
    'banners': LANDSCAPE,
  };

  /* A pull-up / retractable banner is a floor-standing roll-up: it is the one
   * documented exception to the Banner default and is PORTRAIT. It is matched
   * on the product's own words before the family table is consulted, because
   * Sterling files these under the Banner family. Nothing else is inferred
   * from a product name. */
  var PULL_UP_BANNER = /\b(pull[\s-]?up|retractable|roll[\s-]?up)\b/i;

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function isOrientation(o) { return ORIENTATIONS.indexOf(o) >= 0; }

  /** The orientation a width/height pair is already in. Square counts as landscape. */
  function nativeOrientationOf(widthIn, heightIn) {
    return Number(heightIn) > Number(widthIn) ? PORTRAIT : LANDSCAPE;
  }

  /* Read the family / name / geometry off either a normalized Product record or
   * a plain descriptor, so the same rules serve the product path and the
   * standalone template-type path. */
  function describe(subject) {
    if (!subject) return null;
    var d = subject.dimensions || {};
    var w = subject.widthIn != null ? subject.widthIn : d.widthIn;
    var h = subject.heightIn != null ? subject.heightIn : d.heightIn;
    return {
      family: norm(subject.productFamily || subject.family || subject.templateType),
      words: [subject.name, subject.partNumber, subject.productFamily]
        .filter(Boolean).join(' '),
      widthIn: Number(w) || 0,
      heightIn: Number(h) || 0,
      orientation: subject.orientation || null,
      authoritative: !!(subject.provenance && subject.provenance.authoritative),
    };
  }

  /**
   * The orientation a product (or template type) should start in.
   * Returns null when nothing is known — the caller then leaves the current
   * orientation alone.
   */
  function defaultOrientationFor(subject) {
    var s = describe(subject);
    if (!s) return null;
    /* The pull-up exception outranks the Banner family rule. */
    if (PULL_UP_BANNER.test(s.words)) return PORTRAIT;
    if (FAMILY_DEFAULTS[s.family]) return FAMILY_DEFAULTS[s.family];
    /* Unlisted family: preserve the product's own native orientation. */
    if (s.widthIn && s.heightIn) return nativeOrientationOf(s.widthIn, s.heightIn);
    return null;
  }

  /** Why a default was chosen — for the UI hint and for tests. */
  function defaultReasonFor(subject) {
    var s = describe(subject);
    if (!s) return 'none';
    if (PULL_UP_BANNER.test(s.words)) return 'pull-up-banner';
    if (FAMILY_DEFAULTS[s.family]) return 'family-default';
    if (s.widthIn && s.heightIn) return 'product-native';
    return 'none';
  }

  /**
   * Which orientations the user may choose for this product.
   *
   * Only an AUTHORITATIVE (CMS-verified) product may LOCK the control: a
   * restriction is a real product fact and must never be manufactured from
   * spreadsheet-inferred data. Inferred records that explicitly carry a
   * restriction are still honoured — the test inventory is allowed to say a
   * product is one-way-only — but the result is reported as test data, not as
   * a Sterling specification.
   */
  function capabilitiesOf(subject) {
    var s = describe(subject);
    var open = { landscape: true, portrait: true, locked: false, lockedTo: null,
                 restrictionSource: 'none' };
    if (!s) return open;
    var o = s.orientation || {};
    var landscape = o.landscapeAvailable !== false;
    var portrait = o.portraitAvailable !== false;
    /* Both false is meaningless; treat it as no restriction rather than
     * leaving the user with nothing to pick. */
    if (!landscape && !portrait) return open;
    if (landscape && portrait) return open;
    return {
      landscape: landscape,
      portrait: portrait,
      locked: true,
      lockedTo: landscape ? LANDSCAPE : PORTRAIT,
      restrictionSource: s.authoritative ? 'cms-verified' : 'test-data',
    };
  }

  /** Clamp a requested orientation to what the product actually permits. */
  function allowedOrientation(subject, requested) {
    var caps = capabilitiesOf(subject);
    if (caps.locked) return caps.lockedTo;
    return isOrientation(requested) ? requested : defaultOrientationFor(subject);
  }

  /**
   * The same physical size, ordered for an orientation. Width and height are
   * only ever SWAPPED — never scaled, never recomputed.
   */
  function orientDimensions(dims, orientation) {
    var w = Number((dims && (dims.widthIn != null ? dims.widthIn : dims.width)) || 0);
    var h = Number((dims && (dims.heightIn != null ? dims.heightIn : dims.height)) || 0);
    if (!isOrientation(orientation) || !w || !h) return { widthIn: w, heightIn: h, rotated: false };
    var rotated = nativeOrientationOf(w, h) !== orientation;
    return rotated
      ? { widthIn: h, heightIn: w, rotated: true }
      : { widthIn: w, heightIn: h, rotated: false };
  }

  /**
   * Per-edge values (bleed, margins, borders) follow their physical edge when
   * the sheet turns. Turning the product 90 degrees clockwise carries the left
   * edge to the top, the top edge to the right, and so on. The AMOUNTS are
   * untouched — only which edge they name changes.
   */
  function orientEdges(edges, rotated) {
    if (!edges) return edges;
    if (!rotated) {
      return { top: edges.top, right: edges.right, bottom: edges.bottom, left: edges.left };
    }
    return { top: edges.left, right: edges.top, bottom: edges.right, left: edges.bottom };
  }

  /**
   * An oriented VIEW of a product. The record is never mutated and its identity
   * is never touched: same id, same partNumber, same physical size, same DPI,
   * same bleed amounts, same production settings.
   */
  function orientProduct(product, orientation) {
    if (!product || !product.dimensions) return null;
    var applied = allowedOrientation(product, orientation);
    var native = nativeOrientationOf(product.dimensions.widthIn, product.dimensions.heightIn);
    var d = orientDimensions(product.dimensions, applied);
    var dpi = product.dimensions.dpi || 96;
    return {
      orientation: applied,
      nativeOrientation: native,
      rotated: d.rotated,
      widthIn: d.widthIn,
      heightIn: d.heightIn,
      widthPx: Math.round(d.widthIn * dpi),
      heightPx: Math.round(d.heightIn * dpi),
      dpi: dpi,
      bleed: orientEdges(product.bleed, d.rotated),
      margins: orientEdges(product.legacy && product.legacy.margins, d.rotated),
      borders: orientEdges(product.legacy && product.legacy.borders, d.rotated),
    };
  }

  root.SMPOrientation = {
    LANDSCAPE: LANDSCAPE,
    PORTRAIT: PORTRAIT,
    ORIENTATIONS: ORIENTATIONS,
    FAMILY_DEFAULTS: FAMILY_DEFAULTS,
    PULL_UP_BANNER: PULL_UP_BANNER,
    isOrientation: isOrientation,
    nativeOrientationOf: nativeOrientationOf,
    defaultOrientationFor: defaultOrientationFor,
    defaultReasonFor: defaultReasonFor,
    capabilitiesOf: capabilitiesOf,
    allowedOrientation: allowedOrientation,
    orientDimensions: orientDimensions,
    orientEdges: orientEdges,
    orientProduct: orientProduct,
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SMPOrientation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
