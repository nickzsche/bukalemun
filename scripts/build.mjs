#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — scripts/build.mjs
   A dependency-free build: concatenate, minify, and emit every distributable
   shape (full CSS, core-only CSS, per-skin CSS, IIFE JS, ESM JS, minified).

   Run: node scripts/build.mjs
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadTokens, tokenMap, combinations, get, toHex, parseColor } from './lib/tokens.mjs';
import { htmlData } from './html-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const banner = (what) =>
  `/*! Bukalemun ${VERSION} — ${what}\n` +
  ` *  One framework, 50 skins. Zero dependencies.\n` +
  ` *  ${pkg.homepage}\n` +
  ` *  Released under the MIT licence.\n` +
  ` */\n`;

/* ------------------------------------------------------------- ordering -- */

// a11y comes last: its overrides must win over component defaults.
const CORE = ['reset', 'tokens', 'icons', 'typography', 'layout', 'utilities', 'animations', 'a11y'];
const COMPONENTS = [
  'button', 'form', 'choice', 'card', 'badge', 'feedback',
  'table', 'nav', 'overlay', 'disclosure', 'kbd', 'pricing',
  'testimonial', 'hero'
];
const JS_MODULES = ['theme', 'float', 'overlay', 'nav', 'toast', 'input', 'data'];

const read = (p) => readFileSync(p, 'utf8');

/* -------------------------------------------------------------- minify --- */

/**
 * A conservative CSS minifier. It only removes things that are provably safe to
 * remove: comments outside strings, whitespace runs, and the last semicolon in
 * a block. It never touches values, so custom properties and data URIs survive.
 */
function minifyCss(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  let inString = null;

  while (i < n) {
    const ch = css[i];

    if (inString) {
      out += ch;
      if (ch === '\\') { out += css[i + 1] ?? ''; i += 2; continue; }
      if (ch === inString) inString = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") { inString = ch; out += ch; i++; continue; }

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (/\s/.test(ch)) {
      let j = i;
      while (j < n && /\s/.test(css[j])) j++;
      const prev = out[out.length - 1];
      const next = css[j];
      // Whitespace is only meaningful between two "word-ish" characters.
      // '+' keeps its spaces: calc(), min(), max() and clamp() need them, and
      // a selector combinator reads the same either way.
      if (prev && next && !/[{}:;,>~([]/.test(prev) && !/[{};,>~)\]]/.test(next)) {
        out += ' ';
      }
      i = j;
      continue;
    }

    if (ch === ';') {
      // Drop a semicolon that only precedes whitespace and a closing brace.
      let j = i + 1;
      while (j < n && /\s/.test(css[j])) j++;
      if (css[j] === '}') { i = j; continue; }
      out += ';';
      i++;
      continue;
    }

    out += ch;
    i++;
  }
  return out.trim();
}

/**
 * A conservative JS minifier: strips comments and collapses indentation, but
 * never renames or reorders anything. Roughly 35–45% off, and safe.
 */
function minifyJs(js) {
  let out = '';
  let i = 0;
  const n = js.length;
  let str = null;
  let inRegex = false;

  const canPrecedeRegex = () => {
    const t = out.replace(/\s+$/, '');
    if (!t) return true;
    const last = t[t.length - 1];
    if (/[)\]}]/.test(last)) return false;
    if (/[A-Za-z0-9_$]/.test(last)) return /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else)$/.test(t);
    return true;
  };

  while (i < n) {
    const ch = js[i];
    const next = js[i + 1];

    if (str) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === str) str = null;
      i++;
      continue;
    }
    if (inRegex) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === '/') inRegex = false;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; out += ch; i++; continue; }
    if (ch === '/' && next === '/') {
      while (i < n && js[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = js.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '/' && canPrecedeRegex()) { inRegex = true; out += ch; i++; continue; }

    if (/[ \t]/.test(ch)) {
      let j = i;
      while (j < n && /[ \t]/.test(js[j])) j++;
      const prev = out[out.length - 1];
      const nx = js[j];
      if (prev && nx && /[A-Za-z0-9_$]/.test(prev) && /[A-Za-z0-9_$]/.test(nx)) out += ' ';
      else if (prev && nx && /[+\-]/.test(prev) && prev === nx) out += ' ';
      i = j;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      let j = i;
      while (j < n && /[\r\n\s]/.test(js[j])) j++;
      const prev = out[out.length - 1];
      const nx = js[j];
      if (prev && nx && /[A-Za-z0-9_$)\]'"`]/.test(prev) && /[A-Za-z0-9_$({['"`+\-!~]/.test(nx)) out += '\n';
      i = j;
      continue;
    }

    out += ch;
    i++;
  }
  return out.trim();
}

/* --------------------------------------------------------------- build --- */

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'styles'), { recursive: true });

const coreCss = CORE.map((f) => read(join(src, 'core', `${f}.css`))).join('\n\n');
const componentCss = COMPONENTS.map((f) => read(join(src, 'components', `${f}.css`))).join('\n\n');

/**
 * Skins declare their colour-mode palettes as
 *   [data-bk-style="x"][data-bk-theme="dark"] { … }
 * which only fires when the mode is set explicitly. With data-bk-theme="auto"
 * the core's dark palette lives in a `:where()` rule — zero specificity — so a
 * skin's own base block would beat it and the page would stay light on a dark
 * OS. Rather than ask every skin to hand-write a second copy, mirror each mode
 * block into a matching `auto` + prefers-color-scheme rule at build time.
 */
function mirrorAutoMode(css, skin) {
  const out = [];
  // The accent variants carry their own mode blocks, one attribute longer.
  const prefixes = [
    `[data-bk-style="${skin}"]`,
    `[data-bk-style="${skin}"][data-bk-accent="warm"]`,
    `[data-bk-style="${skin}"][data-bk-accent="cool"]`
  ];
  for (const prefix of prefixes) for (const mode of ['dark', 'light']) {
    const needle = `${prefix}[data-bk-theme="${mode}"]`;
    let cursor = 0;
    const blocks = [];
    while (true) {
      const at = css.indexOf(needle, cursor);
      if (at === -1) break;
      const open = css.indexOf('{', at);
      if (open === -1) break;
      // Only mirror whole token blocks, not rules that merely start with the
      // selector and then descend into a component (e.g. `… .bk-card`).
      const selector = css.slice(at, open);
      if (selector.trim() !== needle) { cursor = open + 1; continue; }
      let depth = 1;
      let i = open + 1;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      blocks.push(css.slice(open + 1, i - 1));
      cursor = i;
    }
    if (!blocks.length) continue;
    out.push(
      `@media (prefers-color-scheme: ${mode}) {\n` +
      `  ${prefix}[data-bk-theme="auto"] {${blocks.join('\n')}}\n` +
      `}`
    );
  }
  return out.length ? `\n\n/* auto-mode mirror for "${skin}" — generated by scripts/build.mjs */\n${out.join('\n')}\n` : '';
}

const skinFiles = readdirSync(join(src, 'styles')).filter((f) => f.endsWith('.css')).sort();
const skins = skinFiles.map((f) => basename(f, '.css'));
const skinSources = {};
for (const file of skinFiles) {
  const name = basename(file, '.css');
  const body = read(join(src, 'styles', file));
  skinSources[name] = body + mirrorAutoMode(body, name);
}
const skinCss = skins.map((s) => skinSources[s]).join('\n\n');

const fullCss = `${banner('the whole framework, all 50 skins')}\n${coreCss}\n\n${componentCss}\n\n${skinCss}\n`;
const baseCss = `${banner('core + components, no skins')}\n${coreCss}\n\n${componentCss}\n`;
const coreOnlyCss = `${banner('core only (tokens, reset, layout, utilities)')}\n${coreCss}\n`;

writeFileSync(join(dist, 'bukalemun.css'), fullCss);
writeFileSync(join(dist, 'bukalemun.min.css'), banner('the whole framework, all 50 skins') + minifyCss(fullCss));
writeFileSync(join(dist, 'bukalemun.base.css'), baseCss);
writeFileSync(join(dist, 'bukalemun.base.min.css'), banner('core + components') + minifyCss(baseCss));
writeFileSync(join(dist, 'bukalemun.core.css'), coreOnlyCss);
writeFileSync(join(dist, 'bukalemun.core.min.css'), banner('core only') + minifyCss(coreOnlyCss));

for (const skin of skins) {
  const css = skinSources[skin];
  writeFileSync(join(dist, 'styles', `${skin}.css`), banner(`skin: ${skin}`) + css);
  writeFileSync(join(dist, 'styles', `${skin}.min.css`), banner(`skin: ${skin}`) + minifyCss(css));
}

/* ------------------------------------------------------------------ js --- */

const coreJsRaw = read(join(src, 'js', 'core.js'));
if (!coreJsRaw.includes("var VERSION = '0.0.0-dev';")) {
  throw new Error('core.js no longer carries the version placeholder the build replaces');
}
const coreJs = coreJsRaw.replace("var VERSION = '0.0.0-dev';", `var VERSION = '${VERSION}';`);
const modulesJs = JS_MODULES.map((m) => read(join(src, 'js', 'modules', `${m}.js`))).join('\n\n');
const bootJs = read(join(src, 'js', 'boot.js'));

const body = `${coreJs}\n\n${modulesJs}\n\n${bootJs}`;

const iife = `${banner('runtime (UMD)')}
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { global.bk = global.Bukalemun = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
${body}
return bk;
});
`;

const esm = `${banner('runtime (ES module)')}
const __bk = (function () {
'use strict';
${body}
return bk;
})();
export default __bk;
export const {
  version, $, $$, el, on, delegate, emit, ready, resolve, uid, data,
  store, storage, theme, toast, modal, drawer, confirm, hotkey, copy,
  position, autoPosition, trapFocus, announce, init, observe, destroy, start
} = __bk;
`;

writeFileSync(join(dist, 'bukalemun.js'), iife);
writeFileSync(join(dist, 'bukalemun.min.js'), banner('runtime (UMD)') + minifyJs(iife));

// The package is `"type": "module"`, which means Node reads a bare `.js` as an
// ES module — so `require('bukalemun')` against the UMD file returns an empty
// namespace. The same bytes under a `.cjs` extension are unambiguous, and that
// is what `main` and `exports.require` point at.
writeFileSync(join(dist, 'bukalemun.cjs'), iife);
writeFileSync(join(dist, 'bukalemun.min.cjs'), banner('runtime (CommonJS)') + minifyJs(iife));
writeFileSync(join(dist, 'bukalemun.esm.js'), esm);
writeFileSync(join(dist, 'bukalemun.esm.min.js'), banner('runtime (ESM)') + minifyJs(esm));

/* --------------------------------------------------- no-flash snippet --- */

const flash = `/* Paste inline in <head> to apply the saved skin before first paint. Ship base + one skin and add data-bk-skins="…/styles/{skin}.min.css" to this tag: the stored skin is fetched here, before paint, and bk.theme fetches the rest as they are chosen. */
(function(){try{var d=document.documentElement,s=localStorage.getItem('bk:style'),m=localStorage.getItem('bk:mode'),a=localStorage.getItem('bk:accent');if(s&&s!=='default'){d.setAttribute('data-bk-style',s);var c=document.currentScript,t=c&&c.getAttribute('data-bk-skins');if(t&&!document.querySelector('link[data-bk-skin="'+s+'"]')){var l=document.createElement('link');l.rel='stylesheet';l.href=t.replace('{skin}',s);l.setAttribute('data-bk-skin',s);document.head.appendChild(l);}}if(m)d.setAttribute('data-bk-theme',m);else if(!d.getAttribute('data-bk-theme'))d.setAttribute('data-bk-theme','auto');if(a&&a!=='none')d.setAttribute('data-bk-accent',a);d.classList.add('bk-no-js');}catch(e){}})();`;
writeFileSync(join(dist, 'no-flash.js'), flash);

/* --------------------------------------------------------- tokens.json --
   Every skin, mode and accent variant, resolved, in the W3C Design Tokens
   Community Group format. The audit already computes what each token comes
   to; writing it down lets a designer pull a skin into Figma variables or a
   token pipeline without reading CSS. Colours are resolved to hex (with an
   alpha byte when translucent), families to arrays, radii to dimensions
   where they are plain lengths. Minified: it is a data file, not a read. */

function tokensJson() {
  const tokens = loadTokens(src);
  const out = {
    $description: `Bukalemun ${VERSION} — every skin, colour mode and accent variant, resolved. Groups: skins.<skin>.<mode>[-<variant>].`,
    skins: {}
  };
  const family = (v) => v.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const dimension = (v) => { const t = v.trim(); return /^-?[\d.]+(px|rem|em|%)$/.test(t) || /^0+(\.0+)?$/.test(t) ? t : null; };
  for (const { skin, mode, variant } of combinations(tokens)) {
    const map = tokenMap(tokens, skin, mode, variant);
    const set = { color: {}, font: {}, radius: {}, space: {} };
    for (const [token, raw] of Object.entries(map)) {
      const name = token.replace(/^--bk-/, '');
      if (!name) continue;
      if (/^font-(sans|serif|mono|display|body)$/.test(name)) { set.font[name.slice(5)] = { $type: 'fontFamily', $value: family(raw) }; continue; }
      if (/^radius-/.test(name)) { const d = dimension(raw); if (d) set.radius[name.slice(7)] = { $type: 'dimension', $value: d }; continue; }
      if (/^space-\d+$/.test(name)) { const d = dimension(raw); if (d) set.space[name.slice(6)] = { $type: 'dimension', $value: d }; continue; }
      if (/shadow|image|transition|transform|gradient|backdrop|noise|font|weight|leading|tracking|text-|dur-|ease|z-|control|container|prose|label|heading|border-width|border-style|ring-width|ring-offset|ring-style|corner|outline|attachment|size$/.test(name) && !/^(text|text-muted|text-subtle|text-inverted|text-link)$/.test(name)) {
        if (!parseColor(raw)) continue;
      }
      const c = get(map, token);
      if (!c || raw === undefined) continue;
      const hex = c.a < 1 ? toHex(c) + Math.round(c.a * 255).toString(16).padStart(2, '0') : toHex(c);
      set.color[name] = { $type: 'color', $value: hex };
    }
    for (const k of Object.keys(set)) if (!Object.keys(set[k]).length) delete set[k];
    const bucket = out.skins[skin] || (out.skins[skin] = {});
    bucket[variant ? `${mode}-${variant}` : mode] = set;
  }
  return JSON.stringify(out);
}
writeFileSync(join(dist, 'tokens.json'), tokensJson() + '\n');

/* ------------------------------------------------------ html-data.json --
   Editor autocomplete for every data-bk-* attribute. Skin names, labels and
   accents come from the runtime just written, so they cannot drift from it. */

{
  const { theme } = createRequire(import.meta.url)(join(dist, 'bukalemun.cjs'));
  const data = htmlData({ skins: theme.styles.filter((s) => s !== 'default'), meta: theme.meta, accents: theme.accents });
  writeFileSync(join(dist, 'bukalemun.html-data.json'), JSON.stringify(data, null, 2) + '\n');
}

/* ---------------------------------------------------------- manifest --- */

// Deterministic on purpose: dist/ is committed so the CDN can serve it, and a
// build timestamp would make every rebuild look like a change.
const manifest = {
  name: pkg.name,
  version: VERSION,
  skins,
  components: COMPONENTS,
  core: CORE,
  modules: JS_MODULES
};
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

/* ------------------------------------------------------------ report --- */

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB';
const rows = [
  ['bukalemun.css', fullCss],
  ['bukalemun.min.css', minifyCss(fullCss)],
  ['bukalemun.base.min.css', minifyCss(baseCss)],
  ['bukalemun.core.min.css', minifyCss(coreOnlyCss)],
  ['bukalemun.js', iife],
  ['bukalemun.min.js', minifyJs(iife)],
  ['bukalemun.esm.min.js', minifyJs(esm)]
];

console.log(`\n  Bukalemun ${VERSION} built — ${skins.length} skins, ${COMPONENTS.length} component sheets\n`);
for (const [name, content] of rows) {
  console.log('  ' + name.padEnd(26) + kb(content).padStart(10));
}
console.log('');
