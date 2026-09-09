/* =============================================================================
   Docs page wiring. Uses only the public Bukalemun API — everything here is
   something you could write in your own app.
   ========================================================================== */

(function () {
  'use strict';

  /* --- skin picker ------------------------------------------------------- */

  var picker = document.getElementById('skin-picker');
  var label = document.getElementById('current-skin-label');
  var blurb = document.getElementById('current-skin-blurb');

  // A tiny swatch strip per skin, painted with that skin's own tokens.
  // We render each card inside a scoped element carrying data-bk-style, so the
  // preview genuinely uses the skin instead of guessing at its colours.
  function swatchStrip(skin) {
    var strip = bk.el('span', { class: 'doc-skin-chip' });
    ['--bk-primary', '--bk-secondary', '--bk-surface-3', '--bk-text'].forEach(function (token) {
      strip.appendChild(bk.el('i', { style: { background: 'var(' + token + ')' } }));
    });
    return strip;
  }

  bk.theme.styles.forEach(function (skin) {
    var meta = bk.theme.info(skin);
    var card = bk.el('button', {
      class: 'doc-skin-card',
      type: 'button',
      'data-bk-style-set': skin,
      'aria-pressed': 'false'
    });
    // Scope the preview to the skin it advertises.
    var preview = bk.el('span', { class: 'bk-scope' });
    if (skin !== 'default') preview.setAttribute('data-bk-style', skin);
    preview.appendChild(swatchStrip(skin));
    card.appendChild(preview);
    card.appendChild(bk.el('span', { class: 'bk-weight-semibold bk-text-md' }, meta.label));
    card.appendChild(bk.el('span', { class: 'bk-text-xs bk-subtle' }, meta.blurb));
    picker.appendChild(card);
  });

  function reflect() {
    var meta = bk.theme.info();
    if (label) label.textContent = meta.label;
    if (blurb) blurb.textContent = meta.blurb;
    document.title = 'Bukalemun — ' + meta.label;
  }
  bk.theme.onChange(reflect);

  /* --- live token preview ------------------------------------------------ */

  var tokenHost = document.getElementById('token-preview');
  var SHOWN = [
    ['--bk-bg', 'page background'],
    ['--bk-surface', 'card surface'],
    ['--bk-text', 'body text'],
    ['--bk-border', 'hairline'],
    ['--bk-primary', 'primary action'],
    ['--bk-success', 'success'],
    ['--bk-danger', 'danger']
  ];
  if (tokenHost) {
    SHOWN.forEach(function (pair) {
      tokenHost.appendChild(bk.el('div', { class: 'doc-token-row' }, [
        bk.el('span', { class: 'doc-token-chip', style: { background: 'var(' + pair[0] + ')' } }),
        bk.el('code', { class: 'bk-code-inline' }, pair[0]),
        bk.el('span', { class: 'bk-subtle' }, pair[1])
      ]));
    });
  }

  /* --- command palette contents ----------------------------------------- */

  var list = document.getElementById('palette-list');
  if (list) {
    var sections = [
      ['Install', '#install'], ['Skins', '#skins'], ['Design tokens', '#tokens'],
      ['Buttons', '#buttons'], ['Forms', '#forms'], ['Feedback', '#feedback'],
      ['Data display', '#data'], ['Navigation', '#navigation'], ['Overlays', '#overlays'],
      ['Layout', '#layout'], ['JavaScript API', '#js'], ['Accessibility', '#a11y']
    ];

    var navGroup = bk.el('li', { class: 'bk-cmdk-group' });
    navGroup.appendChild(bk.el('div', { class: 'bk-cmdk-group-label' }, 'Go to'));
    sections.forEach(function (s) {
      var item = bk.el('button', {
        class: 'bk-cmdk-item', type: 'button',
        'data-bk-value': s[1], 'data-bk-keywords': 'section navigate ' + s[0]
      }, [bk.el('i', { class: 'bk-icon bk-i-arrow-right' }), document.createTextNode(s[0])]);
      bk.on(item, 'click', function () { location.hash = s[1]; });
      navGroup.appendChild(item);
    });
    list.appendChild(navGroup);

    var skinGroup = bk.el('li', { class: 'bk-cmdk-group' });
    skinGroup.appendChild(bk.el('div', { class: 'bk-cmdk-group-label' }, 'Switch skin'));
    bk.theme.styles.forEach(function (skin) {
      var meta = bk.theme.info(skin);
      var item = bk.el('button', {
        class: 'bk-cmdk-item', type: 'button',
        'data-bk-value': skin, 'data-bk-keywords': 'skin theme style ' + skin + ' ' + meta.blurb
      }, [
        bk.el('i', { class: 'bk-icon bk-i-star' }),
        document.createTextNode(meta.label),
        bk.el('span', { class: 'bk-cmdk-item-hint' }, skin)
      ]);
      bk.on(item, 'click', function () {
        bk.theme.setStyle(skin);
        bk.toast({ message: 'Skin: ' + meta.label, duration: 1800 });
      });
      skinGroup.appendChild(item);
    });
    list.appendChild(skinGroup);

    var modeGroup = bk.el('li', { class: 'bk-cmdk-group' });
    modeGroup.appendChild(bk.el('div', { class: 'bk-cmdk-group-label' }, 'Appearance' ));
    [['Light mode', 'light'], ['Dark mode', 'dark'], ['Follow system', 'auto']].forEach(function (m) {
      var item = bk.el('button', {
        class: 'bk-cmdk-item', type: 'button', 'data-bk-keywords': 'mode dark light ' + m[1]
      }, [bk.el('i', { class: 'bk-icon bk-i-' + (m[1] === 'dark' ? 'moon' : 'sun') }), document.createTextNode(m[0])]);
      bk.on(item, 'click', function () { bk.theme.setMode(m[1]); });
      modeGroup.appendChild(item);
    });
    list.appendChild(modeGroup);
  }

  /* --- misc demo wiring -------------------------------------------------- */

  var indet = document.getElementById('indet');
  if (indet) indet.indeterminate = true;

  // Left / right arrows cycle skins when nothing is focused.
  bk.hotkey('alt+arrowright', function () { bk.theme.next(); });
  bk.hotkey('alt+arrowleft', function () { bk.theme.prev(); });
  bk.hotkey('alt+d', function () { bk.theme.toggle(); });

  bk.ready(function () {
    reflect();
    bk.theme.sync();

    // Only the current skin was shipped. The picker paints every card in its
    // own tokens, so fetch the rest once it scrolls into view — and sooner if
    // someone reaches for a skin control, so the first switch is instant.
    var warm = function () { bk.theme.preload(); };
    // The proof strip in the hero paints a dot in each skin's own primary, and
    // a skin that has not arrived yet paints in the page's. Eight small files;
    // fetch them straight away so the strip is honest before anyone hovers.
    bk.theme.preload(bk.$$('.doc-proof-strip [data-bk-style-set]').map(function (n) {
      return n.getAttribute('data-bk-style-set');
    }));
    if (picker && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { warm(); io.disconnect(); }
      }, { rootMargin: '400px' });
      io.observe(picker);
    } else {
      warm();
    }
    bk.$$('[data-bk-style-cycle], [onclick*="theme.random"], [data-bk-cmdk]').forEach(function (n) {
      bk.on(n, 'pointerenter', warm, { once: true });
      bk.on(n, 'focus', warm, { once: true });
    });
  });
})();

/* =============================================================================
   Skin builder — six dials in, a skin file out.
   Everything here goes through the same public tokens a hand-written skin uses;
   there is no private API involved.
   ========================================================================== */

(function () {
  'use strict';

  var out = document.getElementById('mk-output');
  if (!out) return;

  var live = document.createElement('style');
  live.id = 'mk-live';
  document.head.appendChild(live);

  var FONTS = {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    rounded: '"Nunito", ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
  };

  /* --- colour helpers ---------------------------------------------------- */

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
  function toHex(c) {
    var p = function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); };
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }
  function mix(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /** Darken or lighten `c` until it clears `target` against `bg`. */
  function readable(c, bg, target) {
    if (contrast(c, bg) >= target) return c;
    var towards = lum(bg) > 0.4 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    for (var t = 0.05; t <= 1; t += 0.05) {
      var cand = mix(c, towards, t);
      if (contrast(cand, bg) >= target) return cand;
    }
    return towards;
  }

  /* --- token generation --------------------------------------------------- */

  function build() {
    var primaryHex = document.getElementById('mk-primary').value;
    var bgHex = document.getElementById('mk-bg').value;
    var radius = Number(document.getElementById('mk-radius').value) / 10;
    var border = Number(document.getElementById('mk-border').value);
    var depth = document.getElementById('mk-depth').value;
    var font = document.getElementById('mk-font').value;

    var primary = hexToRgb(primaryHex);
    var bg = hexToRgb(bgHex);
    var dark = lum(bg) < 0.4;
    var ink = dark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };

    // Surfaces step away from the page; text steps towards the ink.
    var surface = mix(bg, ink, dark ? 0.05 : 0.0);
    var surface2 = mix(bg, ink, dark ? 0.09 : 0.04);
    var surface3 = mix(bg, ink, dark ? 0.15 : 0.09);
    var text = readable(mix(bg, ink, 0.92), bg, 4.5);
    var muted = readable(mix(bg, ink, 0.62), bg, 4.5);
    var subtle = readable(mix(bg, ink, 0.45), bg, 3);
    var borderC = mix(bg, ink, dark ? 0.18 : 0.12);
    var borderStrong = mix(bg, ink, dark ? 0.34 : 0.26);
    var onPrimary = contrast({ r: 255, g: 255, b: 255 }, primary) >= 4.5
      ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    var primarySoft = mix(bg, primary, dark ? 0.22 : 0.13);
    var primaryText = readable(primary, bg, 4.5);
    var primaryOnSoft = readable(primary, primarySoft, 4.5);

    var shadows = {
      soft: {
        sm: '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.08)',
        md: '0 2px 4px -2px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.1)',
        lg: '0 4px 8px -4px rgb(0 0 0 / 0.07), 0 12px 24px -6px rgb(0 0 0 / 0.12)'
      },
      none: { sm: 'none', md: 'none', lg: 'none' },
      hard: {
        sm: '2px 2px 0 0 ' + toHex(borderStrong),
        md: '4px 4px 0 0 ' + toHex(borderStrong),
        lg: '7px 7px 0 0 ' + toHex(borderStrong)
      },
      glow: {
        sm: '0 0 8px ' + toHex(primary) + '40',
        md: '0 0 18px ' + toHex(primary) + '55',
        lg: '0 0 32px ' + toHex(primary) + '66'
      }
    }[depth];

    return {
      '--bk-font-sans': FONTS[font],
      '--bk-font-body': 'var(--bk-font-sans)',
      '--bk-font-display': 'var(--bk-font-sans)',
      '--bk-bg': toHex(bg),
      '--bk-bg-subtle': toHex(surface2),
      '--bk-surface': toHex(surface),
      '--bk-surface-2': toHex(surface2),
      '--bk-surface-3': toHex(surface3),
      '--bk-text': toHex(text),
      '--bk-text-muted': toHex(muted),
      '--bk-text-subtle': toHex(subtle),
      '--bk-border': toHex(borderC),
      '--bk-border-muted': toHex(mix(bg, ink, dark ? 0.11 : 0.07)),
      '--bk-border-strong': toHex(borderStrong),
      '--bk-border-width': border + 'px',
      '--bk-primary': toHex(primary),
      '--bk-primary-hover': toHex(mix(primary, ink, 0.12)),
      '--bk-primary-active': toHex(mix(primary, ink, 0.22)),
      '--bk-primary-soft': toHex(primarySoft),
      '--bk-primary-border': toHex(mix(bg, primary, 0.42)),
      '--bk-on-primary': toHex(onPrimary),
      '--bk-primary-text': toHex(primaryText),
      '--bk-primary-on-soft': toHex(primaryOnSoft),
      '--bk-ring': toHex(primaryText),
      '--bk-radius-scale': String(radius),
      '--bk-shadow-xs': shadows.sm,
      '--bk-shadow-sm': shadows.sm,
      '--bk-shadow-md': shadows.md,
      '--bk-shadow-lg': shadows.lg,
      '--bk-btn-shadow': shadows.sm,
      '--bk-btn-shadow-hover': shadows.md,
      '--bk-card-shadow': shadows.sm,
      '--bk-card-shadow-hover': shadows.md,
      '--bk-field-border': toHex(borderStrong),
      '--bk-code-bg': toHex(surface2),
      '--bk-tooltip-bg': toHex(text),
      '--bk-tooltip-fg': toHex(bg)
    };
  }

  function render() {
    var tokens = build();
    var body = Object.keys(tokens)
      .map(function (k) { return '  ' + k + ': ' + tokens[k] + ';'; })
      .join('\n');

    // Live preview: same declarations, scoped to :root with an id selector so
    // it outranks the active skin's attribute selector.
    live.textContent = ':root, [data-bk-style] {\n' + body + '\n}';

    out.textContent =
      '/* my-skin.css — drop this after bukalemun.css */\n' +
      '[data-bk-style="mine"] {\n' + body + '\n}\n\n' +
      '/* then: <html data-bk-style="mine"> */';

    var radiusOut = document.getElementById('mk-radius-out');
    var borderOut = document.getElementById('mk-border-out');
    if (radiusOut) radiusOut.textContent = (Number(document.getElementById('mk-radius').value) / 10).toFixed(1) + '×';
    if (borderOut) borderOut.textContent = document.getElementById('mk-border').value + 'px';
  }

  // Keep the colour picker and its hex field in step.
  [['mk-primary', 'mk-primary-hex'], ['mk-bg', 'mk-bg-hex']].forEach(function (pair) {
    var picker = document.getElementById(pair[0]);
    var field = document.getElementById(pair[1]);
    bk.on(picker, 'input', function () { field.value = picker.value; render(); });
    bk.on(field, 'input', function () {
      if (/^#[0-9a-f]{6}$/i.test(field.value)) { picker.value = field.value; render(); }
    });
  });
  ['mk-radius', 'mk-border', 'mk-depth', 'mk-font'].forEach(function (id) {
    bk.on(document.getElementById(id), 'input change', render);
  });

  bk.on(document.getElementById('mk-reset'), 'click', function () {
    live.textContent = '';
    bk.toast({ message: 'Preview cleared — back to ' + bk.theme.info().label, duration: 2000 });
  });

  // Seed the dials from whatever skin is active, so you start from something
  // real rather than from grey.
  function seedFromActiveSkin() {
    var cs = getComputedStyle(document.documentElement);
    var read = function (t) { return cs.getPropertyValue(t).trim(); };
    var asHex = function (value, fallback) {
      if (!value) return fallback;
      if (value[0] === '#' && (value.length === 7 || value.length === 4)) return value;
      var probe = document.createElement('span');
      probe.style.color = value;
      document.body.appendChild(probe);
      var rgb = getComputedStyle(probe).color.match(/\d+/g);
      probe.remove();
      return rgb ? toHex({ r: +rgb[0], g: +rgb[1], b: +rgb[2] }) : fallback;
    };
    document.getElementById('mk-primary').value =
      document.getElementById('mk-primary-hex').value = asHex(read('--bk-primary'), '#5b5bd6');
    document.getElementById('mk-bg').value =
      document.getElementById('mk-bg-hex').value = asHex(read('--bk-bg'), '#ffffff');
  }

  bk.ready(function () {
    live.textContent = '';
    seedFromActiveSkin();
    render();
    live.textContent = '';
  });
})();

/* =============================================================================
   Display fonts. The framework only ever *names* a family, but the demo has
   to look like the thing it is demonstrating — a pixel-art skin rendered in
   Courier is a lie — so ask it to fetch each skin's face the first time that
   skin is switched on. Nothing is loaded for skins you never look at.
   ========================================================================== */

(function () {
  'use strict';

  var load = function (skin) { bk.theme.loadFonts(skin); };

  bk.theme.onChange(function (state) { load(state.style); });
  bk.ready(function () {
    load(bk.theme.getStyle());
    var v = document.getElementById('hero-version');
    if (v && bk.version) v.textContent = 'v' + bk.version;
    // The picker shows each skin in its own type, so those cards need theirs.
    bk.$$('.doc-skin-card').forEach(function (card) {
      bk.on(card, 'pointerenter', function () {
        load(card.getAttribute('data-bk-style-set'));
      }, { once: true });
    });
  });
})();
