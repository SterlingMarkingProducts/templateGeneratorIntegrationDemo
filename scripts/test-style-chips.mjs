/* The visible Style Direction chip set: the curated list, deterministic
   resolution onto the Phase 1 direction system, and the polished (non-cartoon)
   Playful Contemporary. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const HTML = readFileSync(REPO + '/generator/index.html', 'utf8');
globalThis.window = {};
globalThis.fetch = async () => ({ ok: false, status: 404 });
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { chooseCreativeDirection, expandStyleDirection, DIRECTION_STYLE_CHIPS,'
  + ' STYLE_CHIP_MAP, DIRECTION_BY_KEY, CHIP_DENSITY, DEFAULT_DIRECTION_POOL, recentDirections };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const choose = (style) => P.chooseCreativeDirection(style, 'dentist', 'Sign', 'balanced',
  'chip-' + style + Math.random(), false, 36, 24, null);

console.log('\n1  the visible chip list is exactly the curated set');
const chips = [...HTML.matchAll(/class="style-chip(?: style-chip--surprise)?"(?:[^>]*data-style="([^"]+)")?[^>]*>([^<]+)</g)]
  .map((m) => ({ style: m[1] || null, label: m[2].trim() }));
const WANT = ['Editorial Minimal', 'Modern Luxury', 'Bold Modernist', 'Clean Corporate',
  'Elegant Serif', 'Organic Botanical', 'Soft Sophisticated', 'Colourful Expressive',
  'Collage Editorial', 'Playful Contemporary', 'Japanese Minimal', 'Dark Luxe',
  'Geometric Professional', 'Art Deco', 'Fashion Editorial', 'Heritage Press', 'Gilded Emerald',
  'Watercolor'];
is(chips.length === 19, 'nineteen chips: eighteen styles plus Surprise Me', chips.length + '');
is(JSON.stringify(chips.slice(0, 18).map((c) => c.style)) === JSON.stringify(WANT),
   'in the requested order, with data-style names intact');
is(/Surprise Me/.test(chips[18].label) && chips[18].style === null,
   'Surprise Me closes the list and carries no style of its own');
const REMOVED = ['Synthwave', 'Psychedelic', 'Y2K Chrome', 'Pop Art', 'Primary Pop',
  'Memphis Bold', 'Neo-Brutalism', 'Cosmic', 'Dark Tech', 'Luxury Max', 'Sage Standard',
  'Deckle Press', 'Corporate Professional', 'Organic Warm'];
is(REMOVED.every((r) => !HTML.includes('>' + r + '<') && !HTML.includes('data-style="' + r)),
   'none of the removed chip labels or values survives in the page');

console.log('\n2  every chip resolves deterministically to its intended direction');
const DIRECTION_CHIPS = {
  'Editorial Minimal': 'editorial-minimal', 'Modern Luxury': 'modern-luxury',
  'Bold Modernist': 'bold-modernist', 'Clean Corporate': 'clean-corporate',
  'Elegant Serif': 'elegant-serif', 'Organic Botanical': 'organic-botanical',
  'Soft Sophisticated': 'soft-sophisticated', 'Colourful Expressive': 'colourful-expressive',
  'Collage Editorial': 'collage-editorial', 'Dark Luxe': 'dark-luxe',
};
let dirOk = true;
for (const [chip, key] of Object.entries(DIRECTION_CHIPS)) {
  const c = choose(chip);
  const d = P.DIRECTION_BY_KEY[key];
  if (c.direction !== key || !c.text.startsWith(d.brief.slice(0, 60))) {
    dirOk = false; console.log('     BAD ' + chip + ' -> ' + c.direction);
  }
}
is(dirOk, 'the ten direction chips land on their Phase 1 direction — key, brief, density and asset families');
const MAP_CHIPS = {
  'Japanese Minimal': 'Japanese Minimalism —', 'Heritage Press': 'Torn-Paper Editorial —',
  'Geometric Professional': 'Geometric Professional —', 'Playful Contemporary': 'Playful Contemporary —',
  'Art Deco': 'Art Deco Revival —', 'Fashion Editorial': 'High-Fashion Editorial —',
  'Gilded Emerald': 'Emerald & Gold Foil —',
};
let mapOk = true;
for (const [chip, prefix] of Object.entries(MAP_CHIPS)) {
  const c = choose(chip);
  if (!c.text.startsWith(prefix)) { mapOk = false; console.log('     BAD ' + chip + ' -> ' + c.text.slice(0, 50)); }
}
is(mapOk, 'the seven brief chips expand to their internal briefs — no duplicates invented');
let det = true;
for (const chip of WANT) {
  const a = choose(chip).text, b = choose(chip).text;
  const strip = (t) => t.split('\n').filter((l) => !/creativity|CREATIVE/i.test(l)).join('\n');
  if (strip(a) !== strip(b)) { det = false; console.log('     NONDET ' + chip); }
}
is(det, 'every chip resolves to the same style text on every click — no random archetype riffs');

console.log('\n3  Playful Contemporary is polished, not a kids brand');
const pc = choose('Playful Contemporary').text;
is(/rounded-but-adult|completely professional/.test(pc), 'the chip carries the studio-grade brief');
is(/NO confetti/.test(pc) && /NO sticker outlines/.test(pc) && /cartoon or bubble typography/.test(pc),
   'and bans confetti, stickers, blobs and cartoon type outright');
is(!/Fredoka|Baloo|bubblegum|sunshine yellow/.test(pc),
   'no cartoon fonts or candy palette anywhere in it');
is(/coral|teal|marigold|cobalt/.test(pc), 'while staying genuinely colourful');
const typedPlayful = P.chooseCreativeDirection('fun and playful for kids', 'daycare', 'Sign',
  'balanced', 'tp1', false, 36, 24, null);
is(/Fredoka|confetti|sticker|playful/i.test(typedPlayful.text),
   'a TYPED playful/kids style still reaches the full playful language');

console.log('\n4  Surprise Me and free text');
P.recentDirections.clear();
const surprise = new Set();
for (let i = 0; i < 300; i++) {
  const c = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'sm' + (i % 20),
    false, 36, 24, null);
  if (c.direction) surprise.add(c.direction);
}
is([...surprise].every((k) => P.DEFAULT_DIRECTION_POOL.indexOf(k) !== -1)
   && !surprise.has('playful-contemporary'),
   'Surprise Me (empty style) draws only from the approved default pool',
   surprise.size + ' directions');
const free = P.chooseCreativeDirection('WPA travel poster', 'tourism', 'Poster',
  'balanced', 'ft1', false, 24, 18, null);
is(free.direction === null && free.text.length > 100,
   'typed free-text style directions still work normally');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
