/* =============================================================================
   BUKALEMUN — demos/demo.js
   Shared chrome for every demo page. Loaded synchronously in <head>, before the
   bundle, so a skin asked for in the URL is on the element before first paint.

   Three jobs:
     1. ?skin= / ?mode= override the page without being persisted, so a link can
        say "this page, in vapor" without changing what the visitor picked.
     2. Build the skin dock from bk.theme.styles. It used to be five hardcoded
        buttons copy-pasted into every demo, which meant forty-five skins were
        unreachable and the list went stale the moment one was added.
     3. Drive the gallery: scale the live previews and let one control re-dress
        all of them at once.
   ========================================================================== */

(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var forcedSkin = params.get('skin');
  var forcedMode = params.get('mode');
  var wantsChrome = params.get('chrome') !== '0';
  var root = document.documentElement;

  /* --- 1. pre-paint ------------------------------------------------------ */

  // no-flash.js has already run, applied whatever was stored and fetched that
  // skin. An explicit URL wins over it, but is never written back to storage.
  // Each demo ships base + its own skin, the way a real site would, so a skin
  // named in the URL has to be fetched — synchronously, here, before the
  // bundle, so the page never paints in the wrong palette first. After that
  // bk.theme owns the fetching; it reads the same data-bk-skins template.
  var template = (function () {
    var tag = document.querySelector('script[data-bk-skins]');
    return tag ? tag.getAttribute('data-bk-skins') : '../dist/styles/{skin}.min.css';
  })();

  if (forcedSkin) {
    if (forcedSkin !== 'default' && !document.querySelector('link[data-bk-skin="' + forcedSkin + '"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = template.replace('{skin}', forcedSkin);
      link.setAttribute('data-bk-skin', forcedSkin);
      document.head.appendChild(link);
    }
    root.setAttribute('data-bk-style', forcedSkin);
  }
  if (forcedMode) root.setAttribute('data-bk-theme', forcedMode);

  /* --- 2. the dock ------------------------------------------------------- */

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function buildDock(bk) {
    var host = document.querySelector('[data-demo-dock]');
    if (!host || !wantsChrome) { if (host) host.remove(); return; }

    host.className = 'demo-dock';
    host.setAttribute('aria-label', 'Skin and theme controls');

    var gallery = host.getAttribute('data-demo-dock') === 'gallery';
    if (!gallery) {
      host.appendChild(el('a', {
        class: 'bk-btn bk-btn-sm bk-btn-ghost',
        href: './index.html',
        'data-demo-hide-sm': ''
      }, '← Gallery'));
    }

    host.appendChild(el('span', { class: 'demo-dock-label', 'data-demo-hide-sm': '' }, 'Skin'));

    var select = el('select', {
      class: 'bk-select bk-select-sm',
      'data-bk-style-select': '',
      'aria-label': 'Skin'
    });
    // Left empty: bukalemun's own theme-controls module fills an empty
    // select[data-bk-style-select] from its skin list, which keeps this from
    // going stale the next time a skin is added.
    host.appendChild(select);

    var group = el('div', { class: 'bk-btn-group bk-btn-group-attached' });
    group.appendChild(el('button', {
      class: 'bk-btn bk-btn-sm bk-btn-neutral', type: 'button',
      'data-bk-style-cycle': 'prev', 'aria-label': 'Previous skin', title: 'Previous skin (Shift + ←)'
    }, '‹'));
    group.appendChild(el('button', {
      class: 'bk-btn bk-btn-sm bk-btn-neutral', type: 'button',
      'data-demo-random': '', 'aria-label': 'Random skin', title: 'Random skin (Shift + R)'
    }, '⁂'));
    group.appendChild(el('button', {
      class: 'bk-btn bk-btn-sm bk-btn-neutral', type: 'button',
      'data-bk-style-cycle': '', 'aria-label': 'Next skin', title: 'Next skin (Shift + →)'
    }, '›'));
    host.appendChild(group);

    host.appendChild(el('button', {
      class: 'bk-btn bk-btn-sm bk-btn-primary', type: 'button',
      'data-bk-theme-toggle': 'Light / dark', title: 'Light / dark (Shift + D)'
    }, '◐'));

    bk.init(host);
  }

  function shortcuts(bk) {
    document.addEventListener('keydown', function (e) {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|select|textarea)$/i.test(t.tagName))) return;
      if (e.key === 'ArrowRight') { bk.theme.next(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { bk.theme.prev(); e.preventDefault(); }
      else if (e.key === 'R' || e.key === 'r') { bk.theme.random(); e.preventDefault(); }
      else if (e.key === 'D' || e.key === 'd') { bk.theme.toggle(); e.preventDefault(); }
    });
    document.addEventListener('click', function (e) {
      var n = e.target.closest && e.target.closest('[data-demo-random]');
      if (n) bk.theme.random();
    });
  }

  /* --- 3. the gallery ---------------------------------------------------- */

  // Each preview renders a 1440x1000 page and is scaled to whatever width the
  // card ended up with, so the previews stay honest at every breakpoint
  // instead of showing the mobile layout of a desktop demo.
  function scalePreviews() {
    document.querySelectorAll('.demo-frame').forEach(function (frame) {
      var f = frame.querySelector('iframe');
      if (!f) return;
      f.style.transform = 'scale(' + (frame.clientWidth / 1440) + ')';
    });
  }

  function gallery(bk) {
    var frames = [].slice.call(document.querySelectorAll('.demo-frame iframe'));
    if (!frames.length) return;

    scalePreviews();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(scalePreviews);
      document.querySelectorAll('.demo-frame').forEach(function (f) { ro.observe(f); });
    } else {
      window.addEventListener('resize', scalePreviews);
    }

    // Remember each demo's own skin so "Own skin" can put it back.
    frames.forEach(function (f) { f.dataset.demoOwn = f.getAttribute('src'); });

    var picker = document.querySelector('[data-demo-preview-skin]');
    if (!picker) return;

    picker.appendChild(el('option', { value: '' }, 'Each in its own skin'));
    bk.theme.styles.forEach(function (name) {
      var info = bk.theme.info(name);
      picker.appendChild(el('option', { value: name }, 'All in ' + (info.label || name)));
    });

    picker.addEventListener('change', function () {
      var skin = picker.value;
      frames.forEach(function (f) {
        if (!skin) { f.src = f.dataset.demoOwn; return; }
        var url = new URL(f.dataset.demoOwn, location.href);
        url.searchParams.set('skin', skin);
        url.searchParams.delete('mode');   // let the skin pick its own mode
        f.src = url.pathname + url.search;
      });
    });
  }

  /* --- wiring ------------------------------------------------------------ */

  /**
   * The dock offers all fifty, and fetching a palette at the moment someone
   * picks it would show one frame of the wrong colours. So they are fetched
   * ahead of time — but only once a visitor reaches for the dock, not for
   * everyone who came to read the page. Someone who never touches it pays for
   * one skin, which is what a real site would ship.
   */
  var prefetched = false;
  function prefetchRemainingSkins(bk) {
    if (prefetched) return;
    prefetched = true;
    bk.theme.preload();
  }

  function armPrefetch(bk) {
    var fire = function () { prefetchRemainingSkins(bk); };
    var dock = document.querySelector('.demo-dock, .demo-controls');
    if (dock) {
      dock.addEventListener('pointerenter', fire, { once: true });
      dock.addEventListener('focusin', fire, { once: true });
      dock.addEventListener('touchstart', fire, { once: true, passive: true });
    }
    document.addEventListener('keydown', function (e) { if (e.shiftKey) fire(); }, { once: true });
  }

  document.addEventListener('bk:ready', function () {
    // Belt and braces: older builds emitted bk:ready from inside the UMD
    // wrapper, before the global existed. Wait for it rather than giving up.
    var bk = window.bk;
    if (!bk) { setTimeout(function () { document.dispatchEvent(new CustomEvent('bk:ready')); }, 0); return; }

    // theme.restore() has just re-applied the stored preference over the top of
    // the URL. Put the URL back, still without persisting it.
    if (forcedSkin) bk.theme.setStyle(forcedSkin, false);
    if (forcedMode) bk.theme.setMode(forcedMode, false);

    buildDock(bk);
    shortcuts(bk);
    gallery(bk);

    // A skin is its type as much as its palette. Fetch the face for whatever
    // is on the page now, and for each skin the dock switches to.
    bk.theme.loadFonts();
    bk.theme.onChange(function (state) { bk.theme.loadFonts(state.style); });

    armPrefetch(bk);
  });
})();
