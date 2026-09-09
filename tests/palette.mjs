#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — tests/palette.mjs
   A lockfile for how each skin actually looks.

   The contrast audit proves a skin is *legible*; it says nothing about whether
   it still looks like itself. A refactor of the token graph, a stray override,
   or a re-run of the contrast deriver can quietly repaint a skin and every
   other test stays green. So: resolve the tokens that define a skin's identity,
   snapshot them, and diff on every run.

   node tests/palette.mjs            check against tests/palette.lock.json
   node tests/palette.mjs --update   rewrite the lockfile (review the diff!)
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokens, tokenMap, get, toHex, ROLES } from '../scripts/lib/tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const lockPath = join(here, 'palette.lock.json');
const UPDATE = process.argv.includes('--update');

/* The tokens that carry a skin's identity. Colours are resolved to hex so a
   var() refactor is invisible; shape and type tokens are kept verbatim so a
   changed radius or family shows up as a change. */
const COLOUR_TOKENS = [
  '--bk-bg', '--bk-surface', '--bk-surface-2', '--bk-surface-3',
  '--bk-surface-inverted', '--bk-text', '--bk-text-muted', '--bk-text-subtle',
  '--bk-border', '--bk-border-muted', '--bk-border-strong', '--bk-ring',
  '--bk-tooltip-bg', '--bk-tooltip-fg', '--bk-field-bg', '--bk-field-border',
  '--bk-code-bg', '--bk-overlay-surface',
  ...ROLES.flatMap((r) => [
    `--bk-${r}`, `--bk-${r}-soft`, `--bk-${r}-border`,
    `--bk-on-${r}`, `--bk-${r}-text`, `--bk-${r}-on-soft`
  ])
];

const LITERAL_TOKENS = [
  '--bk-font-sans', '--bk-font-display', '--bk-font-mono',
  '--bk-heading-weight', '--bk-heading-transform', '--bk-heading-tracking',
  '--bk-label-transform', '--bk-radius-scale', '--bk-radius-field',
  '--bk-radius-card', '--bk-radius-pill', '--bk-border-width', '--bk-border-style',
  '--bk-btn-radius', '--bk-btn-shadow', '--bk-btn-weight', '--bk-btn-transform',
  '--bk-card-shadow', '--bk-card-border-width', '--bk-field-shadow',
  '--bk-press-transform', '--bk-hover-transform', '--bk-transition',
  '--bk-body-image', '--bk-surface-image'
];

const tokens = loadTokens(src);

function snapshot() {
  const out = {};
  for (const skin of Object.keys(tokens.SKINS).sort()) {
    for (const mode of ['light', 'dark']) {
      const map = tokenMap(tokens, skin, mode);
      const entry = {};
      for (const t of COLOUR_TOKENS) {
        const c = get(map, t);
        if (c) entry[t] = c.a < 1 ? `${toHex(c)}@${c.a.toFixed(2)}` : toHex(c);
      }
      for (const t of LITERAL_TOKENS) {
        if (map[t] !== undefined) entry[t] = map[t].replace(/\s+/g, ' ').trim();
      }
      out[`${skin}/${mode}`] = entry;
    }
  }
  return out;
}

const current = snapshot();

if (UPDATE || !existsSync(lockPath)) {
  writeFileSync(lockPath, JSON.stringify(current, null, 2) + '\n');
  const n = Object.keys(current).length;
  console.log(`\n  palette.lock.json written — ${n} skin/mode snapshots\n`);
  process.exit(0);
}

const locked = JSON.parse(readFileSync(lockPath, 'utf8'));
const drift = [];

for (const key of new Set([...Object.keys(locked), ...Object.keys(current)])) {
  const a = locked[key];
  const b = current[key];
  if (!a) { drift.push({ key, token: '(whole skin)', from: '—', to: 'added' }); continue; }
  if (!b) { drift.push({ key, token: '(whole skin)', from: 'present', to: 'removed' }); continue; }
  for (const token of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[token] !== b[token]) {
      drift.push({ key, token, from: a[token] ?? '—', to: b[token] ?? '—' });
    }
  }
}

const total = Object.keys(current).length;
// Derived, not written down: a hardcoded "50 skins" here is the same stale-copy
// trap the prose already has a test for.
const palettes = new Set(Object.keys(current).map((k) => k.split('/')[0]));
const skinCount = [...palettes].filter((p) => p !== 'default').length;
console.log(
  `\n\x1b[1mBukalemun palette lock\x1b[0m — ${total} snapshots ` +
  `(${skinCount} skins + the default, light and dark)\n`
);

if (!drift.length) {
  console.log('\x1b[32m\x1b[1m  every skin resolves exactly as locked\x1b[0m\n');
  process.exit(0);
}

const grouped = {};
for (const d of drift) (grouped[d.key] ||= []).push(d);
for (const [key, list] of Object.entries(grouped)) {
  console.log(`\x1b[33m  ${key}\x1b[0m`);
  for (const d of list.slice(0, 12)) {
    console.log(`    ${d.token.padEnd(28)} ${String(d.from).padEnd(24)} → ${d.to}`);
  }
  if (list.length > 12) console.log(`    …and ${list.length - 12} more`);
}
console.log(
  `\n\x1b[33m\x1b[1m  ${drift.length} token(s) drifted\x1b[0m\n` +
  `  If this was intentional, review the diff and run:\n` +
  `    npm run palette:update\n`
);
process.exit(1);
