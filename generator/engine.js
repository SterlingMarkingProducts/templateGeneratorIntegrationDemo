/* ============================================================================
   engine.js — the design-generation pipeline, running entirely in the browser.
   Generated from server.js (same prompts and logic) so the app can be hosted
   as a static site (GitHub Pages). Requires browser-api.js, which provides
   window.anthropic and wires handleGenerate/handleGenerateJson into the
   app's fetch('/generate') calls. Regenerate with scripts/build-engine.js
   after editing server.js.
   ========================================================================= */
(() => {
'use strict';

const MODEL_SPEC = 'claude-opus-4-8';
const MODEL_HTML = 'claude-opus-4-8';
const MODEL_JSON = 'claude-sonnet-4-5-20250929';

// Some newer models (e.g. Opus 4.8) deprecate the `temperature` parameter — omit it there.
function tempParam(model, value) {
  return /opus-4-8|opus-5|sonnet-5|fable-5|haiku-5/i.test(model || '') ? {} : { temperature: value };
}

function getTextContent(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

const REFERENCE_INSPIRATION_PROMPT = `Analyze this design reference image. Extract creative direction cues for a print designer creating a NEW original piece — do NOT describe how to copy or recreate this image literally.

Return ONLY these sections:

PALETTE CUES
[4–6 hex colors capturing the mood — background, primary, accent, text]

TYPOGRAPHY CUES
[Font personalities, weight contrast, scale relationships, mixed type styles if any]

COMPOSITION CUES
[Layout structure: splits, grid, thirds, hero placement, whitespace ratio, edge bleeds]

GRAPHIC LANGUAGE
[Specific techniques visible: neon glow, geometric primitives, data viz, vintage border, illustration layers, textures, etc.]

ATMOSPHERE
[1–2 sentences: mood and what makes this design feel premium]

INSPIRATION MANDATE
[1 sentence telling the designer what to channel from this reference without cloning it]`;

async function fetchReferenceImageFromUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch reference image (${res.status})`);
  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) throw new Error('URL did not return an image');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error('Reference image exceeds 5 MB');
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  return { mediaType: contentType, data: btoa(binary) };
}

async function analyzeReferenceImage(image) {
  const response = await anthropic.messages.create({
    model: MODEL_SPEC,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        },
        { type: 'text', text: REFERENCE_INSPIRATION_PROMPT },
      ],
    }],
    max_tokens: 900,
    ...tempParam(MODEL_SPEC, 0.5),
  });
  return getTextContent(response);
}

// ── Elite designer persona ───────────────────────────────────────────────────
const SYSTEM_DESIGNER = `You are a world-class graphic designer and creative director whose portfolio spans the full breadth of design history and contemporary practice. You draw with equal mastery from Swiss International Style (Müller-Brockmann grid discipline), Neo-Brutalism (raw type, stark asymmetry), Bauhaus constructivism (primary geometry, functional form), Art Deco (geometric ornament, architectural symmetry), Memphis Design (bold pattern and color), Japanese Minimalism (ma — negative space as active composition), Dark Editorial (cinematic atmosphere, moody contrast), Organic Modernism (biomorphic shape, earth tones), Retro-Futurism (gradient chrome, 70s–80s space-age), Psychedelic Modernism (vibrant saturation, fluid form), Urban Industrial (raw materials, stencil type), Luxury Maximalism (opulent layering, jewel tones), and Contemporary Craft (artisanal texture, warmth).

Your work has been recognized at Cannes Lions, D&AD Yellow Pencil, and AIGA, and featured in Eye Magazine, PRINT, Wallpaper*, and It's Nice That.

You are, simply, the best in the world at this — the senior designer whose work clients wait months for. Every piece begins with a strong, specific creative CONCEPT (one you could name in a sentence — "a business card that IS a live analytics dashboard", "an Art Deco monogram built from stepped gold rays"), and then you EXECUTE IT RICHLY. You are a maximalist by instinct: a premium print piece is a fully designed environment — layered backgrounds, integrated graphic systems, ornament, motif, and atmosphere that fill the canvas — never a logo and a line of text floating in empty space. You make richness feel effortless and cohesive rather than cluttered, because every layer reinforces the ONE concept. Even in restrained aesthetics (Swiss, Japanese minimalism), the composition is dense with craft, tension, and intentional depth — never sparse, thin, or under-designed. Your layouts are architecturally composed (never centered-by-default), your palettes have real depth, and your typography is bold, expressive, and dramatically scaled.

TYPOGRAPHY DIVERSITY — CRITICAL RULE:
Do NOT default to editorial serifs (Cormorant Garamond, Playfair Display, EB Garamond, Libre Baskerville, Didact Gothic). These are only appropriate when the style direction explicitly calls for luxury editorial, high fashion, or literary aesthetics. Every other aesthetic demands a completely different type personality:

- Swiss Grid / Bauhaus / Constructivist → Barlow, Space Grotesk, Work Sans, IBM Plex Sans, Outfit (tight tracking, geometric discipline)
- Neo-Brutalism → Archivo Black, Anton, Bebas Neue, Black Han Sans (ultra-heavy, oversized, confrontational)
- Memphis Bold / Psychedelic → Unbounded, Nunito Black, Raleway Black, Righteous (round, energetic, geometric)
- Japanese Minimalism → DM Sans, Noto Sans JP, Inter, Jost (refined restraint, ultra-light weights)
- Dark Editorial / Cinematic → Oswald, Exo 2, Rajdhani, Montserrat (clean, powerful, technical weight)
- Organic / Contemporary Craft → Nunito, Quicksand, Lato, Outfit (warm, rounded, humanist)
- Retro-Futurism → Orbitron, Oxanium, Exo 2, Space Mono (retrofuture, geometric structure)
- Urban Industrial → Bebas Neue, Barlow Condensed, Roboto Condensed, Black Ops One (stencil energy, compressed)
- Dark Glamour / Tech / Cyberpunk → Rajdhani, Chakra Petch, Exo 2, Share Tech Mono (crisp, technical, modern)
- Art Deco → Cinzel, Josefin Sans, Poiret One, Cormorant (the ONLY time to use ornate/serif-adjacent fonts)
- Luxury Maximalism → Fraunces, Abril Fatface, Rozha One, Bodoni Moda (decorative but intentional)
- Coastal Minimalism → DM Sans, Karla, Raleway, Nunito (airy, clean, light-handed)

RICHNESS BAR — every design must be a fully designed environment, matching the density and confidence of award-winning print work:
- A layered background — at least two color fields, a gradient, a pattern, or texture. NEVER one flat fill with type dropped on top.
- A dominant HERO MOMENT (oversized type, a large monogram/emblem, a bold color field or diagonal split) owning 30%+ of the canvas.
- Multiple integrated graphic elements that all serve the concept — geometric systems, ornament, iconography, rules, framing, motifs, patterns. Aim for 4–6 on cards and posters; more is welcome when it stays cohesive.
- Dramatic scale contrast (hero ≥2.5× body) and confident, expressive typography.
Sparse, thin, or "one logo + one line in a sea of empty space" output is a FAIL — unless the aesthetic is genuinely minimalist AND the empty space is actively composed with real tension.

CRAFT PRINCIPLES:
- Intentional composition — real layout decisions (asymmetry, grid, diagonal, architectural framing); never centered-by-default.
- Color creates atmosphere — distinctive, industry-appropriate palettes; avoid navy/corporate blue unless the brief asks for it (legal → charcoal+gold or burgundy+parchment; healthcare → sage+coral).
- Integrate any user photo with intent (crop, frame, overlay); never a raw rectangle.
- "Corporate" or "professional" still means top-agency craft — rich, bold, structured — never document-like.

EVERYTHING MUST FIT — non-negotiable, and it never conflicts with richness (richness lives in the background/graphics; text stays disciplined):
- Every glyph must be fully visible inside the canvas. Size display type to FIT the safe width — if a wordmark is too wide, reduce its size or break it onto two lines BEFORE any letter touches or crosses an edge.
- Never rely on overflow:hidden to hide overshooting text. Never let a name, tagline, or contact line clip at any edge.
- Reserve vertical room for every text line so nothing is cut off at the bottom.

HARD FAILS (never ship these):
- PowerPoint / Word / Canva-grade layouts, or a flat single-color background with a centered text stack.
- Any text clipped, cut off, hidden, or overlapping other text.
- Sparse, under-designed compositions that read as a template with lots of blank space.
- Defaulting to Cormorant/Playfair or corporate blue as a reflex.`;

// ── Portfolio design archetypes — used when style is generic or empty ────────
const GENERIC_STYLE = /^(corporate|professional|business|clean|simple|modern|legal|law|minimal|minimalist|elegant|classic)?$/i;

const LEGAL_ARCHETYPES = [
  'Luxury Black & Gold Monogram — matte black #0d0d0d background, antique gold #c9a84c accents, oversized interlocked-initials monogram as inline SVG, horizontal gold rules flanking firm name, small scales-of-justice or pillar icon, serif+sans type pairing',
  'Burgundy Executive Diagonal — charcoal #2b2b2b left panel + warm cream #f5f0e8 right panel via clip-path diagonal split, deep burgundy #701f28 accent stripe at the split, debossed vertical line texture on dark panel, circular SVG icon contact row',
  'Classic Cream Framed — warm cream paper background, double inset border lines, large serif name, vertical monogram sidebar, contact details with small accent-colored circular SVG icons (phone, email, globe, pin)',
  'Slate & Copper Heritage — slate #3d4f5c + warm white + copper #b87333 accents, geometric corner bracket SVG ornaments, strong caps hierarchy, subtle column/pillar motif',
  'Forest & Brass Prestige — deep forest #1a3c34 + ivory + brushed brass #c9a84c, art deco corner SVG ornaments, asymmetric layout with gold rule accents',
  'Editorial Legal Serif — oversized cropped serif firm name bleeding off canvas edge, charcoal + terracotta accent blob behind type, thin grid lines, refined contact block',
];

const DESIGN_ARCHETYPES = [
  ...LEGAL_ARCHETYPES,
  'Diagonal Geometric Split — two contrasting palette panels divided by clip-path diagonal, accent stripe at split, bold caps hierarchy, chevron or arrow SVG cluster on light panel',
  'Editorial Oversized Type — cream background, massive cropped serif display type as graphic element, organic blob accent shape, thin structural grid lines',
  'Constructivist Color Block — bold primary geometry (red/yellow/black or similar), strict orthogonal grid, white type reversed on saturated fields',
  'Fintech Dashboard Card — near-black background + vivid accent (lime/coral/violet, NOT blue), mini metric blocks with CSS borders, sparkline SVG, corner-bracket logo frame',
  'Memphis Energy — saturated contrasting shapes (triangles, circles, zigzags), dot grid pattern, playful asymmetric layout, bold geometric sans',
  'Dark Glamour Editorial — deep oxblood or charcoal + metallic gold accent, high-contrast typographic hierarchy, geometric arc SVG motifs',
  'Organic Warm Craft — terracotta + sage + warm cream, biomorphic blob shapes, rounded humanist type, fluid asymmetric layering',
];

const BOLD_ARCHETYPES = [
  'Massive Knockout Type — business name at 56–80px filling 65%+ of a saturated color panel, white or accent reversed type, cropped at canvas edge',
  'Asymmetric Dual Panel — 55/45 clip-path split with contrasting palettes, typography on lighter panel, bold accent stripe at the seam',
  'Dominant Monogram — custom inline SVG interlocked initials occupying 40–50% of canvas height, typography arranged beside/below it',
  'Pattern-Forward Background — repeating geometric SVG or CSS pattern at 10–20% opacity across full canvas, bold solid type and color block on top',
  'Photo Fusion — image bleeds one full edge with gradient fade into solid color field; type overlaps photo with mix-blend-mode or knockout panel',
  'Layered Depth Stack — 3 overlapping semi-transparent geometric shapes (circles, arcs, polygons) creating depth; type on top z-index',
  'Edge-Bleed Brutal — oversized condensed type touching or bleeding off canvas edges via overflow:hidden, raw saturated color blocks',
  'Neon Electric Contrast — near-black field + single vivid neon accent (lime #c8f542, hot coral #ff6b6b, electric violet #a855f7), glow via text-shadow/box-shadow',
  'Sculptural Minimal — 75%+ intentional negative space, one bold horizontal bar or arc spanning 70%+ width, tiny precise type in one corner',
  'Chromatic Collision — two saturated opposing hues meeting at 25–40° diagonal, halftone or dot-grid texture on one panel, knock-out caps',
  'Oversized Cropped Display — one word of business name at 72px+ partially clipped by container overflow, secondary info in small caps below',
  'Frame Within Frame — inset panel with contrasting fill, double-border or corner bracket SVG ornaments, editorial hierarchy inside panel',
];

// ── Poster / Sign archetypes — large-format design language ──────────────────
const POSTER_ARCHETYPES = [
  'Swiss Modernist Grid — 2–3 words of oversized display type filling 55–65% of canvas height, strict geometric shapes (filled circles, rectangles, quarter-arcs) as the compositional graphic system in exactly 3 colors, off-white or warm cream background, Swiss grid spatial discipline (Müller-Brockmann energy)',
  'Dark Cinematic Event — deep saturated background (near-black, oxblood, or midnight navy) with large atmospheric photography blended via gradient overlay or color-burn mask, bold reversed headline at 160–220px+, gold or electric accent geometry (diagonal band, arc, corner bracket), dramatic film-poster hierarchy with strong bottom information block',
  'Neo-Brutalist Festival — ultra-heavy condensed type (Bebas Neue, Anton, or Black Han Sans) at raw extreme scale filling 60%+ of canvas, stark saturated background (hot yellow, raw red, or black), irregular grid with deliberate visual aggression, secondary type at aggressively contrasting sizes, zero decorative niceties',
  'Retro Vintage Illustrated — warm sun-toned palette (amber #f5a623, rust #c45c3e, teal #2a7f7f, cream #faf6ed), radiating sunburst SVG ray pattern, banner ribbon shapes with contrasting fill, layered decorative typography at multiple scales, hand-crafted warmth of vintage market and carnival poster tradition',
  'Editorial Typographic Monument — one word or two-word headline at 200–280px as the entire hero occupying 65% of the canvas, secondary info in ultra-precise small caps at 14px, 70%+ of canvas is pure intentional negative space, gallery announcement / museum exhibition / high fashion minimalism',
  'Constructivist Diagonal Energy — bold primary color blocks (red + black + white, or red + blue + yellow) at sharp diagonal compositions, heavy condensed type running at 45° or stacked in Rodchenko-style vertical column, strong directional arrow or diagonal band dividing canvas, revolutionary poster kinetic energy',
  'Punk Collage Chaos — distressed halftone grain texture layered at 40% opacity, ripped-paper edge shapes via SVG path, neon color explosions (magenta, yellow, cyan) on near-black background, multiple typeface weights in chaotic-but-intentionally-composed hierarchy, barcode or stamp elements, concert culture raw energy',
  'Luxury Art Gala — large refined display type (Abril Fatface or Cormorant) in deep jewel tone (emerald #1a4a3a, burgundy #4a1c2e, sapphire #1a2e4a), elegant geometric ornament (thin gold rule flanking headline, corner SVG bracket), generous negative space, art auction / opera / museum gala prestige',
  'Organic Botanical Warmth — terracotta #c45c3e + sage #7d9b8a + cream + mustard palette, large flowing botanical vector illustration or biomorphic blob shapes in soft fill, layered transparency via opacity, text anchored bottom-left with warm humanist sans, farmers market / artisan / wellness warmth',
  'Art Gallery Stark Minimalist — 70%+ intentional negative space as active design element, one singular bold element (a 400px+ geometric shape OR one carefully-placed image crop OR a single giant letterform) positioned off-center in the lower or upper third, tiny ultra-precise contact type (12px) anchored in the opposing corner, maximum tension between emptiness and weight',
];

// ── Stamp archetypes — monochromatic self-inking stamp designs ───────────────
const STAMP_ARCHETYPES = [
  'Classic Double Border — solid 3px outer rectangle border + 1px inner border inset 3px, business name centered in heavy condensed caps, one thin rule below the name, 1–2 compact info lines centered underneath',
  'Top Banner Reversal — solid black bar spanning the full width at the top (~40% of height) with the business name reversed in white bold caps, clean white zone below with 1–2 black info lines centered',
  'Bottom Banner Reversal — business name in heavy black caps in the upper white zone, solid black bottom bar spanning full width with one contact line reversed in white',
  'Left Initial Block — solid black square filling the full height on the left side containing the business initial reversed in white at large bold size, right zone holds the name and 1–2 info lines left-aligned in a tidy vertical stack',
  'Rule Architecture — thick 3px horizontal rules spanning the full width at the very top and very bottom, business name large and centered between them, a single thin rule separating the name from one info line',
  'Rounded Seal Frame — one rounded-rectangle border (6–8px radius, 2–3px stroke), business name centered in bold letter-spaced caps, one smaller info line below, generous even padding all around',
  'Typographic Weight Drama — no border at all: business name at maximum bold size spanning the width, second line in much smaller widely-tracked caps below — pure scale contrast is the entire design',
  'Dashed Inner Accent — solid 2px outer border + dashed 1px inner border, business name centered in bold caps, one info line below in condensed type',
  'Full Reversal — the entire stamp is a solid black rounded rectangle with ALL text reversed in white: bold business name centered, thin white rules above and below it, one small info line at the bottom',
  'Corner Bracket Minimal — thick L-shaped bracket marks in the four corners only (no full border), business name bold and centered, one small info line below — modern minimal stamp with intentional white space',
];

const STAMP_CREATIVE_MOMENTS = [
  'Dramatic weight contrast: the business name must be at least 2.5× the size of the info lines — the size jump IS the design.',
  'Use letter-spacing as the design tool: spread the business name caps with 0.1–0.2em tracking for engraved-stamp authority.',
  'One strong solid black element (bar, block, or thick border) anchors the design — everything else stays quiet and minimal.',
  'Perfect optical balance: even margins on all sides, consistent vertical rhythm between the stacked text lines.',
  'Negative space is the luxury: fewer elements, larger margins, bolder name.',
];

// ── Reference-quality archetypes — modeled on award-winning print design ───────
const SYNTHWAVE_POSTER_ARCHETYPES = [
  'Neon Nights Festival — stacked chrome-gradient 3D headline (linear-gradient silver + text-shadow neon cyan glow stack), brush-stroke secondary word in hot pink #ff2d95, purple lightning SVG bolts framing a glowing triangle portal, layered scene: perspective grid floor (repeating-linear-gradient), striped orange sun (#ff6b35 horizontal bands), palm + pier silhouettes, cyan/magenta light-trail streaks, boxed date badges with skew transform',
  'Outrun Horizon — full-bleed sunset gradient (#1a0a2e → #ff6b35 → #ffd700), massive condensed display type with multi-layer text-shadow neon (0 0 10px #0ff, 0 0 30px #f0f), VHS scanline overlay via repeating-linear-gradient, retro grid receding to vanishing point, chrome text via background-clip:text',
  'Electric Pier — photographic pier zone with purple/pink color-burn overlay, Ferris wheel SVG silhouette with radial glow, dual-sun motif (small badge sun + large horizon sun), mixed type: Orbitron chrome + Pacifico script + Bebas date blocks',
];

const FASHION_EDITORIAL_ARCHETYPES = [
  'VELA Editorial — cream #f5f0e8 canvas, brand name in ultra-wide tracked serif spanning full width overlapping photo, asymmetric 40/60 split with architectural model photo (clip-path curved crop), italic collection line, thin tan #c4a882 rule separators, vertical edge text, 70%+ intentional whitespace',
  'Runway Monument — one word at 200px+ cropped by overflow:hidden bleeding off bottom, dusty rose #d4a5a5 semicircle behind final letters, services list in tiny tracked caps, diagonal terracotta accent line',
  'Gallery Minimal — single serif headline "A Study in Form" with italic connector word, photo occupying right 55% with soft gradient fade into cream, logo lockup in thin rounded rectangle frame, tagline in 10px spaced sans at bottom',
];

const WPA_TRAVEL_ARCHETYPES = [
  'Cascadia National Parks — double inset border with notched corners, cream paper grain via feTurbulence SVG filter, layered flat-color illustration zones (snow peak, evergreen forest, coastal cliffs, vintage camper van foreground with kayaks), script "Explore" flanked by rules, embossed serif title with text-shadow depth, compass rose SVG footer banner',
  'Vintage Road Trip — warm hazy sky gradient (#faf6ed → #e8c872), flat color plane landscape in 3 depth layers, bold serif destination name with cream stroke effect (-webkit-text-stroke), tracked sans subhead with dot separators, "ADVENTURE AWAITS" bottom banner with circular emblem',
  'Screenprint Poster — limited 5-color palette (forest, rust, cream, teal, mustard), halftone texture overlay at 15% opacity, bold geometric mountain silhouette, decorative border frame, hand-crafted travel copy blocks',
];

const SWISS_EDITORIAL_ARCHETYPES = [
  'North/South Exhibition — strict grid on cream, tall condensed sans headline split across black + saturated red (#e63946), geometric system: solid red circle, black downward triangle overlapping masked photo, horizontal stripe square block, grounding red square anchor, vertical side text in 10px caps, short horizontal rule accents only',
  'Müller-Brockmann Poster — mathematical spacing, one primary color + black + white only, display type at 180px+ filling left column, photo crop in geometric mask (circle or triangle), baseline grid visible through subtle guide lines at 5% opacity',
  'International Typographic — asymmetric but balanced, 3 font sizes only (display 160px, sub 24px, detail 12px), one bold geometric primitive as hero, zero decorative fluff',
];

const SUMMIT_CORPORATE_ARCHETYPES = [
  'Elevate Leadership Summit — diagonal navy #0a1628 + gold split, curved gold-bordered photo portal revealing architectural interior (stairs/skyline), nested gold triangle depth stack at bottom, serif ELEVATE + gold year, tracked sans summit subhead, calendar/location icon rows with gold rule separators, three-bar growth logo mark',
  'Premium Conference — dark navy field with metallic gold gradient accents (linear-gradient #c9a84c → #f5e6a3), upward-perspective photography, keynote typography hierarchy, footer tagline flanked by rules',
  'Executive Innovation — asymmetric 45/55 split, gold geometric frame device, white serif headline + gold accent subhead, vertical gold bar beside secondary message, B2B prestige palette',
];

const STUDIO_CARD_ARCHETYPES = [
  'Verve Studio — cream card, tiny tracked sans studio name top-left, services list top-right in terracotta with diagonal rule separator, massive lowercase serif wordmark cropped at bottom edge (overflow:hidden), dusty rose semicircle overlapping final letters, back: three-column grid with thin dividers + terracotta bleed block',
  'Editorial Knockout — oversized cropped display type filling 60% of card, one semicircle or blob accent behind type, minimal contact in opposing corner, high whitespace ratio',
  'Luxury Crop Type — single word at 72px+ clipped by container, secondary info in 9px tracked caps, one warm accent shape (terracotta, rose, or sand)',
];

const DATA_STUDIO_CARD_ARCHETYPES = [
  'Metric Haus Dashboard — navy #0f1729 front designed as live analytics UI: lime #c8f542 accent, metric blocks with borders, sparkline SVG, "LIVE" status dot, bar chart icons; back: navy/white split with bracketed monogram, topographic line pattern, subtle chart watermark',
  'Pulse Creative Agency — royal blue + white diagonal split with orange-red triangle, custom geometric P logo (stacked triangles + semicircle), nested chevron momentum graphic, back: diagonal split with bar chart + line graph SVG, icon contact column, vertical keyword stack (STRATEGY / CREATIVE / GROWTH)',
  'Growth Analytics Card — dark field with data visualization as primary art (bar chart, trend line, metric tiles), monospace accent numbers, corner crosshair motif, services footer bar',
];

// ── New signature styles (from user references) — light/bright/premium diversity ──
const DECKLE_PRESS_ARCHETYPES = [
  'North Torn-Paper — a dusty-rose #d9a7a0 paper layer torn away along an irregular deckle edge (rough SVG path / jagged clip-path) revealing a plum #6b3f52 textured layer beneath; an oversized refined serif wordmark (Fraunces / Cormorant / DM Serif Display) set large or vertical across the rose field in warm cream; a subtle paper-fibre grain overlay; back: warm cream #f3ece4 stock with vertical tracked-caps labels (EMAIL / PHONE / WEBSITE), a serif name, and a small serif N&Co. monogram lockup with a thin rule',
  'Letterpress Deckle — two stacked torn-paper bands (cream over blush) split by a rough torn SVG edge, an elegant high-contrast serif headline with a soft inset/emboss shadow, a single plum accent, generous editorial margins — boutique letterpress stationery',
  'Blush Editorial — a full blush paper field with a torn corner peeling to mauve, a large serif wordmark with one italic accent word, a refined small-caps role label, hand-crafted premium warmth',
];
const PRIMARY_POP_ARCHETYPES = [
  'North Color-Block — an off-white base carved into bold geometric fields: a cobalt #2f4fe0 corner triangle, a hot-pink #ff5ea8 + tangerine #ff5a1f triangle pair, a teal #16c2c2 block, and a rising yellow #ffd21f half-sun semicircle; a heavy rounded sans wordmark (Poppins / Nunito Black / Fredoka) in cobalt with a tangerine ampersand; back: flat circular icons (pink / orange / teal) for contact and a cobalt-on-pink quarter-arc corner holding a bold N& monogram',
  'Bauhaus Playground — three primary color fields meeting at sharp diagonals with a big circle and triangle, chunky rounded sans, one playful accent dot — confident, spunky, disciplined',
  'Sunrise Pop — a large half-sun semicircle rising from the bottom in sunshine yellow, cobalt and pink corner wedges, a bold friendly sans, optimistic modern-brand energy',
];
const GILDED_EMERALD_ARCHETYPES = [
  'North Emerald Foil — deep emerald #0f3d2e stock with a large tone-on-tone embossed serif monogram watermark centered, and a metallic gold #c8a44d foil serif wordmark over it (gold gradient background-clip text + subtle emboss text-shadow) with a short gold rule; back: emerald field, a stacked serif N&Co. monogram beside a thin gold vertical rule, a cream name + gold role label, and delicate gold line-icons for contact',
  'Gilt Estate — an emerald background with a symmetrical gold-foil wordmark flanked by thin gold rules and a refined stacked monogram; quiet-luxury restraint, heavyweight foil-stamped feel',
  'Jewel & Gold — deep green with metallic gold accents, an elegant high-contrast serif, and a single large embossed initial as a background motif — private-client prestige',
];
const SAGE_STANDARD_ARCHETYPES = [
  'North Sage Split — a warm cream card with one clean vertical color-block: a solid sage #a9b39a panel holding a stacked N&Co. monogram in ink charcoal #23241f, and a cream field holding a large clean-sans name (Inter / Manrope / Jost), a tracked-caps role label, thin divider rules, and small line-icons for contact; immaculate alignment and generous white space',
  'Quiet Modern — mostly cream with a single sage accent block in one corner, a precise modern sans, wide-tracked labels, one hairline rule — architecture-studio calm',
  'Meadow Minimal — soft sage + cream, a restrained monogram, abundant negative space, one hairline accent — contemporary consultancy polish',
];

const CORPORATE_ARCHETYPES = [
  'Executive Panel Split — a deep charcoal panel meeting warm white at a crisp vertical or slightly diagonal seam, a thin metallic accent line at the junction, a tracked-caps name lockup on the light panel, a compact monogram reversed out of the dark panel',
  'Boardroom Frame — warm white stock with a precise hairline border inset, a bold grotesque wordmark anchored top-left, a single accent-color bar underscoring the name, contact details in two aligned columns separated by hairline rules',
  'Skyline Ascent — a subtle tone-on-tone abstract skyline or rising-bars motif along the bottom edge, a confident name and title hierarchy above it, one saturated accent reserved for the logo mark and contact icons',
];

const PLAYFUL_ARCHETYPES = [
  'Confetti Celebration — a warm cream canvas showered with multicolor confetti dots, squiggles, and tiny stars (inline SVG) at varied sizes and rotations, a chunky rounded wordmark in bubblegum pink #ff5ea8 with a sunshine-yellow #ffd21f offset shadow, one big tilted star or smiley badge as the hero, contact lines in a tidy rounded pill',
  'Sticker Sheet — bold sticker-style elements with thick white borders and soft drop shadows scattered across a bright single-hue field, the business name as the biggest sticker in outlined chunky letters, small supporting icon stickers (star, heart, lightning bolt), one sticker peeling at a corner',
  'Bouncy Type Party — the business name in oversized rounded letters, each glyph nudged or rotated a few degrees and filled in alternating bright colors, a low-opacity dot-grid or zigzag pattern background, one large soft blob shape anchoring a corner with contact info inside',
];

const STYLE_KEYWORD_ROUTES = [
  { test: /synthwave|retrowave|vaporwave|outrun|neon.?night|80s.?night|electric.?night/i, poster: SYNTHWAVE_POSTER_ARCHETYPES, card: SYNTHWAVE_POSTER_ARCHETYPES },
  { test: /fashion|editorial|runway|luxury.?minimal|vela|haute|lookbook|autumn.?collection/i, poster: FASHION_EDITORIAL_ARCHETYPES, card: STUDIO_CARD_ARCHETYPES },
  { test: /wpa|travel.?poster|national.?park|cascadia|vintage.?travel|retro.?illustrated|screenprint/i, poster: WPA_TRAVEL_ARCHETYPES, card: WPA_TRAVEL_ARCHETYPES },
  { test: /swiss|international.?typographic|north.?south|grid.?poster|müller|brockmann/i, poster: SWISS_EDITORIAL_ARCHETYPES, card: SWISS_EDITORIAL_ARCHETYPES },
  { test: /summit|conference|leadership|elevate|corporate.?event|gala.?premium|keynote/i, poster: SUMMIT_CORPORATE_ARCHETYPES, card: SUMMIT_CORPORATE_ARCHETYPES },
  { test: /data.?studio|dashboard.?card|metric|analytics.?card|agency.?card|pulse.?creative|marketing.?moves/i, poster: DATA_STUDIO_CARD_ARCHETYPES, card: DATA_STUDIO_CARD_ARCHETYPES },
  { test: /studio.?card|verve|creative.?studio|brand.?studio/i, poster: STUDIO_CARD_ARCHETYPES, card: STUDIO_CARD_ARCHETYPES },
  { test: /deckle|torn.?paper|blush.?editorial|letterpress/i, poster: DECKLE_PRESS_ARCHETYPES, card: DECKLE_PRESS_ARCHETYPES },
  { test: /primary.?pop|colou?r.?block.?pop|playful.?primary|bauhaus.?pop|sunrise.?pop|block.?party/i, poster: PRIMARY_POP_ARCHETYPES, card: PRIMARY_POP_ARCHETYPES },
  { test: /gilded.?emerald|emerald.?(gold|foil)|gilt|gold.?foil/i, poster: GILDED_EMERALD_ARCHETYPES, card: GILDED_EMERALD_ARCHETYPES },
  { test: /sage.?standard|sage.?(minimal|modern|split)|quiet.?modern|meadow.?minimal/i, poster: SAGE_STANDARD_ARCHETYPES, card: SAGE_STANDARD_ARCHETYPES },
  { test: /playful|whimsic|bubbly|confetti|sticker|\bfun\b/i, poster: PLAYFUL_ARCHETYPES, card: PLAYFUL_ARCHETYPES },
  { test: /corporate.?professional|executive|boardroom|\bcorporate\b.+\b(clean|modern|premium)\b/i, poster: CORPORATE_ARCHETYPES, card: CORPORATE_ARCHETYPES },
];

function pickFromStyleRoute(styleText, templateType) {
  const s = (styleText || '').toLowerCase();
  const isLargeFormat = /poster|sign/i.test(templateType || '');
  for (const route of STYLE_KEYWORD_ROUTES) {
    if (route.test.test(s)) {
      const pool = isLargeFormat ? route.poster : route.card;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return null;
}

function getCreativityDirective(creativityLevel) {
  if (creativityLevel === 'bold') {
    return `AMBITION: PORTFOLIO BOLD — push the concept to its most memorable, confident expression. Extreme scale contrast and layered atmosphere in service of the ONE idea (still keep contact info readable). Reference bar: D&AD Yellow Pencil / Cannes Lions print winners.`;
  }
  return `AMBITION: BALANCED — award-caliber craft with strong hierarchy and readable information. Still commit to one clear idea and a real hero moment; avoid template tropes.`;
}

function validateDesignSpec(spec) {
  const issues = [];
  if (!/concept/i.test(spec)) issues.push('missing CONCEPT — no single driving idea');
  if (!/hero moment/i.test(spec)) issues.push('missing HERO MOMENT');
  if (/nav-dot|three dots|single thin rule|one vertical stripe/i.test(spec)) {
    issues.push('spec leans on template decoration patterns');
  }
  return { ok: issues.length === 0, issues };
}

const STYLE_CHIP_MAP = {
  'Swiss Grid': 'Swiss International Style — disciplined modular grid, Space Grotesk or Barlow bold sans-serif, primary color accent on stark white or black, geometric dividing lines, precise alignment',
  'Neo-Brutalism': 'Neo-Brutalism — ultra-heavy Archivo Black or Anton type at dramatic scale, asymmetric raw layout, diagonal or offset text blocks, extreme value contrast, bold background color blocks',
  'Art Deco': 'Art Deco Revival — Cinzel or Josefin Sans type; a RICH, layered Deco environment: radiating sunburst/fan rays, stepped ziggurat and chevron forms, a repeating geometric pattern field, metallic gold (#c9a84c) gradients on black or deep jewel tones, ornate corner fans and framing — opulent and detailed, NEVER just a thin border on empty black',
  'Memphis Bold': 'Memphis Design — Unbounded or Righteous type, bold triangles/circles/zigzag shapes in contrasting saturated colors (coral, cobalt, yellow, mint), energetic asymmetric composition',
  'Japanese Minimalism': 'Japanese Minimalism — DM Sans or Noto Sans JP, extreme negative space, one restrained accent color on near-white or deep charcoal, ultra-light type weights, immaculate spacing',
  'Dark Tech': 'Dark Tech / Cinematic — Rajdhani or Exo 2 type, deep black background, electric cyan or vivid accent color, geometric circuit-line details, bold spaced-caps hierarchy',
  'Organic Modernism': 'Organic Modernism — Nunito or Quicksand rounded type, large biomorphic blob shapes in terracotta/sage/warm cream, fluid asymmetric layering, nature-inspired warmth',
  'Retro-Futurism': 'Retro-Futurism — Orbitron or Oxanium type, warm amber and deep navy gradient, concentric arc or ring motifs, bold condensed retro-space aesthetic, chrome-gradient accents',
  'Psychedelic Modernism': 'Psychedelic Modernism — 1960s liquid-poster energy reimagined: melting, warping groovy display lettering that flows and bends around the composition, kaleidoscopic radial symmetry, swirling liquid-marble and paisley forms, hyper-saturated clashing palette (electric violet, hot magenta, acid lime, tangerine), concentric rippling colour bands, trippy op-art motion, Righteous or Rubik Mono display type',
  'Vaporwave': 'Vaporwave — dreamy pastel gradient wash (miami pink #ff6ad5 + electric cyan #26d0ce + soft lavender) over twilight purple, a Greek marble statue bust as hero motif, VHS scanlines with RGB glitch offset, Japanese katakana accent text, neon grid horizon with a low sun, mixed type (wide Righteous display + Space Mono labels), 80s-mall retro-computing nostalgia',
  'Y2K Chrome': 'Y2K Chrome — liquid-metal 3D chrome headline lettering with glossy reflections, iridescent holographic gradient (silver → violet → aqua), blobby bubble shapes and star-sparkle glints, lens-flare highlights, early-2000s tech-optimism, wide futuristic type (Michroma or Orbitron), high-shine glassy surfaces',
  'Pop Art Comic': 'Pop Art Comic — Lichtenstein / Warhol energy: Ben-Day halftone dot fields, thick black comic outlines, primary POW palette (comic red #e63946, cyan, sunshine yellow), explosive starburst and speech-bubble callouts, ultra-bold condensed comic type (Bangers or Anton), screen-print misregistration, high-impact and playful',
  'Cosmic Celestial': 'Cosmic Celestial — deep-space vertical gradient (midnight indigo #0b0b2d → violet), glowing nebula clouds and a scatter of stars with delicate constellation lines, luminous gold and silver foil accents, elegant high-contrast serif (Cinzel or Cormorant) with airy tracking, a crescent-moon or radiant sun-ring motif, mystical premium astral atmosphere',
  'Street Graffiti': 'Street Graffiti — raw urban wall energy: spray-paint texture and paint drips, bold wildstyle tag lettering with hard outlines and highlights, high-contrast colour on concrete grey or brick, stencil and torn-wheatpaste poster layers, marker-scrawl accents, halftone spray shading, rebellious hand-style craft',
  'Urban Industrial': 'Urban Industrial — Bebas Neue or Barlow Condensed type, dark grey and concrete palette, offset asymmetric grid, bold stencil-style headline, sharp geometric cut shapes',
  'Luxury Maximalism': 'Luxury Maximalism — Abril Fatface or Fraunces display type, opulent jewel tones (deep emerald, burgundy, sapphire), heavy decorative geometric shapes, layered theatricality',
  'Bauhaus Constructivism': 'Bauhaus Constructivism — IBM Plex Sans or Work Sans, primary color geometry (red, blue, yellow, black), strict orthogonal grid, architectural precision, functional modernism',
  'Dark Glamour': 'Dark Glamour — Oswald or Montserrat Bold type, deep oxblood or midnight navy background, metallic gold accent, high-contrast bold typographic hierarchy',
  'Bold Geometric': 'Bold Geometric Corporate — Barlow or Space Grotesk, diagonal color-block composition splitting the canvas, bold primary colors, white type reversed out on saturated fields',
  'Coastal Minimalism': 'Coastal Minimalism — Karla or Raleway Light type, deep ocean blue and warm sand, airy negative space, clean organic shapes, light atmospheric freshness',
  'Synthwave Neon': 'Synthwave / Retrowave — layered neon atmosphere on near-black (#0a0a1a), hot pink #ff2d95 + cyan #00f5ff + electric purple, chrome-gradient 3D headlines with multi-layer text-shadow glow, perspective grid floor, striped sunset sun, palm/pier silhouettes, mixed fonts (Orbitron + Pacifico script + Bebas badge type), VHS scanlines',
  'Fashion Editorial': 'High-Fashion Editorial — cream #f5f0e8 canvas, ultra-wide tracked serif brand mark, asymmetric photo crop with architectural framing, italic collection lines, thin tan rule separators, 70%+ whitespace, DM Serif Display + Jost pairing, vertical edge type',
  'WPA Travel': 'WPA / Vintage Travel Poster — flat illustrated depth layers, limited earthy palette (forest #2d5016, rust #c45c3e, cream #faf6ed, teal), double border frame, embossed serif titles, script accents, compass/emblem details, paper grain texture, National Parks poster energy',
  'Swiss Exhibition': 'Swiss International Typographic — strict grid, tall condensed sans (Barlow Condensed or Oswald), 2-color discipline (black + one saturated accent like #e63946), geometric primitives (circle, triangle, stripe block, square anchor), monumental type scale, mathematical spacing',
  'Event Summit': 'Premium Leadership Summit — navy #0a1628 + metallic gold gradient, curved gold-bordered photo portal, nested triangle depth motifs, serif+sans hierarchy, calendar/location icon rows with gold rules, B2B luxury event branding',
  'Data Studio': 'Data-Driven Creative Studio — navy dashboard UI aesthetic, lime or orange accent on dark field, metric blocks, sparkline/bar chart SVG as primary art, monospace numbers, diagonal agency split layouts, marketing analytics as visual identity',
  'Creative Studio': 'Boutique Creative Studio — cream canvas, oversized cropped serif wordmark bleeding off edge, terracotta/dusty rose accents, diagonal rule separators, three-column back grid, warm earthy palette, collectible stationery quality',
  'Deckle Press': 'Torn-Paper Editorial — a refined display serif (Fraunces, Cormorant, or DM Serif Display) as an oversized vertical or cropped wordmark; a soft tactile palette of dusty rose #d9a7a0 + mauve/plum #6b3f52 + warm cream #f3ece4; the hero is a torn/deckle paper edge (irregular clip-path or rough SVG path) dividing two paper textures, with a subtle fibre-grain overlay; elegant editorial composition, generous margins, a small serif monogram and thin rules; boutique letterpress-studio feel — soft, premium, hand-crafted, never digital',
  'Primary Pop': 'Playful Primary Color-Block — a bold rounded geometric sans (Poppins, Nunito Black, Fredoka, or Outfit) in heavy weight; a bright saturated palette of cobalt #2f4fe0 + hot pink #ff5ea8 + tangerine #ff5a1f + teal #16c2c2 + sunshine yellow #ffd21f on off-white; the canvas is divided into bold geometric color fields (triangles, a rising-sun semicircle, quarter-arcs) meeting at clean diagonals, with simple circular icons and a friendly ampersand accent; energetic, spunky, optimistic Bauhaus-pop — fun but disciplined',
  'Gilded Emerald': 'Emerald & Gold Foil — a high-contrast serif (Cormorant, Playfair Display, or Bodoni Moda); a deep emerald #0f3d2e background with metallic gold #c8a44d foil accents (gold gradient text-fill + subtle emboss via text-shadow); a large tone-on-tone embossed monogram watermark behind a centered gold wordmark, thin gold rules and a refined stacked serif monogram; restrained, symmetrical, opulent quiet-luxury — the feel of foil-stamped heavyweight stock, jeweler / private-client premium',
  'Corporate Professional': 'Executive Corporate — a confident modern grotesque (Barlow, Space Grotesk, Archivo, or IBM Plex Sans) with tracked-caps labels; a refined businesslike palette of deep charcoal #23272e + warm white + ONE considered accent (steel teal #2a7f8f, oxford burgundy #701f28, or brass #c9a84c) — premium and boardroom-credible without defaulting to corporate blue; a disciplined grid with one architectural gesture (a vertical accent band, a sharp diagonal seam, or a precise corner-bracket frame), thin hairline rules, a compact monogram lockup, and generous structured whitespace; polished, authoritative, Fortune-500 annual-report craft',
  'Playful': 'Playful & Fun — a chunky rounded sans (Fredoka, Baloo 2, Nunito Black, or Poppins) with a bouncy friendly personality; a bright happy palette (sunshine yellow #ffd21f, bubblegum pink #ff5ea8, sky blue #3aa0ff, tangerine #ff5a1f, mint #4cd6b0) on warm off-white; sticker-style graphics with bold outlines and soft shadows, confetti dots, squiggles, zigzags, stars, and blob shapes placed with intent; gently tilted headline energy and an oversized friendly ampersand or badge motif; joyful, energetic, kid-at-heart charm — fun but composed, never chaotic',
  'Sage Standard': 'Clean Sage Minimal — a precise modern sans (Inter, Manrope, Work Sans, or Jost) with wide-tracked labels; a calm muted palette of soft sage #a9b39a + warm cream #f4f1e8 + ink charcoal #23241f; a clean color-block split (a solid sage panel meeting cream) with a stacked N&Co. monogram, thin divider rules and small tracked-caps labels; abundant white space, immaculate alignment, one restrained accent — contemporary, confident, corporate-modern calm',
};

function expandStyleDirection(styleDirection) {
  const trimmed = (styleDirection || '').trim();
  if (!trimmed) return trimmed;
  return STYLE_CHIP_MAP[trimmed] || trimmed;
}

function resolveCreativeDirection(styleDirection, industry, templateType, creativityLevel) {
  const raw = (styleDirection || '').trim();
  const creativityDirective = getCreativityDirective(creativityLevel || 'standard');

  // ── Stamps: monochromatic only — special archetype pool ─────────────────
  const isStamp = /stamp/i.test(templateType || '');
  if (isStamp) {
    const archetype = STAMP_ARCHETYPES[Math.floor(Math.random() * STAMP_ARCHETYPES.length)];
    const moment    = STAMP_CREATIVE_MOMENTS[Math.floor(Math.random() * STAMP_CREATIVE_MOMENTS.length)];
    return `STAMP DESIGN — monochromatic black ink on white ONLY, SUPER SIMPLE flat layout. EXECUTE ARCHETYPE: ${archetype}. CREATIVE MANDATE: ${moment} ABSOLUTE STAMP RULES: (1) Only #000000 and #ffffff permitted — zero color, zero grey; (2) Bold/heavy type weights only — thin fonts blur in stamp impression; (3) Text is a simple vertical stack of straight horizontal lines — NO arced text, NO curved text, NO rotated text, NO circular text paths, NO radial bursts, NO ovals, NO icons or shapes overlapping type; (4) Simple clean geometry only: straight borders, solid bars, thin horizontal rules; (5) Every element must survive actual rubber stamp impression quality. ${creativityDirective}`;
  }

  const isLargeFormat = /poster|sign/i.test(templateType || '');
  const archetypePool = isLargeFormat ? POSTER_ARCHETYPES : BOLD_ARCHETYPES;

  // Style-specific reference archetypes take priority when keywords match
  const styleArchetype = pickFromStyleRoute(raw, templateType)
    || pickFromStyleRoute(expandStyleDirection(raw), templateType);
  const archetype = styleArchetype
    || archetypePool[Math.floor(Math.random() * archetypePool.length)];

  const formatNote = isLargeFormat
    ? 'Design at true poster scale — monumental display type (120px+), one dominant visual covering ≥40% of the canvas, edge-to-edge composition. A poster, not a scaled-up business card.'
    : 'Design at portfolio quality — one clear hero moment and real graphic craft with a print-shop finish. Not a plain background with text.';

  // The archetype is INSPIRATION, not a checklist — the concept step decides how to use it.
  const inspiration = (label) =>
    `${label}\n\nINSPIRATION DIRECTION (a reference to riff on — take its spirit, do not copy it): ${archetype}\n\n${formatNote} ${creativityDirective}`;

  if (raw && !GENERIC_STYLE.test(raw)) {
    return inspiration(expandStyleDirection(raw));
  }

  const key = (industry || '').toLowerCase();
  if (!isLargeFormat && /legal|law|attorney|counsel|litigation|barrister|solicitor/.test(key)) {
    const pick  = LEGAL_ARCHETYPES[Math.floor(Math.random() * LEGAL_ARCHETYPES.length)];
    const style = DIVERSE_STYLES[Math.floor(Math.random() * DIVERSE_STYLES.length)];
    return `${style}\n\nINSPIRATION DIRECTION (riff, don't copy): ${pick}\n\n${formatNote} ${creativityDirective}`;
  }

  const style = DIVERSE_STYLES[Math.floor(Math.random() * DIVERSE_STYLES.length)];
  return inspiration(style);
}

// ── Diverse style pool — used when user provides no direction ────────────────
const DIVERSE_STYLES = [
  'Swiss International Style — disciplined modular grid, Space Grotesk or Barlow bold sans-serif, primary color accent on stark white or black, geometric dividing lines, precise alignment',
  'Neo-Brutalism — ultra-heavy Archivo Black or Anton type at dramatic scale, asymmetric raw layout, diagonal or offset text blocks, extreme value contrast, bold background color blocks',
  'Art Deco Revival — Cinzel or Josefin Sans type, geometric ornamental border framing, symmetrical composition, rich gold (#c9a84c) and black or deep jewel tones, architectural detail flourishes',
  'Memphis Design — Unbounded or Righteous type, bold triangles/circles/zigzag shapes in contrasting saturated colors (coral, cobalt, yellow, mint), energetic asymmetric composition',
  'Japanese Minimalism — DM Sans or Noto Sans JP, extreme negative space, one restrained accent color on near-white or deep charcoal, ultra-light type weights, immaculate spacing',
  'Dark Tech / Cinematic — Rajdhani or Exo 2 type, deep black background, electric cyan or vivid accent color, geometric circuit-line details, bold spaced-caps hierarchy',
  'Organic Modernism — Nunito or Quicksand rounded type, large biomorphic blob shapes in terracotta/sage/warm cream, fluid asymmetric layering, nature-inspired warmth',
  'Retro-Futurism — Orbitron or Oxanium type, warm amber and deep navy gradient, concentric arc or ring motifs, bold condensed retro-space aesthetic, chrome-gradient accents',
  'Psychedelic Modernism — Raleway Black or Righteous type, deeply saturated vibrant palette (electric violet, hot coral, acid yellow), fluid organic forms, bold chromatic collisions',
  'Urban Industrial — Bebas Neue or Barlow Condensed type, dark grey and concrete palette, offset asymmetric grid, bold stencil-style headline, sharp geometric cut shapes',
  'Luxury Maximalism — Abril Fatface or Fraunces display type, opulent jewel tones (deep emerald, burgundy, sapphire), heavy decorative geometric shapes, layered theatricality',
  'Coastal Minimalism — Karla or Raleway Light type, deep ocean blue and warm sand, airy negative space, clean organic shapes, light atmospheric freshness',
  'Bauhaus Constructivism — IBM Plex Sans or Work Sans, primary color geometry (red, blue, yellow, black), strict orthogonal grid, architectural precision, functional modernism',
  'Dark Glamour — Oswald or Montserrat Bold type, deep oxblood or midnight navy background, metallic gold accent, high-contrast bold typographic hierarchy',
  'Bold Geometric Corporate — Barlow or Space Grotesk, diagonal color-block composition splitting the canvas, bold primary colors, white type reversed out on saturated fields',
  'Synthwave / Retrowave — layered neon atmosphere, chrome type, perspective grid, mixed font personalities, sunset horizon gradients',
  'High-Fashion Editorial — cream canvas, extreme whitespace, serif/sans tension, architectural photo crop, thin rule separators',
  'WPA Vintage Travel — flat illustrated depth layers, double border frame, embossed serif titles, compass emblem, earthy limited palette',
  'Premium Leadership Summit — navy + gold luxury, curved photo portal, nested triangle depth, icon+rule information hierarchy',
  'Data-Driven Creative Studio — dashboard UI as brand identity, metric blocks, sparkline SVG, lime accent on navy',
  'Torn-Paper Editorial — refined serif wordmark, dusty rose + plum + cream, a torn deckle paper edge dividing two textures, fibre grain, boutique letterpress warmth',
  'Playful Primary Color-Block — heavy rounded sans, bright cobalt/pink/tangerine/teal/yellow geometric fields and a rising-sun semicircle, circular icons, spunky Bauhaus-pop',
  'Emerald & Gold Foil — high-contrast serif, deep emerald with gold-foil accents, an embossed monogram watermark, thin gold rules, quiet-luxury foil-stamped premium',
  'Clean Sage Minimal — precise modern sans, sage + cream color-block split, stacked monogram, tracked-caps labels, generous white space, corporate-modern calm',
];

// ── Industry palette hints when user leaves colors empty ─────────────────────
const INDUSTRY_COLOR_POOLS = {
  legal: [
    'Charcoal #1c1c1e + warm parchment #f5f0e8 + antique gold #b8956a + deep burgundy accent',
    'Slate #3d4f5c + cream #faf8f5 + copper #b87333 + forest green accent',
    'Deep oxblood #4a1c2e + ivory #f8f4ef + brushed brass #c9a84c + muted sage accent',
    'Warm black #2a2a2a + stone #e8e4df + terracotta #c45c3e + teal accent',
  ],
  dental: [
    'Warm white #faf9f7 + coral #e8725a + soft sage #8fa68a + deep charcoal text',
    'Mint #d4ede4 + terracotta #d4725a + cream #fffbf5 + navy text (not background)',
    'Blush #f5e6e0 + teal #2a9d8f + warm grey #6b6b6b + gold accent',
  ],
  healthcare: [
    'Sage #7d9b8a + warm cream #f7f3ed + coral #e07a5f + deep teal accent',
    'Soft lavender #c4b5d4 + white + plum #6b4c7a + mint accent',
    'Warm grey #5c5c5c + peach #f4c4a0 + forest #3d5a45 + cream background',
  ],
  tech: [
    'Electric violet #7c3aed + near-black #0f0f12 + lime #c8f542 + cool grey',
    'Deep charcoal #1a1a2e + hot coral #ff6b6b + white + cyan accent',
    'Midnight #121826 + amber #f59e0b + slate text + mint accent',
  ],
  default: [
    'Terracotta #c45c3e + warm cream #faf6f1 + forest #2d5016 + mustard accent',
    'Deep plum #4a1942 + blush #f2d7d9 + gold #d4a853 + charcoal text',
    'Burnt orange #cc5500 + sand #e8dcc8 + teal #1a6b6a + charcoal',
    'Olive #6b7c3e + cream #f5f0e1 + rust #a0522d + dark brown text',
    'Charcoal #2d2d2d + saffron #f4c430 + warm white + emerald accent',
  ],
};

function getColorGuidance(industry) {
  const key = (industry || '').toLowerCase();
  let pool = INDUSTRY_COLOR_POOLS.default;
  if (/legal|law|attorney|counsel/.test(key)) pool = INDUSTRY_COLOR_POOLS.legal;
  else if (/dental|dentist|orthodont/.test(key)) pool = INDUSTRY_COLOR_POOLS.dental;
  else if (/health|medical|clinic|hospital|pharma/.test(key)) pool = INDUSTRY_COLOR_POOLS.healthcare;
  else if (/tech|software|saas|digital|startup/.test(key)) pool = INDUSTRY_COLOR_POOLS.tech;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `No colors specified — invent a distinctive, premium palette. Direction: ${pick}. STRICTLY FORBIDDEN as background or primary unless user explicitly chose blue: navy #1e3a5f, royal #2563eb, corporate #1e40af, midnight #172554. Legal industry ≠ blue. Prefer charcoal+gold, burgundy+cream, slate+copper, forest+brass, black+gold, cream+charcoal.`;
}

function toPx(value, unit) {
  if (unit === 'px') return Math.round(value);
  if (unit === 'mm') return Math.round(value * (96 / 25.4));
  if (unit === 'in') return Math.round(value * 96);
  return Math.round(value);
}

// ── Print bleed ──────────────────────────────────────────────────────────────
// Products that ship to a commercial printer need a 0.125" bleed on every edge.
const BLEED_IN = 0.125;
const BLEED_PRODUCTS = ['Business Card', 'Poster', 'Brochure'];

function getBleedPx(templateType) {
  return BLEED_PRODUCTS.includes(templateType) ? Math.round(BLEED_IN * 96) : 0; // 12px @ 96dpi
}

function getBleedNote(bleedPx, canvasW, canvasH, trimW, trimH) {
  if (!bleedPx) return '';
  const safe = bleedPx * 2; // recommended safe margin from the canvas edge
  return `
PRINT BLEED — this is a print-ready file with ${BLEED_IN}" bleed on every edge:
- Total canvas is ${canvasW}×${canvasH}px and ALREADY INCLUDES a ${bleedPx}px bleed margin on all four edges. Size the outer container to exactly ${canvasW}×${canvasH}px.
- The trim/cut line sits ${bleedPx}px inside each edge; the finished (post-cut) size is ${trimW}×${trimH}px.
- ALL background colors, color fields, gradients, images, and full-bleed shapes MUST extend to the very edge of the ${canvasW}×${canvasH}px canvas so there is no white gap after cutting — bleed the background fully.
- Keep ALL critical content (headline, body text, logos, icons, faces, contact info) inside the SAFE AREA: at least ${safe}px in from the canvas edge on every side, so nothing important is trimmed off.
- Do NOT draw visible crop marks, trim guides, or a border line at the trim edge — bleed is expressed only through full-bleed backgrounds.`;
}

function getLayoutBudget(width, height, unit, templateType, bleedPx = 0, businessName = '') {
  const h = toPx(height, unit || 'px') + bleedPx * 2;
  const w = toPx(width, unit || 'px') + bleedPx * 2;

  if (/stamp/i.test(templateType || '')) {
    const nameMax = Math.max(14, Math.min(26, Math.round(h * 0.33)));
    const maxLines = h <= 96 ? 4 : 6;
    return `STAMP LAYOUT BUDGET (${w}×${h}px) — RIGID SIMPLICITY MANDATORY:
- ALL text lives in ONE flex column: .zone-copy { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; height:100%; box-sizing:border-box; padding:6px 10px; }
- NO position:absolute on any text element. NO transform:rotate anywhere. NO arced, curved, vertical, or circular text. NO SVG text elements.
- Text stack: business name (${Math.round(nameMax * 0.6)}–${nameMax}px bold caps, ONE line that must fit the width) + up to ${maxLines - 1} shorter info lines at 7–10px
- Maximum ${maxLines} total text lines
- Decoration is ONLY: a CSS border on the card (solid/double/dashed, straight or rounded corners), OR one solid black bar (top, bottom, or left block), OR 1–3px horizontal rules between text lines
- Decorations NEVER overlap or intersect text — bars sit strictly above/below/beside the text column
- Every element fits inside ${w}×${h}px with at least 5px padding on all sides; nothing may clip or touch the canvas edge unless it is a full-bleed bar`;
  }

  // ── Nameplates / name badges: a person-identity plate, NOT a business card ──
  if (/nameplate|name badge|name tag/i.test(templateType || '')) {
    const words = String(businessName || '').split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
    const longestWord = words.length ? Math.max(...words.map((x) => x.length)) : 8;
    const safeW = Math.max(120, w - 64);                       // ~32px inset each side
    const fitCap = Math.floor(safeW / (0.85 * longestWord));   // px at which the longest name word still fits one line
    const ceiling = h <= 130 ? 40 : h <= 200 ? 64 : h <= 320 ? 96 : 140;
    const nameMax = Math.max(28, Math.min(ceiling, fitCap));
    const titleMax = Math.max(11, Math.round(nameMax * 0.26));
    return `NAMEPLATE LAYOUT BUDGET (${w}×${h}px, landscape desk/door plate) — NAME-FIRST, RICH BACKGROUND:
- CONTENT MODEL (this is NOT a business card): the ONLY foreground content is (1) a PERSON'S NAME as the hero, (2) their JOB TITLE / role, and (3) a small business LOGO or wordmark. NO contact lines (no phone, email, website, address), NO tagline, NO paragraphs, NO body copy anywhere.
- HERO = the person's NAME, set BOLD and LARGE — up to ${nameMax}px at this width — the single dominant element. It MUST fit fully inside the ${safeW}px safe width; if it will not fit on one line, reduce the size or break "First / Last" onto two lines. Never let a glyph touch an edge. line-height 0.98–1.06.
- JOB TITLE sits directly under or beside the name at ${Math.round(titleMax * 0.7)}–${titleMax}px in a quieter weight/color or tracked caps — clearly subordinate (name ≥ 2.2× the title).
- LOGO: place the business logo/wordmark small and tidy in one corner or flanking the name (≈12–22% of canvas width) — user SVG if provided, otherwise a compact monogram/wordmark of the business name. The logo is an accent, never the hero.
- RICH BACKGROUND (maximalism still applies): fill the plate with a layered, designed background — 2+ color fields, a gradient, a motif, ornament, a rule/frame system, or a pattern — so it reads as a premium object, never a flat fill with a name on it. But every decorative layer lives BEHIND/AROUND the text and must never reduce the legibility or dominance of the NAME.
- LAYOUT: a landscape composition with intent — name+title on one side with the logo opposite; or logo in a top corner with name+title anchored beside it; or a vertical accent band next to a name block. Never a dead-centered stack on a flat fill.
- TEXT STRUCTURE (prevents clipping): put the name + title in ONE flex block — .zone-copy { display:flex; flex-direction:column; gap:6px } — inside a .content { position:absolute; inset:0; display:flex; align-items:center; padding:~20px; box-sizing:border-box }. Do NOT give the name or title its own position:absolute or hardcoded top. Everything fits inside ${w}×${h}px with ≥12px clearance on every side.`;
  }

  const isLargeFormat = /poster|sign/i.test(templateType || '') || h > 600;

  if (isLargeFormat) {
    return `LARGE FORMAT POSTER/SIGN CANVAS: ${w}×${h}px

THIS IS A POSTER/SIGN — NOT A BUSINESS CARD. Design language must be theatrical, editorial, and bold.

COMPOSITIONAL STRUCTURE (mandatory — pick one):
  A) Horizontal Thirds: top band (hero display type or dominant image, ~45% height) + middle band (subhead + event info, ~35%) + bottom band (fine details + contact, ~20%)
  B) Two-Column Grid: left column (large graphic or color field, 45–55% width) + right column (stacked hierarchy of type zones)
  C) Diagonal/Dynamic Split: clip-path diagonal dividing two color fields, type anchored to the lighter panel
  D) Full-Bleed Hero: photographic or illustrated base covering 100% of canvas, typography overlaid in distinct zones with contrast backgrounds or overlays

TYPOGRAPHY SCALE (these are the CORRECT sizes for this canvas):
  • Display / Hero headline: 120px–300px — monumental, commanding
  • Subhead / Event title: 36px–72px — clear second tier
  • Body / Supporting info: 18px–28px — legible at reading distance
  • Fine detail (date, location, URL): 14px–18px — precise and small
  FORBIDDEN: typography capped at business-card sizes (28px, 36px) on a ${w}×${h}px canvas

GRAPHIC ELEMENTS:
  • One dominant element MUST cover ≥40% of canvas area (color field, geometric shape, image zone)
  • At least one element must touch or bleed off a canvas edge — no floating-island layouts
  • Background: multi-stop gradient, layered clip-path color fields, or designed atmospheric layer — NEVER flat single color

FORBIDDEN ON LARGE FORMAT:
  - Photo column on right + text column on left (this is a scaled-up business card — REJECTED)
  - Centered text stack with flat background (PowerPoint quality — REJECTED)
  - Business-card-size typography (28–52px headlines on a ${h}px tall canvas — REJECTED)
  - Four text elements in a .zone-copy flex column as the primary composition (card layout — REJECTED)`;
  }

  // Fit-aware headline cap: as LARGE as fits the safe width, so display type is bold AND never clips.
  const words = String(businessName || '').split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
  const longestWord = words.length ? Math.max(...words.map((x) => x.length)) : 8;
  const safeW = Math.max(80, w - 56);                          // ~28px inset on each side
  const fitCap = Math.floor(safeW / (0.85 * longestWord));     // px at which the longest word still fits one line (with tracking margin)
  const ceiling = h <= 160 ? 44 : h <= 220 ? 76 : 104;         // allow genuinely bold display type on cards
  const headlineMax = Math.max(24, Math.min(ceiling, fitCap));
  const zoneMaxWidth = Math.round(w * 0.55);
  const textMaxHeight = h - 16;

  return `SMALL-FORMAT LAYOUT BUDGET (${w}×${h}px) — GRAPHICS RICH, TEXT MUST FIT:
- RICHNESS: fill the canvas with layered background and graphic design (color fields, ornament, motifs, patterns, emblems). This budget disciplines TEXT sizing/placement only — it is NOT a licence to leave the canvas sparse. A near-empty card is a failure.
- HERO NAME: the business name may be BOLD and large — up to ${headlineMax}px at this width — but it MUST fit fully inside the ${safeW}px safe width. If it will not fit on one line at your chosen size, REDUCE the size or break it onto two lines; never let a letter touch or cross any edge. line-height 0.95–1.05.
- Person name max 13px, tagline max 11px at this canvas height.
- TEXT LAYOUT (prevents overlap AND clipping): put ALL text in ONE flex container — .content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:space-between; padding:~24px; box-sizing:border-box; z-index:20 } — holding .zone-copy (name + tagline) at the top and .zone-contact (person, title, contact lines) at the bottom, each a flex column with gap 6–8px. NEVER give an individual text line its own position:absolute or hardcoded top; flex flow then makes overlap and bottom-clipping impossible.
- One contact/icon system only — never both a .contact-group inside .zone-copy AND a separate .icon-row.
- Total text height (copy + contact) must fit inside ${textMaxHeight}px with the padding above — if it doesn't, reduce the display size until it does. Nothing clips, top or bottom.
- .zone-copy max-width: ${zoneMaxWidth}px when a graphic/photo occupies the other side.
- Tagline color must contrast with its background — never use --primary text on a --primary shape.
- A large monogram/emblem is welcome as a hero; if it sits BEHIND text keep it at opacity ≤ 0.25 so the headline stays readable.`;
}

// ── Pass 1: Creative director spec ──────────────────────────────────────────
const SPEC_PROMPT = `You are a world-class creative director. Define a precise visual specification for the brief below. This spec will be handed directly to a front-end developer — be specific, decisive, and measurable.

BRIEF
Industry: {{INDUSTRY}}
Product: {{PRODUCT_TYPE}}
Dimensions: {{DIMENSIONS}}
Colors: {{COLORS}}
Business Name: {{BUSINESS_NAME}}
Style Direction: {{STYLE_DIRECTION}}
Special Instructions: {{SPECIAL_INSTRUCTIONS}}
Image URL: {{IMAGE_URL}}
User SVG: {{SVG_CONTENT}}

{{LAYOUT_BUDGET}}

HOW TO APPROACH THIS:
1. Start with ONE idea. Before anything else, decide the single memorable concept that drives this piece — something you could say in one sentence, specific to THIS business, not a generic template. Every field below serves it. This is the most important decision.
2. Honor the Style Direction — it is the primary creative driver. Choose typography that matches the aesthetic; never default to Cormorant/Playfair/EB Garamond unless the direction is genuinely luxury-editorial or Art Deco. (Swiss/Bauhaus → Space Grotesk, Barlow, Archivo Black; organic/craft → Nunito, DM Sans; dark/tech → Oswald, Rajdhani, Exo 2; retro-future → Orbitron, Space Mono; luxury → Fraunces, Abril Fatface.) Size display type large and dramatic, but within the safe width given in the layout budget — specify sizes that fit, reducing size or breaking to two lines rather than clipping.
3. Pick a distinctive palette. If Colors is empty, invent one that fits the industry and concept; avoid navy/royal/corporate blue unless the brief explicitly chose blue. The background must suit the aesthetic (dark styles → dark background; bold styles → saturated).
4. Compose with intent — asymmetry, strict grid, or diagonal as the concept demands; never a centered stack on a flat fill. Keep decorative shapes out of the text-safe zone.
5. Build a RICH, layered design that serves the concept. Specify a layered background (2+ color fields / gradient / pattern / texture), a dominant hero, and 4–6 integrated graphic elements that reinforce the idea — the density and craft of award-winning print, never a sparse template. Even minimal aesthetics must be rich in composition and tension, not empty.
6. If an Image URL is provided, describe its crop/frame/overlay and how it connects to type (IMAGE INTEGRATION). If a User SVG is provided, describe its exact placement, size, and relationship to the composition (SVG INTEGRATION).

Return ONLY the spec in this exact format — no explanation, no code, no preamble:

CONCEPT
[one sentence: the single memorable idea driving this design, specific to this business — decide this FIRST; everything below serves it]

PALETTE
Background: #______
Primary: #______
Secondary: #______
Accent: #______
Text: #______
Text-muted: #______

TYPOGRAPHY
Headline: [Google Font] | [weight] | [px size] | [letter-spacing e.g. -0.02em or 0.15em]
Sub: [Google Font] | [weight] | [px size] | [letter-spacing]
Body: [Google Font] | [weight] | [px size] | [letter-spacing]

LAYOUT
[2–3 sentences: exact compositional strategy — how the canvas is divided, where key elements are anchored, how visual weight and hierarchy flow. Describe any asymmetric, diagonal, offset, or architectural layout decisions. Be specific about which quadrants are occupied by what elements.]

BACKGROUND
[The layered background environment — the 2+ color fields / gradient / pattern / texture and exactly how they are arranged across the canvas. Never a single flat fill.]

TEXT ZONES
[Two zones only, flowed by a flex container — NO per-line pixel positions. State which text sits in .zone-copy (top: business name + tagline) vs .zone-contact (bottom: person name, title, contact lines), and whether the copy block is top-anchored or vertically centered. The build flexes these so lines can never overlap or clip.]

TEXT-SAFE ZONE
[Define the rectangular region (left, top, width, height in px) where ALL typography lives — decorative shapes must not intersect this rectangle]

MOTIF
[1–2 sentences: the specific visual element(s) — shape type (diagonal band, blob, arc, polygon, circuit line, dot grid, wave), scale relative to the canvas (e.g. "covers 60% of background"), fill treatment (solid, gradient, transparent), and exact position on the canvas]

HERO MOMENT
[The one unforgettable element that embodies the CONCEPT — its shape/type, exact size (≥30% of canvas on cards, ≥40% on posters), fill treatment, and position. This is what a viewer remembers, not merely something that looks professional.]

SUPPORTING ELEMENTS
[4–6 concrete, placed graphic elements that build a rich environment around the hero — geometric systems, ornament, iconography, rules, framing, patterns, motifs — each specific (e.g. "circular SVG icon row for contact, bottom-left" not "some icons"). Fewer than 4 only for a genuinely minimalist aesthetic.]

CSS TECHNIQUES
[Only the techniques this design actually uses — from: clip-path, conic-gradient, radial-gradient, multi-stop linear-gradient, mix-blend-mode, inline SVG path, CSS filter, multi-layer box-shadow, backdrop-filter, ::before/::after shapes]

ATMOSPHERE
[1 sentence: overall mood and one specific design reference — a brand, publication, designer, or real-world example — that captures this direction precisely]

IMAGE INTEGRATION
[Only if an Image URL is provided: 2–3 sentences on crop shape, frame treatment, overlay/tint, and how the photo connects to adjacent typography and color fields. Write "N/A" if no image URL provided.]

SVG INTEGRATION
[Only if User SVG Logo is provided: 2–3 sentences on exact logo placement (e.g. top-left corner, bottom-right, centered above headline), size as a percentage of canvas width, and how it connects to the surrounding palette and typography. Write "N/A" if no SVG provided.]

{{DS_SPEC_NOTE}}`;

// ── Pass 2: Developer implements spec as HTML ────────────────────────────────
const HTML_PROMPT = `You are an elite front-end developer AND award-winning graphic designer implementing a precise creative brief as print-ready HTML/CSS. The output must look like a premium print shop business card ($500+ quality) — comparable to D&AD-winning stationery design. Execute the spec exactly.

DESIGN SPEC
{{DESIGN_SPEC}}

INPUTS
Product: {{PRODUCT_TYPE}}
Dimensions: {{DIMENSIONS}}
Business Name: {{BUSINESS_NAME}}
Industry: {{INDUSTRY}}
Colors: {{COLORS}}
Style Direction: {{STYLE_DIRECTION}}
Special Instructions: {{SPECIAL_INSTRUCTIONS}}
Image URL: {{IMAGE_URL}}
User SVG: {{SVG_CONTENT}}

{{LAYOUT_BUDGET}}

BUILD THE IDEA — a fully designed, RICH environment that serves the spec's CONCEPT:
- Build the layered BACKGROUND first — 2+ color fields, a gradient, a pattern, or texture. Never a single flat fill with type dropped on it.
- Make the HERO MOMENT unmistakable — it dominates 30%+ of the canvas exactly as the spec describes.
- Implement ALL the spec's SUPPORTING ELEMENTS at full weight (the 4–6 it lists) — monograms/emblems/icons as inline SVG, splits as clip-path panels, ornament and rules via CSS/pseudo-elements, patterns via gradients/repeating-linear-gradient. Cohesive richness that reinforces the concept is the goal — NOT restraint, NOT a sparse card.
- Dramatic scale contrast: the hero/headline is big and confident (≥2.5× the body/contact text).
- FIT IS MANDATORY: size display type so every glyph sits fully inside the safe width with margin. If the business name is too wide at your chosen size, REDUCE the size or break it onto two lines — never let a letter clip an edge, and never hide overshoot with overflow:hidden. Reserve vertical room for every line so nothing cuts off at the bottom.

TECHNICAL REQUIREMENTS
- Outer container fixed to exact pixel dimensions (1in = 96px, 1mm = 3.7795px — round to integer)
- LAYER MODEL:
  • Background layer (z-index 0–1): position:absolute background color, decorative shapes, bands, motifs, patterns — ALL the rich graphics live here, behind the text.
- NOTHING CROSSES TEXT (critical legibility rule): NO element — decorative shape, oversized number/letter, monogram/emblem, metric tile, badge, chip, or icon — may overlap or cross ANY text (business name, tagline, person, title, or contact line) in a way that reduces legibility. Give large graphics and UI tiles (stat cards, badges, big numbers) their OWN clear region, separated from all text by a gap. A large monogram/emblem placed behind text must be low-opacity (≤0.15) or offset so no stroke crosses a glyph. Every word — name, tagline, and each contact line — stays crisply legible.
  • Image wrapper (z-index 10) if a photo is present.
  • Text layer (z-index 20): a SINGLE flex container holding all copy — see TEXT LAYOUT.
- TEXT LAYOUT — this structure makes text overlap and clipping STRUCTURALLY IMPOSSIBLE; use it exactly:
  • Wrap ALL text in ONE flex container filling the card: .content { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; justify-content:space-between; padding:[safe inset ~22-28px]px; box-sizing:border-box; }
  • Inside .content, use at most TWO flex blocks: .zone-copy (business name + tagline) at the top, and .zone-contact (person name, title, contact lines) at the bottom. Each is display:flex; flex-direction:column; gap:6–8px.
  • Because flex flows these, text can NEVER overlap or clip as long as it fits. Do NOT give individual text lines (name, tagline, person, title, contact) their own position:absolute or a hardcoded top — let flex place them. NEVER absolutely-position a text block at a middle/low top value.
  • For asymmetric or offset placement, use align-items (flex-start/center/flex-end), padding, gap, or max-width on the zones — NEVER by absolutely positioning individual lines.
  • One contact/icon system only — never both a .contact-group and a separate .icon-row.
  • NEVER apply margin-top/margin-bottom over ~16px, or transform:translateY, to .zone-copy/.zone-contact — a big margin (e.g. margin-top:130px to clear a centered emblem) pushes the text off the card and clips it. Vertical placement is done ONLY by .content's justify-content plus small gaps.
  • On cards ≤240px tall, do NOT stack a large emblem/medallion directly ABOVE a multi-line business name — there is not enough height and the name will clip. Make the wordmark itself the hero, or keep the emblem in the background layer behind/beside the text (small or offset), never stacked above it in the flow.
  • line-height ≥1.05 for display headlines, ≥1.35 for body/contact.
- Honor the spec's zone plan (which text sits in .zone-copy vs .zone-contact, and whether copy is top-anchored or centered) — but always via the flex .content structure above, never per-line absolute tops.
- CSS custom properties (--var) for every color, font stack, and key measurement from the spec
- Google Fonts @import in <head> for all fonts named in TYPOGRAPHY
- @media print: margin:0; and @page { size: [W]px [H]px; margin: 0; }
- Pure HTML and CSS only — no JavaScript. Inline SVG is allowed.
- Implement the techniques listed under CSS TECHNIQUES in the spec
- Large-scale shapes MUST be built with CSS clip-path, SVG path elements, or pure CSS geometry
- Typography MUST match the spec font exactly — do not substitute a different font family
- The layout MUST honor the LAYOUT direction from the spec — do not default to centered-text stacks

EXTERNAL IMAGES — when an Image URL is provided:
- Use <img src="URL"> for that user-provided image (this overrides the default no-external-images rule)
- NEVER place a raw unstyled rectangle. Integrate the photo using at least TWO of: clip-path crop, border-radius, gradient/color overlay on a wrapper ::after, mix-blend-mode tint matching the palette, decorative SVG frame, offset box-shadow panel, overlap with an adjacent color field, or masked bleed into a shape
- The image must feel designed-in — cropped with intent, aligned to the grid, and visually connected to surrounding typography and color blocks
- Follow IMAGE INTEGRATION from the spec if provided

{{DS_HTML_NOTE}}

USER SVG LOGO — when User SVG markup is provided, treat it as the brand logo:
- Embed the SVG inline exactly as provided (preserve viewBox and paths). Do NOT recreate, simplify, or alter the paths
- Always position it as the primary logo — typically top-left or top-center, following standard print layout conventions for the template type
- Follow SVG INTEGRATION from the spec for exact placement, size, and relationship to other elements
- Size it proportionally — typically 15–25% of canvas width unless the spec directs otherwise
- Apply CSS fill/stroke color overrides ONLY if needed to ensure contrast against the background; otherwise preserve original colors
- Do NOT use external references inside the SVG — inline only

ANTI-PATTERNS — NEVER DO THESE:
- Do NOT produce a boring single-color card with only text and a tiny photo — this is the #1 failure mode
- Do NOT use nav-dots, a single thin rule line, or one vertical stripe as the primary graphic language
- Do NOT use navy/royal/corporate blue (#1e3a5f, #2563eb, #1e40af) unless the user's Colors field explicitly provided blue
- Do NOT stack multiple text elements at the same top coordinate
- Do NOT absolutely-position taglines/subheads over headlines
- Do NOT let diagonal bands, lines, or shapes cross through text
- Do NOT ignore the provided Image URL or User SVG
- Do NOT drop the HERO MOMENT or the SUPPORTING ELEMENTS the spec lists
- Do NOT put contact info inside .zone-copy on small cards (height ≤ 240px)
- Do NOT use gap:0 on .zone-copy
- Do NOT duplicate icon rows (.contact-group + .icon-row)
- Do NOT let any text clip or fall off ANY edge (top, bottom, left, right) — every glyph must sit fully inside the canvas with ≥10px padding; scale display type down or break lines to fit rather than clipping
- Do NOT set the business name as vertical/rotated text unless it clearly fits the card's HEIGHT — a rotated wordmark longer than the card's shorter dimension clips top and bottom. Prefer horizontal display type; use vertical text only for a short word that fits with margin

ADVANCED EFFECT RECIPES (reach for these ONLY when the concept calls for them — skip entirely for clean/minimal designs):
- Neon glow: text-shadow: 0 0 7px #0ff, 0 0 20px #0ff, 0 0 40px #f0f on the headline
- Chrome type: background: linear-gradient(180deg,#fff,#aaa 45%,#fff 50%,#888); -webkit-background-clip:text; -webkit-text-fill-color:transparent
- Paper grain / halftone: SVG feTurbulence, or radial-gradient(circle,#000 .5px,transparent .5px) background-size 4px, at ~10% opacity
- Dashboard block: border:1px solid rgba(255,255,255,.15); border-radius:4px; label in 8px caps + value in bold monospace
- Sparkline / bar chart: inline SVG polyline or rects with stroke/fill var(--accent)
- Curved photo portal / nested depth: clip-path on the image wrapper, or stacked SVG polygons at decreasing opacity

SHAPE IMPLEMENTATION GUIDE (use the right technique for the aesthetic):
- Diagonal color bands → clip-path: polygon() on a full-bleed div (e.g. "polygon(0 0, 70% 0, 55% 100%, 0 100%)")
- Organic blobs → clip-path with rounded polygon or inline SVG <path> with bezier curves
- Geometric arcs → inline SVG <circle> or <arc> with stroke or fill
- Circuit / grid lines → inline SVG <line> or <polyline> elements
- Dot grids → radial-gradient pattern or inline SVG <circle> repeats
- Hard geometric blocks → clip-path: polygon() with sharp angles for cut shapes

CODE RULES
Compact, non-repetitive CSS. Use shorthand and CSS variables throughout. No duplicate declarations. No inline styles unless unavoidable. Use ::before/::after pseudo-elements for atmospheric shapes. Express gradients, clip-paths, and SVG motifs efficiently.

Return in this exact order with nothing else before, between, or after:

One \`\`\`html code block containing the complete self-contained file.

DESIGN SUMMARY
A 2–3 sentence description of the artistic direction and visual strategy.`;

// ── JSON schema prompt ───────────────────────────────────────────────────────
const JSON_SCHEMA_PROMPT = `You are a design system architect. Given the print-ready HTML design template below, generate its complete JSON schema.

Return a valid JSON object with these top-level keys:
- template_metadata (product_type, industry, dimensions, units, sides, bleed, safe_area)
- color_palette
- typography
- editable_fields
- layers (each with: id, side, type, name, x, y, width, height, rotation, opacity, z_index, editable, locked, styles, content)
- export_settings

Layer types: text, shape, decorative_element, background, image_placeholder, logo_placeholder, qr_placeholder.

Return ONLY the JSON inside one json code block. No explanation, no other text.

HTML:
\`\`\`html
{{HTML}}
\`\`\``;

async function handleGenerate(body, send) {
  const {
    templateType,
    width,
    height,
    unit,
    industry,
    businessName,
    colors,
    styleDirection,
    specialInstructions,
    imageUrl,
    svgContent,
    doubleSided,
    creativityLevel,
    referenceImage,
    referenceImageUrl,
  } = body;

  if (!templateType) { send({ error: 'Template type is required.' }); return; }
  if (!width || !height) { send({ error: 'Width and height are required.' }); return; }

  // ── Print bleed: expand the canvas so backgrounds can bleed past the trim ──
  const bleedPx = getBleedPx(templateType);
  const trimWpx = toPx(width, unit);
  const trimHpx = toPx(height, unit);
  const canvasWpx = trimWpx + bleedPx * 2;
  const canvasHpx = trimHpx + bleedPx * 2;

  const dimensions = bleedPx > 0
    ? `${canvasWpx} x ${canvasHpx} px (includes ${BLEED_IN}" bleed on all sides; trim/finished size ${trimWpx} x ${trimHpx} px)`
    : `${width} x ${height} ${unit || 'px'}`;

  const colorParts = [];
  const colorLabels = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'];
  const colorKeys  = ['primary', 'secondary', 'tertiary', 'quaternary'];
  if (colors && typeof colors === 'object') {
    colorKeys.forEach((key, i) => {
      if (colors[key]) colorParts.push(`${colorLabels[i]}: ${colors[key]}`);
    });
  }
  // When the user gives no colors: if they chose a real style, that style's signature palette
  // must win (never override it with a random industry palette). Only fall back to industry
  // guidance when there is no style direction at all.
  const hasChosenStyle = (styleDirection || '').trim() && !GENERIC_STYLE.test((styleDirection || '').trim());
  const colorScheme = colorParts.length > 0
    ? `${colorParts.join(', ')} — USER-SELECTED PALETTE, MANDATORY: build the design's palette from EXACTLY these hex values (plus black/white/neutrals as needed). They take priority over any signature palette named in the Style Direction — do not substitute different hues.`
    : (hasChosenStyle
        ? 'No colors specified — use the signature palette described in the Style Direction. Do NOT substitute a different palette; stay true to the style\'s named colors. (If the Style Direction truly implies no palette, invent a distinctive premium one for the industry — avoid corporate blue unless requested.)'
        : getColorGuidance(industry));

  // Resolve creative direction — replace generic "corporate" with portfolio archetypes
  let styleDirFinal = resolveCreativeDirection(styleDirection, industry, templateType, creativityLevel);

  const hasRefUpload = referenceImage?.data && referenceImage?.mediaType;
  const hasRefUrl = (referenceImageUrl || '').trim();

  if (hasRefUpload || hasRefUrl) {
    send({ phase: 0 });
    try {
      const img = hasRefUpload
        ? referenceImage
        : await fetchReferenceImageFromUrl(referenceImageUrl.trim());
      const inspiration = await analyzeReferenceImage(img);
      styleDirFinal += `\n\nSTYLE REFERENCE INSPIRATION (channel this creative energy for an ORIGINAL design — do NOT clone or recreate the reference image literally):\n${inspiration}`;
    } catch (err) {
      console.warn('Reference image analysis skipped:', err.message);
    }
  }

  const layoutBudget = getLayoutBudget(width, height, unit, templateType, bleedPx, businessName)
    + getBleedNote(bleedPx, canvasWpx, canvasHpx, trimWpx, trimHpx);

  const imageUrlValue   = imageUrl?.trim()   || 'None';
  const svgContentValue = svgContent?.trim() || 'None';

  // ── Large-format poster/sign notes injected into prompts ─────────────────
  const isLargeFormat = /poster|sign/i.test(templateType || '');
  const isStamp       = /stamp/i.test(templateType || '');
  const isNameplate   = /nameplate|name badge|name tag/i.test(templateType || '');
  const pxW = canvasWpx;
  const pxH = canvasHpx;

  let posterSpecNote = '';
  let posterHtmlNote = '';

  if (isLargeFormat) {
    posterSpecNote = `
FORMAT OVERRIDE — LARGE FORMAT ${templateType.toUpperCase()} (${pxW}×${pxH}px):
This is NOT a business card. Reference quality: award-winning theatrical posters, gallery announcements, festival bills, editorial magazine covers.
- TYPOGRAPHY SCALE for this canvas: headline 140–280px, subhead 36–72px, body info 18–28px, fine detail 14–18px
- SPEC TYPE POSITIONS must use these large-format px values — not business-card values
- One element in the spec must be described as covering ≥40% of canvas (e.g. a 900px color field, a full-width image zone, a 500px geometric shape)
- HERO MOMENT must read from 15 feet away — a massive typographic form, a dramatic color collision, or a full-bleed compositional moment
- LAYOUT must specify one of: horizontal thirds, two-column grid, diagonal split, or full-bleed layered composition
- SUPPORTING ELEMENTS must scale to large format — no "80–140px monogram" or "48px lettermark" — think 300–600px for hero shapes`;

    posterHtmlNote = `
LARGE FORMAT POSTER/SIGN IMPLEMENTATION (${pxW}×${pxH}px) — MANDATORY OVERRIDES:
- font-size values of 120px–300px are CORRECT and EXPECTED for display type on this canvas
- DO NOT produce a "scaled-up business card" — photo on right + text stack on left = AUTOMATIC FAIL
- STRUCTURE: Use CSS grid rows or absolute-positioned zones to create horizontal bands or column grid
- HERO ELEMENT: One element dominates — a massive headline, a full-width color field, a 400px+ geometric shape, or an image zone
- SHAPES at poster scale: circles at 300–600px diameter, diagonal clip-path bands spanning full canvas width, color field panels covering 40–60% of canvas height
- TYPOGRAPHY: three visible tiers — display (140px+), subhead (40–70px), detail (14–20px) — all must be visible and clearly differentiated
- BLEEDING EDGES: at least one shape or color field must touch the canvas edge on 2+ sides
- BACKGROUND: Use at least 2 color zones — top and bottom bands, diagonal split, or layered gradients — never a single flat fill with text dropped on it
- .zone-copy four-item limit and .zone-contact separation rules DO NOT APPLY to large format posters — use whatever HTML structure best serves the design
- FORBIDDEN on this canvas: typography below 120px for any headline element, business-card-style layout at any scale, centered text stack on plain background`;
  }

  // ── Stamp: override color scheme to monochromatic ───────────────────────
  let effectiveColorScheme = colorScheme;
  if (isStamp) {
    effectiveColorScheme = 'STAMP MONOCHROMATIC MANDATORY: Background #ffffff (white paper), all ink #000000 (pure black). NO other colors, NO grey tones, NO rgba opacity tricks. Self-inking stamps print black ink only.';
  }

  // ── Double-sided notes injected into prompts ─────────────────────────────
  const isBrochure = templateType === 'Brochure';
  let dsSpecNote = posterSpecNote;
  let dsHtmlNote = posterHtmlNote;

  if (doubleSided) {
    if (isBrochure) {
      dsSpecNote += `
DOUBLE-SIDED BROCHURE (tri-fold, letter size) — SPEC FOR BOTH SIDES REQUIRED:

FRONT SIDE (outside) — three panels:
  • Right panel (Front Cover): hero panel — main business name, logo mark, hero visual or photo, tagline
  • Center panel (Inside Flap): teaser panel — one strong hook statement, 2–3 value icons with labels
  • Left panel (Back Cover): contact panel — phone, email, address with icon row, small logo, subtle texture

INSIDE SPREAD — three panels forming one cohesive editorial interior:
  • Left inside panel (Panel 1): Brand story or "About Us" — large display quote or mission statement (32–40px), 2–3 short body paragraphs, accent color field covering top 35–40% of panel height
  • Center inside panel (Panel 2): Services or Offerings — headline, 4–6 service items each with a small inline SVG icon and 1-line description, cream or light background for readability
  • Right inside panel (Panel 3): Call-to-action — bold CTA headline (28–36px), 3–4 bullet-point reasons to choose this business, prominent button-style CTA block, contact info repeat, logo

Both sides share the same palette, typography, and decorative language. Inside panels must be fully designed — same visual quality as the outside. No blank panels.

After your standard spec sections (PALETTE through SVG INTEGRATION), add:

INSIDE SPREAD LAYOUT
[2–3 sentences: describe how the 3 interior panels flow as a connected editorial spread — visual direction, color field distribution, and typographic hierarchy across panels]

INSIDE PANEL DETAILS
Panel 1 (left — About/Story): [specific headline text suggestion, color treatment for top accent field, body copy style]
Panel 2 (center — Services): [specific service category names to use as placeholders, icon style, background color]
Panel 3 (right — CTA): [CTA headline text, button copy, accent treatment, how contact info is displayed]`;

      dsHtmlNote += `
DOUBLE-SIDED BROCHURE HTML STRUCTURE — MANDATORY: OUTPUT EXACTLY TWO COMPLETE .card ELEMENTS:

═══ CARD 1 — OUTSIDE SPREAD ═══
<div class="card card--front">  ← outside, three-panel grid
  display:grid; grid-template-columns:repeat(3,1fr); width:[fullW]px; height:[fullH]px;
  Left column (.panel-back): back cover — icon contact row (SVG circle icons for phone/email/address), logo, decorative texture
  Center column (.panel-flap): inside flap — hook headline, 3 value-prop icons with labels below each
  Right column (.panel-front): front cover — business name at 48–64px, tagline, hero graphic treatment, photo if provided

═══ CARD 2 — INSIDE SPREAD ═══
<div class="card card--back" style="display:none">  ← inside, same grid structure
  display:grid; grid-template-columns:repeat(3,1fr); width:[fullW]px; height:[fullH]px;

  PANEL 1 — Left inside (.panel-inside-left):
    • Accent color field (top 38% of panel height) — solid panel using var(--accent) or var(--secondary)
    • "About Us" or brand story section label (10px, spaced caps, var(--accent))
    • Large display pull-quote or mission statement (28–36px, headline font)
    • 2–3 paragraphs of body copy (13px, var(--body) font, 1.6 line-height)
    • Small logo or lettermark at bottom

  PANEL 2 — Center inside (.panel-inside-center):
    • Light/cream background for maximum readability
    • "Our Services" or equivalent section headline (22–28px)
    • 4–6 service items, each as a flex row: [32px SVG circle icon in var(--secondary)] + [service name bold 12px + descriptor 11px]
    • Thin border separator between items (1px, rgba of var(--secondary))
    • Optional: inset border frame matching outside flap style

  PANEL 3 — Right inside (.panel-inside-right):
    • Dark or saturated background (matching front cover palette)
    • Bold CTA headline (26–32px, accent color) — "Ready to Get Started?" or equivalent
    • 3–4 bullet points with small SVG dot markers and 13px body text
    • CTA button-style block: solid background var(--secondary), white text 11px spaced caps, 14px padding
    • Contact repeat: phone + email + website in small accent-colored text
    • Business name / logo lockup at bottom

FOLD LINES: subtle 1px dashed rgba(0,0,0,0.12) right-border on each .panel (except last)
@media print: show BOTH cards; page-break-after:always on .card--front; .card--back{display:grid!important;}
VISIBILITY RULE: hide the back card ONLY via the inline style attribute (style="display:none") on the .card--back div. NEVER write "display:none" for .card--back inside any <style> stylesheet rule — the app toggles visibility by changing the inline style, and a stylesheet rule would keep it permanently hidden.
Do NOT add JavaScript toggle — the app handles switching.
CRITICAL: .card--back MUST contain fully designed, visually rich HTML. An empty or near-empty .card--back is a FAILURE.`;
    } else if (templateType === 'Business Card') {
      dsSpecNote += `
DOUBLE-SIDED BUSINESS CARD — contact/details on FRONT, brand identity on BACK (this matches how users preview and hand out cards):
  FRONT (card--front): person name + title + ALL contact lines (phone, email, website, address) + a clean secondary graphic. This is the details side users see first.
  BACK (card--back): brand identity ONLY — business name (hero), tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines on the back.
Both sides share the same palette and typography. The person appears ONCE, on the front — do NOT invent a different name for each side.
If an Image URL is provided, the photo MUST be integrated on at least one side — typically as (part of) the BACK's hero graphic, or as the FRONT's secondary graphic — following IMAGE INTEGRATION. "Brand identity ONLY" refers to text content and NEVER excludes the user's photo.
If the user provided Colors, BOTH sides must be built from exactly those hex values as the dominant palette.`;

      dsHtmlNote += `
DOUBLE-SIDED BUSINESS CARD HTML STRUCTURE:
Output EXACTLY TWO .card containers in one HTML file:
1. <div class="card card--front"> — CONTACT / DETAILS SIDE (shown first in preview): person name + title + ALL contact lines (phone, email, website, address) + secondary graphic treatment.
2. <div class="card card--back" style="display:none"> — BRAND SIDE: business name, tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines here.
Both .card elements must be fixed to the exact same pixel dimensions, each using its own .content flex layer. The person's name and all contact info appear only on card--front.
Hide the brand side ONLY via the inline attribute style="display:none" on the .card--back div — do NOT put display:none in a <style> stylesheet rule.
@media print: show BOTH cards; add page-break-after:always on .card--front.
Do NOT add any JavaScript toggle — the app handles front/back switching externally.
If an Image URL is provided, embed it with <img> on at least one of the two cards (typically the back's hero graphic or the front's secondary graphic), integrated per the EXTERNAL IMAGES rules — omitting the provided photo is WRONG.
If the Colors input lists user-selected hex values, both cards' CSS custom properties MUST be built from exactly those values.`;
    } else {
      dsSpecNote += `
DOUBLE-SIDED ${templateType.toUpperCase()} — SPLIT THE CONTENT so neither side is crowded (like premium cards: brand on the front, person + details on the back):
  FRONT: brand identity ONLY — business name (hero), tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines on the front.
  BACK: the person — their name + title — plus ALL contact lines (phone, email, website, address) and a secondary/complementary graphic treatment.
Both sides share the same palette and typography but differ in layout and focus. The person appears ONCE, on the back — do NOT invent a different name for each side. Keeping the person and contact off the front gives the hero room to breathe.`;

      dsHtmlNote += `
DOUBLE-SIDED HTML STRUCTURE:
NON-NEGOTIABLE SPLIT: the FRONT card is brand-only and the BACK card holds the person + all contact. If any phone/email/website/address or the person's name appears on the FRONT, the output is WRONG. Do NOT compress everything onto one card — build two distinct cards.
Output EXACTLY TWO .card containers in one HTML file:
1. <div class="card card--front"> — brand side: business name, tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines here.
2. <div class="card card--back" style="display:none"> — details side: person name + title + ALL contact lines (phone, email, website, address) + a secondary graphic.
Both .card elements must be fixed to the exact same pixel dimensions, each using its own .content flex layer. The person's name appears only on the back.
If an Image URL is provided, embed it with <img> on at least one of the two cards, integrated per the EXTERNAL IMAGES rules — omitting the provided photo is WRONG.
Do NOT crowd the front — moving the person and contact to the back is what keeps the front clean and clip-free.
Hide the back ONLY via the inline attribute style="display:none" on the .card--back div — do NOT put display:none in a <style> stylesheet rule.
@media print: show BOTH cards; add page-break-after:always on .card--front.
Do NOT add any JavaScript toggle — the app handles front/back switching externally.`;
    }
  }

  // ── Stamp: append monochromatic override notes ───────────────────────────
  if (isStamp) {
    dsSpecNote += `
STAMP DESIGN OVERRIDE — NON-NEGOTIABLE:
This is a self-inking rubber stamp (${pxW}×${pxH}px). Physical stamps print in ONE COLOR — black ink on paper.

PALETTE OVERRIDE (hard rule — no exceptions):
Background: #ffffff
Primary: #000000
Secondary: #000000
Accent: #000000
Text: #000000
Text-muted: #000000
(Reversed text on filled shapes: white #ffffff on black #000000 fill — permitted)

DESIGN CONSTRAINTS:
- MAX 6 LINES of text total — self-inking stamps have a physical line limit
- SIMPLE BOLD GEOMETRY ONLY: straight borders, horizontal rules, solid bars, corner brackets — no gradients, no shadows, no complex illustration
- Type must be BOLD or HEAVY weight — light/thin fonts blur in stamp impression
- Every design element must survive actual rubber stamp impression quality (high contrast, clean edges, no fine detail)
- Be CREATIVE within monochrome: use reversal (white-on-black), border variation, weight drama, rule patterns
- The design should feel like a premium custom rubber stamp — intentional, not default

SIMPLICITY OVERRIDE — supersedes ALL generic complexity rules in this brief:
- SUPPORTING ELEMENTS: list only 2–3 simple elements — (1) the border/frame or bar treatment, (2) one rule or divider system, (3) the typography treatment. Any "add more elements" pressure DOES NOT APPLY to stamps.
- HERO MOMENT = bold typography or one solid reversed black bar. Nothing else.
- STRICTLY FORBIDDEN in this spec: arced text, curved text, rotated text, text on a circular path, ovals, radial bursts, starbursts, ornamental notches, decorative icons, monograms overlapping text, ANY element that intersects the text column
- TYPE POSITIONS: a simple vertical stack of straight horizontal text lines, every line fully inside the canvas with clear separation — nothing else`;

    dsHtmlNote += `
STAMP MONOCHROMATIC IMPLEMENTATION — ABSOLUTE RULES:
- CSS color values: ONLY #000000 and #ffffff permitted — zero exceptions
- background-color: #ffffff on the outer card; all shapes/borders/type: #000000
- Reversed elements: color:#fff on elements with background-color:#000 — allowed and encouraged for hero elements
- FORBIDDEN: any hex color other than #000 / #fff, any rgba(), any opacity less than 1, any gradient of any kind, any box-shadow, any text-shadow, any filter
- border: use solid 2px+ black lines — no grey, no colored borders
- font-weight: 700 or 800 or 900 ONLY — no light or regular weights
- Maximum 6 text-rendering lines in the output
- The design must be CLEAN, BOLD, and LEGIBLE at actual stamp impression size

STAMP LAYOUT IMPLEMENTATION — SIMPLICITY OVERRIDES (supersede all generic complexity mandates above):
- Implement ONLY the 2–3 supporting elements from the spec — no "add more elements" pressure applies to stamps
- ALL text goes in ONE flex column (.zone-copy) centered in the card — no .zone-contact, no absolutely-positioned text
- FORBIDDEN: transform:rotate on anything, <svg> text or textPath, arced/curved text, letter-by-letter positioning, circles or ovals, radial/starburst shapes, icons overlapping text
- Decoration is ONLY straight-edged: card border, solid black bar (top/bottom/left), or horizontal rules — and it must never intersect a text line
- Result must read instantly: business name dominant, info lines small and clean below it`;
  }

  // ── Nameplate / Name Badge: person-identity content model (no contact info) ──
  if (isNameplate) {
    const nameNote = `
NAMEPLATE / NAME BADGE — READ THIS FIRST. IT OVERRIDES EVERY "business name is the hero" INSTRUCTION ANYWHERE ABOVE.
This is a PERSON'S desk/door plate, NOT a business card. The hierarchy is INVERTED from a business card:
- THE HERO IS THE PERSON'S NAME — it is the single LARGEST element on the plate (the monument). Size it at the big display/headline size from the layout budget.
- THE JOB TITLE is a quiet secondary line directly under or beside the name, clearly smaller (person name ≥ 2.2× the title).
- THE BUSINESS NAME IS ONLY A SMALL LOGO / WORDMARK — no larger than ~40% of the person-name size — tucked into a corner or flanking the name. It is NEVER the hero and NEVER the centered main event. Use the user's SVG logo if one is provided.
- FOREGROUND TEXT IS EXACTLY THREE THINGS: person name (hero) + job title + a small business wordmark/logo. NOTHING ELSE — NO tagline, NO industry descriptor line (e.g. "ATTORNEYS AT LAW"), NO phone, email, website, address, NO body copy.
- NAME SOURCE: use the person name and title from Special Instructions if given; otherwise invent ONE tasteful placeholder name + a fitting senior title. Do NOT reuse the business name as the person's name.
- The CONCEPT for this piece must be built around making the PERSON'S NAME unforgettable, with the business reduced to a quiet mark. Keep the BACKGROUND rich and designed (layered fields, gradient, motif, ornament, frame, pattern) so the plate reads as a premium object — but every decorative layer stays BEHIND/AROUND the text and never competes with the name.
WRONG (a business-card layout — REJECT it): the business wordmark large or centered as the hero with the person's name small at the bottom, or any tagline / industry line present. RIGHT: the person's NAME is the biggest text on the plate; the business is a small logo; the title is a quiet subordinate line; everything else is background ornament.`;
    dsSpecNote += nameNote + `
In the SPEC: CONCEPT and HERO MOMENT must both be the PERSON'S NAME (give it the largest px size); the business name appears only in SUPPORTING ELEMENTS as a small logo/wordmark. TEXT ZONES contain ONLY the person name + job title (one .zone-copy block) — do NOT specify a .zone-contact, contact lines, or a tagline.`;
    dsHtmlNote += nameNote + `
HTML STRUCTURE: one .content flex layer holding a single .zone-copy whose FIRST and LARGEST child is the person NAME, then the smaller JOB TITLE; the business logo/wordmark sits small in the background/accent layer or a corner. Do NOT output a .zone-contact, .contact-group, .icon-row, a tagline element, any phone/email/website/address, and do NOT invent contact details. If the business name's font-size is ever ≥ the person name's font-size, you have failed — make the person name larger.`;
  }

  if (creativityLevel === 'bold') {
    dsHtmlNote += `
PORTFOLIO BOLD — make the CONCEPT and HERO MOMENT unmistakable and the canvas richly designed:
- The hero dominates — ≥30% of canvas on cards, ≥40% on posters
- Layered background (2+ fields / gradient / texture / pattern), never a single flat fill
- Implement ALL the spec's supporting elements at full weight — cohesive richness (4–6 integrated elements) that reinforces the concept, never a sparse card
- Dramatic scale contrast and confident use of the CSS techniques the spec names
- Mixed typography where the aesthetic allows (2 contrasting families). Commission-worthy, not template-safe — and every glyph fits inside the canvas`;
  }

  try {
    // ── Pass 1: Creative director generates visual spec ──────────────────────
    send({ phase: 1 });

    const specContent = SPEC_PROMPT
      .replace('{{PRODUCT_TYPE}}',         templateType)
      .replace('{{DIMENSIONS}}',           dimensions)
      .replace('{{INDUSTRY}}',             industry            || 'Not specified')
      .replace('{{BUSINESS_NAME}}',        businessName        || 'Create tasteful placeholder branding')
      .replace('{{COLORS}}',              effectiveColorScheme)
      .replace('{{STYLE_DIRECTION}}',      styleDirFinal)
      .replace('{{SPECIAL_INSTRUCTIONS}}', specialInstructions || 'None')
      .replace('{{IMAGE_URL}}',            imageUrlValue)
      .replace('{{SVG_CONTENT}}',          svgContentValue)
      .replace('{{LAYOUT_BUDGET}}',        layoutBudget)
      .replace('{{DS_SPEC_NOTE}}',         dsSpecNote);

    const specResponse = await anthropic.messages.create({
      model: MODEL_SPEC,
      system: SYSTEM_DESIGNER,
      messages: [{ role: 'user', content: specContent }],
      max_tokens: doubleSided ? 2800 : (isLargeFormat ? 2200 : 1800),
      ...tempParam(MODEL_SPEC, 1),
    });

    let designSpec = getTextContent(specResponse);

    const specValidation = validateDesignSpec(designSpec);
    if (!specValidation.ok) {
      designSpec += `\n\nSPEC CORRECTION — before implementation, fix: ${specValidation.issues.join('; ')}. Lead with a bold one-sentence CONCEPT specific to this business, and a HERO MOMENT covering ≥30% of the canvas that embodies it.`;
    }

    // ── Pass 2: Developer implements spec as streaming HTML ──────────────────
    send({ phase: 2 });

    const htmlContent = HTML_PROMPT
      .replace('{{DESIGN_SPEC}}',          designSpec)
      .replace('{{PRODUCT_TYPE}}',         templateType)
      .replace('{{DIMENSIONS}}',           dimensions)
      .replace('{{BUSINESS_NAME}}',        businessName        || 'Create tasteful placeholder branding')
      .replace('{{INDUSTRY}}',             industry            || 'Not specified')
      .replace('{{COLORS}}',               effectiveColorScheme)
      .replace('{{STYLE_DIRECTION}}',      styleDirFinal)
      .replace('{{SPECIAL_INSTRUCTIONS}}', specialInstructions || 'None')
      .replace('{{IMAGE_URL}}',            imageUrlValue)
      .replace('{{SVG_CONTENT}}',          svgContentValue)
      .replace('{{LAYOUT_BUDGET}}',        layoutBudget)
      .replace('{{DS_HTML_NOTE}}',         dsHtmlNote);

    const stream = anthropic.messages.stream({
      model: MODEL_HTML,
      system: SYSTEM_DESIGNER,
      messages: [{ role: 'user', content: htmlContent }],
      max_tokens: 16000,
      ...tempParam(MODEL_HTML, 0.95),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text || '';
        if (text) send({ t: text });
      }
    }

    send({ done: true });

  } catch (err) {
    console.error('Anthropic error:', err);
    const message =
      err?.error?.message ||
      err?.message ||
      'Anthropic API request failed. Check your API key and try again.';
    send({ error: message });
  }
}

async function handleGenerateJson(body) {
  const { html } = body;
  if (!html) throw new Error('HTML is required.');

  const jsonContent = JSON_SCHEMA_PROMPT.replace('{{HTML}}', html);

  try {
    const completion = await anthropic.messages.create({
      model: MODEL_JSON,
      messages: [{ role: 'user', content: jsonContent }],
      max_tokens: 6000,
    });

    const raw = getTextContent(completion);
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
    const jsonStr   = jsonMatch ? jsonMatch[1].trim() : null;

    if (!jsonStr) {
      throw new Error('Could not extract JSON from response. Please try again.');
    }

    return { json: jsonStr };
  } catch (err) {
    console.error('Anthropic error (generate-json):', err);
    const message = err?.error?.message || err?.message || 'Anthropic API request failed.';
    throw new Error(message);
  }
}

window.handleGenerate = handleGenerate;
window.handleGenerateJson = handleGenerateJson;
})();
