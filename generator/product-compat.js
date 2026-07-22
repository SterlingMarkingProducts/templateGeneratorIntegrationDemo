/* Product compatibility engine — TEST DATA ONLY.
 *
 * Classifies Sterling products against a pushed design's dimensions using the
 * four-tier model agreed for the designer integration:
 *   exact      — same finished size, orientation, and colour/production mode
 *   compatible — same usable design area, different material/finish/process
 *   adaptable  — different size but same (or rotated) aspect ratio within tolerance
 *   selectable — substantially different shape; user may pick it but must rearrange
 *
 * The catalog below is a stand-in for staging rows from designCentral
 * (productTemplateMap / stampinfo). Every product number is prefixed TEST- so
 * records can never be confused with production parts. When Sterling IT
 * provides a staging catalog endpoint, replace TEST_PRODUCT_CATALOG with a
 * fetch of that endpoint and keep classifyProduct/recommendProducts unchanged.
 */

const COMPAT_TOLERANCE = {
  exactDimPct: 0.02,      // ≤2% off in both dimensions still counts as the same finished size
  adaptableAspectPct: 0.05, // ≤5% aspect-ratio difference scales cleanly
};

/* Dimensions in inches (finished size). bleedIn = required bleed per edge.
 * mode mirrors designerVariationCode in the live designer. */
const TEST_PRODUCT_CATALOG = [
  { number: 'TEST-BC-001',  name: 'Standard Business Card',    category: 'Business Cards', material: 'Matte 14pt stock',   w: 3.5,  h: 2,      mode: 'FullColour',     bleedIn: 0.125, doubleSided: true },
  { number: 'TEST-BC-002',  name: 'Gloss Business Card',       category: 'Business Cards', material: 'Gloss UV 16pt',      w: 3.5,  h: 2,      mode: 'FullColour',     bleedIn: 0.125, doubleSided: true },
  { number: 'TEST-BC-003',  name: 'Raised-Ink Business Card',  category: 'Business Cards', material: 'Thermographed',      w: 3.5,  h: 2,      mode: 'SingleColour',   bleedIn: 0,     doubleSided: false },
  { number: 'TEST-LBL-001', name: 'Square Label',              category: 'Labels',         material: 'Vinyl',              w: 3,    h: 3,      mode: 'FullColour',     bleedIn: 0.0625, doubleSided: false },
  { number: 'TEST-SGN-001', name: '12x16 Acrylic Sign',        category: 'Signs',          material: 'Acrylic',            w: 12,   h: 16,     mode: 'FullColour',     bleedIn: 0.25,  doubleSided: false },
  { number: 'TEST-SGN-002', name: '12x16 Coroplast Sign',      category: 'Signs',          material: 'Coroplast',          w: 12,   h: 16,     mode: 'FullColour',     bleedIn: 0.25,  doubleSided: false },
  { number: 'TEST-SGN-003', name: '18x24 PVC Sign',            category: 'Signs',          material: 'PVC',                w: 18,   h: 24,     mode: 'FullColour',     bleedIn: 0.25,  doubleSided: false },
  { number: 'TEST-NP-001',  name: 'Executive Desk Nameplate',  category: 'Nameplates',     material: 'Engraved plastic',   w: 8,    h: 2,      mode: 'EngravedPlastic', bleedIn: 0,    doubleSided: false },
  { number: 'TEST-STP-001', name: 'Self-Inking Stamp 2.25in',  category: 'Stamps',         material: 'Rubber die',         w: 2.25, h: 0.8125, mode: 'SingleColour',   bleedIn: 0,     doubleSided: false },
  { number: 'TEST-PST-001', name: '18x24 Poster',              category: 'Posters',        material: '100lb gloss text',   w: 18,   h: 24,     mode: 'FullColour',     bleedIn: 0.125, doubleSided: false },
];

function pctDiff(a, b) {
  return Math.abs(a - b) / Math.max(a, b);
}

function orientationOf(w, h) {
  if (Math.abs(w - h) < 1e-6) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

/* design: { widthIn, heightIn, mode, doubleSided } */
function classifyProduct(design, product) {
  const reasons = [];
  const warnings = [];
  const dOrient = orientationOf(design.widthIn, design.heightIn);
  const pOrient = orientationOf(product.w, product.h);
  const dAspect = design.widthIn / design.heightIn;
  const pAspect = product.w / product.h;
  const rotatedAspect = product.h / product.w;

  const sameSize = pctDiff(design.widthIn, product.w) <= COMPAT_TOLERANCE.exactDimPct
                && pctDiff(design.heightIn, product.h) <= COMPAT_TOLERANCE.exactDimPct;
  const sameAspect = pctDiff(dAspect, pAspect) <= COMPAT_TOLERANCE.adaptableAspectPct;
  const rotatedMatch = pctDiff(dAspect, rotatedAspect) <= COMPAT_TOLERANCE.adaptableAspectPct;

  const modeMatches = design.mode === product.mode;
  if (!modeMatches) {
    if (product.mode === 'SingleColour') warnings.push('This product prints in one ink colour — full-colour elements will be converted.');
    if (product.mode === 'EngravedPlastic') warnings.push('Engraved product — photos and colour fills are not supported; text and line art only.');
    if (product.mode === 'Grayscale') warnings.push('This product prints in greyscale.');
  }
  if (design.doubleSided && !product.doubleSided) warnings.push('Your design has two sides but this product is single-sided; only the front will be used.');
  if (product.bleedIn > 0) warnings.push(`Requires ${product.bleedIn}" bleed on each edge — background must extend past the cut line.`);

  let tier;
  if (sameSize && dOrient === pOrient && modeMatches) {
    tier = 'exact';
    reasons.push(`Same ${product.w}" × ${product.h}" finished size and print mode.`);
  } else if (sameSize && dOrient === pOrient) {
    tier = 'compatible';
    reasons.push('Same finished size; different printing method.');
  } else if (sameAspect && dOrient === pOrient) {
    tier = 'adaptable';
    reasons.push(`Same proportions — scales cleanly from ${design.widthIn}" × ${design.heightIn}" to ${product.w}" × ${product.h}".`);
  } else if (rotatedMatch) {
    tier = 'adaptable';
    reasons.push('Same proportions when rotated 90°.');
    warnings.push('The design will be rotated to fit this product.');
  } else {
    tier = 'selectable';
    reasons.push(`Different shape (${product.w}" × ${product.h}") — the layout will need rearranging.`);
    warnings.push('Aspect ratio differs: text may reflow and images may need repositioning or cropping.');
  }

  return { product, tier, reasons, warnings,
           scale: Math.min(product.w / design.widthIn, product.h / design.heightIn) };
}

function recommendProducts(design, catalog = TEST_PRODUCT_CATALOG) {
  const results = catalog.map(p => classifyProduct(design, p));
  const rank = { exact: 0, compatible: 1, adaptable: 2, selectable: 3 };
  results.sort((a, b) => rank[a.tier] - rank[b.tier]);
  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEST_PRODUCT_CATALOG, classifyProduct, recommendProducts, orientationOf, COMPAT_TOLERANCE };
}
