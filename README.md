<div align="center">

<picture>
  <source srcset="https://raw.githubusercontent.com/nickzsche/bukalemun/main/assets/mascot.webp" type="image/webp">
  <img src="https://raw.githubusercontent.com/nickzsche/bukalemun/main/assets/mascot.png" alt="Bukalemun — a chameleon in sunglasses on a branch" width="360">
</picture>

# Bukalemun

**One framework. Fifty skins. Zero dependencies.**

The same markup, the same class names, the same JavaScript — wearing a
neo-brutalist, glassmorphic, Bauhaus, CRT-terminal or vaporwave face.
Change one attribute, change everything.

[![npm](https://img.shields.io/npm/v/bukalemun?color=black&label=npm)](https://www.npmjs.com/package/bukalemun)
[![MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![no dependencies](https://img.shields.io/badge/dependencies-0-black)](package.json)
[![CSS 91 KB gzipped](https://img.shields.io/badge/css-91%20KB%20gzip-black)](#size)
[![typed](https://img.shields.io/badge/types-included-black)](types/index.d.ts)
[![WCAG AA](https://img.shields.io/badge/contrast-WCAG%20AA%20audited-black)](#accessibility)

### [→ Live demo: try all 50 skins](https://bukalemun.zerosixlab.com/) · [Playground: paste your own HTML](https://bukalemun.zerosixlab.com/playground.html)

<sub>mirror: [nickzsche.github.io/bukalemun](https://nickzsche.github.io/bukalemun/)</sub>

</div>

---

```html
<!-- everything except the skins, then the one skin you picked -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.base.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/styles/brutal.min.css">
<script src="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.min.js" defer></script>
```

```html
<html data-bk-style="brutal" data-bk-theme="dark">
```

That is the whole install — **33.0 KB of CSS gzipped**, no build step, no config
file, no plugin ecosystem, no `node_modules`.

Fifty skins in one file is the *playground* build, not the shipping one. Reach
for `bukalemun.min.css` when you want a visitor to be able to try all of them
in a picker; it costs 120 KB gzipped, which is fifty palettes you are not
using.

---

## Why this exists

Every CSS framework makes you look like that CSS framework. You can retheme
Bootstrap or Tailwind, but you are always working *against* a house style that
was baked into the component rules themselves.

Bukalemun inverts that. **No component stylesheet ever names a colour, a radius,
a shadow or a font.** Components read semantic tokens; a *skin* rewrites the
tokens. So a skin is not a colour swap — it is a whole design language, and
swapping it repaints buttons, dialogs, tables, focus rings and motion curves in
one attribute change.

```
┌─ tier 1 ─ primitives ── space, type scale, easings, z-layers
├─ tier 2 ─ semantics ─── --bk-surface, --bk-text, --bk-primary, --bk-radius-card …
├─ tier 3 ─ component ─── --bk-btn-shadow, --bk-field-border, --bk-card-pad …
└─ skins ──────────────── rewrite tier 2 and 3, never touch a component rule
```

## The 50 skins

| | | |
|---|---|---|
| **`brutal`** Neo-Brutalist — hard offset shadows, 2px ink, zero radius | **`glass`** Glassmorphism — frosted panes over an aurora | **`neumorph`** Soft UI — one slab of plastic, lit top-left |
| **`skeuo`** Skeuomorphic — bevels, gloss, brushed metal | **`terminal`** CRT phosphor — monospace, scanlines, bracketed buttons | **`swiss`** International Typographic — grid, Helvetica, one red |
| **`memphis`** 80s postmodern — confetti, clashing pastels, tilt | **`clay`** Claymorphism — puffy pastel dough, fat corners | **`cyber`** Cyberpunk HUD — chamfered corners, neon rim-light |
| **`pixel`** 8-bit — everything snaps to the pixel grid | **`material`** Material — elevation, tonal surfaces, ripples | **`minimal`** Hairline monochrome — whitespace does the work |
| **`paper`** Newsprint — serif editorial, drop caps, grain | **`aurora`** Gradient mesh — saturated glow, gradient text | **`blueprint`** Technical drawing — cyan ink on a navy grid |
| **`deco`** Art Deco — gold hairlines, stepped chamfers | **`bauhaus`** Primary colours, primary shapes | **`vapor`** Vaporwave — sunset grid, chrome, VHS fringe |
| **`organic`** Blob radii and earthy pigments | **`aero`** Frutiger Aero — glossy aqua, circa 2006 | **`sketch`** Hand-drawn — wobbly SVG ink on notebook paper |
| **`luxe`** Editorial noir — charcoal, champagne, high-contrast serif | **`y2k`** Y2K chrome — liquid-chrome type, bevelled bubbles | **`zen`** Japandi — washi paper, sumi ink, one clay accent |
| **`comic`** Ink outlines and Ben-Day halftone dots | **`wireframe`** Lo-fi mockup — greyscale, dashed, honest | **`solarpunk`** Brass and leaf green on limewashed plaster |
| **`retro70s`** Avocado, rust and harvest gold bands | **`pixelart`** 16-bit — dithering instead of gradients | **`riso`** Risograph — two spot inks, slightly off-register |
| **`gothic`** Blackletter, oxblood and tarnished gold | **`win95`** Grey chrome, outset bevels, title bars | **`macclassic`** 1984 — one bit of colour depth |
| **`noir`** Hard light, venetian blinds, one bruise | **`candy`** Glossy, saturated, entirely unserious | **`industrial`** Concrete, safety orange, hazard stripes |
| **`herbarium`** Pressed-specimen sheet, engraved serif | **`typewriter`** Struck on onion skin, red ribbon | **`magazine`** Newsstand headlines, one arterial red |
| **`ledger`** Green-bar paper, figures that add up | **`nouveau`** Whiplash curves, sage and old brass | **`holo`** Prism foil that shifts as it moves |
| **`thermal`** One ink, no greys — only dithered dots | **`chalk`** Slate, chalk dust, unclosed strokes | **`neonsign`** Bent glass on brick, humming |
| **`denim`** Indigo twill, contrast topstitching | **`marble`** Carrara veining, inscriptional caps | **`space`** Deep field, star map, instrument cyan |
| **`clinical`** Sterile white, mint, strict tabular grid | **`origami`** Every sheet has a corner folded back | *(plus the neutral default)* |

Every skin ships a light **and** a dark palette, and every one is contrast-audited.

Every skin also carries two **accent variants**, `warm` and `cool`: the same
accent family rotated thirty degrees in hue, with saturation and lightness left
exactly where the skin put them, so a brutalist yellow becomes a brutalist
orange and a vaporwave pink becomes a vaporwave coral. They are generated, not
painted (`scripts/derive-variants.mjs`), and every one is audited and locked
like a skin. Switch with `data-bk-accent="warm|cool"` on `<html>`.

```js
bk.theme.setStyle('vapor');   // switch
bk.theme.next();              // cycle
bk.theme.random();            // roll the dice
bk.theme.toggle();            // light ⇄ dark
bk.theme.setAccent('cool');   // the skin's accent, thirty degrees cooler
bk.theme.loadFonts();         // opt-in: fetch the skin's display face from Google Fonts
```

The framework never loads a webfont on its own — it only *names* families —
but every skin declares the face it was drawn for (`bk.theme.info('pixel').fonts`),
so a page that switches skins at runtime can fetch the right one.

The choice persists in `localStorage`. Paste `dist/no-flash.js` inline in
`<head>` to apply it before the first paint.

## Install

**CDN — what you should ship** · core + every component, then one skin.
31.0 KB + 2.0 KB gzipped.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.base.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/styles/brutal.min.css">
<script src="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.min.js" defer></script>
```

Swapping skins later is swapping that second line. Shipping two or three so a
user can choose between them is still under 40 KB.

**Letting people pick, without shipping all fifty** · tell the no-flash snippet
where the per-skin files live and the runtime fetches each one the first time
it is chosen — the stored one before first paint, the rest on demand, and
`bk.theme.setStyle()` waits for the stylesheet before it flips, so nothing ever
paints in the wrong palette. This is what the docs and every demo do: about
55 KB gzipped on arrival, then ~2 KB per skin you actually look at.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.base.min.css">
<script src="https://cdn.jsdelivr.net/npm/bukalemun/dist/no-flash.js"
        data-bk-skins="https://cdn.jsdelivr.net/npm/bukalemun/dist/styles/{skin}.min.css"></script>
<script src="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.min.js" defer></script>
```

`bk.theme.preload()` fetches the rest during idle time if you would rather pay
up front, and `bk.theme.lazy(template)` sets the template from script instead.

**CDN — all fifty in one file** · for a playground where every skin is on the
page at once. 120 KB gzipped.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.min.css">
<script src="https://cdn.jsdelivr.net/npm/bukalemun/dist/bukalemun.min.js" defer></script>
```

> `bukalemun.core.min.css` (14 KB) is tokens, reset, layout and utilities
> **without any components** — no `.bk-btn`, no `.bk-card`. It is there for
> people bringing their own components to the token contract, not as a smaller
> way to get the framework.

**npm**

```bash
npm install bukalemun
```

```js
import 'bukalemun/css/base';                 // core + components, no skins
import 'bukalemun/styles/brutal.min.css';    // then one skin
// import 'bukalemun/css/min';               // or all fifty, for a playground
import bk from 'bukalemun';
```

The package ships ESM, UMD and plain `<script>` builds, with TypeScript
declarations. Importing it on a server is safe — the runtime no-ops without
a DOM.

```ts
import bk, { type SkinName } from 'bukalemun';

const skin: SkinName = 'solarpunk';   // checked against the 50 real slugs
bk.theme.setStyle(skin);
await bk.confirm({ title: 'Ship it?', danger: true });
```

## <a id="size"></a>Size

| file | raw | gzip |
|---|---:|---:|
| `bukalemun.base.min.css` — core + every component, no skins | 180 KB | **31.0 KB** |
| a single skin with its two accent variants, e.g. `styles/brutal.min.css` | 10 KB | **2.0 KB** |
| **the two above — what you should ship** | 190 KB | **33.0 KB** |
| `bukalemun.min.js` — the full runtime, entirely optional | 82 KB | **23.4 KB** |
| `bukalemun.min.css` — all fifty skins in one file | 768 KB | **119.7 KB** |
| `bukalemun.core.min.css` — tokens, reset, layout, utilities, a11y, **no components** | 63 KB | **13.5 KB** |

The last two rows are not smaller ways to install the framework. The fifty-skin
bundle is for playgrounds and style pickers — this project's own demos use it
because switching is the point. `core` has no `.bk-btn` and no `.bk-card`; it
is for bringing your own components to the token contract.

## Components

65+ pieces, all pure CSS, all skin-aware:

**Actions** button (7 appearances × 7 colours × 5 sizes), button group, segmented
control, FAB, close, ripple, key caps (`bk-kbd`)
**Forms** input, textarea, select, input group, inline affixes, floating label,
search, checkbox, radio, switch, range, rating, file, dropzone, OTP, tags input,
combobox, choice cards, fieldset, validation states
**Data** table (sortable, filterable, responsive card mode), list group, card,
stat, badge, chip, avatar + group, timeline, tree, calendar, code block, chat
bubbles, carousel, marquee, empty state, skeleton
**Feedback** alert, banner, callout, toast, progress (linear, striped,
indeterminate, ring), meter, spinner, dots, bars, status dot
**Navigation** navbar, sidebar, tabs (4 styles, animated indicator), breadcrumb,
pagination, steps, toolbar, dock, bottom nav, TOC/scrollspy, back-to-top, footer
**Overlays** modal, drawer (4 sides), popover, dropdown menu, tooltip, command
palette, lightbox, confirm dialog
**Layout** container, stack, cluster, switcher, sidebar layout, auto grid, reel,
split, columns, frame, cover, layers
**Marketing** hero section, pricing table, testimonial

## Demos

Ten standalone pages live in [`demos/`](demos/) — each one is a small, real
interface wearing the framework. Start at
[`demos/index.html`](demos/index.html), a gallery whose thumbnails are the live
pages in scaled iframes rather than screenshots, so they can never go stale.

Every demo carries a dock in the corner with all fifty skins, a light/dark
toggle and `Shift + ← →` to cycle. Append `?skin=vapor&mode=dark` to any demo
URL to link straight to one look without changing what the visitor picked.

| page | signature skin | what it shows |
|---|---|---|
| [`landing.html`](demos/landing.html) | Neo-Brutalist | hero, feature grid, pricing table, testimonials, FAQ accordion |
| [`dashboard.html`](demos/dashboard.html) | Terminal | sidebar, stat cards, sortable table, progress, activity timeline |
| [`docs.html`](demos/docs.html) | Newsprint | breadcrumb, TOC, code blocks, key caps, callouts, tabs |
| [`store.html`](demos/store.html) | Claymorphism | product gallery, ratings, choice cards, reviews, cart badge |
| [`app.html`](demos/app.html) | Glassmorphism | kanban board, drawer, confirm modal, toasts, menus |
| [`blog.html`](demos/blog.html) | Magazine | long-form prose, pull quotes, author card, pagination, chips |
| [`portfolio.html`](demos/portfolio.html) | Film Noir | gallery grid, modals, marquee, steps, counters, contact form |
| [`settings.html`](demos/settings.html) | Clinical | the whole form kit — validation, switches, range, dropzone, tags, OTP |
| [`chat.html`](demos/chat.html) | Y2K | conversation list, bubbles, typing indicator, presence, popover |
| [`arcade.html`](demos/arcade.html) | Pixel Art | leaderboard, meters, tree, key caps, segmented control |

Serve them from any static server (`python3 -m http.server`) — the demo pages
load the framework from `../dist/`.

## JavaScript

Behaviour is opt-in through `data-bk-*` attributes, and everything has a
programmatic twin. Nothing is required — the CSS works alone.

```html
<button data-bk-open="#dialog">Open</button>
<dialog id="dialog" class="bk-modal">…</dialog>

<table data-bk-table data-bk-filter="#q">
  <th data-bk-sort="number">Builds</th>
</table>

<div data-bk-tabs>…</div>
<span data-bk-counter="1284"></span>
<button data-bk-copy="#snippet">Copy</button>
```

```js
bk.toast.success('Saved');
bk.toast.promise(deploy(), { loading: 'Deploying…', success: 'Live', error: 'Failed' });
await bk.confirm({ title: 'Delete?', danger: true });
bk.modal('#dialog', 'open');
bk.hotkey('mod+k', openPalette);
bk.announce('Row deleted');            // polite live region

const state = bk.store({ count: 0 });  // ~40-line reactive store
state.subscribe(s => render(s));
```

Register your own component against the same auto-init machinery:

```js
bk.define('flip', {
  selector: '[data-bk-flip]',
  setup(node) {
    const off = bk.on(node, 'click', () => node.classList.toggle('is-flipped'));
    return { destroy: off };
  }
});
```

New nodes are picked up automatically by a `MutationObserver`, so it works with
htmx, Turbo, or any framework that swaps DOM under you.

## <a id="accessibility"></a>Accessibility

Not a checklist item — a build gate.

- **Native elements first.** Checkboxes are `<input type=checkbox>`, dialogs are
  `<dialog>`, accordions are `<details>`. Semantics and keyboard support come
  from the platform, not from re-implementations.
- **21 442 contrast pairs are audited on every `npm test`** — 51 skins × 2 colour
  modes × 3 accent variants × every foreground/background combination the
  components actually paint, hover and active fills, cards, overlays and
  inverted surfaces included.
  `node tests/contrast.mjs` resolves the token graph (var() chains, fallbacks,
  alpha compositing) without a browser and fails the build below WCAG AA.
- **Forced colours are handled properly.** In Windows High Contrast the skins
  step aside: system colours take over, borders carry the meaning that shadows
  and tints used to, and mask-drawn icons stay visible.
- `prefers-contrast: more` firms up every edge without leaving the skin;
  `prefers-reduced-transparency` drops the frosted-glass effects.
- **Palettes are derived, not guessed.** `npm run contrast:fix` keeps each
  accent's hue and saturation and moves only its lightness until the pair
  passes, so a skin stays itself while becoming legible.
- Focus is always visible and skin-aware; overlays trap focus and restore it.
- `prefers-reduced-motion` is honoured in CSS *and* in the runtime.
- Logical properties throughout — RTL needs no second stylesheet.

### A note on fonts

Skins *name* a family; they do not ship one. Loading fonts is your call — the
framework stays dependency-free and most projects want their own type anyway.
Point `--bk-font-sans` and `--bk-font-display` at whatever you have:

```css
[data-bk-style="pixelart"] { --bk-font-sans: "Silkscreen", monospace; }
```

The demo site loads each skin's intended family from Google Fonts lazily, the
first time you switch to that skin — see `docs/assets/docs.js` if you want the
same trick.

## Tokens as data

`dist/tokens.json` is every skin, colour mode and accent variant, resolved, in
the [W3C Design Tokens](https://tr.designtokens.org/format/) format: colours
as hex, font stacks as arrays, radii and spacing as dimensions. Pull a skin
into Figma variables, a Style Dictionary pipeline or a native app without
reading a line of CSS.

```js
import tokens from 'bukalemun/tokens' with { type: 'json' };
tokens.skins.brutal['dark-warm'].color.primary.$value;   // "#ff723f"
```

## Customising

There is a [skin builder on the demo site](https://bukalemun.zerosixlab.com/#builder)
— move six dials, copy the CSS, and what you get *is* a skin file.

By hand: override tokens; never fork a component.

```css
:root {
  --bk-primary: #ff5c00;
  --bk-on-primary: #fff;
  --bk-radius-card: 1.25rem;
  --bk-font-sans: "Inter", system-ui;
}

.checkout { --bk-primary: #16794b; }   /* scoped to a region */
```

Four axes compose freely with all 50 skins:

```html
<html data-bk-style="glass"
      data-bk-theme="dark"
      data-bk-accent="cool"
      data-bk-density="compact"
      data-bk-radius="full">
```

## Development

```bash
git clone https://github.com/nickzsche/bukalemun
cd bukalemun
npm run build          # concatenate + minify (no dependencies)
npm test               # structure suite + contrast audit + palette lock
npm run docs           # http://localhost:4321
npm run contrast:fix   # re-derive the contrast fixes and the warm/cool accent variants
npm run palette:update # re-lock the palette snapshot after a deliberate change
```

There is no bundler. `scripts/build.mjs` is ~300 lines of plain Node and
contains its own conservative CSS and JS minifiers.

Three test layers, none of which need a browser:

| suite | what it protects |
|---|---|
| `tests/run.mjs` | structure — token contract, skin scoping, naming, build integrity |
| `tests/contrast.mjs` | legibility — 21 000+ WCAG pairs across every skin, mode and accent variant |
| `tests/palette.mjs` | identity — a lockfile of how each skin *resolves*, so a refactor cannot repaint a skin in silence |

## Browser support

Evergreen Chrome, Firefox, Safari and Edge. Uses `<dialog>`, `:has()`,
`color-mix()`, CSS nesting-free custom properties, container queries and logical
properties — all baseline since 2023.

## Licence

MIT © [Şahan Hasret](https://github.com/nickzsche)
