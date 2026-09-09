/* =============================================================================
   BUKALEMUN — js/core.js
   The runtime kernel: DOM helpers, a tiny reactive store, a positioning engine,
   focus management, and the plugin/auto-init registry every module hangs off.

   No dependencies. No build step required. ~0 assumptions about your framework.
   ========================================================================== */

var bk = (function () {
  'use strict';

  // Replaced by scripts/build.mjs from package.json. Kept as a visible
  // placeholder rather than a real number so an unbuilt file cannot quietly
  // claim to be a release — bk.version said 1.3.2 for two releases.
  var VERSION = '0.0.0-dev';
  var doc = typeof document !== 'undefined' ? document : null;
  var win = typeof window !== 'undefined' ? window : null;

  /* ---------------------------------------------------------------- dom -- */

  function $(sel, root) {
    if (sel instanceof Element || sel instanceof Document) return sel;
    return (root || doc).querySelector(sel);
  }

  function $$(sel, root) {
    if (Array.isArray(sel)) return sel;
    if (sel instanceof Element) return [sel];
    if (sel && typeof sel.length === 'number' && typeof sel !== 'string') {
      return Array.prototype.slice.call(sel);
    }
    return Array.prototype.slice.call((root || doc).querySelectorAll(sel));
  }

  /** Resolve a target that may be a selector, an element, or an id fragment. */
  function resolve(target, ctx) {
    if (!target) return null;
    if (target instanceof Element) return target;
    if (typeof target !== 'string') return null;
    var t = target.trim();
    if (!t) return null;
    if (t.charAt(0) === '#' || t.charAt(0) === '.' || t.charAt(0) === '[') {
      return $(t, ctx && ctx.ownerDocument ? ctx.ownerDocument : doc);
    }
    return doc.getElementById(t) || $(t);
  }

  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
      });
    }
    return node;
  }

  function on(target, type, handler, opts) {
    var nodes = target instanceof Element || target === win || target === doc
      ? [target] : $$(target);
    var types = type.split(/\s+/);
    nodes.forEach(function (n) {
      types.forEach(function (t) { n.addEventListener(t, handler, opts); });
    });
    return function off() {
      nodes.forEach(function (n) {
        types.forEach(function (t) { n.removeEventListener(t, handler, opts); });
      });
    };
  }

  /** Event delegation: one listener on `root`, matched against `selector`. */
  function delegate(root, type, selector, handler, opts) {
    var node = root instanceof Element || root === doc ? root : $(root);
    if (!node) return function () {};
    function wrapped(e) {
      var match = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (match && node.contains(match)) handler.call(match, e, match);
    }
    node.addEventListener(type, wrapped, opts);
    return function () { node.removeEventListener(type, wrapped, opts); };
  }

  function emit(target, name, detail, opts) {
    var ev = new CustomEvent(name, Object.assign(
      { bubbles: true, cancelable: true, detail: detail },
      opts || {}
    ));
    target.dispatchEvent(ev);
    return !ev.defaultPrevented;
  }

  function ready(fn) {
    if (!doc) return;
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  var uidCounter = 0;
  function uid(prefix) { return (prefix || 'bk') + '-' + (++uidCounter) + '-' + Math.random().toString(36).slice(2, 7); }

  function addClass(node, cls) { if (node) node.classList.add(cls); }
  function removeClass(node, cls) { if (node) node.classList.remove(cls); }
  function toggleClass(node, cls, force) { if (node) node.classList.toggle(cls, force); }
  function hasClass(node, cls) { return !!node && node.classList.contains(cls); }

  /** Read a data-bk-* attribute with JSON coercion and a fallback. */
  function data(node, key, fallback) {
    var raw = node.getAttribute('data-bk-' + key);
    if (raw === null) return fallback;
    if (raw === '') return true;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw !== '' && !isNaN(Number(raw))) return Number(raw);
    if ((raw[0] === '{' && raw.slice(-1) === '}') || (raw[0] === '[' && raw.slice(-1) === ']')) {
      try { return JSON.parse(raw); } catch (err) { return raw; }
    }
    return raw;
  }

  function throttle(fn, wait) {
    var last = 0, timer = null, lastArgs;
    return function () {
      lastArgs = arguments;
      var now = Date.now();
      var remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(this, lastArgs);
      } else if (!timer) {
        var self = this;
        timer = setTimeout(function () {
          last = Date.now(); timer = null; fn.apply(self, lastArgs);
        }, remaining);
      }
    };
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var self = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function raf(fn) { return (win && win.requestAnimationFrame ? win.requestAnimationFrame : setTimeout)(fn); }

  function prefersReducedMotion() {
    return !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Wait for CSS animations/transitions on `node` to settle, with a hard cap. */
  function afterMotion(node, cb, cap) {
    if (prefersReducedMotion()) { cb(); return; }
    var done = false;
    var limit = cap || 700;
    function finish() { if (done) return; done = true; clearTimeout(timer); node.removeEventListener('animationend', finish); node.removeEventListener('transitionend', finish); cb(); }
    var timer = setTimeout(finish, limit);
    node.addEventListener('animationend', finish);
    node.addEventListener('transitionend', finish);
  }

  /* -------------------------------------------------------------- store -- */
  /* A ~40-line reactive store. Enough for component state and cross-component
     wiring; deliberately not a framework.                                    */

  function store(initial) {
    var state = Object.assign({}, initial);
    var subs = [];
    var api = {
      get: function (key) { return key === undefined ? Object.assign({}, state) : state[key]; },
      set: function (patch, value) {
        var next = typeof patch === 'string' ? {} : patch;
        if (typeof patch === 'string') next[patch] = value;
        var changed = [];
        for (var k in next) {
          if (state[k] !== next[k]) { state[k] = next[k]; changed.push(k); }
        }
        if (changed.length) {
          var snapshot = Object.assign({}, state);
          subs.slice().forEach(function (s) { s(snapshot, changed); });
        }
        return api;
      },
      subscribe: function (fn, immediate) {
        subs.push(fn);
        if (immediate) fn(Object.assign({}, state), Object.keys(state));
        return function () { subs = subs.filter(function (s) { return s !== fn; }); };
      },
      reset: function () { return api.set(initial); }
    };
    return api;
  }

  /* ------------------------------------------------------------ storage -- */

  var storage = {
    get: function (key, fallback) {
      try {
        var v = win.localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { win.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
      return value;
    },
    remove: function (key) {
      try { win.localStorage.removeItem(key); } catch (e) { /* noop */ }
    }
  };

  /* --------------------------------------------------------- focus trap -- */

  var FOCUSABLE = [
    'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'object', 'embed',
    'audio[controls]', 'video[controls]', 'summary', '[contenteditable]', '[tabindex]:not([tabindex^="-"])'
  ].join(',');

  function focusables(root) {
    return $$(FOCUSABLE, root).filter(function (n) {
      if (n.hasAttribute('inert') || n.closest('[inert]')) return false;
      if (n.getAttribute('aria-hidden') === 'true') return false;
      return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);
    });
  }

  function trapFocus(container, opts) {
    opts = opts || {};
    var previous = doc.activeElement;

    function keydown(e) {
      if (e.key !== 'Tab') return;
      var list = focusables(container);
      if (!list.length) { e.preventDefault(); container.focus(); return; }
      var first = list[0], last = list[list.length - 1];
      var active = doc.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    }

    container.addEventListener('keydown', keydown);

    if (opts.autoFocus !== false) {
      raf(function () {
        var target = opts.initial ? $(opts.initial, container) : null;
        if (!target) target = container.querySelector('[autofocus]');
        if (!target) target = focusables(container)[0];
        if (!target) { container.setAttribute('tabindex', '-1'); target = container; }
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      });
    }

    return function release(restore) {
      container.removeEventListener('keydown', keydown);
      if (restore !== false && previous && previous.focus) {
        try { previous.focus({ preventScroll: true }); } catch (e) { previous.focus(); }
      }
    };
  }

  /* --------------------------------------------------------- scroll lock -- */

  var lockCount = 0;
  var lockedPadding = '';
  function lockScroll() {
    if (lockCount++ > 0) return;
    var sbw = win.innerWidth - doc.documentElement.clientWidth;
    lockedPadding = doc.body.style.paddingInlineEnd;
    if (sbw > 0) doc.body.style.paddingInlineEnd = sbw + 'px';
    doc.body.classList.add('bk-scroll-locked');
  }
  function unlockScroll() {
    if (--lockCount > 0) return;
    lockCount = 0;
    doc.body.classList.remove('bk-scroll-locked');
    doc.body.style.paddingInlineEnd = lockedPadding;
  }

  /* ----------------------------------------------------------- position -- */
  /* A compact anchored-positioning engine: place, flip when it would overflow,
     shift back into view, and optionally point an arrow at the anchor.        */

  var SIDES = { top: 1, bottom: 1, left: 1, right: 1 };

  function position(anchor, floating, opts) {
    opts = opts || {};
    var placement = opts.placement || 'bottom';
    var offset = opts.offset == null ? 8 : opts.offset;
    var padding = opts.padding == null ? 8 : opts.padding;
    var flip = opts.flip !== false;
    var shift = opts.shift !== false;
    var arrow = opts.arrow || null;
    var strategy = opts.strategy || 'absolute';

    var parts = placement.split('-');
    var side = SIDES[parts[0]] ? parts[0] : 'bottom';
    var align = parts[1] || 'center';

    floating.style.position = strategy;
    floating.style.left = '0px';
    floating.style.top = '0px';
    floating.style.transform = '';

    var a = anchor.getBoundingClientRect();
    var f = floating.getBoundingClientRect();
    var vw = doc.documentElement.clientWidth;
    var vh = doc.documentElement.clientHeight;

    // Available room on each side of the anchor.
    var room = {
      top: a.top - padding,
      bottom: vh - a.bottom - padding,
      left: a.left - padding,
      right: vw - a.right - padding
    };
    var need = { top: f.height + offset, bottom: f.height + offset, left: f.width + offset, right: f.width + offset };

    if (flip && room[side] < need[side]) {
      var opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
      if (room[opposite] >= need[opposite] || room[opposite] > room[side]) side = opposite;
    }

    var x, y;
    if (side === 'top' || side === 'bottom') {
      y = side === 'top' ? a.top - f.height - offset : a.bottom + offset;
      if (align === 'start') x = a.left;
      else if (align === 'end') x = a.right - f.width;
      else x = a.left + (a.width - f.width) / 2;
    } else {
      x = side === 'left' ? a.left - f.width - offset : a.right + offset;
      if (align === 'start') y = a.top;
      else if (align === 'end') y = a.bottom - f.height;
      else y = a.top + (a.height - f.height) / 2;
    }

    var shiftX = 0, shiftY = 0;
    if (shift) {
      if (side === 'top' || side === 'bottom') {
        var maxX = vw - f.width - padding;
        var clampedX = Math.min(Math.max(x, padding), Math.max(padding, maxX));
        shiftX = clampedX - x;
        x = clampedX;
      } else {
        var maxY = vh - f.height - padding;
        var clampedY = Math.min(Math.max(y, padding), Math.max(padding, maxY));
        shiftY = clampedY - y;
        y = clampedY;
      }
    }

    if (strategy === 'absolute') {
      var host = floating.offsetParent || doc.body;
      var hostRect = host === doc.body
        ? { left: -win.scrollX, top: -win.scrollY }
        : host.getBoundingClientRect();
      x -= hostRect.left;
      y -= hostRect.top;
      if (host === doc.body) { x += 0; y += 0; }
    }

    floating.style.left = Math.round(x) + 'px';
    floating.style.top = Math.round(y) + 'px';
    floating.setAttribute('data-bk-side', side);
    floating.setAttribute('data-bk-align', align);

    if (arrow) {
      var ar = arrow.getBoundingClientRect();
      var half = (side === 'top' || side === 'bottom' ? ar.width : ar.height) / 2;
      arrow.style.position = 'absolute';
      arrow.style.left = arrow.style.top = arrow.style.right = arrow.style.bottom = '';
      if (side === 'top' || side === 'bottom') {
        var ax = (f.width / 2) - shiftX - half;
        ax = Math.min(Math.max(ax, 6), Math.max(6, f.width - ar.width - 6));
        arrow.style.left = Math.round(ax) + 'px';
        arrow.style[side === 'top' ? 'bottom' : 'top'] = Math.round(-half) + 'px';
      } else {
        var ay = (f.height / 2) - shiftY - half;
        ay = Math.min(Math.max(ay, 6), Math.max(6, f.height - ar.height - 6));
        arrow.style.top = Math.round(ay) + 'px';
        arrow.style[side === 'left' ? 'right' : 'left'] = Math.round(-half) + 'px';
      }
    }

    return { side: side, align: align, x: x, y: y };
  }

  /** Keep `floating` glued to `anchor` while the page scrolls or resizes. */
  function autoPosition(anchor, floating, opts) {
    var update = function () { position(anchor, floating, opts); };
    update();
    var offScroll = on(win, 'scroll', update, { passive: true, capture: true });
    var offResize = on(win, 'resize', update, { passive: true });
    var ro = null;
    if (win.ResizeObserver) {
      ro = new ResizeObserver(update);
      ro.observe(anchor); ro.observe(floating);
    }
    return function stop() {
      offScroll(); offResize();
      if (ro) ro.disconnect();
    };
  }

  /* --------------------------------------------------------------- a11y -- */

  var liveRegion = null;
  function announce(message, assertive) {
    if (!doc) return;
    if (!liveRegion) {
      liveRegion = el('div', { class: 'bk-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
      doc.body.appendChild(liveRegion);
    }
    liveRegion.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    liveRegion.textContent = '';
    setTimeout(function () { liveRegion.textContent = message; }, 60);
  }

  /* ----------------------------------------------------------- registry -- */

  var plugins = {};
  var instances = new WeakMap();

  /**
   * Register a component.
   *   name     unique id, also the data attribute suffix (data-bk-<name>)
   *   spec     { selector, setup(node, options) -> instance|void, singleton }
   */
  function define(name, spec) {
    plugins[name] = Object.assign({ name: name }, spec);
    return plugins[name];
  }

  function instanceOf(node, name) {
    var map = instances.get(node);
    return map ? map[name] : undefined;
  }

  function setInstance(node, name, value) {
    var map = instances.get(node);
    if (!map) { map = {}; instances.set(node, map); }
    map[name] = value;
    return value;
  }

  /** Boot every registered plugin inside `root` (idempotent). */
  function init(root) {
    root = root || doc;
    Object.keys(plugins).forEach(function (name) {
      var spec = plugins[name];
      if (!spec.selector) return;
      var nodes = $$(spec.selector, root === doc ? doc : root);
      if (root !== doc && root.matches && root.matches(spec.selector)) nodes.unshift(root);
      nodes.forEach(function (node) {
        if (instanceOf(node, name) !== undefined) return;
        var options = spec.options ? spec.options(node) : undefined;
        var inst;
        try {
          inst = spec.setup(node, options);
        } catch (err) {
          if (win.console) console.error('[bukalemun] failed to init "' + name + '"', err, node);
          return;
        }
        setInstance(node, name, inst === undefined ? null : inst);
      });
    });
    return root;
  }

  var observer = null;
  function observe(root) {
    if (observer || !win.MutationObserver) return;
    observer = new MutationObserver(function (records) {
      var pending = [];
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType === 1) pending.push(n);
        });
      });
      if (pending.length) pending.forEach(function (n) { init(n); });
    });
    observer.observe(root || doc.body, { childList: true, subtree: true });
  }

  function destroy(node) {
    var map = instances.get(node);
    if (!map) return;
    Object.keys(map).forEach(function (name) {
      var inst = map[name];
      if (inst && typeof inst.destroy === 'function') inst.destroy();
    });
    instances.delete(node);
  }

  /* --------------------------------------------------------------- api --- */

  var api = {
    version: VERSION,
    $: $, $$: $$, el: el, on: on, delegate: delegate, emit: emit, ready: ready,
    resolve: resolve, uid: uid, data: data,
    addClass: addClass, removeClass: removeClass, toggleClass: toggleClass, hasClass: hasClass,
    throttle: throttle, debounce: debounce, raf: raf,
    prefersReducedMotion: prefersReducedMotion, afterMotion: afterMotion,
    store: store, storage: storage,
    focusables: focusables, trapFocus: trapFocus,
    lockScroll: lockScroll, unlockScroll: unlockScroll,
    position: position, autoPosition: autoPosition,
    announce: announce,
    define: define, init: init, observe: observe, destroy: destroy,
    instance: instanceOf,
    plugins: plugins
  };

  return api;
})();
