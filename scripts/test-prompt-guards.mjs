/* Prompt-generation guards for the Phase 1 design-quality change.
   Asserts what the always-on prompts now say — and, just as importantly, that
   the print-fit / legibility / bleed rules were not touched. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
let src = readFileSync(REPO + '/generator/engine.js', 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { SYSTEM_DESIGNER, SPEC_PROMPT, HTML_PROMPT, DENSITY_CONTRACTS,'
  + ' DESIGN_DIRECTIONS, resolveCreativeDirection, getColorGuidance, getCreativityDirective };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
globalThis.window = {};
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
const app = readFileSync(REPO + '/generator/app.js', 'utf8');

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const ALL = P.SYSTEM_DESIGNER + '\n' + P.SPEC_PROMPT + '\n' + P.HTML_PROMPT;

console.log('\n1  the universal maximalist floor is gone');
is(!/maximalist by instinct/i.test(P.SYSTEM_DESIGNER), 'no "maximalist by instinct" personality');
is(!/RICHNESS BAR/.test(P.SYSTEM_DESIGNER), 'no RICHNESS BAR');
is(!/Aim for 4[–-]6 on cards/.test(ALL), 'no unconditional 4–6 element quota');
is(!/Sparse, thin.*is a FAIL/i.test(P.SYSTEM_DESIGNER), 'sparse output is no longer an automatic failure');
is(!/NEVER one flat fill with type dropped on top/.test(ALL), 'a flat ground is no longer forbidden outright');
is(/CRAFT BAR/.test(P.SYSTEM_DESIGNER), 'a density-neutral craft bar replaces it');

console.log('\n2  density follows the direction');
is(Object.keys(P.DENSITY_CONTRACTS).join(',') === 'restrained,balanced,rich', 'three contracts exist');
is(/1[–-]3 graphic elements/.test(P.DENSITY_CONTRACTS.restrained)
   && /4[–-]6 integrated graphic elements/.test(P.DENSITY_CONTRACTS.rich),
   'restrained and rich ask for different amounts');
is(/FINISHED WORK/.test(P.SYSTEM_DESIGNER), 'the system prompt states restrained output is finished work');
for (const d of P.DESIGN_DIRECTIONS.slice(0, 3)) {
  const out = P.resolveCreativeDirection('', '', 'Business Card', 'balanced');
  is(/DESIGN DENSITY/.test(out), 'the density contract reaches the Style Direction');
  break;
}
const restrained = P.DESIGN_DIRECTIONS.filter((d) => d.density === 'restrained').length;
is(restrained >= 4, 'several directions are genuinely restrained', restrained + '/' + P.DESIGN_DIRECTIONS.length);

console.log('\n3  the style funnels are gone');
is(!/Do NOT default to editorial serifs/.test(ALL), 'no blanket serif ban');
is(/Cormorant.*exactly right for elegant serif/i.test(P.SYSTEM_DESIGNER),
   'editorial serifs are now correct for the directions that want them');
is(!/STRICTLY FORBIDDEN as background or primary/.test(P.getColorGuidance('legal')),
   'no blanket blue prohibition in the colour guidance');
is(!/Prefer charcoal\+gold/.test(P.getColorGuidance('')), 'no dark+metallic replacement funnel');
is(/professional blue is welcome/i.test(P.getColorGuidance('')), 'professional blue is allowed when it fits');
is(!/Do NOT use navy\/royal\/corporate blue/.test(P.HTML_PROMPT), 'the anti-pattern blue ban is gone');
is(/RECIPES FOR RESTRAINED DIRECTIONS/.test(P.HTML_PROMPT), 'restrained directions now have code recipes too');

console.log('\n4  one seed, no unrelated second draw');
is(typeof P.DESIGN_DIRECTIONS !== 'undefined' && P.DESIGN_DIRECTIONS.length === 12,
   'a single balanced pool of 12 directions');
is(!/DIVERSE_STYLES\[Math\.floor/.test(src) && !/archetypePool\[Math\.floor/.test(src),
   'the two-random-picks default is removed from the code path');
const jm = P.resolveCreativeDirection('Japanese Minimalism', '', 'Business Card', 'balanced');
is(!/INSPIRATION DIRECTION/.test(jm),
   'an unrouted style no longer collects a random bold archetype');

console.log('\n5  creativity defaults to balanced');
is(!/creativityLevel\?\.value \|\| 'bold'/.test(app), "no 'bold' fallback left in app.js");
is((app.match(/creativityLevel\?\.value \|\| 'balanced'/g) || []).length === 2,
   'both call sites default to balanced');
is(/AMBITION: BALANCED/.test(P.getCreativityDirective('balanced')), 'balanced yields the balanced directive');
is(/PORTFOLIO BOLD/.test(P.getCreativityDirective('bold')), 'bold is still reachable if ever wired up');

console.log('\n6  print, fit, legibility and bleed rules are untouched');
for (const [needle, name] of [
  ['EVERYTHING MUST FIT', 'system: everything-must-fit'],
  ['Every glyph must be fully visible inside the canvas', 'system: every glyph visible'],
  ['FIT IS MANDATORY', 'html: fit is mandatory'],
  ['NOTHING CROSSES TEXT', 'html: nothing crosses text'],
  ['TEXT LAYOUT — this structure makes text overlap and clipping STRUCTURALLY IMPOSSIBLE', 'html: flex zone model'],
  ['@media print', 'html: print rules'],
  ['TEXT-SAFE ZONE', 'spec: text-safe zone'],
  ['Any text clipped, cut off, hidden, or overlapping other text', 'system: no clipped text'],
]) is(ALL.includes(needle), name);

console.log('\n7  stamps are untouched');
const st = P.resolveCreativeDirection('', '', 'Self-Inking Stamp', 'balanced');
is(/monochromatic black ink on white ONLY/.test(st), 'stamp rules still apply');
is(!/DESIGN DENSITY/.test(st), 'and stamps get no density contract');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
