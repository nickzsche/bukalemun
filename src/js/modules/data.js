/* =============================================================================
   MODULE — data
   Table sorting/filtering, carousel, animated counters, copy-to-clipboard,
   scroll reveal, ripples, hotkeys and the marquee duplicator.
   ========================================================================== */

(function (bk) {
  'use strict';

  /* ---------------------------------------------------------------- table */

  bk.define('table', {
    selector: 'table[data-bk-table]',
    setup: function (table) {
      var tbody = table.tBodies[0];
      if (!tbody) return null;
      var headers = bk.$$('thead th', table);
      var filterInput = table.getAttribute('data-bk-filter') ? bk.resolve(table.getAttribute('data-bk-filter')) : null;
      var countEl = table.getAttribute('data-bk-count-into') ? bk.resolve(table.getAttribute('data-bk-count-into')) : null;
      var sortState = { index: -1, dir: 'ascending' };

      function cellValue(row, index) {
        var cell = row.cells[index];
        if (!cell) return '';
        var explicit = cell.getAttribute('data-bk-sort-value');
        return explicit !== null ? explicit : cell.textContent.trim();
      }

      function compare(a, b, index, type) {
        var av = cellValue(a, index), bv = cellValue(b, index);
        if (type === 'number') {
          var an = parseFloat(av.replace(/[^0-9.eE+-]/g, ''));
          var bn = parseFloat(bv.replace(/[^0-9.eE+-]/g, ''));
          an = isNaN(an) ? -Infinity : an;
          bn = isNaN(bn) ? -Infinity : bn;
          return an - bn;
        }
        if (type === 'date') {
          return new Date(av).getTime() - new Date(bv).getTime();
        }
        return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      }

      function sort(index, dir) {
        var th = headers[index];
        if (!th) return;
        var type = th.getAttribute('data-bk-sort') || 'text';
        var rows = bk.$$('tr', tbody);
        var factor = dir === 'descending' ? -1 : 1;
        rows.sort(function (a, b) { return compare(a, b, index, type) * factor; });
        rows.forEach(function (r) { tbody.appendChild(r); });
        headers.forEach(function (h, i) {
          if (h.classList.contains('bk-th-sort')) {
            h.setAttribute('aria-sort', i === index ? dir : 'none');
          }
        });
        sortState = { index: index, dir: dir };
        bk.emit(table, 'bk:table:sort', { index: index, direction: dir });
      }

      headers.forEach(function (th, i) {
        if (!th.hasAttribute('data-bk-sort')) return;
        th.classList.add('bk-th-sort');
        th.setAttribute('aria-sort', 'none');
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'columnheader');
        function go() {
          var dir = sortState.index === i && sortState.dir === 'ascending' ? 'descending' : 'ascending';
          sort(i, dir);
        }
        bk.on(th, 'click', go);
        bk.on(th, 'keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
      });

      function filter(query) {
        var q = String(query || '').trim().toLowerCase();
        var visible = 0;
        bk.$$('tr', tbody).forEach(function (row) {
          var match = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
          row.hidden = !match;
          if (match) visible++;
        });
        if (countEl) countEl.textContent = String(visible);
        bk.emit(table, 'bk:table:filter', { query: q, visible: visible });
        return visible;
      }

      if (filterInput) {
        bk.on(filterInput, 'input', bk.debounce(function () { filter(filterInput.value); }, 120));
      }
      if (countEl) countEl.textContent = String(bk.$$('tr', tbody).length);

      return { sort: sort, filter: filter, destroy: function () {} };
    }
  });

  /* -------------------------------------------------------------- carousel */

  bk.define('carousel', {
    selector: '[data-bk-carousel]',
    setup: function (root) {
      var track = root.querySelector('.bk-carousel-track');
      if (!track) return null;
      var slides = bk.$$('.bk-carousel-slide', track);
      var prev = root.querySelector('.bk-carousel-prev');
      var next = root.querySelector('.bk-carousel-next');
      var dotsHost = root.querySelector('.bk-carousel-dots');
      var interval = parseInt(root.getAttribute('data-bk-autoplay') || '0', 10);
      var loop = root.getAttribute('data-bk-loop') !== 'false';
      var timer = null;
      var index = 0;

      root.setAttribute('role', 'region');
      root.setAttribute('aria-roledescription', 'carousel');

      var dots = [];
      if (dotsHost && !dotsHost.children.length) {
        slides.forEach(function (s, i) {
          var d = bk.el('button', {
            class: 'bk-carousel-dot', type: 'button',
            'aria-label': 'Go to slide ' + (i + 1)
          });
          bk.on(d, 'click', function () { go(i); });
          dotsHost.appendChild(d);
          dots.push(d);
        });
      } else if (dotsHost) {
        dots = bk.$$('.bk-carousel-dot', dotsHost);
        dots.forEach(function (d, i) { bk.on(d, 'click', function () { go(i); }); });
      }

      function sync() {
        dots.forEach(function (d, i) {
          d.classList.toggle('bk-is-active', i === index);
          d.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
        if (prev) prev.disabled = !loop && index === 0;
        if (next) next.disabled = !loop && index === slides.length - 1;
        slides.forEach(function (s, i) { s.setAttribute('aria-hidden', i === index ? 'false' : 'true'); });
        bk.emit(root, 'bk:carousel:change', { index: index });
      }

      function go(i) {
        if (!slides.length) return;
        index = loop ? (i + slides.length) % slides.length : Math.min(Math.max(i, 0), slides.length - 1);
        var target = slides[index];
        track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: bk.prefersReducedMotion() ? 'auto' : 'smooth' });
        sync();
      }

      if (prev) bk.on(prev, 'click', function () { go(index - 1); });
      if (next) bk.on(next, 'click', function () { go(index + 1); });

      bk.on(root, 'keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      });

      bk.on(track, 'scroll', bk.debounce(function () {
        var closest = 0, min = Infinity;
        slides.forEach(function (s, i) {
          var d = Math.abs(s.offsetLeft - track.offsetLeft - track.scrollLeft);
          if (d < min) { min = d; closest = i; }
        });
        if (closest !== index) { index = closest; sync(); }
      }, 120));

      function play() {
        if (!interval) return;
        stop();
        timer = setInterval(function () { go(index + 1); }, interval);
      }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      if (interval) {
        play();
        bk.on(root, 'mouseenter focusin', stop);
        bk.on(root, 'mouseleave focusout', play);
        bk.on(document, 'visibilitychange', function () { document.hidden ? stop() : play(); });
      }

      sync();
      return { go: go, next: function () { go(index + 1); }, prev: function () { go(index - 1); }, play: play, stop: stop, destroy: stop };
    }
  });

  /* --------------------------------------------------------------- counter */

  bk.define('counter', {
    selector: '[data-bk-counter]',
    setup: function (node) {
      var target = parseFloat(node.getAttribute('data-bk-counter'));
      if (isNaN(target)) return null;
      var duration = parseInt(node.getAttribute('data-bk-duration') || '1400', 10);
      var decimals = parseInt(node.getAttribute('data-bk-decimals') || '0', 10);
      var prefix = node.getAttribute('data-bk-prefix') || '';
      var suffix = node.getAttribute('data-bk-suffix') || '';
      var started = false;

      function format(v) {
        return prefix + v.toLocaleString(undefined, {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        }) + suffix;
      }

      function run() {
        if (started) return;
        started = true;
        if (bk.prefersReducedMotion()) { node.textContent = format(target); return; }
        var start = performance.now();
        function tick(now) {
          var t = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - t, 3);
          node.textContent = format(target * eased);
          if (t < 1) requestAnimationFrame(tick);
          else node.textContent = format(target);
        }
        requestAnimationFrame(tick);
      }

      node.textContent = format(0);
      if (window.IntersectionObserver) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) { run(); io.disconnect(); } });
        }, { threshold: 0.4 });
        io.observe(node);
        return { run: run, destroy: function () { io.disconnect(); } };
      }
      run();
      return { run: run, destroy: function () {} };
    }
  });

  /* ------------------------------------------------------------------ copy */

  bk.define('copy', {
    selector: '[data-bk-copy]',
    setup: function (btn) {
      var raw = btn.getAttribute('data-bk-copy');
      var label = btn.getAttribute('data-bk-copied-label') || 'Copied';
      var off = bk.on(btn, 'click', function () {
        var source = bk.resolve(raw);
        var text = source ? (source.value !== undefined ? source.value : source.textContent) : raw;
        var done = function () {
          var original = btn.getAttribute('aria-label') || btn.textContent;
          btn.classList.add('bk-is-copied');
          if (btn.hasAttribute('data-bk-copy-swap')) {
            btn.dataset.bkOriginal = btn.textContent;
            btn.textContent = label;
          }
          btn.setAttribute('aria-label', label);
          bk.announce(label);
          if (bk.toast && btn.hasAttribute('data-bk-copy-toast')) bk.toast.success(label);
          setTimeout(function () {
            btn.classList.remove('bk-is-copied');
            btn.setAttribute('aria-label', original);
            if (btn.dataset.bkOriginal) { btn.textContent = btn.dataset.bkOriginal; delete btn.dataset.bkOriginal; }
          }, 1600);
          bk.emit(btn, 'bk:copy', { text: text });
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done).catch(fallback);
        } else fallback();

        function fallback() {
          var ta = bk.el('textarea', { style: { position: 'fixed', opacity: '0', pointerEvents: 'none' } });
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* nothing else to try */ }
          ta.remove();
        }
      });
      return { destroy: off };
    }
  });

  bk.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = bk.el('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  };

  /* ---------------------------------------------------------------- reveal */

  bk.define('reveal', {
    selector: '.bk-reveal,[data-bk-reveal]',
    setup: function (node) {
      node.classList.add('bk-reveal');
      if (!window.IntersectionObserver || bk.prefersReducedMotion()) {
        node.classList.add('bk-is-revealed');
        return { destroy: function () {} };
      }
      var once = node.getAttribute('data-bk-reveal-once') !== 'false';
      var delay = node.getAttribute('data-bk-reveal-delay');
      if (delay) node.style.setProperty('--bk-reveal-delay', delay + 'ms');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            node.classList.add('bk-is-revealed');
            if (once) io.unobserve(node);
          } else if (!once) node.classList.remove('bk-is-revealed');
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      io.observe(node);
      return { destroy: function () { io.disconnect(); } };
    }
  });

  /* ---------------------------------------------------------------- ripple */

  bk.define('ripple', {
    selector: '[data-bk-ripple]',
    setup: function (node) {
      node.classList.add('bk-ripple');
      var off = bk.on(node, 'pointerdown', function (e) {
        if (bk.prefersReducedMotion()) return;
        var rect = node.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var wave = bk.el('span', { class: 'bk-ripple-wave' });
        wave.style.width = wave.style.height = size + 'px';
        wave.style.left = (e.clientX - rect.left - size / 2) + 'px';
        wave.style.top = (e.clientY - rect.top - size / 2) + 'px';
        node.appendChild(wave);
        setTimeout(function () { wave.remove(); }, 620);
      });
      return { destroy: off };
    }
  });

  /* --------------------------------------------------------------- marquee */

  bk.define('marquee', {
    selector: '[data-bk-marquee]',
    setup: function (node) {
      var track = node.querySelector('.bk-marquee-track');
      if (!track || track.dataset.bkCloned) return null;
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.dataset.bkCloned = '1';
      clone.dataset.bkCloned = '1';
      node.appendChild(clone);
      var speed = node.getAttribute('data-bk-marquee');
      if (speed && speed !== 'true') {
        node.style.setProperty('--bk-marquee-speed', parseFloat(speed) + 's');
      }
      return { destroy: function () { clone.remove(); delete track.dataset.bkCloned; } };
    }
  });

  /* --------------------------------------------------------------- hotkeys */

  var hotkeyMap = [];
  var isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function normalize(combo) {
    return combo.toLowerCase().split('+').map(function (p) { return p.trim(); }).sort().join('+');
  }

  function comboFromEvent(e) {
    var parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    if (['control', 'meta', 'alt', 'shift'].indexOf(key) === -1) parts.push(key);
    return parts.sort().join('+');
  }

  function expand(combo) {
    var c = combo.toLowerCase();
    if (c.indexOf('mod') !== -1) return normalize(c.replace('mod', isMac ? 'meta' : 'ctrl'));
    return normalize(c);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      var pressed = comboFromEvent(e);
      var tag = (e.target && e.target.tagName) || '';
      var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      hotkeyMap.forEach(function (h) {
        if (h.combo !== pressed) return;
        if (typing && !h.allowInInput) return;
        e.preventDefault();
        h.handler(e);
      });
    });
  }

  bk.hotkey = function (combo, handler, opts) {
    var entry = { combo: expand(combo), handler: handler, allowInInput: !!(opts && opts.allowInInput) };
    hotkeyMap.push(entry);
    return function () { hotkeyMap = hotkeyMap.filter(function (h) { return h !== entry; }); };
  };
  bk.hotkey.label = function (combo) {
    return combo.replace(/mod/i, isMac ? '⌘' : 'Ctrl')
      .replace(/alt/i, isMac ? '⌥' : 'Alt')
      .replace(/shift/i, isMac ? '⇧' : 'Shift')
      .replace(/\+/g, isMac ? '' : '+')
      .toUpperCase();
  };

  bk.define('hotkey', {
    selector: '[data-bk-hotkey]',
    setup: function (node) {
      var combo = node.getAttribute('data-bk-hotkey');
      var off = bk.hotkey(combo, function () { node.click(); });
      return { destroy: off };
    }
  });

  /* -------------------------------------------------------------- progress */

  bk.define('progress', {
    selector: '[data-bk-progress]',
    setup: function (node) {
      var bar = node.querySelector('.bk-progress-bar') || node;
      function set(value) {
        var v = Math.min(100, Math.max(0, Number(value)));
        node.style.setProperty('--bk-value', v + '%');
        node.setAttribute('aria-valuenow', String(Math.round(v)));
        if (node.classList.contains('bk-progress-ring')) node.style.setProperty('--bk-value', String(v));
        return v;
      }
      node.setAttribute('role', 'progressbar');
      node.setAttribute('aria-valuemin', '0');
      node.setAttribute('aria-valuemax', '100');
      set(node.getAttribute('data-bk-progress') || 0);
      return { set: set, el: bar, destroy: function () {} };
    }
  });

  /* ------------------------------------------------------------- loadbar --- */

  var loadbarEl = null, loadbarValue = 0, loadbarTimer = null;
  bk.loadbar = {
    start: function () {
      if (!loadbarEl) {
        loadbarEl = bk.el('div', { class: 'bk-loadbar' });
        document.body.appendChild(loadbarEl);
      }
      loadbarEl.style.opacity = '1';
      loadbarValue = 8;
      loadbarEl.style.width = loadbarValue + '%';
      clearInterval(loadbarTimer);
      loadbarTimer = setInterval(function () {
        loadbarValue = Math.min(loadbarValue + Math.random() * 8, 92);
        loadbarEl.style.width = loadbarValue + '%';
      }, 320);
    },
    done: function () {
      if (!loadbarEl) return;
      clearInterval(loadbarTimer);
      loadbarEl.style.width = '100%';
      setTimeout(function () {
        loadbarEl.style.opacity = '0';
        setTimeout(function () { if (loadbarEl) loadbarEl.style.width = '0'; }, 260);
      }, 180);
    }
  };
})(bk);
