#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — scripts/derive-contrast.mjs
   Every skin picks its own accent colours for how they look as *fills*. Those
   same accents are also painted as *text* (soft buttons, badges, links), where
   they often fail WCAG. Rather than hand-tune 50 palettes, this tool derives
   the accessible variants: it keeps each accent's hue and saturation and moves
   only its lightness until the pair passes, then writes the result back into
   the skin file inside a regenerable block.

   Run: node scripts/derive-contrast.mjs [--dry]
   ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadTokens, tokenMap, get, contrast, composite, fitLightness, toHex, parseColor, luminance,
  ROLES, AA, AA_LARGE, GENERATED_MARK, GENERATED_END, stripGenerated
} from './lib/tokens.mjs';

// Derive to a slightly higher bar than we test against: lightness moves in 1%
// steps and hex rounds, so aiming exactly at 4.5 can land at 4.49.
const MARGIN = 1.04;
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

// `color-mix(in srgb, a, b amount)`, the way the core builds hover and active.
const mixTowards = (a, b, amount) => ({
  r: a.r * (1 - amount) + b.r * amount,
  g: a.g * (1 - amount) + b.g * amount,
  b: a.b * (1 - amount) + b.b * amount,
  a: 1
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src');
const DRY = process.argv.includes('--dry');

const tokens = loadTokens(src, { includeGenerated: false });
const skins = Object.keys(tokens.SKINS).filter((s) => s !== 'default');

let totalFixes = 0;
const report = [];

for (const skin of skins) {
  const entry = tokens.SKINS[skin];
  // A skin whose base palette is dark declares a `light` override instead of a
  // `dark` one. Its derived values therefore belong in the opposite blocks.
  const baseIsDark = Object.keys(entry.light).length > 0;

  // Per mode: the current value of every token we manage, plus any fix.
  const perMode = { light: { current: {}, fixed: {} }, dark: { current: {}, fixed: {} } };
  const changed = new Set();

  for (const mode of ['light', 'dark']) {
    const map = tokenMap(tokens, skin, mode);
    const bg = get(map, '--bk-bg');
    if (!bg) continue;
    const surface = get(map, '--bk-surface');
    const surface2 = get(map, '--bk-surface-2');
    const surface3 = get(map, '--bk-surface-3');
    const flat = (c) => (c ? composite(c, bg) : null);
    const layers = [bg, flat(surface), flat(surface2), flat(surface3)].filter(Boolean);
    const slot = perMode[mode];

    const track = (token, color) => {
      if (!color) return;
      const declared = map[token];
      // Keep a literal declaration verbatim so translucent chips stay
      // translucent. A `var()` link, though, must be flattened: the token it
      // points at may itself be pinned per mode, and following it would drag a
      // light-mode fix into dark mode.
      slot.current[token] =
        declared !== undefined && parseColor(declared) ? declared : toHex(color);
    };
    const fix = (token, color) => {
      slot.fixed[token] = color;
      changed.add(token);
      totalFixes++;
      report.push(`${skin}/${mode} ${token} → ${toHex(color)}`);
    };

    /* --- body text ramp ------------------------------------------------- */
    for (const [token, min] of [['--bk-text', AA], ['--bk-text-muted', AA], ['--bk-text-subtle', AA_LARGE]]) {
      const current = get(map, token);
      track(token, current);
      if (!current) continue;
      const worst = Math.min(...layers.map((l) => contrast(composite(current, l), l)));
      if (worst + 0.005 >= min) continue;
      const fixed = fitLightness(current, layers, min * MARGIN);
      if (fixed) fix(token, fixed);
    }

    /* --- accents ---------------------------------------------------------- */
    for (const role of ROLES) {
      const fill = get(map, `--bk-${role}`);
      const soft = get(map, `--bk-${role}-soft`);

      // The label printed *on* a solid fill.
      const onToken = `--bk-on-${role}`;
      const onCurrent = get(map, onToken);
      const fillToken = `--bk-${role}`;
      track(onToken, onCurrent);
      track(fillToken, fill);
      if (fill && onCurrent) {
        const fillFlat = flat(fill);
        if (contrast(composite(onCurrent, fillFlat), fillFlat) + 0.005 < AA) {
          const fixed = fitLightness(onCurrent, [fillFlat], AA * MARGIN);
          if (fixed) {
            fix(onToken, fixed);
          } else {
            // No foreground in this hue clears the bar against this fill, so
            // the fill is the thing that has to move. Keep its hue, shift its
            // lightness the minimum amount, and pair it with plain black/white.
            const fg = [WHITE, BLACK].sort(
              (a, b) => contrast(b, fillFlat) - contrast(a, fillFlat)
            )[0];
            const movedFill = fitLightness(fill, [fg], AA * MARGIN);
            if (movedFill) { fix(fillToken, movedFill); fix(onToken, fg); }
          }
        }
      }

      // The label has to survive the fill moving under the pointer. The core
      // derives hover/active from the fill and its label, which is safe for
      // any pair with a little contrast to spare; a pair sitting right at AA,
      // or a skin's own hand-picked hover, can still fall short. Move the
      // hover (its hue kept) rather than the label, which is shared by all
      // three fills.
      for (const state of ['hover', 'active']) {
        const stateToken = `--bk-${role}-${state}`;
        const amount = state === 'hover' ? 0.08 : 0.14;
        const onNow = slot.fixed[onToken] || onCurrent;
        const fillNow = slot.fixed[fillToken] || fill;
        // The core derives these from the fill and its label. If either was
        // just moved, judge the value the browser will actually compute from
        // the moved pair, not the one resolved from the palette as written.
        const derived = /color-mix\(/.test(map[stateToken] || '');
        const stateFill = derived && fillNow && onNow
          ? mixTowards(fillNow, onNow, amount)
          : get(map, stateToken);
        track(stateToken, stateFill);
        if (!stateFill || !onNow) continue;
        const stateFlat = flat(stateFill);
        // Judged with the deriver's own margin: a derived value that only just
        // clears AA in float can land at 4.49 once it is pinned as rounded hex.
        if (contrast(composite(onNow, stateFlat), stateFlat) >= AA * MARGIN) continue;
        // Mix the same distance the other way: away from the label, towards
        // whichever of black and white lies on the far side of the fill from
        // it. Contrast can only go up, and the step stays as visible as the
        // derived one would have been.
        const pole = luminance(onNow) > luminance(fillNow) ? BLACK : WHITE;
        fix(stateToken, mixTowards(fillNow, pole, amount));
      }

      // The accent used as text on the page, a card, or a tinted surface.
      const textToken = `--bk-${role}-text`;
      const textCurrent = get(map, textToken) || fill;
      track(textToken, textCurrent);
      if (textCurrent) {
        const against = [bg, flat(surface), flat(surface2)].filter(Boolean);
        const worst = Math.min(...against.map((l) => contrast(composite(textCurrent, l), l)));
        if (worst + 0.005 < AA) {
          const fixed = fitLightness(textCurrent, against, AA * MARGIN);
          if (fixed) fix(textToken, fixed);
        }
      }

      // The accent used as text on its own soft fill. A skin is free to keep a
      // pale soft chip in dark mode, so this is judged against the chip alone.
      const onSoftToken = `--bk-${role}-on-soft`;
      const onSoftCurrent = get(map, onSoftToken) || textCurrent;
      track(onSoftToken, onSoftCurrent);
      const softToken = `--bk-${role}-soft`;
      track(softToken, soft);
      if (soft && onSoftCurrent) {
        const chip = flat(soft);
        if (contrast(composite(onSoftCurrent, chip), chip) + 0.005 < AA) {
          const fixed = fitLightness(onSoftCurrent, [chip], AA * MARGIN);
          if (fixed) {
            fix(onSoftToken, fixed);
          } else {
            const fg = [WHITE, BLACK].sort((a, b) => contrast(b, chip) - contrast(a, chip))[0];
            // A translucent chip is a wash over the page; re-tinting it by
            // lightness would make it opaque and change the skin. Only move
            // chips that are already solid colours.
            const movedChip = soft.a >= 1 ? fitLightness(soft, [fg], AA * MARGIN) : null;
            if (movedChip) { fix(softToken, movedChip); fix(onSoftToken, fg); }
            else fix(onSoftToken, fg);
          }
        }
      }
    }

    /* --- odds and ends ---------------------------------------------------- */
    const fieldBg = flat(get(map, '--bk-field-bg'));
    const placeholder = get(map, '--bk-field-placeholder');
    track('--bk-field-placeholder', placeholder);
    if (fieldBg && placeholder && contrast(composite(placeholder, fieldBg), fieldBg) + 0.005 < AA_LARGE) {
      const fixed = fitLightness(placeholder, [fieldBg], AA_LARGE * MARGIN);
      if (fixed) fix('--bk-field-placeholder', fixed);
    }

    // Inverted chips and the .bk-surface-inverted utility paint text-inverted
    // on surface-inverted. A skin that flips one in dark mode and forgets the
    // other ends up with dark on dark.
    const invBg = flat(get(map, '--bk-surface-inverted'));
    const invFg = get(map, '--bk-text-inverted');
    track('--bk-text-inverted', invFg);
    if (invBg && invFg && contrast(composite(invFg, invBg), invBg) + 0.005 < AA) {
      const fixed = fitLightness(invFg, [invBg], AA * MARGIN);
      if (fixed) fix('--bk-text-inverted', fixed);
    }

    const tipBg = flat(get(map, '--bk-tooltip-bg'));
    const tipFg = get(map, '--bk-tooltip-fg');
    track('--bk-tooltip-fg', tipFg);
    if (tipBg && tipFg && contrast(composite(tipFg, tipBg), tipBg) + 0.005 < AA) {
      const fixed = fitLightness(tipFg, [tipBg], AA * MARGIN);
      if (fixed) fix('--bk-tooltip-fg', fixed);
    }
  }

  /* --- write the block back ----------------------------------------------- */
  // A token fixed in one mode must be pinned in *both*, otherwise the base
  // block's light value leaks into dark mode (or vice versa) and undoes a
  // pairing that was previously fine.
  // `--bk-R-on-soft` defaults to `--bk-R-text`, and `--bk-on-R` pairs with
  // `--bk-R`. Pinning one without the other lets a fix for the page background
  // leak onto a chip (or vice versa), so close the set over those links.
  for (const role of ROLES) {
    const linked = [`--bk-${role}-text`, `--bk-${role}-on-soft`];
    if (linked.some((t) => changed.has(t))) linked.forEach((t) => changed.add(t));
    const pairTokens = [`--bk-${role}`, `--bk-on-${role}`, `--bk-${role}-soft`];
    if (pairTokens.some((t) => changed.has(t))) pairTokens.forEach((t) => changed.add(t));
  }

  const blocks = { base: {}, light: {}, dark: {} };
  for (const mode of ['light', 'dark']) {
    const slot = perMode[mode];
    const target = baseIsDark
      ? (mode === 'dark' ? 'base' : 'light')
      : (mode === 'light' ? 'base' : 'dark');
    for (const token of changed) {
      if (slot.fixed[token]) blocks[target][token] = toHex(slot.fixed[token]);
      else if (slot.current[token]) blocks[target][token] = slot.current[token];
    }
  }

  const raw = readFileSync(entry.file, 'utf8');
  const clean = stripGenerated(raw).replace(/\s+$/, '') + '\n';

  const sections = [];
  const emit = (selector, decls) => {
    const keys = Object.keys(decls).sort();
    if (!keys.length) return;
    sections.push(`${selector} {\n${keys.map((k) => `  ${k}: ${decls[k]};`).join('\n')}\n}`);
  };
  emit(`[data-bk-style="${skin}"]`, blocks.base);
  emit(`[data-bk-style="${skin}"][data-bk-theme="light"]`, blocks.light);
  emit(`[data-bk-style="${skin}"][data-bk-theme="dark"]`, blocks.dark);

  if (!sections.length) {
    if (!DRY && raw !== clean) writeFileSync(entry.file, clean);
    continue;
  }

  const block =
    `\n${GENERATED_MARK}\n` +
    `     Hue and saturation are the skin's; only lightness moved, and only far\n` +
    `     enough to clear WCAG AA. Regenerate with: npm run contrast:fix        */\n` +
    sections.join('\n') + '\n' +
    `${GENERATED_END}\n`;

  if (!DRY) writeFileSync(entry.file, clean + block);
}

console.log(`\n  ${DRY ? 'Would derive' : 'Derived'} ${totalFixes} contrast fixes across ${skins.length} skins`);
if (process.argv.includes('--verbose')) report.forEach((r) => console.log('    ' + r));
console.log('');
