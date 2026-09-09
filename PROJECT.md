# Bukalemun — architecture

This document explains *why* the code is shaped the way it is. If you only want
to use the framework, [README.md](README.md) is the one you want.

---

## The central idea

A CSS framework usually bakes its taste into its component rules:

```css
/* the usual shape — the look is welded to the component */
.btn-primary { background: #0d6efd; border-radius: .375rem; box-shadow: none; }
```

You can override that, but you are fighting the rule. Bukalemun forbids it. The
single hard constraint in this codebase is:

> **A component stylesheet may not name a colour, a radius, a shadow, a font, a
> border width or a duration. It may only read tokens.**

```css
/* components/button.css — nothing here knows what a skin looks like */
.bk-btn {
  color: var(--_fg);
  background-color: var(--_bg);
  border: var(--bk-btn-border-width) var(--bk-border-style) var(--_bd);
  border-radius: var(--bk-btn-radius);
  box-shadow: var(--bk-btn-shadow);
  transition: var(--bk-transition);
}
```

A *skin* is then a pure token document. It never writes a component rule unless
it wants a structural flourish that tokens cannot express (terminal's bracketed
`[Buttons]`, cyber's chamfered `clip-path`, sketch's SVG turbulence filter).

That constraint is enforced by the test suite, not by discipline:
`tests/run.mjs` fails if any component reads a `--bk-*` token that is never
defined, if any selector escapes its skin's scope, or if a class or custom
property drops the `bk-` prefix.

## Token tiers

```
tier 1  primitives    space scale, type scale, easings, durations, z-layers
tier 2  semantics     --bk-bg --bk-surface --bk-text --bk-primary --bk-radius-card …
tier 3  component     --bk-btn-shadow --bk-field-border --bk-card-pad --bk-overlay-*
```

Components read tier 2 and 3. Skins rewrite tier 2 and 3. Tier 1 is shared, so
`--bk-space-4` means the same distance in every skin — which is what keeps 50
wildly different looks from also being 50 different layout systems.

### The colour channel pattern

A button has two orthogonal axes: which colour it is, and how that colour is
applied. Encoding that as `.bk-btn-primary-outline` explodes combinatorially.
Instead, a colour modifier only redefines a *channel*:

```css
.bk-btn-primary { --bk-c: var(--bk-primary); --bk-c-soft: …; --bk-c-on: …; }
.bk-btn-outline { --_bg: transparent; --_fg: var(--bk-c-text); --_bd: var(--bk-c-border); }
```

7 colours × 8 appearances × 5 sizes = 280 button variants from 20 rules.

### Why an accent needs three foreground tokens

This is the part that took the longest to get right. An accent colour plays
three different roles, and they have three different contrast requirements:

| token | used as | judged against |
|---|---|---|
| `--bk-primary` | a solid fill | — |
| `--bk-on-primary` | text **on** that fill | the fill |
| `--bk-primary-text` | the accent **as** text | the page and cards |
| `--bk-primary-on-soft` | text on the pale chip | `--bk-primary-soft` |

Collapsing these breaks immediately in practice. Neo-brutalism's primary is a
bright yellow: perfect as a fill with black text, illegible as body text on
cream. And a skin may deliberately keep pale chips in dark mode — brutal does —
so the chip foreground cannot be derived from the page background either.

Splitting the roles is what makes it possible for 50 opinionated palettes to all
pass WCAG AA without any of them being toned down.

### Hover and active are derived

`--bk-primary-hover` used to be a literal in the core palette, like the fill.
That meant a skin which set `--bk-success` but not `--bk-success-hover` — most
of them — showed its own green at rest and the *default palette's* green under
the pointer, with a label tuned for the wrong fill. Forty-five skins had it.

The core now derives the two states from the fill and its own label:

```css
--bk-success-hover:  color-mix(in srgb, var(--bk-success), var(--bk-on-success) 8%);
--bk-success-active: color-mix(in srgb, var(--bk-success), var(--bk-on-success) 14%);
```

A step *towards the label* darkens a dark-on-light fill and lightens a
light-on-dark one, so it reads as pressure in either mode. It also costs a
little contrast, which is why the audit checks the label against all three
fills and the deriver, when the derived step falls short of AA, pins a literal
that steps the same distance *away* from the label instead. A skin that hand-
picks its hovers keeps them.

The same audit closed a second gap: `--bk-surface-inverted` is only inverted
if the mode block flips it. Thirty-three skins flipped the text and not the
surface, or neither, and painted an "inverted" chip in the page's own colour.

## Colour-mode resolution, and a trap

Core tokens are declared inside `:where(:root)` so that a single user class beats
them. That zero specificity is deliberate — and it creates a subtle bug that
existed in this repo for exactly one afternoon:

```css
:where([data-bk-theme="auto"]) { --bk-bg: #0e1014; }  /* specificity 0,0,0 */
[data-bk-style="glass"]        { --bk-bg: #eef1fb; }  /* specificity 0,1,0 — wins */
```

With `data-bk-theme="auto"` on a dark OS, the *skin's light palette* won. Asking
every skin to hand-write a second copy of its dark block would be 50 chances to
forget, so `scripts/build.mjs` generates the mirror instead:

```css
@media (prefers-color-scheme: dark) {
  [data-bk-style="glass"][data-bk-theme="auto"] { /* …the dark block, verbatim… */ }
}
```

The build only mirrors blocks whose selector is *exactly* the mode selector, so
a rule that descends into a component is never duplicated.

## Contrast as a build gate

`tests/contrast.mjs` resolves the token graph the way a browser would — `var()`
chains, fallback arguments, alpha compositing over the page — and checks every
foreground/background pair the components actually paint. 7 242 pairs across 51
skins × 2 modes, with no browser involved, in well under a second.

When it fails, `scripts/derive-contrast.mjs` fixes it. Rather than hand-tuning
palettes, it keeps each colour's hue and saturation and walks its **lightness**
in 1% steps until the pair clears AA with a 4% margin. Only if no lightness in
that hue works does it start bleeding saturation, and only as far as needed. As a
last resort it moves the *fill* instead of the foreground, and reports that it
did.

The result is written back into the skin file inside a regenerable block:

```css
/* ==== derived contrast tokens — generated by scripts/derive-contrast.mjs */
[data-bk-style="brutal"] {
  --bk-primary-text: #8b6b00;      /* the yellow, dark enough to read */
  --bk-primary-on-soft: #866700;
}
/* ==== end derived contrast tokens ==== */
```

Two non-obvious rules the deriver has to follow, both learned by getting them
wrong first:

1. **Fixes must be pinned in both modes.** `--bk-primary-text` fixed for light
   mode lands in the base block, which also applies in dark mode — where it may
   be wrong. So any token fixed in either mode is written explicitly in both.
2. **Private variables are real variables.** A skin may keep its palette in
   `--_gold` or `--_orange` and point `--bk-primary` at it. The resolver has to
   follow those too — an earlier version collected only `--bk-*` and therefore
   could not see through `--bk-primary: var(--_orange)`, which made it audit a
   colour it had failed to resolve.
3. **Pin literals verbatim, flatten `var()` links.** A translucent chip like
   `rgb(99 102 241 / 0.14)` must stay translucent, so literal declarations are
   copied as-is. But a `var()` link must be resolved to a hex, because the token
   it points at may itself be pinned per mode — following the link would drag a
   light-mode fix into dark mode.

## Three test layers

Each one protects a different property, and none of them needs a browser.

| suite | property | failure it catches |
|---|---|---|
| `tests/run.mjs` | **structure** | a component naming a colour, a skin leaking outside its scope, an unprefixed class, a broken export map |
| `tests/contrast.mjs` | **legibility** | any of 7 242 foreground/background pairs dropping below WCAG AA |
| `tests/palette.mjs` | **identity** | a skin quietly changing appearance |

The third one is the least obvious and the most useful. The contrast audit
proves a skin is *readable*; it says nothing about whether it still looks like
itself. Re-running the contrast deriver, refactoring the token graph, or adding
a stray override can repaint a skin while every other test stays green.

So `tests/palette.lock.json` records, for all 102 skin/mode combinations, what
the identity-carrying tokens actually *resolve* to — colours flattened to hex
(a `var()` refactor is invisible), shape and type tokens kept verbatim (a
changed radius shows up). Any drift fails the build with a token-level diff.
When the change was deliberate: `npm run palette:update`.

## Accessibility beyond contrast

`src/core/a11y.css` loads last in the core, so it outranks component defaults.
It covers the environments where a skin's taste has to yield:

- **`forced-colors`** (Windows High Contrast) replaces the palette wholesale.
  Everything a skin expressed through background images, shadows or
  `color-mix()` simply disappears — so under forced colours the rules re-express
  state through borders and system colours (`Canvas`, `CanvasText`,
  `Highlight`), and explicitly repaint the mask-drawn icons, which would
  otherwise vanish entirely.
- **`prefers-contrast: more`** keeps the skin but firms up every edge:
  hairlines become the strong border, subtle text is promoted to muted,
  the focus ring thickens, and ghost/link buttons gain underlines.
- **`prefers-reduced-transparency`** drops backdrop filters, which is the one
  thing glass, aero and vapor cannot express any other way.
- **`@media print`** removes overlays and chrome, flattens surfaces, expands
  every tab panel and prints link targets.

## The runtime

`src/js/core.js` is a kernel, not a framework: DOM helpers, event delegation, a
~40-line reactive store, an anchored-positioning engine (place → flip → shift →
arrow), a focus trap, a reference-counted scroll lock, and a plugin registry.

Every behaviour registers against that registry:

```js
bk.define('tabs', {
  selector: '[data-bk-tabs]',
  setup(node) { /* … */ return { activate, destroy }; }
});
```

`bk.init()` walks the tree once, `bk.observe()` keeps a `MutationObserver` on it
so htmx/Turbo swaps just work, and instances are stored in a `WeakMap` so
removing a node collects its state.

Overlays ride on native `<dialog>` — top layer, `::backdrop`, inertness and Esc
come from the platform. The runtime only adds animated close, light dismiss and
focus restoration.

Three module-scope guards (`typeof document !== 'undefined'`) make the bundle
safe to import on a server; `bk.start()` becomes a no-op there.

## Build

`scripts/build.mjs` is plain Node with no dependencies, including its own
minifiers. Both are deliberately conservative:

- The **CSS minifier** walks the string tracking string state, so it never
  touches a value. Custom properties and data-URI masks survive intact. A test
  asserts the declaration count is *identical* before and after.
- The **JS minifier** strips comments and collapses whitespace but renames
  nothing and reorders nothing. It tracks strings, template literals and regex
  literals so `/` is never mistaken for a comment. ~30% off, zero risk.

Output: full / base / core CSS, 50 per-skin files, UMD + ESM + CJS, all minified,
plus `no-flash.js` and a `manifest.json`.

## Repository layout

```
src/core/          reset, tokens, icons, typography, layout, utilities, animations, a11y
src/components/    button form choice card badge feedback table nav overlay disclosure
src/styles/        50 skins, one file each
src/js/            core.js, boot.js, modules/{theme,float,overlay,nav,toast,input,data}
scripts/           build.mjs, site.mjs, derive-contrast.mjs, serve.mjs, lib/tokens.mjs
types/             index.d.ts — hand-written, checked by a drift test
tests/             run.mjs (39 structural checks), contrast.mjs (7 242 pairs),
                   palette.mjs + palette.lock.json (102 skin/mode snapshots)
docs/              single-page showcase, built with the framework itself
dist/              generated — do not edit
```

## Deliberate non-goals

- **No utility-first API.** There are ~150 utilities, the ones that earn their
  keep. Components do the work.
- **No JS-driven styling.** The runtime adds behaviour and toggles classes; it
  never writes a colour.
- **No framework adapters.** The `data-bk-*` attributes and the `MutationObserver`
  are the integration story.
- **No `!important`.** Not once in `src/`.

## Adding a skin

1. Copy the nearest `src/styles/*.css` and rename the attribute selector.
2. Rewrite the tier-2 palette. Add a `[data-bk-theme="dark"]` block (or a
   `[data-bk-theme="light"]` one if your base palette is dark).
3. Add the slug and a one-line blurb to `STYLES`/`META` in
   `src/js/modules/theme.js` — a test enforces that they stay in sync.
4. Add the slug to the `SkinName` union in `types/index.d.ts` — also enforced
   by a test.
5. `npm run contrast:fix && npm test`.

The build picks the file up automatically; nothing else needs editing.

## Publishing

`scripts/site.mjs` owns the published layout, and three consumers call it: the
GitHub Pages workflow, the Cloudflare tunnel's systemd unit, and `npm run docs`.
They cannot drift apart because there is only one implementation.

One detail worth keeping: `dist/` filenames are stable on purpose, because CDN
consumers pin them. That means TTL is the only thing invalidating them, and
different CDN edges can briefly disagree about which build they hold — we
watched one serve a fresh stylesheet against a stale script. So the published
pages fingerprint *their own* asset URLs (`dist/bukalemun.base.min.css?v=<hash>`,
and the `{skin}` template the runtime fetches skins through), which
makes a mismatched pair unrepresentable while leaving the public filenames
untouched.
