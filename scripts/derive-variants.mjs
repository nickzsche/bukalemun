#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — scripts/derive-variants.mjs
   Two accent variants for every skin, switched with data-bk-accent="warm|cool".

   A variant is not a second palette somebody had to paint. It is the skin's own
   accent family rotated 30° in hue — toward red for "warm", toward blue for
   "cool" — with saturation and lightness left exactly where the skin put them,
   so a brutal yellow becomes a brutal orange and a vaporwave pink becomes a
   vaporwave coral. Page, surfaces, text and the status roles never move: they
   are what makes the skin the skin. Anything the rotation pushes below WCAG AA
   is re-fitted by lightness only, the same rule derive-contrast.mjs follows.

   The result is written into each skin file inside a regenerable block, one
   attribute longer than the block it shadows so it wins at every layer.

   Run: node scripts/derive-variants.mjs [--dry] [--verbose] [--only=a,b,c]
   ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadTokens, tokenMap, get, parseColor, toHex, rgbToHsl, hslToRgb, luminance, contrast, composite,
  fitLightness, pairsFor, VARIANTS, VARIANT_MARK, VARIANT_END, stripVariants
} from './lib/tokens.mjs';

// `color-mix(in srgb, a, b amount)`, the way the core builds hover and active.
const mixTowards = (a, b, amount) => ({
  r: a.r * (1 - amount) + b.r * amount,
  g: a.g * (1 - amount) + b.g * amount,
  b: a.b * (1 - amount) + b.b * amount,
  a: 1
});
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

const ROTATE = 30;                       // degrees of hue, per variant
const POLE = { warm: 30, cool: 210 };    // the hue each variant moves toward
const NEAR = 25;                         // a literal within this many degrees of an accent hue belongs to the family
const CHROMA_FLOOR = 0.08;               // below this chroma a colour is "grey" and only tints
const TINT = 0.14;                       // the saturation a grey accent takes on when tinted
const MARGIN = 1.04;                     // fit slightly past AA so hex rounding cannot land at 4.49

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const VERBOSE = args.includes('--verbose');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/* The accent family proper, plus every knob a skin routinely paints in its
   accent hue: rings, selections, glows, focus shadows, accent borders. A
   literal in one of these moves only if its hue is the accent's; a neutral ink
   shadow in the same knob stays put. */
const FAMILY = /^--bk-(primary|secondary)(-[a-z-]+)?$|^--bk-on-(primary|secondary)$/;
const ACCENTISH = new Set([
  '--bk-ring', '--bk-selection-bg', '--bk-selection-fg', '--bk-caret', '--bk-decor-1', '--bk-decor-2',
  '--bk-glow', '--bk-text-link', '--bk-field-border-hover', '--bk-field-shadow-focus',
  '--bk-btn-shadow', '--bk-btn-shadow-hover', '--bk-btn-shadow-active', '--bk-btn-gradient',
  '--bk-text-gradient', '--bk-card-shadow', '--bk-card-shadow-hover', '--bk-tooltip-bg', '--bk-tooltip-fg',
  '--bk-scrollbar-thumb', '--bk-overlay-border', '--bk-overlay-shadow',
  '--bk-border', '--bk-border-muted', '--bk-border-strong', '--bk-field-border', '--bk-card-border',
  '--bk-code-border', '--bk-divider-color',
  '--bk-shadow-xs', '--bk-shadow-sm', '--bk-shadow-md', '--bk-shadow-lg', '--bk-shadow-xl',
  '--bk-shadow-2xl', '--bk-shadow-inner'
]);
const eligible = (token) => FAMILY.test(token) || ACCENTISH.has(token);

/* ------------------------------------------------------------- colour ---- */

const hueDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/* HSL saturation lies at the extremes: a cream like #fffdf5 reports s = 1.
   Chroma — how far the colour actually sits from grey — is what decides
   whether a literal belongs to the accent family. */
const chroma = (hsl) => hsl.s * (1 - Math.abs(2 * hsl.l - 1));

/** Rotate `h` (degrees) 30° toward the variant's pole along the shorter arc. */
function rotate(h, variant) {
  const d = ((POLE[variant] - h + 540) % 360) - 180;
  const sign = Math.abs(d) >= 179 ? 1 : Math.sign(d) || 1;
  return (h + sign * ROTATE + 360) % 360;
}

function serialise(c) {
  return c.a < 1
    ? `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)} / ${Number(c.a.toFixed(3))})`
    : toHex(c);
}

/**
 * Shift one colour literal. `refs` are the accent hues in this mode; when the
 * skin has no chromatic accent at all, `refs` is empty and greys in the accent
 * family take on a faint tint instead of a rotation.
 */
function shiftLiteral(literal, variant, refs, tintAllowed) {
  const c = parseColor(literal);
  if (!c || c.a === 0) return literal;
  const hsl = rgbToHsl(c);
  const h = hsl.h * 360;
  if (refs.length) {
    if (chroma(hsl) < CHROMA_FLOOR) return literal;
    if (!refs.some((ref) => hueDistance(h, ref) <= NEAR)) return literal;
    return serialise({ ...hslToRgb({ h: rotate(h, variant) / 360, s: hsl.s, l: hsl.l }), a: c.a });
  }
  if (!tintAllowed || chroma(hsl) >= CHROMA_FLOOR || hsl.l <= 0.1 || hsl.l >= 0.97) return literal;
  return serialise({ ...hslToRgb({ h: POLE[variant] / 360, s: TINT, l: hsl.l }), a: c.a });
}

const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;

/** The chromatic accent hues of a resolved token map. */
function accentHues(map) {
  const hues = [];
  for (const token of ['--bk-primary', '--bk-secondary']) {
    const c = get(map, token);
    if (!c) continue;
    const hsl = rgbToHsl(c);
    if (chroma(hsl) >= CHROMA_FLOOR) hues.push(hsl.h * 360);
  }
  return hues;
}

/* --------------------------------------------------------------- main ---- */

const tokens = loadTokens(src, { includeGenerated: true, includeVariants: false });
const skins = Object.keys(tokens.SKINS).filter((s) => s !== 'default' && (!ONLY || ONLY.has(s)));

let written = 0;
let pinned = 0;
const notes = [];

for (const skin of skins) {
  const entry = tokens.SKINS[skin];
  const baseIsDark = Object.keys(entry.light).length > 0;
  const baseMode = baseIsDark ? 'dark' : 'light';
  const sections = [];

  for (const variant of VARIANTS) {
    /* --- 1. rotate the literals in every block the skin wrote -------------- */
    const rotated = { base: {}, light: {}, dark: {} };
    const modeOf = { base: baseMode, light: 'light', dark: 'dark' };
    let moved = 0;
    for (const block of ['base', 'light', 'dark']) {
      const refs = accentHues(tokenMap(tokens, skin, modeOf[block]));
      for (const [token, value] of Object.entries(entry[block])) {
        if (!eligible(token)) continue;
        const next = value.replace(LITERAL, (lit) => shiftLiteral(lit, variant, refs, FAMILY.test(token)));
        if (next !== value) { rotated[block][token] = next; moved++; }
      }
    }
    if (!moved) { notes.push(`${skin}/${variant}: nothing to rotate (achromatic accent at an extreme lightness)`); continue; }

    /* --- 2. audit the result and re-fit whatever the rotation broke -------- */
    const probe = { ...tokens, SKINS: { ...tokens.SKINS, [skin]: { ...entry, variants: { [variant]: rotated } } } };
    const pins = { light: {}, dark: {} };
    const current = { light: {}, dark: {} };
    const changed = new Set();
    for (const mode of ['light', 'dark']) {
      // A token is painted on several backgrounds (the page and three
      // surfaces, say), so it is fitted against all of them at once; fitting
      // pair by pair would let the last fit undo the first. Two rounds, so a
      // fix that shifts a fill also gets its label re-checked.
      for (let round = 0; round < 3; round++) {
        const probeMap = tokenMap(probe, skin, mode, variant);
        Object.assign(probeMap, pins[mode]);
        // A label is fitted against every background it is painted on, not
        // only the ones failing this round: the core derives hover and active
        // from the fill and the label, so a label moved for the fill can fail
        // on the active state next round, and fitting it against the active
        // state alone would undo the first fit.
        const every = new Map();
        const failing = new Map();
        const stateFails = [];
        for (const pair of pairsFor(probeMap)) {
          // The hover and active fills are mixed from the fill towards its own
          // label, so a label sitting just above AA on the fill drops below it
          // on hover. Those pairs are not the label's to fix: the state fill is
          // re-mixed away from the label instead, the way derive-contrast does.
          const st = pair.label.match(/^on-([a-z]+) over \1-(hover|active)$/);
          if (st) {
            if (pair.ratio + 0.005 < pair.min) stateFails.push({ role: st[1], state: st[2], min: pair.min });
            continue;
          }
          const e = every.get(pair.token) || { bgs: [], min: 0 };
          e.bgs.push(pair.bg);
          e.min = Math.max(e.min, pair.min);
          every.set(pair.token, e);
          if (pair.ratio + 0.005 >= pair.min) continue;
          const f = failing.get(pair.token) || { bgs: [], min: 0, labels: [] };
          f.labels.push(pair.label);
          failing.set(pair.token, f);
        }
        for (const [token, f] of failing) { f.bgs = every.get(token).bgs; f.min = every.get(token).min; }
        for (const { role, state, min } of stateFails) {
          const fillToken = `--bk-${role}`, onToken = `--bk-on-${role}`, stateToken = `--bk-${role}-${state}`;
          const fill = pins[mode][fillToken] ? parseColor(pins[mode][fillToken]) : get(probeMap, fillToken);
          const on = pins[mode][onToken] ? parseColor(pins[mode][onToken]) : get(probeMap, onToken);
          if (!fill || !on) continue;
          const pole = luminance(on) > luminance(fill) ? BLACK : WHITE;
          const base = state === 'hover' ? 0.08 : 0.14;
          for (const amount of [base, base + 0.08, base + 0.16, base + 0.3]) {
            const moved = mixTowards(fill, pole, amount);
            if (contrast(composite(on, moved), moved) >= min * MARGIN) {
              pins[mode][stateToken] = toHex(moved);
              changed.add(stateToken);
              pinned++;
              if (VERBOSE) console.log(`    ${skin}/${mode}/${variant} ${stateToken} → ${toHex(moved)} (mixed away from the label)`);
              break;
            }
          }
        }
        if (!failing.size && !stateFails.length) break;
        for (const [token, f] of failing) {
          const fixed = fitLightness(get(probeMap, token), f.bgs, f.min * MARGIN);
          if (fixed) {
            pins[mode][token] = toHex(fixed);
            changed.add(token);
            pinned++;
            if (VERBOSE) console.log(`    ${skin}/${mode}/${variant} ${token} → ${toHex(fixed)} (${f.labels.join(', ')})`);
            continue;
          }
          // No label in any lightness clears the bar against this fill (a
          // mid-lightness saturated fill beats black and white alike). Move
          // the fill instead, the minimum distance, and pair it with plain
          // black or white — the same last resort derive-contrast.mjs takes.
          const onRole = token.match(/^--bk-on-([a-z]+)$/);
          if (!onRole) continue;
          const fillToken = `--bk-${onRole[1]}`;
          const fill = get(probeMap, fillToken);
          if (!fill) continue;
          const ends = [{ r: 255, g: 255, b: 255, a: 1 }, { r: 0, g: 0, b: 0, a: 1 }];
          for (const fg of ends) {
            const moved = fitLightness(fill, [fg], f.min * MARGIN);
            if (!moved) continue;
            pins[mode][fillToken] = toHex(moved);
            pins[mode][token] = toHex(fg);
            changed.add(fillToken);
            changed.add(token);
            pinned += 2;
            if (VERBOSE) console.log(`    ${skin}/${mode}/${variant} ${fillToken} → ${toHex(moved)}, ${token} → ${toHex(fg)} (fill moved)`);
            break;
          }
        }
      }
      // A token pinned in one mode must be pinned in both, or the base block's
      // value leaks across. Record what each mode resolves to right now.
      const map = tokenMap(probe, skin, mode, variant);
      for (const token of Object.keys(map)) {
        const declared = map[token];
        const colour = get(map, token);
        if (colour) current[mode][token] = parseColor(declared) ? declared : toHex(colour);
      }
    }

    /* --- 3. assemble the three blocks ------------------------------------ */
    const blocks = { base: { ...rotated.base }, light: { ...rotated.light }, dark: { ...rotated.dark } };
    const target = (mode) => (baseIsDark ? (mode === 'dark' ? 'base' : 'light') : (mode === 'light' ? 'base' : 'dark'));
    for (const token of changed) {
      for (const mode of ['light', 'dark']) {
        blocks[target(mode)][token] = pins[mode][token] || current[mode][token];
      }
    }
    const prefix = `[data-bk-style="${skin}"][data-bk-accent="${variant}"]`;
    const emit = (selector, decls) => {
      const keys = Object.keys(decls).sort();
      if (keys.length) sections.push(`${selector} {\n${keys.map((k) => `  ${k}: ${decls[k]};`).join('\n')}\n}`);
    };
    emit(prefix, blocks.base);
    emit(`${prefix}[data-bk-theme="light"]`, blocks.light);
    emit(`${prefix}[data-bk-theme="dark"]`, blocks.dark);
  }

  const raw = readFileSync(entry.file, 'utf8');
  const clean = stripVariants(raw).replace(/\s+$/, '') + '\n';
  if (!sections.length) {
    if (!DRY && raw !== clean) writeFileSync(entry.file, clean);
    continue;
  }
  const block =
    `\n${VARIANT_MARK}\n` +
    `     "warm" and "cool" rotate the skin's accent family 30° in hue, keeping\n` +
    `     saturation and lightness; anything that then fails WCAG AA is re-fitted\n` +
    `     by lightness only. Regenerate with: npm run contrast:fix              */\n` +
    sections.join('\n') + '\n' +
    `${VARIANT_END}\n`;
  if (!DRY) writeFileSync(entry.file, clean + block);
  written++;
}

console.log(`\n  ${DRY ? 'Would write' : 'Wrote'} accent variants for ${written} skins (${pinned} contrast re-fits)`);
for (const n of notes) console.log('    ' + n);
console.log('');
