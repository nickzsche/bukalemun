#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — tests/run.mjs
   A dependency-free test runner. Checks the source tree for structural
   correctness and the built bundles for integrity.

   Run: node tests/run.mjs
   ========================================================================== */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('\x1b[32m  ✓\x1b[0m ' + name + '\n');
  } catch (err) {
    failed++;
    failures.push({ name, err });
    process.stdout.write('\x1b[31m  ✗\x1b[0m ' + name + '\n    \x1b[31m' + err.message + '\x1b[0m\n');
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'values differ') + ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const read = (p) => readFileSync(p, 'utf8');
const cssFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => join(dir, f));

const allSourceCss = [
  ...cssFiles(join(src, 'core')),
  ...cssFiles(join(src, 'components')),
  ...cssFiles(join(src, 'styles'))
];
const skinPaths = cssFiles(join(src, 'styles'));
const skinNames = skinPaths.map((p) => basename(p, '.css')).sort();

/* ------------------------------------------------------------ helpers --- */

/** Strip comments and strings so structural checks don't trip over content. */
function stripCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

function balance(text, open, close) {
  let depth = 0;
  for (const ch of text) {
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth < 0) return -1; }
  }
  return depth;
}

console.log('\n\x1b[1mBukalemun test suite\x1b[0m\n');
console.log('\x1b[2m  source integrity\x1b[0m');

/* ------------------------------------------------------ source: syntax -- */

test('every source stylesheet has balanced braces', () => {
  for (const file of allSourceCss) {
    const stripped = stripCss(read(file));
    assertEqual(balance(stripped, '{', '}'), 0, `unbalanced braces in ${basename(file)}`);
  }
});

test('every source stylesheet has balanced parentheses', () => {
  for (const file of allSourceCss) {
    const stripped = stripCss(read(file));
    assertEqual(balance(stripped, '(', ')'), 0, `unbalanced parens in ${basename(file)}`);
  }
});

test('no malformed hex colour literals', () => {
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    const bad = body.match(/#[0-9a-fA-F]*[g-zG-Z][0-9a-zA-Z]*/g);
    assert(!bad, `${basename(file)} contains ${bad && bad.join(', ')}`);
  }
});

test('hex colours are 3, 4, 6 or 8 digits', () => {
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    for (const match of body.matchAll(/#([0-9a-fA-F]+)\b/g)) {
      const len = match[1].length;
      assert([3, 4, 6, 8].includes(len), `${basename(file)}: #${match[1]} has ${len} digits`);
    }
  }
});

test('no stray non-ASCII inside property values', () => {
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    // Declarations only: `prop: value;` — content:"" strings were stripped above.
    for (const line of body.split('\n')) {
      const decl = line.match(/^\s*(--[\w-]+|[a-z-]+)\s*:\s*([^;{]+);/);
      if (!decl) continue;
      const value = decl[2];
      // eslint-disable-next-line no-control-regex
      assert(!/[^\x00-\x7F]/.test(value), `${basename(file)}: non-ASCII in "${decl[1]}: ${value.trim()}"`);
    }
  }
});

test('all class selectors use the bk- prefix', () => {
  const offenders = new Set();
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    for (const match of body.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const name = match[1];
      if (!name.startsWith('bk-')) offenders.add(basename(file) + ' → .' + name);
    }
  }
  assert(offenders.size === 0, 'unprefixed classes: ' + [...offenders].join(', '));
});

test('all custom properties use the --bk- prefix', () => {
  const offenders = new Set();
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    for (const match of body.matchAll(/(--[\w-]+)\s*:/g)) {
      const name = match[1];
      // `--_x` is the documented convention for file-local privates.
      if (!name.startsWith('--bk-') && !name.startsWith('--_')) {
        offenders.add(basename(file) + ' → ' + name);
      }
    }
  }
  assert(offenders.size === 0, 'unprefixed custom properties: ' + [...offenders].join(', '));
});

/* -------------------------------------------------- token contract ------ */

const tokenSource = read(join(src, 'core', 'tokens.css')) + read(join(src, 'core', 'icons.css'));
const definedTokens = new Set([...tokenSource.matchAll(/(--bk-[\w-]+)\s*:/g)].map((m) => m[1]));

// The one hard rule, finally enforced: a component reads tokens, it does not
// name a colour. tokens.css is where literals live by definition, and
// a11y.css speaks the OS's own colour names (Canvas, CanvasText, Highlight)
// and prints in plain black on white. Everything else has to go through a
// knob. url() payloads (data-URI icons) and comments are skipped; so is the
// word "white" inside "white-space".
test('component and core sheets never name a colour', () => {
  const exempt = new Set(['tokens.css', 'a11y.css']);
  const sheets = [...cssFiles(join(src, 'core')), ...cssFiles(join(src, 'components'))]
    .filter((p) => !exempt.has(basename(p)));
  const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|(?<!-)\b(?:white|black|red|blue|green|yellow|orange|purple|pink|gr[ae]y|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|cyan|magenta)\b(?!-)/i;
  const offenders = [];
  for (const sheet of sheets) {
    const body = stripCss(read(sheet)).replace(/url\([^)]*\)/g, 'url()');
    body.split('\n').forEach((line, i) => {
      const m = line.match(literal);
      if (m) offenders.push(basename(sheet) + ':' + (i + 1) + ' → ' + m[0]);
    });
  }
  assert(offenders.length === 0, 'colour literals in component/core sheets:\n      ' + offenders.join('\n      '));
});

test('the token contract defines every documented semantic role', () => {
  const required = [
    '--bk-bg', '--bk-surface', '--bk-surface-2', '--bk-surface-3', '--bk-surface-inverted',
    '--bk-text', '--bk-text-muted', '--bk-text-subtle', '--bk-text-inverted',
    '--bk-border', '--bk-border-muted', '--bk-border-strong',
    '--bk-primary', '--bk-secondary', '--bk-success', '--bk-warning', '--bk-danger',
    '--bk-info', '--bk-neutral', '--bk-ring',
    '--bk-radius-field', '--bk-radius-card', '--bk-radius-overlay', '--bk-radius-pill',
    '--bk-shadow-xs', '--bk-shadow-sm', '--bk-shadow-md', '--bk-shadow-lg', '--bk-shadow-xl',
    '--bk-font-sans', '--bk-font-mono', '--bk-font-display',
    '--bk-dur-fast', '--bk-dur-base', '--bk-ease', '--bk-transition'
  ];
  for (const token of required) {
    assert(definedTokens.has(token), `tokens.css never defines ${token}`);
  }
});

test('no --bk-* token is read without either a definition or a fallback', () => {
  // A token may legitimately be undefined *if* the call site supplies a
  // fallback — that is how per-instance knobs like var(--bk-gap, 1rem) work.
  // Reading an undefined token with no fallback is always a bug.
  const allDefined = new Set(definedTokens);
  for (const file of allSourceCss) {
    for (const m of read(file).matchAll(/(--bk-[\w-]+)\s*:/g)) allDefined.add(m[1]);
  }
  const missing = new Set();
  for (const file of allSourceCss) {
    const body = stripCss(read(file));
    for (const m of body.matchAll(/var\(\s*(--bk-[\w-]+)\s*([,)])/g)) {
      const hasFallback = m[2] === ',';
      if (!hasFallback && !allDefined.has(m[1])) {
        missing.add(m[1] + ' (' + basename(file) + ')');
      }
    }
  }
  assert(missing.size === 0, 'undefined tokens read without a fallback: ' + [...missing].join(', '));
});

// A repeating background needs a tile size. That size used to live in each
// skin's own hand-written selector list, so three skins carried three
// different incomplete lists and the pixel-art navbar rendered as one giant
// cone — half flat, half checkerboard. The size travels with the image as a
// token now, and this keeps the two in step.
// The demo pages are the living documentation, and nothing else checks them.
// A renamed class or a mistyped hook shows up as a page that quietly looks
// wrong, which is exactly what a demo cannot afford. Both of these have
// happened: bk-badge-soft never existed, and data-bk-count belongs to the
// character counter, not the number counter — the framework tried to use
// "184" as a CSS selector and threw.
test('the demo pages only use classes and hooks that exist', () => {
  const demoDir = join(root, 'demos');
  if (!existsSync(demoDir)) return;

  const known = new Set(
    [...allSourceCss.map(read).join('\n').matchAll(/\.(bk-[a-z0-9-]+)/g)].map((m) => m[1])
  );
  const hooks = new Set(
    readdirSync(join(src, 'js', 'modules'))
      .map((f) => read(join(src, 'js', 'modules', f)))
      .concat([read(join(src, 'js', 'core.js')), read(join(demoDir, 'demo.js'))])
      .join('\n')
      .match(/data-bk-[a-z-]+/g) || []
  );
  // Written by the author, read by no module.
  ['data-bk-style', 'data-bk-theme', 'data-bk-manual'].forEach((a) => hooks.add(a));

  for (const file of readdirSync(demoDir).filter((f) => f.endsWith('.html'))) {
    const html = read(join(demoDir, file));

    const classes = new Set(
      [...html.matchAll(/class="([^"]+)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith('bk-'))
    );
    for (const c of classes) {
      assert(known.has(c), `demos/${file}: .${c} is not defined by any stylesheet`);
    }

    for (const [, attr] of html.matchAll(/\s(data-bk-[a-z-]+)/g)) {
      assert(hooks.has(attr), `demos/${file}: ${attr} is not read by any module`);
    }

    // A stray </div> does not throw anywhere — the browser silently reparents
    // half the page and the demo just looks wrong.
    for (const tag of ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'form']) {
      const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
      const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert(open === close, `demos/${file}: ${open} <${tag}> against ${close} </${tag}>`);
    }
  }
});

// Two files both defined .bk-hero, from different eras. The newer one won on
// display and the older one still leaked justify-content: center, so
// .bk-hero-start could not left-align anything and there was nothing in the
// output to suggest why.
test('no component class is defined in two different stylesheets', () => {
  const owner = new Map();
  const clashes = [];
  for (const file of cssFiles(join(src, 'components'))) {
    const css = stripCss(read(file));
    for (const m of css.matchAll(/(^|\n)\s*((?:\.bk-[a-z0-9-]+\s*,\s*)*\.bk-[a-z0-9-]+)\s*\{/g)) {
      for (const sel of m[2].split(',')) {
        const cls = sel.trim();
        if (!/^\.bk-[a-z0-9-]+$/.test(cls)) continue;
        const seen = owner.get(cls);
        if (seen && seen !== basename(file)) clashes.push(`${cls}: ${seen} and ${basename(file)}`);
        else owner.set(cls, basename(file));
      }
    }
  }
  assert(clashes.length === 0, [...new Set(clashes)].join('; '));
});

test('every element painting an image token also sizes it', () => {
  for (const file of [...cssFiles(join(src, 'core')), ...cssFiles(join(src, 'components'))]) {
    for (const rule of stripCss(read(file)).split('}')) {
      const paint = rule.match(/background-image:\s*var\((--bk-[\w-]*image)\)/);
      if (!paint) continue;
      const size = paint[1] + '-size';
      assert(rule.includes('background-size: var(' + size),
        basename(file) + ': paints ' + paint[1] + ' without background-size: var(' + size + ')');
    }
  }
});

test('every skin overrides the core palette roles', () => {
  const mustOverride = ['--bk-bg', '--bk-surface', '--bk-text', '--bk-primary', '--bk-border'];
  for (const skinPath of skinPaths) {
    const body = read(skinPath);
    for (const token of mustOverride) {
      assert(
        new RegExp(`${token}\\s*:`).test(body),
        `${basename(skinPath)} does not set ${token}`
      );
    }
  }
});

test('every skin scopes its rules under its own attribute selector', () => {
  for (const skinPath of skinPaths) {
    const name = basename(skinPath, '.css');
    // Comments only — quoted strings must survive, the scope lives inside one.
    const body = read(skinPath).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectorBlocks = body.split('}').map((b) => b.split('{')[0]).filter((s) => s.trim());
    for (const raw of selectorBlocks) {
      const sel = raw.trim();
      if (!sel || sel.startsWith('@')) continue;
      for (const part of sel.split(',')) {
        const p = part.trim();
        if (!p) continue;
        assert(
          p.includes(`[data-bk-style="${name}"]`) || p.startsWith('body[data-bk-style'),
          `${basename(skinPath)} has an unscoped selector: ${p.slice(0, 70)}`
        );
      }
    }
  }
});

// The variants are generated, and a skin that missed the generator would ship
// with a data-bk-accent axis that silently does nothing.
test('every skin carries a warm and a cool accent variant', () => {
  for (const skinPath of skinPaths) {
    const name = basename(skinPath, '.css');
    const body = read(skinPath);
    for (const variant of ['warm', 'cool']) {
      assert(
        body.includes(`[data-bk-style="${name}"][data-bk-accent="${variant}"]`),
        `${basename(skinPath)} has no ${variant} accent variant — run npm run variants:update`
      );
    }
  }
});

test('skin list in theme.js matches the files on disk', () => {
  const themeJs = read(join(src, 'js', 'modules', 'theme.js'));
  // Slugs may contain digits (y2k, retro70s), so do not restrict to letters.
  const listed = [...themeJs.matchAll(/^\s*'([a-z0-9]+)',?/gm)].map((m) => m[1]);
  const declared = new Set(listed);
  for (const skin of skinNames) {
    assert(declared.has(skin), `theme.js STYLES is missing "${skin}"`);
  }
  const metaBlock = themeJs.slice(themeJs.indexOf('var META'), themeJs.indexOf('var KEY_STYLE'));
  for (const skin of skinNames) {
    assert(metaBlock.includes(`'${skin}'`), `theme.js META has no entry for "${skin}"`);
  }
});

test('every skin says which webfont it is drawn for, or says none', () => {
  const themeJs = read(join(src, 'js', 'modules', 'theme.js'));
  const block = themeJs.slice(themeJs.indexOf('var FONTS'), themeJs.indexOf('var KEY_STYLE'));
  for (const skin of [...skinNames, 'default']) {
    const m = block.match(new RegExp(`'${skin}':\\s*(null|'[^']+')`));
    assert(m, `theme.js FONTS has no entry for "${skin}" (use null for a system face)`);
  }
});

test('the docs and demos ship base + one skin, never the all-skins bundle', () => {
  const pages = ['docs/index.html', ...readdirSync(join(root, 'demos')).filter((f) => f.endsWith('.html')).map((f) => `demos/${f}`)];
  for (const page of pages) {
    const html = read(join(root, page));
    assert(!/<link[^>]*href="[^"]*dist\/bukalemun(\.min)?\.css"/.test(html), `${page} links the all-skins bundle`);
    assert(html.includes('bukalemun.base.min.css'), `${page} does not link the base bundle`);
    assert(html.includes('data-bk-skins="../dist/styles/{skin}.min.css"'), `${page} does not tell no-flash where skins live`);
  }
});

test('no prose quotes a skin count that is out of date', () => {
  // The count is written by hand in a dozen places — a headline, a footer, a
  // meta description, an architecture doc. Adding skins used to leave some of
  // them behind, which is exactly the sort of thing nobody notices until a
  // stranger does. CHANGELOG is exempt: it is supposed to say 22.
  const real = skinNames.length;              // skins on disk
  const withDefault = real + 1;               // + the neutral default
  const WORDS = {
    twenty: 20, 'twenty-two': 22, 'twenty-eight': 28, thirty: 30,
    forty: 40, fifty: 50, sixty: 60
  };

  const offenders = [];
  for (const file of ['docs/index.html', 'README.md', 'PROJECT.md', 'CONTRIBUTING.md']) {
    const body = read(join(root, file));
    const pattern = /(\b[0-9]{1,3}\b|\b(?:twenty|thirty|forty|fifty|sixty)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?\b)[\s-]+(skins|aesthetics|visual languages|opinionated palettes|per-skin files)/gi;
    for (const m of body.matchAll(pattern)) {
      const raw = m[1].toLowerCase();
      const value = WORDS[raw] ?? Number(raw);
      if (!Number.isFinite(value)) continue;
      if (value === real || value === withDefault) continue;
      offenders.push(`${file}: "${m[0].trim()}" (should be ${real})`);
    }
  }
  assert(offenders.length === 0, 'stale skin counts:\n      ' + offenders.join('\n      '));
});

// Same failure mode as the skin count, one directory over: the README said
// "Five standalone pages" long after there were ten.
// Sizes are the first thing a stranger checks and the first thing to rot. The
// README used to say 29 KB for a file that had grown to 30.8, and pointed at
// core.min.css as the small install when it contains no components at all.
test('the size table matches the files on disk', () => {
  if (!existsSync(join(dist, 'bukalemun.min.css'))) return;
  const readme = read(join(root, 'README.md'));
  const gzip = (file) => gzipSync(readFileSync(join(dist, file))).length / 1024;

  const rows = [
    ['bukalemun.base.min.css', 'bukalemun.base.min.css'],
    ['bukalemun.min.css', 'bukalemun.min.css'],
    ['bukalemun.core.min.css', 'bukalemun.core.min.css'],
    ['bukalemun.min.js', 'bukalemun.min.js']
  ];

  for (const [label, file] of rows) {
    const line = readme.split('\n').find((l) => l.startsWith(`| \`${label}\``));
    assert(line, `README has no size row for ${label}`);
    const claimed = Number(line.match(/\*\*([\d.]+) KB\*\*/)?.[1]);
    assert(Number.isFinite(claimed), `${label}: no gzip figure in the table`);
    const real = gzip(file);
    assert(Math.abs(claimed - real) <= Math.max(1, real * 0.05),
      `${label}: README says ${claimed} KB gzipped, it is ${real.toFixed(1)} KB`);
  }

  // The recommended install is the sum of two rows; nobody recomputes that.
  const combined = gzip('bukalemun.base.min.css') + gzip('styles/brutal.min.css');
  const line = readme.split('\n').find((l) => l.startsWith('|') && l.includes('what you should ship'));
  assert(line, 'README no longer names a recommended install in the size table');
  const claimed = Number(line.match(/\*\*([\d.]+) KB\*\*/)?.[1]);
  assert(Math.abs(claimed - combined) <= 1,
    `the recommended install is ${combined.toFixed(1)} KB, the table says ${claimed}`);
});

test('no prose quotes a demo count that is out of date', () => {
  const demoDir = join(root, 'demos');
  if (!existsSync(demoDir)) return;
  const real = readdirSync(demoDir).filter((f) => f.endsWith('.html') && f !== 'index.html').length;
  const WORDS = { five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

  const offenders = [];
  for (const file of ['README.md', 'demos/index.html', 'docs/index.html']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const pattern = /(\b[0-9]{1,2}\b|\b(?:five|six|seven|eight|nine|ten|eleven|twelve)\b)[\s-]+(demos|demo pages|standalone pages|pages)\b/gi;
    for (const m of read(path).matchAll(pattern)) {
      const raw = m[1].toLowerCase();
      const value = WORDS[raw] ?? Number(raw);
      if (!Number.isFinite(value) || value === real) continue;
      offenders.push(`${file}: "${m[0].trim()}" (there are ${real})`);
    }
  }
  assert(offenders.length === 0, offenders.join('; '));
});

test('the TypeScript SkinName union matches the skins on disk', () => {
  const dts = read(join(root, 'types', 'index.d.ts'));
  const block = dts.slice(dts.indexOf('export type SkinName'), dts.indexOf(';', dts.indexOf('export type SkinName')));
  const declared = new Set([...block.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]));
  assert(declared.has('default'), "SkinName is missing 'default'");
  for (const skin of skinNames) {
    assert(declared.has(skin), `SkinName is missing "${skin}"`);
  }
  for (const name of declared) {
    assert(name === 'default' || skinNames.includes(name), `SkinName has a stale entry "${name}"`);
  }
});

test('there are at least 20 distinct skins', () => {
  assert(skinNames.length >= 20, `only ${skinNames.length} skins found`);
});

/* --------------------------------------------------------- js: syntax --- */

console.log('\n\x1b[2m  javascript\x1b[0m');

const jsFiles = [
  join(src, 'js', 'core.js'),
  ...readdirSync(join(src, 'js', 'modules')).map((f) => join(src, 'js', 'modules', f)),
  join(src, 'js', 'boot.js')
];

test('every source module parses', () => {
  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

test('no module leaks a global other than bk', () => {
  for (const file of jsFiles) {
    const body = read(file);
    if (basename(file) === 'core.js') continue;
    assert(
      /^\(function \(bk\)/m.test(body),
      `${basename(file)} is not wrapped in an IIFE taking bk`
    );
  }
});

test('core exposes the documented API surface', () => {
  const core = read(join(src, 'js', 'core.js'));
  const required = [
    '$:', '$$:', 'el:', 'on:', 'delegate:', 'emit:', 'ready:', 'uid:', 'data:',
    'store:', 'storage:', 'trapFocus:', 'lockScroll:', 'position:', 'autoPosition:',
    'announce:', 'define:', 'init:', 'observe:', 'destroy:'
  ];
  for (const key of required) {
    assert(core.includes(key), `core.js api object is missing ${key}`);
  }
});

/* ------------------------------------------------------------- build --- */

console.log('\n\x1b[2m  build output\x1b[0m');

const distExists = existsSync(dist);

test('dist/ exists (run `npm run build` first)', () => {
  assert(distExists, 'dist/ not found');
});

if (distExists) {
  const expected = [
    'bukalemun.css', 'bukalemun.min.css',
    'bukalemun.base.css', 'bukalemun.base.min.css',
    'bukalemun.core.css', 'bukalemun.core.min.css',
    'bukalemun.js', 'bukalemun.min.js',
    'bukalemun.cjs', 'bukalemun.min.cjs',
    'bukalemun.esm.js', 'bukalemun.esm.min.js',
    'no-flash.js', 'manifest.json', 'tokens.json'
  ];

  test('every expected artefact is emitted', () => {
    for (const f of expected) {
      assert(existsSync(join(dist, f)), `dist/${f} missing`);
    }
    for (const skin of skinNames) {
      assert(existsSync(join(dist, 'styles', `${skin}.css`)), `dist/styles/${skin}.css missing`);
      assert(existsSync(join(dist, 'styles', `${skin}.min.css`)), `dist/styles/${skin}.min.css missing`);
    }
  });

  test('minified CSS keeps braces balanced', () => {
    for (const f of ['bukalemun.min.css', 'bukalemun.base.min.css', 'bukalemun.core.min.css']) {
      const body = stripCss(read(join(dist, f)));
      assertEqual(balance(body, '{', '}'), 0, `${f} braces`);
      assertEqual(balance(body, '(', ')'), 0, `${f} parens`);
    }
  });

  test('minification preserves every declaration', () => {
    const count = (css) => (stripCss(css).match(/:/g) || []).length;
    const full = read(join(dist, 'bukalemun.css'));
    const min = read(join(dist, 'bukalemun.min.css'));
    const delta = Math.abs(count(full) - count(min));
    assert(delta === 0, `declaration count changed by ${delta}`);
  });

  test('minification actually shrinks the payload', () => {
    const full = read(join(dist, 'bukalemun.css')).length;
    const min = read(join(dist, 'bukalemun.min.css')).length;
    assert(min < full * 0.9, `only shrank to ${((min / full) * 100).toFixed(1)}%`);
  });

  // The snippet runs before the bundle and before first paint, so a mistake in
  // it is invisible until someone notices their page is the wrong colour. It
  // used to call setAttribute('data-bk-theme', saved || 'auto') unconditionally,
  // which threw away a theme the author had written into the markup — every
  // demo page in this repo shipped dark and rendered light because of it.
  test('the no-flash snippet respects a theme written in the markup', () => {
    const snippet = read(join(dist, 'no-flash.js'));

    const run = (stored, authored) => {
      const attrs = { ...(authored ? { 'data-bk-theme': authored } : {}) };
      const documentElement = {
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        setAttribute: (k, v) => { attrs[k] = String(v); },
        classList: { add() {} }
      };
      const sandbox = {
        document: { documentElement },
        localStorage: { getItem: (k) => (k in stored ? stored[k] : null) }
      };
      new Function('document', 'localStorage', snippet)(sandbox.document, sandbox.localStorage);
      return attrs;
    };

    assert(run({}, 'dark')['data-bk-theme'] === 'dark',
      'an authored theme was overwritten when nothing was stored');
    assert(run({}, 'light')['data-bk-theme'] === 'light',
      'an authored light theme was overwritten');
    assert(run({}, null)['data-bk-theme'] === 'auto',
      'no theme anywhere should fall back to auto');
    assert(run({ 'bk:mode': 'dark' }, 'light')['data-bk-theme'] === 'dark',
      'a stored preference must win over the markup');
    assert(run({ 'bk:style': 'vapor' }, null)['data-bk-style'] === 'vapor',
      'a stored skin was not applied');
    assert(run({ 'bk:style': 'default' }, null)['data-bk-style'] === undefined,
      'the default skin should not be written as an attribute');
  });

  test('the no-flash snippet fetches the stored skin when told where skins live', () => {
    const snippet = read(join(dist, 'no-flash.js'));
    const run = (stored, template) => {
      const attrs = {};
      const links = [];
      const documentElement = {
        getAttribute: (k) => attrs[k] ?? null,
        setAttribute: (k, v) => { attrs[k] = String(v); },
        classList: { add() {} }
      };
      const document = {
        documentElement,
        currentScript: template ? { getAttribute: (k) => (k === 'data-bk-skins' ? template : null) } : null,
        querySelector: () => null,
        createElement: () => {
          const el = { setAttribute(k, v) { el[k] = v; } };
          return el;
        },
        head: { appendChild: (el) => links.push(el) }
      };
      new Function('document', 'localStorage', snippet)(document, { getItem: (k) => stored[k] ?? null });
      return { attrs, links };
    };
    const lazy = run({ 'bk:style': 'vapor' }, 'dist/styles/{skin}.min.css');
    assert(lazy.links.length === 1 && lazy.links[0].href === 'dist/styles/vapor.min.css',
      'the stored skin was not fetched from the template');
    assert(lazy.links[0]['data-bk-skin'] === 'vapor', 'the link must be marked so bk.theme knows it is there');
    assert(run({ 'bk:style': 'vapor' }, null).links.length === 0, 'no template, no fetch');
    assert(run({ 'bk:style': 'default' }, 'x/{skin}.css').links.length === 0, 'the default skin has no file');
  });

  test('built JS parses in every shape', () => {
    for (const f of ['bukalemun.js', 'bukalemun.min.js', 'bukalemun.cjs', 'bukalemun.min.cjs',
                     'bukalemun.esm.js', 'bukalemun.esm.min.js', 'no-flash.js']) {
      execFileSync(process.execPath, ['--check', join(dist, f)], { stdio: 'pipe' });
    }
  });

  // Load the built files the way a consumer does — through Node's own
  // resolver. An earlier version of this test hand-rolled a CommonJS context
  // with `new Function`, which passed happily while `require('bukalemun')` was
  // in fact returning an empty object: the package is `"type": "module"`, so
  // Node read the UMD `.js` as an ES module. Only the real resolver sees that.
  const esm = await import(pathToFileURL(join(dist, 'bukalemun.esm.js')).href);
  const cjs = createRequire(import.meta.url)(join(dist, 'bukalemun.cjs'));

  // bk.version was hardcoded in src/js/core.js and read 1.3.2 while package.json
  // said 1.5.0 — two releases of a runtime lying about which one it was. The
  // build injects it now, and the source carries a placeholder so an unbuilt
  // file cannot pass for a release.
  test('the runtime reports the version in package.json', () => {
    const pkg = JSON.parse(read(join(root, 'package.json')));
    assert(cjs.version === pkg.version,
      `bk.version is ${cjs.version}, package.json says ${pkg.version}`);
    assert(esm.default.version === pkg.version,
      `the ES module reports ${esm.default.version}`);
    assert(JSON.parse(read(join(dist, 'manifest.json'))).version === pkg.version,
      'the manifest disagrees with package.json');
    assert(read(join(src, 'js', 'core.js')).includes("'0.0.0-dev'"),
      'src/js/core.js has gone back to hardcoding a version');
  });

  test('the CommonJS build loads through require()', () => {
    assert(typeof cjs === 'object' && cjs !== null, 'require() produced nothing');
    assert(typeof cjs.version === 'string', 'version missing');
    assert(typeof cjs.define === 'function', 'define() missing');
    assert(typeof cjs.theme === 'object', 'theme missing — modules did not run');
    assert(cjs.theme.styles.length === skinNames.length + 1, 'theme.styles is out of step with the skins on disk');
  });

  test('the ES module build loads through import()', () => {
    assert(typeof esm.default === 'object', 'no default export');
    assert(typeof esm.version === 'string', 'named version export missing');
    assert(typeof esm.theme === 'object', 'named theme export missing');
    assert(esm.default.version === cjs.version, 'the two builds disagree on the version');
  });

  test('a "type": "module" package points require() at a .cjs file', () => {
    const pkg = JSON.parse(read(join(root, 'package.json')));
    if (pkg.type !== 'module') return;
    // Under type:module a bare .js is an ES module, so main/require must not
    // point at one or every CommonJS consumer silently gets an empty object.
    assert(pkg.main.endsWith('.cjs'), `main is ${pkg.main}, which Node will parse as ESM`);
    assert(
      pkg.exports['.'].require.endsWith('.cjs'),
      `exports["."].require is ${pkg.exports['.'].require}, which Node will parse as ESM`
    );
  });

  test('tokens.json resolves every skin, mode and variant', () => {
    const t = JSON.parse(read(join(dist, 'tokens.json')));
    assert(t.skins && t.skins.default, 'tokens.json has no default palette');
    for (const skin of [...skinNames, 'default']) {
      const s = t.skins[skin];
      assert(s, `tokens.json is missing ${skin}`);
      for (const key of ['light', 'dark']) {
        assert(s[key] && s[key].color && s[key].color.primary, `tokens.json: ${skin}.${key} has no primary colour`);
        assert(/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(s[key].color.primary.$value), `tokens.json: ${skin}.${key} primary is not hex`);
      }
      if (skin !== 'default') {
        assert(s['light-warm'] && s['dark-cool'], `tokens.json: ${skin} is missing its accent variants`);
      }
    }
  });

  test('manifest agrees with the file system', () => {
    const manifest = JSON.parse(read(join(dist, 'manifest.json')));
    assertEqual(manifest.skins.length, skinNames.length, 'skin count');
    assertEqual(manifest.skins.sort().join(','), skinNames.join(','), 'skin names');
  });

  test('package.json exports all resolve', () => {
    const pkg = JSON.parse(read(join(root, 'package.json')));
    for (const [key, value] of Object.entries(pkg.exports)) {
      const targets = typeof value === 'string' ? [value] : Object.values(value);
      for (const t of targets) {
        if (t.includes('*')) continue;
        assert(existsSync(join(root, t)), `exports["${key}"] → ${t} does not exist`);
      }
    }
    for (const field of ['main', 'module', 'style', 'unpkg', 'jsdelivr']) {
      assert(existsSync(join(root, pkg[field])), `${field} → ${pkg[field]} does not exist`);
    }
  });

  test('the full bundle contains every skin', () => {
    const css = read(join(dist, 'bukalemun.css'));
    for (const skin of skinNames) {
      assert(css.includes(`[data-bk-style="${skin}"]`), `bundle is missing skin ${skin}`);
    }
  });

  test('the base bundle contains no skins', () => {
    const css = read(join(dist, 'bukalemun.base.css'));
    for (const skin of skinNames) {
      assert(!css.includes(`[data-bk-style="${skin}"]`), `base bundle leaked skin ${skin}`);
    }
  });
}

/* ------------------------------------------------------------- report --- */

console.log('');
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m  ${passed} passed\x1b[0m, 0 failed\n`);
  process.exit(0);
} else {
  console.log(`\x1b[31m\x1b[1m  ${failed} failed\x1b[0m, ${passed} passed\n`);
  process.exit(1);
}
