#!/usr/bin/env python3
"""Build the SPREADSHEET-INFERRED test catalogue for the Generator.

    python3 scripts/build-test-catalogue.py "sterling products.xls" "sterling products 2.xlsx"

WHAT THIS IS
------------
A static TEST inventory, built from two Sterling product spreadsheets, so the
Generator can be exercised against a broad range of real Sterling part numbers
and realistic dimensions before we have live designCentral access.

WHAT THIS IS NOT
----------------
It is NOT a reproduction of designCentral. Every technical value it produces
beyond the part number and the description is INFERRED, and every record it
emits is stamped `authoritative: false` / `technicalDataStatus: "inferred-test"`.
The one CMS-verified record (6505 / BCDP-CM) lives in data/sterling-products.json
and is NOT produced here.

Commercial data (price, cost, margin) is present in both spreadsheets and is
deliberately never read into the output.

The inference rules below are TEST-ONLY and live here, in the spreadsheet layer,
so that a live SterlingProductProvider can replace all of them without the
Generator UI changing.
"""
import sys, os, re, json, collections, datetime

DPI = 96
MM_PER_IN = 25.4

# ── TEST-ONLY defaults ───────────────────────────────────────────────────
# None of these are Sterling values. They mirror what the Generator already
# assumes today so inferred products behave like the existing demo path.
TEST_BLEED_PX      = 12   # 0.125in @96dpi — the Generator's existing print bleed
TEST_MARGIN_PX     = 6    # half the bleed — matches the verified BCDP-CM record
TEST_NO_BLEED_PX   = 0    # stamps and non-print products
DEFAULT_PAGES      = 1

# Products the Generator can plausibly design. Order matters: first hit wins.
FAMILY_RULES = [
    # Postcards first: "Postcards - Double Sided" would otherwise be swept into
    # the Business Card family and inherit its 3.5x2 default.
    ('Postcard',      r'\bpost ?cards?\b|\brack cards?\b|\bgreeting cards?\b'),
    ('Business Card', r'business card|bus\.? cards?|bus cards'),
    ('Stamp',         r'prostamp|self[- ]inking|self inking|trodat|printy|xstamper|'
                      r'\bdater\b|numberer|\bstamp\b|pre[- ]inked|rubber stamp'),
    ('Banner',        r'\bbanner\b'),
    ('Poster',        r'\bposter\b'),
    ('Sign',          r'\bsign\b|\bsignage\b|coroplast|sandwich board|a[- ]frame'),
    ('Decal',         r'\bdecals?\b|vinyl lettering|window cling'),
    ('Nameplate',     r'name ?plate|desk plate|door plate|wall plate'),
    ('Name Badge',    r'name ?badge|\bbadge\b|name ?tag'),
    ('Label',         r'\blabels?\b'),
    ('Magnet',        r'\bmagnets?\b|magnetic sign'),
]

# High-confidence NON-designer products. Anything matching is dropped.
EXCLUDE = [
    ('ink & pads',   r'\bink pad|replacement pad|\bre[- ]?ink|ink bottle|\bink\b(?!.*stamp)|'
                     r'\bpad\b|\bcartridge\b|\btoner\b'),
    ('holders',      r'\bholder\b|\bframe\b|\beasel\b|\bstand\b(?! ?up sign)|\bsleeve\b'),
    ('fasteners',    r'\bfastener|\bgrommet|\bscrew|\bbracket|\bclip\b|\bchain\b|\bhook\b|'
                     r'\bwire\b|\bpin\b|\blanyard\b|\bmagnet backing\b|\bhardware\b'),
    ('stakes',       r'\bstake\b|\bh[- ]?frame\b|\bpost\b'),
    ('tools',        r'\bpunch\b|\bdie\b|\bplier|\bembosser\b|\bcrimper\b|\bhandle\b|'
                     r'\bcleaner\b|\bbrush\b|\bmount\b|\bblank\b'),
    ('stock stamps', r'stock stamp|\bstock\b.*stamp|message stamp|\bdater band\b|\bband\b'),
    ('engraved',     r'engrav|\bplastic plate\b|\bacrylic block\b'),   # out of Generator scope
    ('accessories',  r'\baccessor|\bkit\b|\brefill\b|\bcase\b|\bbox\b|\bpackage of\b|'
                     r'\bper package\b|\breplacement\b|\bspare\b'),
    ('withdrawn',    r'do not use|discontinued|obsolete|\bn/?a\b$'),
]

# Trailing hardware/finishing mentions. A product that merely SHIPS with these
# is still the product, so they are removed before the exclusion scan.
INCIDENTAL = re.compile(
    r'\b(?:c/w|with|and|w/|complete with|incl(?:udes|uding)?)\s+'
    r'(?:\d+\s*(?:oz|gauge|guage|mil|ga)\.?\s+)?'
    r'(?:high\s+|heavy\s+duty\s+)?'
    r'(?:grommets?|pin ?backs?|hems?|wire|holes?|adhesive|magnet(?:ic)? backing|'
    r'stands?|hooks?|chains?|clips?|tape|velcro|suction cups?)\b',
    re.I)

# TEST-ONLY standard sizes for families where every product shares one, used
# only when no dimension can be parsed from any description.
FAMILY_DEFAULT_IN = {
    'Business Card': (3.5, 2.0),
}

# ── dimension parsing ────────────────────────────────────────────────────
# A number, optionally a mixed fraction. The hyphen form must be UNSPACED
# ("1-1/2"), because a spaced hyphen is a dash in Sterling part text:
# "F10 - 1/2\" x 1-5/8\"" must read 1/2, not 10.5. The leading lookbehind stops
# a match starting inside a part number: without the '#', "ProStamp #1438 1/2\""
# reads as the mixed number 1438 1/2 rather than the 1/2 inch it means.
FRACT = r'(?<![\w/.#-])\d+(?:\s+\d+/\d+|-\d+/\d+|/\d+|\.\d+)?'
RE_IN = re.compile(rf'({FRACT})\s*(?:"|”|\bin\b|\binch(?:es)?\b)?\s*[xX×]\s*({FRACT})\s*(?:"|”|\bin\b|\binch(?:es)?\b)', re.I)
RE_IN_LOOSE = re.compile(rf'({FRACT})\s*(?:"|”)\s*[xX×]\s*({FRACT})\s*(?:"|”)?', re.I)
RE_MM = re.compile(r'(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm', re.I)
RE_ROUND_IN = re.compile(rf'({FRACT})\s*(?:"|”|\bin\b)?\s*(?:dia(?:meter)?|round|circle)', re.I)
RE_ROUND_MM = re.compile(r'(\d+(?:\.\d+)?)\s*mm\s*(?:dia(?:meter)?|round|circle)', re.I)
# LAST RESORT, unitless: "5x7", "3.5x2". Only used when no unit-bearing pattern
# matched and the text never mentions mm, and only if both numbers land in a
# plausible inch range. Sterling writes plenty of sizes this way.
RE_BARE = re.compile(rf'({FRACT})\s*[xX×]\s*({FRACT})(?!\s*[xX×])', re.I)

def to_float(tok):
    """'1 1/2' / '1-1/2' / '3.5' / '1/2' -> float."""
    t = str(tok).strip().replace('–', '-')
    m = re.fullmatch(r'(\d+)\s*[-\s]\s*(\d+)\s*/\s*(\d+)', t)
    if m:
        w, n, d = (float(x) for x in m.groups())
        return w + n / d if d else None
    m = re.fullmatch(r'(\d+)\s*/\s*(\d+)', t)
    if m:
        n, d = (float(x) for x in m.groups())
        return n / d if d else None
    try:
        return float(t)
    except ValueError:
        return None

def parse_dims(text):
    """-> (widthIn, heightIn, unitSeen, shape, matchedText) or None."""
    if not text:
        return None
    t = re.sub(r'\s+', ' ', str(text))
    m = RE_ROUND_MM.search(t)
    if m:
        d = to_float(m.group(1))
        if d: return (d / MM_PER_IN, d / MM_PER_IN, 'mm', 'circle', m.group(0))
    m = RE_ROUND_IN.search(t)
    if m:
        d = to_float(m.group(1))
        if d: return (d, d, 'in', 'circle', m.group(0))
    m = RE_MM.search(t)
    if m:
        w, h = to_float(m.group(1)), to_float(m.group(2))
        if w and h: return (w / MM_PER_IN, h / MM_PER_IN, 'mm', 'rect', m.group(0))
    for rx in (RE_IN, RE_IN_LOOSE):
        m = rx.search(t)
        if m:
            w, h = to_float(m.group(1)), to_float(m.group(2))
            if w and h: return (w, h, 'in', 'rect', m.group(0))
    if not re.search(r'\bmm\b|\bcm\b', t, re.I):
        m = RE_BARE.search(t)
        if m:
            w, h = to_float(m.group(1)), to_float(m.group(2))
            if w and h and plausible(w, h):
                return (w, h, 'in-bare', 'rect', m.group(0))
    return None

PLAUSIBLE_MIN_IN = 0.25      # smaller than a small stamp die
PLAUSIBLE_MAX_IN = 240.0     # 20 feet — banners get large

def plausible(w, h):
    return (w and h and PLAUSIBLE_MIN_IN <= w <= PLAUSIBLE_MAX_IN
            and PLAUSIBLE_MIN_IN <= h <= PLAUSIBLE_MAX_IN)

def classify(text):
    t = (text or '').lower()
    for fam, rx in FAMILY_RULES:
        if re.search(rx, t): return fam
    return None

def excluded_reason(text):
    t = (text or '').lower()
    for reason, rx in EXCLUDE:
        if re.search(rx, t): return reason
    return None

# ── readers ──────────────────────────────────────────────────────────────
def undate(v):
    """Excel turns part numbers like "9-1-31" or "1-31" into dates. Recover the
    literal the user typed, using Excel's own parsing rules in reverse:
      m-d      -> a date in the CURRENT year
      m-d-yy   -> that explicit year
    Anything else is left alone."""
    if isinstance(v, datetime.datetime) or isinstance(v, datetime.date):
        y, m, d = v.year, v.month, v.day
        now = datetime.date.today().year
        if y in (now, now - 1, now + 1):
            return f'{m}-{d}'
        return f'{m}-{d}-{str(y)[-2:]}'
    return v

def read_xls(path):
    import xlrd
    sh = xlrd.open_workbook(path).sheet_by_index(0)
    hdr = [str(sh.cell_value(1, c)).strip() for c in range(sh.ncols)]
    out = []
    for r in range(2, sh.nrows):
        row = {}
        for c in range(sh.ncols):
            v = sh.cell_value(r, c)
            if sh.cell_type(r, c) == xlrd.XL_CELL_DATE:
                v = undate(datetime.datetime(*xlrd.xldate_as_tuple(v, 0)))
            row[hdr[c]] = str(v).strip()
        out.append(row)
    return out

def read_xlsx(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    out = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row or not row[0]:
            continue
        out.append({
            'XREF': str(undate(row[0]) or '').strip(),
            'Parent': str(undate(row[1]) or '').strip(),
            'XREFDesc': str(row[6] or '').strip(),
            'PartDesc': str(row[7] or '').strip(),
        })
    return out

# ── build ────────────────────────────────────────────────────────────────
def build(xls_path, xlsx_path):
    stats = collections.Counter()
    xls, xlsx = read_xls(xls_path), read_xlsx(xlsx_path)
    stats['xls_rows'] = len(xls)
    stats['xlsx_rows'] = len(xlsx)

    # base part -> merged evidence
    parts = {}

    def touch(base):
        if base not in parts:
            parts[base] = {'partNumber': base, 'names': [], 'texts': [], 'skus': set(),
                           'sources': set()}
        return parts[base]

    # sheet 1: `product` is the base, `Sterling Part Number` the SKU
    for x in xls:
        base = x.get('product', '').strip()
        if not base:
            continue
        rec = touch(base)
        rec['sources'].add('xls')
        for k in ('Description', 'Business System Description'):
            v = x.get(k, '').strip()
            if v:
                rec['texts'].append(v)
                if k == 'Description':
                    rec['names'].append(v)
        sku = x.get('Sterling Part Number', '').strip()
        if sku and sku != base:
            rec['skus'].add(sku)
        xref = x.get('XrefParentPart', '').strip()
        if xref and xref != base:
            rec['skus'].add(xref) if xref.startswith(base) else None

    # sheet 2: `Parent` is the base, `XREF` the SKU
    for x in xlsx:
        base = x['Parent'] or x['XREF']
        if not base:
            continue
        rec = touch(base)
        rec['sources'].add('xlsx')
        for v in (x['XREFDesc'], x['PartDesc']):
            v = re.sub(r'^\d+\*', '', v).strip()      # strip the "999*" business prefix
            if v and v.lower() != 'none':
                rec['texts'].append(v)
                rec['names'].append(v)
        if x['XREF'] and x['XREF'] != base:
            rec['skus'].add(x['XREF'])

    # ── collapse pass ────────────────────────────────────────────────
    # A part that another base lists as one of its SKUs is a VARIATION, not a
    # product, even if a sheet also gave it a self-parent row. B14381/2/3 are
    # colour variations of B1438 and must not become three Generator products.
    # Roots are resolved by walking sku->base until a fixed point, guarding
    # against the cycles imperfect spreadsheet data can produce.
    sku_owner = {}
    for base, rec in parts.items():
        for sku in rec['skus']:
            if sku == base or sku not in parts:
                continue
            owner = sku_owner.get(sku)
            # Prefer the shortest owner, ties broken lexicographically, so the
            # choice is deterministic regardless of iteration order.
            if owner is None or (len(base), base) < (len(owner), owner):
                sku_owner[sku] = base

    def root_of(part):
        seen, cur = set(), part
        while cur in sku_owner and cur not in seen:
            seen.add(cur)
            nxt = sku_owner[cur]
            if nxt == cur or nxt in seen:
                break
            cur = nxt
        return cur

    collapsed = 0
    for part in list(parts.keys()):
        r = root_of(part)
        if r == part or r not in parts:
            continue
        victim = parts.pop(part)
        keeper = parts[r]
        keeper['texts'].extend(victim['texts'])
        keeper['names'].extend(victim['names'])
        keeper['skus'].add(part)
        keeper['skus'].update(victim['skus'])
        keeper['sources'].update(victim['sources'])
        collapsed += 1
    stats['collapsed_variation_parts'] = collapsed

    stats['unique_base_parts'] = len(parts)
    stats['collapsed_skus'] = sum(len(p['skus']) for p in parts.values())

    products, rejected = [], collections.Counter()
    for base, rec in sorted(parts.items()):
        blob = ' | '.join(dict.fromkeys(rec['texts']))
        if not blob:
            rejected['no description'] += 1
            continue

        # Incidental trailing phrases must not trigger an exclusion: a banner
        # "with grommets" is still a banner, a nameplate "c/w pinback" is still
        # a nameplate. Strip them before deciding what the product IS.
        scan = INCIDENTAL.sub(' ', blob)
        reason = excluded_reason(scan)
        family = classify(blob)

        # Best dimension across every description we have; prefer the most
        # complete match (longest matched substring), then explicit units.
        best = None
        for t in dict.fromkeys(rec['texts']):
            d = parse_dims(t)
            if not d or not plausible(d[0], d[1]):
                continue
            score = (len(d[4]), 1 if d[2] == 'in' else 0)
            if best is None or score > best[0]:
                best = (score, d, t)

        if reason:
            rejected[reason] += 1
            continue
        if not family:
            rejected['no designer family'] += 1
            continue

        if best:
            _, (w_in, h_in, unit, shape, matched), src_text = best
        else:
            # TEST-ONLY family default, used only where the family has one
            # standard size. Business cards are 3.5x2in, corroborated by the
            # CMS-verified BCDP-CM record. Flagged as a family default so it is
            # never mistaken for a parsed or authoritative value.
            fam_default = FAMILY_DEFAULT_IN.get(family)
            if not fam_default:
                rejected['no usable dimensions'] += 1
                continue
            w_in, h_in = fam_default
            unit, shape, matched, src_text = 'family-default', 'rect', '', ''
            stats['family_default_dimensions'] += 1
        name = max((n for n in rec['names'] if n), key=len, default=base)

        products.append({
            'partNumber': base,
            'name': name[:120],
            'productFamily': family,
            'widthIn': round(w_in, 4),
            'heightIn': round(h_in, 4),
            'shape': shape,
            'sourceUnit': unit,
            'sourceText': src_text[:160],
            'matched': matched,
            'skuCount': len(rec['skus']),
            'skus': sorted(rec['skus'])[:12],
            'sources': sorted(rec['sources']),
        })

    stats['products'] = len(products)
    return products, stats, rejected

def to_catalogue_record(p, index):
    """Clean-API record shape + explicit test metadata."""
    w_px = round(p['widthIn'] * DPI)
    h_px = round(p['heightIn'] * DPI)
    fam = p['productFamily']
    is_stamp = fam == 'Stamp'
    is_print = not is_stamp

    # TEST-ONLY inference, documented in the module docstring.
    # Stamps infer GRAYSCALE, not SingleColour. The one verified Sterling stamp
    # we have (B1438 / ProStamp) carries a CMS designer variation of Grayscale,
    # and no normal current Sterling product is known to use SingleColour. The
    # Generator draws stamp artwork monochromatically and Sterling picks the ink
    # colour downstream, so Grayscale is also the behaviour that matches what
    # the Generator actually produces. SingleColour remains supported by the
    # legacy adapter for compatibility; it is simply never inferred here.
    bleed = TEST_NO_BLEED_PX if is_stamp else TEST_BLEED_PX
    margin = 0 if is_stamp else TEST_MARGIN_PX
    pages = 2 if fam == 'Business Card' else DEFAULT_PAGES
    landscape = p['widthIn'] >= p['heightIn']

    return {
        # Synthetic NEGATIVE id: designCentral ids are positive AUTO_INCREMENT,
        # so a negative value can never be mistaken for one, and never collides.
        'id': -(1000 + index),
        'partNumber': p['partNumber'],
        'name': p['name'],
        'productFamily': fam,
        'dimensions': {
            'widthIn': p['widthIn'], 'heightIn': p['heightIn'], 'dpi': DPI,
            'displayUnit': 'in',
            'widthDisplay': str(p['widthIn']), 'heightDisplay': str(p['heightIn']),
        },
        'bleed': {'top': bleed, 'right': bleed, 'bottom': bleed, 'left': bleed},
        'pages': {'min': pages, 'max': pages},
        'shape': p['shape'],
        'orientation': {'landscapeAvailable': landscape or True,
                        'portraitAvailable': (not landscape) or True},
        'maxLines': 0,
        'status': {'active': True, 'retired': False},
        'legacy': {
            # 3 -> FullColour (PROVEN); 2 -> Grayscale (INFERRED, flagged
            # unproven by the contract). The mode is derived from this code by
            # the same normalizer the future API will use.
            'designerVariationCode': 3 if is_print else 2,
            'margins': {'top': margin, 'right': margin, 'bottom': margin, 'left': margin},
            'borders': {'top': 0, 'right': 0, 'bottom': 0, 'left': 0, 'width': 0},
            'daterBox': {'width': 0, 'height': 0},
            'isProStamp': is_stamp,
            'greenInkAvailable': False,
            'bandString': '', 'clipPaths': [], 'clipPathOverlays': [],
        },
        'availability': {'customizable': True, 'isAccessory': False},
        'test': {
            'technicalDataStatus': 'inferred-test',
            'canvasPx': [w_px, h_px],
            'dimensionSource': p['sourceUnit'],
            'dimensionMatchedText': p['matched'],
            'dimensionFromDescription': p['sourceText'],
            'collapsedSkuCount': p['skuCount'],
            'collapsedSkus': p['skus'],
            'spreadsheets': p['sources'],
            'designerModeRule': 'print -> FullColour (code 3, proven); '
                                'stamp -> Grayscale (code 2, inferred). '
                                'SingleColour is never inferred.',
            'inferred': ['dimensions', 'shape', 'pages', 'bleed', 'margins',
                         'designerMode', 'orientation', 'id'],
        },
    }

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    products, stats, rejected = build(sys.argv[1], sys.argv[2])
    records = [to_catalogue_record(p, i) for i, p in enumerate(products)]
    out = {
        '_README': 'SPREADSHEET-INFERRED TEST INVENTORY. Not authoritative. Generated by '
                   'scripts/build-test-catalogue.py from two Sterling product spreadsheets.',
        '_provenance': {
            'status': 'inferred-test',
            'authoritative': False,
            'whatThisIs': 'A static test inventory so the Generator can be exercised against a '
                          'broad range of REAL Sterling part numbers and REALISTIC dimensions '
                          'before live designCentral access exists.',
            'whatThisIsNot': 'It is NOT designCentral and does not reproduce it. Part numbers, '
                             'names and the SKU/parent relationships come from the spreadsheets. '
                             'Everything else - dimensions, shape, pages, bleed, margins, '
                             'designer mode, orientation and the id - is INFERRED by test-only '
                             'rules documented in the builder.',
            'ids': 'Synthetic and NEGATIVE. designCentral ids are positive AUTO_INCREMENT, so a '
                   'negative id can never be mistaken for or collide with a real one. Inferred '
                   'products therefore contribute no productList entry to a pushed package; '
                   'their real part number still travels.',
            'commercialData': 'Both spreadsheets contain price, e-price and cost columns. None '
                              'of it is read by the builder or present in this file.',
            'verifiedRecordsElsewhere': 'The CMS-verified record (6505 / BCDP-CM) lives in '
                                        'data/sterling-products.json and is not produced here.',
            'replacement': 'A live SterlingProductProvider replaces every inferred value without '
                           'the Generator UI changing. The inference rules live only in the '
                           'builder and the catalogue provider.',
            'dpiConvention': 'px = inches * 96; mm converted as mm * 96 / 25.4.',
            'generatedFrom': [os.path.basename(sys.argv[1]), os.path.basename(sys.argv[2])],
        },
        'products': records,
    }
    dest = os.path.join(os.path.dirname(__file__), '..', 'data', 'sterling-test-catalogue.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write('\n')

    print(f'wrote {len(records)} products -> {os.path.normpath(dest)}')
    print('\n--- stats ---')
    for k, v in sorted(stats.items()):
        print(f'  {k:28s} {v}')
    print('\n--- rejected ---')
    for k, v in rejected.most_common():
        if v: print(f'  {k:28s} {v}')
    fam = collections.Counter(r['productFamily'] for r in records)
    print('\n--- families ---')
    for k, v in fam.most_common():
        print(f'  {k:28s} {v}')

if __name__ == '__main__':
    main()
