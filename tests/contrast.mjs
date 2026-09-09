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
import { loadTokens, tokenMap, pairsFor } from '../scripts/lib/tokens.mjs';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const VERBOSE = process.argv.includes('--verbose');

const tokens = loadTokens(src);
const skins = Object.keys(tokens.SKINS);

let checked = 0;
const failures = [];

for (const skin of skins) {
  for (const mode of ['light', 'dark']) {
    for (const pair of pairsFor(tokenMap(tokens, skin, mode))) {
      checked++;
      if (pair.ratio + 0.005 < pair.min) failures.push({ skin, mode, ...pair });
      else if (VERBOSE) console.log(`    ${skin}/${mode}  ${pair.label}  ${pair.ratio.toFixed(2)}`);
    }
  }
}

// `skins` includes the neutral `default` palette, which is not a skin file.
// Saying "51 skins" next to a README that says 50 invites someone to count.
const skinCount = skins.filter((s) => s !== 'default').length;
console.log(
  `\n\x1b[1mBukalemun contrast audit\x1b[0m — ${checked} pairs, ` +
  `${skinCount} skins + the default palette, light and dark\n`
);

if (!failures.length) {
  console.log('\x1b[32m\x1b[1m  every pair meets its WCAG target\x1b[0m\n');
  process.exit(0);
}

const grouped = {};
for (const f of failures) (grouped[`${f.skin}/${f.mode}`] ||= []).push(f);
for (const [key, list] of Object.entries(grouped)) {
  console.log(`\x1b[31m  ${key}\x1b[0m`);
  for (const f of list.sort((a, b) => a.ratio - b.ratio)) {
    console.log(`    ${f.label.padEnd(36)} ${f.ratio.toFixed(2).padStart(6)}  (needs ${f.min})`);
  }
}
console.log(`\n\x1b[31m\x1b[1m  ${failures.length} failing pairs\x1b[0m\n`);
process.exit(1);
