/* =============================================================================
   MODULE — theme
   Skin (data-bk-style) and colour-mode (data-bk-theme) switching, persisted to
   localStorage, applied before paint by the optional inline snippet.
   ========================================================================== */

(function (bk) {
  'use strict';

  var STYLES = [
    'default', 'brutal', 'glass', 'neumorph', 'skeuo', 'terminal', 'swiss',
    'memphis', 'clay', 'cyber', 'pixel', 'material', 'minimal', 'paper',
    'aurora', 'blueprint', 'deco', 'bauhaus', 'vapor', 'organic', 'aero',
    'sketch', 'luxe', 'y2k', 'zen', 'comic', 'wireframe', 'solarpunk', 'retro70s',
    'pixelart', 'riso',
    'gothic', 'win95', 'macclassic', 'noir', 'candy', 'industrial', 'herbarium',
    'typewriter', 'magazine', 'ledger', 'nouveau', 'holo', 'thermal', 'chalk',
    'neonsign', 'denim', 'marble', 'space', 'clinical', 'origami'
  ];

  var META = {
    'default':   { label: 'Default',        blurb: 'Neutral, modern, boring on purpose.' },
    'brutal':    { label: 'Neo-Brutalist',  blurb: 'Hard shadows, thick ink, zero radius.' },
    'glass':     { label: 'Glassmorphism',  blurb: 'Frosted panes over an aurora.' },
    'neumorph':  { label: 'Neumorphism',    blurb: 'One slab of plastic, lit top-left.' },
    'skeuo':     { label: 'Skeuomorphic',   blurb: 'Bevels, gloss and brushed metal.' },
    'terminal':  { label: 'Terminal',       blurb: 'Phosphor on a CRT, scanlines included.' },
    'swiss':     { label: 'Swiss',          blurb: 'Grid, Helvetica, one red accent.' },
    'memphis':   { label: 'Memphis',        blurb: '80s confetti and clashing pastels.' },
    'clay':      { label: 'Claymorphism',   blurb: 'Puffy pastel dough with fat corners.' },
    'cyber':     { label: 'Cyberpunk',      blurb: 'Chamfered neon HUD panels.' },
    'pixel':     { label: '8-bit',          blurb: 'Everything snaps to the pixel grid.' },
    'material':  { label: 'Material',       blurb: 'Elevation, tonal surfaces, ripples.' },
    'minimal':   { label: 'Minimal',        blurb: 'Hairlines and whitespace only.' },
    'paper':     { label: 'Newsprint',      blurb: 'Serif editorial on textured stock.' },
    'aurora':    { label: 'Aurora',         blurb: 'Gradient mesh and soft glow.' },
    'blueprint': { label: 'Blueprint',      blurb: 'Cyan drafting ink on navy grid.' },
    'deco':      { label: 'Art Deco',       blurb: 'Gold hairlines, stepped chamfers.' },
    'bauhaus':   { label: 'Bauhaus',        blurb: 'Primary colours, primary shapes.' },
    'vapor':     { label: 'Vaporwave',      blurb: 'Sunset grid, chrome, VHS fringe.' },
    'organic':   { label: 'Organic',        blurb: 'Blob radii and earthy pigments.' },
    'aero':      { label: 'Frutiger Aero',  blurb: 'Glossy aqua optimism, circa 2006.' },
    'sketch':    { label: 'Hand-drawn',     blurb: 'Wobbly ink on notebook paper.' },
    'luxe':      { label: 'Editorial Noir', blurb: 'Charcoal, champagne, high-contrast serif.' },
    'y2k':       { label: 'Y2K Chrome',     blurb: 'Liquid chrome type and bevelled bubbles.' },
    'zen':       { label: 'Japandi',        blurb: 'Washi paper, sumi ink, one clay accent.' },
    'comic':     { label: 'Comic',          blurb: 'Ink outlines and Ben-Day halftone dots.' },
    'wireframe': { label: 'Wireframe',      blurb: 'Lo-fi greyscale mockup, dashed and honest.' },
    'solarpunk': { label: 'Solarpunk',      blurb: 'Brass and leaf green on limewashed plaster.' },
    'retro70s':  { label: 'Retro 70s',      blurb: 'Avocado, rust and harvest gold bands.' },
    'pixelart':  { label: 'Pixel Art',      blurb: '16-bit palette, dithering instead of gradients.' },
    'riso':      { label: 'Risograph',      blurb: 'Two spot inks, overprinted, slightly off-register.' },
    'gothic':      { label: 'Gothic',          blurb: 'Blackletter, oxblood and tarnished gold.' },
    'win95':       { label: 'Desktop 95',      blurb: 'Grey chrome, outset bevels, title bars.' },
    'macclassic':  { label: 'Mac Classic',     blurb: 'One bit of colour depth, pinstriped.' },
    'noir':        { label: 'Film Noir',       blurb: 'Hard light, venetian blinds, one bruise.' },
    'candy':       { label: 'Bubblegum',       blurb: 'Glossy, saturated and entirely unserious.' },
    'industrial':  { label: 'Industrial',      blurb: 'Concrete, safety orange, hazard striping.' },
    'herbarium':   { label: 'Herbarium',       blurb: 'Pressed-specimen sheet, engraved serif.' },
    'typewriter':  { label: 'Typewriter',      blurb: 'Struck on onion skin, red ribbon.' },
    'magazine':    { label: 'Magazine',        blurb: 'Newsstand headlines, one arterial red.' },
    'ledger':      { label: 'Ledger',          blurb: 'Green-bar paper and figures that add up.' },
    'nouveau':     { label: 'Art Nouveau',     blurb: 'Whiplash curves, sage and old brass.' },
    'holo':        { label: 'Holographic',     blurb: 'Prism foil that shifts as it moves.' },
    'thermal':     { label: 'Thermal',         blurb: 'One ink, no greys — only dithered dots.' },
    'chalk':       { label: 'Blackboard',      blurb: 'Slate, chalk dust and unclosed strokes.' },
    'neonsign':    { label: 'Neon Sign',       blurb: 'Bent glass on brick, humming slightly.' },
    'denim':       { label: 'Denim',           blurb: 'Indigo twill, contrast topstitching.' },
    'marble':      { label: 'Marble',          blurb: 'Carrara veining and inscriptional caps.' },
    'space':       { label: 'Observatory',     blurb: 'Deep field, star map, instrument cyan.' },
    'clinical':    { label: 'Clinical',        blurb: 'Sterile white, mint, strict tabular grid.' },
    'origami':     { label: 'Origami',         blurb: 'Every sheet has a corner folded back.' }
  };

  /* The display face each skin is drawn for, as a Google Fonts css2 `family=`
     spec. The framework never loads a font by itself — that would make it stop
     being dependency-free, and most sites bring their own type — but a page
     that switches skins at runtime needs to know what to fetch, and guessing
     from the font-family stack is not knowing. `bk.theme.loadFonts()` is the
     opt-in. `null` is deliberate: win95, macclassic and skeuo are drawn in
     system faces, and a webfont substitute would read as a different decade. */
  var FONTS = {
    'default':    null,
    'brutal':     'Archivo:wght@400;700;800;900',
    'glass':      'Inter:wght@400;500;600;700',
    'neumorph':   'Nunito:wght@400;600;700;800',
    'skeuo':      null,
    'terminal':   'JetBrains+Mono:wght@400;700',
    'swiss':      'Inter:wght@400;500;700',
    'memphis':    'Poppins:wght@400;600;700;800',
    'clay':       'Quicksand:wght@400;600;700',
    'cyber':      'Rajdhani:wght@400;600;700&family=JetBrains+Mono:wght@400',
    'pixel':      'Press+Start+2P',
    'material':   'Roboto:wght@400;500;700',
    'minimal':    'Inter:wght@400;500;600',
    'paper':      'Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Playfair+Display:wght@600;700',
    'aurora':     'Plus+Jakarta+Sans:wght@400;600;700;800',
    'blueprint':  'IBM+Plex+Mono:wght@400;600',
    'deco':       'Cormorant+Garamond:wght@400;600&family=Josefin+Sans:wght@400;600',
    'bauhaus':    'Jost:wght@400;600;700',
    'vapor':      'Space+Grotesk:wght@400;500;700',
    'organic':    'Outfit:wght@400;600&family=Fraunces:opsz,wght@9..144,400;9..144,600',
    'aero':       'Titillium+Web:wght@400;600;700',
    'sketch':     'Gaegu:wght@400;700',
    'luxe':       'Playfair+Display:wght@400;500&family=Inter:wght@300;400;500',
    'y2k':        'Michroma',
    'zen':        'Zen+Kaku+Gothic+New:wght@400;500&family=Zen+Old+Mincho:wght@400;600',
    'comic':      'Bangers&family=Comic+Neue:wght@400;700',
    'wireframe':  'IBM+Plex+Mono:wght@400;600',
    'solarpunk':  'Work+Sans:wght@400;600&family=Fraunces:opsz,wght@9..144,400;9..144,600',
    'retro70s':   'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700',
    'pixelart':   'Silkscreen:wght@400;700',
    'riso':       'Space+Grotesk:wght@400;500;700',
    'gothic':     'UnifrakturMaguntia&family=EB+Garamond:wght@400;500;600',
    'win95':      null,
    'macclassic': null,
    'noir':       'Oswald:wght@300;500;600&family=Inter:wght@400;500',
    'candy':      'Baloo+2:wght@400;600;700;800',
    'industrial': 'Saira+Condensed:wght@400;600;700',
    'herbarium':  'EB+Garamond:ital,wght@0,400;0,500;1,400',
    'typewriter': 'Courier+Prime:ital,wght@0,400;0,700;1,400',
    'magazine':   'Anton&family=Inter:wght@400;500;700&family=Playfair+Display:ital@1',
    'ledger':     'IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600',
    'nouveau':    'Cormorant+Garamond:wght@400;500;600&family=Julius+Sans+One',
    'holo':       'Space+Grotesk:wght@400;500;600;700',
    'thermal':    'Courier+Prime:wght@400;700',
    'chalk':      'Caveat:wght@400;600;700',
    'neonsign':   'Monoton&family=Inter:wght@400;500;700',
    'denim':      'Archivo:wght@400;600;700',
    'marble':     'Cinzel:wght@400;500;600&family=Cormorant+Garamond:wght@400;500',
    'space':      'Exo+2:wght@300;400;500;600&family=Roboto+Mono:wght@300;400',
    'clinical':   'IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400',
    'origami':    'Manrope:wght@400;600;700;800'
  };
  Object.keys(META).forEach(function (k) { META[k].fonts = FONTS.hasOwnProperty(k) ? FONTS[k] : null; });

  var KEY_STYLE = 'bk:style';
  var KEY_MODE = 'bk:mode';
  var listeners = [];

  function root() { return document.documentElement; }

  function notify() {
    var s = { style: getStyle(), mode: getMode(), resolved: resolvedMode() };
    listeners.slice().forEach(function (fn) { fn(s); });
    bk.emit(root(), 'bk:themechange', s);
  }

  function getStyle() {
    return root().getAttribute('data-bk-style') || 'default';
  }

  /* --- lazy skins ----------------------------------------------------------
     The recommended install is base + one skin. A page that lets people
     switch has to fetch the others, and doing that *after* flipping the
     attribute paints one frame of the base palette. So the module owns it:
     tell it where the per-skin files live, and setStyle() waits for the
     stylesheet before it flips. The template is picked up automatically from
     `<script src="no-flash.js" data-bk-skins="…/{skin}.min.css">`, which is
     also how the snippet fetches the *stored* skin before first paint.     */
  var skinTemplate = null;
  var skinLinks = {};
  var pendingStyle = null;

  function detectTemplate() {
    if (typeof document === 'undefined') return null;
    var tag = document.querySelector('script[data-bk-skins]');
    return tag ? tag.getAttribute('data-bk-skins') : null;
  }

  function lazySkins(template) {
    skinTemplate = template === undefined ? detectTemplate() : (template || null);
    return skinTemplate;
  }

  /**
   * Make sure a skin's stylesheet is in the document. Calls back exactly once:
   * straight away if it is already there (or nothing is lazy), otherwise when
   * the fetch settles. A failed fetch settles too — the wrong look for a
   * moment beats a control that never responds.
   */
  function ensureSkin(name, done) {
    var cb = done || function () {};
    if (!name || name === 'default' || !skinTemplate) { cb(); return true; }
    var entry = skinLinks[name];
    if (!entry) {
      var existing = document.querySelector('link[data-bk-skin="' + name + '"]');
      if (existing) {
        entry = skinLinks[name] = { done: true, waiting: [] };
      } else {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = skinTemplate.replace('{skin}', name);
        link.setAttribute('data-bk-skin', name);
        entry = skinLinks[name] = { done: false, waiting: [] };
        link.onload = link.onerror = function () {
          entry.done = true;
          var waiting = entry.waiting;
          entry.waiting = [];
          waiting.forEach(function (fn) { fn(); });
        };
        document.head.appendChild(link);
      }
    }
    if (entry.done) { cb(); return true; }
    entry.waiting.push(cb);
    return false;
  }

  /** Fetch skins ahead of time, one per idle slot, so a switch is instant. */
  function preloadSkins(names) {
    if (!skinTemplate) return;
    var queue = (names || STYLES).filter(function (n) { return n !== 'default' && !skinLinks[n]; });
    var idle = window.requestIdleCallback
      ? function (fn) { window.requestIdleCallback(fn); }
      : function (fn) { window.setTimeout(fn, 1); };
    (function next() {
      var name = queue.shift();
      if (!name) return;
      ensureSkin(name);
      idle(next);
    })();
  }

  function setStyle(name, persist) {
    var value = STYLES.indexOf(name) === -1 ? 'default' : name;
    if (persist !== false) bk.storage.set(KEY_STYLE, value);
    pendingStyle = value;
    ensureSkin(value, function () {
      // Two quick clicks: the earlier fetch may land last. Only the most
      // recent choice gets to paint.
      if (pendingStyle !== value) return;
      if (value === 'default') root().removeAttribute('data-bk-style');
      else root().setAttribute('data-bk-style', value);
      syncControls();
      notify();
    });
    return value;
  }

  function nextStyle(step) {
    var i = STYLES.indexOf(getStyle());
    var n = (i + (step || 1) + STYLES.length) % STYLES.length;
    return setStyle(STYLES[n]);
  }

  function getMode() {
    return root().getAttribute('data-bk-theme') || 'auto';
  }

  function resolvedMode() {
    var m = getMode();
    if (m !== 'auto') return m;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setMode(mode, persist) {
    var value = ['light', 'dark', 'auto'].indexOf(mode) === -1 ? 'auto' : mode;
    root().setAttribute('data-bk-theme', value);
    if (persist !== false) bk.storage.set(KEY_MODE, value);
    syncControls();
    notify();
    return value;
  }

  var FONT_HOST = 'https://fonts.googleapis.com/css2?family=';
  var fontsLoaded = {};

  /** The stylesheet URL that would load a skin's display face, or null. */
  function fontsUrl(name) {
    var spec = FONTS[name || getStyle()];
    return spec ? FONT_HOST + spec + '&display=swap' : null;
  }

  /**
   * Fetch a skin's display face from Google Fonts, once. Opt-in: nothing calls
   * this unless the page does. Returns the <link>, or null when the skin has no
   * webfont or it is already on its way. A failed load is cosmetic and is
   * simply retried next time.
   */
  function loadFonts(name) {
    var skin = name || getStyle();
    var href = fontsUrl(skin);
    if (!href || fontsLoaded[skin] || typeof document === 'undefined') return null;
    if (!fontsLoaded.__preconnect) {
      fontsLoaded.__preconnect = true;
      ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach(function (origin) {
        var pre = document.createElement('link');
        pre.rel = 'preconnect';
        pre.href = origin;
        if (origin.indexOf('gstatic') > -1) pre.crossOrigin = '';
        document.head.appendChild(pre);
      });
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-bk-fonts', skin);
    link.onerror = function () { fontsLoaded[skin] = false; };
    fontsLoaded[skin] = true;
    document.head.appendChild(link);
    return link;
  }

  function toggleMode() {
    return setMode(resolvedMode() === 'dark' ? 'light' : 'dark');
  }

  /** Reflect current state onto any control that declares itself a theme UI. */
  function syncControls() {
    var style = getStyle(), mode = getMode(), resolved = resolvedMode();
    bk.$$('[data-bk-style-set]').forEach(function (n) {
      var on = n.getAttribute('data-bk-style-set') === style;
      n.setAttribute('aria-pressed', on ? 'true' : 'false');
      n.classList.toggle('bk-is-active', on);
    });
    bk.$$('select[data-bk-style-select]').forEach(function (n) { n.value = style; });
    bk.$$('[data-bk-mode-set]').forEach(function (n) {
      var on = n.getAttribute('data-bk-mode-set') === mode;
      n.setAttribute('aria-pressed', on ? 'true' : 'false');
      n.classList.toggle('bk-is-active', on);
    });
    bk.$$('[data-bk-theme-toggle]').forEach(function (n) {
      n.setAttribute('aria-pressed', resolved === 'dark' ? 'true' : 'false');
      var label = n.getAttribute('data-bk-theme-toggle');
      if (label && label !== 'true') n.setAttribute('aria-label', label);
    });
  }

  function restore() {
    var savedStyle = bk.storage.get(KEY_STYLE, null);
    var savedMode = bk.storage.get(KEY_MODE, null);
    if (savedStyle) setStyle(savedStyle, false);
    if (savedMode) setMode(savedMode, false);
    else if (!root().hasAttribute('data-bk-theme')) root().setAttribute('data-bk-theme', 'auto');
    syncControls();
  }

  skinTemplate = detectTemplate();

  var theme = {
    styles: STYLES,
    meta: META,
    info: function (name) { return META[name || getStyle()] || { label: name, blurb: '' }; },
    get: function () { return { style: getStyle(), mode: getMode(), resolved: resolvedMode() }; },
    getStyle: getStyle,
    setStyle: setStyle,
    next: nextStyle,
    prev: function () { return nextStyle(-1); },
    random: function () {
      var pool = STYLES.filter(function (s) { return s !== getStyle(); });
      return setStyle(pool[Math.floor(Math.random() * pool.length)]);
    },
    fonts: fontsUrl,
    loadFonts: loadFonts,
    lazy: lazySkins,
    ensure: ensureSkin,
    preload: preloadSkins,
    getMode: getMode,
    setMode: setMode,
    resolved: resolvedMode,
    toggle: toggleMode,
    sync: syncControls,
    restore: restore,
    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };

  bk.theme = theme;

  bk.define('theme-controls', {
    selector: '[data-bk-theme-toggle],[data-bk-style-set],[data-bk-mode-set],[data-bk-style-select],[data-bk-style-cycle]',
    setup: function (node) {
      if (node.matches('[data-bk-theme-toggle]')) {
        bk.on(node, 'click', function () { toggleMode(); });
      } else if (node.matches('[data-bk-style-set]')) {
        bk.on(node, 'click', function () { setStyle(node.getAttribute('data-bk-style-set')); });
      } else if (node.matches('[data-bk-mode-set]')) {
        bk.on(node, 'click', function () { setMode(node.getAttribute('data-bk-mode-set')); });
      } else if (node.matches('[data-bk-style-cycle]')) {
        bk.on(node, 'click', function () {
          nextStyle(node.getAttribute('data-bk-style-cycle') === 'prev' ? -1 : 1);
        });
      } else if (node.matches('select[data-bk-style-select]')) {
        if (!node.options.length) {
          STYLES.forEach(function (s) {
            node.appendChild(bk.el('option', { value: s }, META[s] ? META[s].label : s));
          });
        }
        node.value = getStyle();
        bk.on(node, 'change', function () { setStyle(node.value); });
      }
      return { destroy: function () {} };
    }
  });

  if (typeof window !== 'undefined' && window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var handler = function () { if (getMode() === 'auto') notify(); };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
})(bk);
