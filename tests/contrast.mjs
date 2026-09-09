#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — tests/contrast.mjs
   Static WCAG contrast audit. Resolves the token graph the way a browser would
   (var() chains, fallbacks, alpha compositing) and checks every foreground /
   background pair the components actually paint, for every skin in both colour
   modes. No browser, no dependencies — it runs in CI and in `npm test`.

   Run:  node tests/contrast.mjs [--verbose]
   ========================================================================== */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokens, tokenMap, pairsFor, combinations } from '../scripts/lib/tokens.mjs';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const VERBOSE = process.argv.includes('--verbose');

const tokens = loadTokens(src);
const skins = Object.keys(tokens.SKINS);

let checked = 0;
const failures = [];

// Every skin, both modes, and each accent variant a skin carries — a variant
// is a palette like any other and gets audited like one.
let variantCombos = 0;
for (const { skin, mode, variant } of combinations(tokens)) {
  if (variant) variantCombos++;
  const key = variant ? `${skin}/${mode}/${variant}` : `${skin}/${mode}`;
  for (const pair of pairsFor(tokenMap(tokens, skin, mode, variant))) {
    checked++;
    if (pair.ratio + 0.005 < pair.min) failures.push({ key, ...pair });
    else if (VERBOSE) console.log(`    ${key}  ${pair.label}  ${pair.ratio.toFixed(2)}`);
  }
}

// `skins` includes the neutral `default` palette, which is not a skin file.
// Saying "51 skins" next to a README that says 50 invites someone to count.
const skinCount = skins.filter((s) => s !== 'default').length;
console.log(
  `\n\x1b[1mBukalemun contrast audit\x1b[0m — ${checked} pairs, ` +
  `${skinCount} skins + the default palette, light and dark` +
  (variantCombos ? `, plus ${variantCombos} accent-variant palettes` : '') + '\n'
);

if (!failures.length) {
  console.log('\x1b[32m\x1b[1m  every pair meets its WCAG target\x1b[0m\n');
  process.exit(0);
}

const grouped = {};
for (const f of failures) (grouped[f.key] ||= []).push(f);
for (const [key, list] of Object.entries(grouped)) {
  console.log(`\x1b[31m  ${key}\x1b[0m`);
  for (const f of list.sort((a, b) => a.ratio - b.ratio)) {
    console.log(`    ${f.label.padEnd(36)} ${f.ratio.toFixed(2).padStart(6)}  (needs ${f.min})`);
  }
}
console.log(`\n\x1b[31m\x1b[1m  ${failures.length} failing pairs\x1b[0m\n`);
process.exit(1);
