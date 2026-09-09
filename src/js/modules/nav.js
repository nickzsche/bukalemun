/* =============================================================================
   MODULE — nav
   Tabs, accordion/collapse, scrollspy, sticky navbar state, back-to-top,
   and the mobile navbar toggle.
   ========================================================================== */

(function (bk) {
  'use strict';

  /* ---------------------------------------------------------------- tabs */

  bk.define('tabs', {
    selector: '[data-bk-tabs]',
    setup: function (root) {
      var list = root.querySelector('.bk-tablist') || root.querySelector('[role="tablist"]');
      if (!list) return null;
      var tabs = bk.$$('.bk-tab,[role="tab"]', list);
      if (!tabs.length) return null;
      var vertical = list.classList.contains('bk-tablist-vertical');
      var manual = root.getAttribute('data-bk-activation') === 'manual';
      var storeKey = root.getAttribute('data-bk-remember');

      list.setAttribute('role', 'tablist');
      if (vertical) list.setAttribute('aria-orientation', 'vertical');

      var panels = tabs.map(function (tab) {
        var sel = tab.getAttribute('data-bk-panel') || tab.getAttribute('aria-controls');
        var panel = sel ? bk.resolve(sel) : null;
        if (panel) {
          if (!panel.id) panel.id = bk.uid('bk-panel');
          if (!tab.id) tab.id = bk.uid('bk-tab');
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tab.id);
          panel.setAttribute('tabindex', '0');
          tab.setAttribute('aria-controls', panel.id);
        }
        tab.setAttribute('role', 'tab');
        return panel;
      });

      function indicator() {
        if (!list.classList.contains('bk-tablist-indicator')) return;
        var active = tabs[current];
        if (!active) return;
        list.style.setProperty('--bk-ind-w', active.offsetWidth + 'px');
        list.style.setProperty('--bk-ind-x', (active.offsetLeft - list.scrollLeft) + 'px');
      }

      var current = Math.max(0, tabs.findIndex(function (t) {
        return t.getAttribute('aria-selected') === 'true' || t.classList.contains('bk-is-active');
      }));

      function activate(index, focus) {
        if (index < 0 || index >= tabs.length) return;
        var tab = tabs[index];
        if (tab.hasAttribute('disabled')) return;
        if (!bk.emit(root, 'bk:tabs:beforechange', { index: index, tab: tab })) return;
        current = index;
        tabs.forEach(function (t, i) {
          var on = i === index;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.setAttribute('tabindex', on ? '0' : '-1');
          t.classList.toggle('bk-is-active', on);
          if (panels[i]) {
            panels[i].classList.toggle('bk-is-active', on);
            panels[i].hidden = !on;
          }
        });
        if (focus) tab.focus();
        if (storeKey) bk.storage.set('bk:tabs:' + storeKey, String(index));
        indicator();
        bk.emit(root, 'bk:tabs:change', { index: index, tab: tab, panel: panels[index] });
      }

      bk.on(list, 'click', function (e) {
        var tab = e.target.closest('.bk-tab,[role="tab"]');
        if (!tab || !list.contains(tab)) return;
        e.preventDefault();
        activate(tabs.indexOf(tab), true);
      });

      bk.on(list, 'keydown', function (e) {
        var prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
        var nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
        var idx = tabs.indexOf(document.activeElement);
        if (idx < 0) return;
        var next = null;
        if (e.key === nextKey) next = (idx + 1) % tabs.length;
        else if (e.key === prevKey) next = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(idx, true); return; }
        if (next === null) return;
        e.preventDefault();
        if (manual) tabs[next].focus();
        else activate(next, true);
      });

      if (storeKey) {
        var saved = parseInt(bk.storage.get('bk:tabs:' + storeKey, ''), 10);
        if (!isNaN(saved) && tabs[saved]) current = saved;
      }
      var hash = window.location.hash.slice(1);
      if (hash) {
        var byHash = tabs.findIndex(function (t) {
          return (t.getAttribute('data-bk-panel') || '').replace('#', '') === hash;
        });
        if (byHash >= 0) current = byHash;
      }
      activate(current, false);
      bk.on(window, 'resize', bk.debounce(indicator, 100));

      return {
        activate: activate,
        get index() { return current; },
        next: function () { activate((current + 1) % tabs.length, true); },
        prev: function () { activate((current - 1 + tabs.length) % tabs.length, true); },
        destroy: function () {}
      };
    }
  });

  /* ----------------------------------------------------------- accordion */

  bk.define('accordion', {
    selector: '[data-bk-accordion]',
    setup: function (root) {
      var single = root.getAttribute('data-bk-accordion') === 'single';
      var items = bk.$$('details.bk-accordion-item', root);
      if (!items.length) return null;

      function onToggle(e) {
        var item = e.target;
        if (!item.open || !single) return;
        items.forEach(function (other) {
          if (other !== item && other.open) other.open = false;
        });
      }
      items.forEach(function (i) { bk.on(i, 'toggle', onToggle); });

      return {
        openAll: function () { items.forEach(function (i) { i.open = true; }); },
        closeAll: function () { items.forEach(function (i) { i.open = false; }); },
        destroy: function () {}
      };
    }
  });

  /* ------------------------------------------------------------ collapse */

  bk.define('collapse', {
    selector: '[data-bk-collapse]',
    setup: function (trigger) {
      var panel = bk.resolve(trigger.getAttribute('data-bk-collapse'));
      if (!panel) return null;
      if (!panel.classList.contains('bk-collapse')) panel.classList.add('bk-collapse');
      if (!panel.id) panel.id = bk.uid('bk-collapse');
      trigger.setAttribute('aria-controls', panel.id);

      function isOpen() { return panel.classList.contains('bk-is-open'); }
      function set(open) {
        panel.classList.toggle('bk-is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        trigger.classList.toggle('bk-is-active', open);
        bk.emit(panel, 'bk:collapse:' + (open ? 'open' : 'close'), { trigger: trigger });
      }
      set(trigger.getAttribute('aria-expanded') === 'true' || isOpen());

      var off = bk.on(trigger, 'click', function (e) {
        e.preventDefault();
        set(!isOpen());
      });
      return {
        open: function () { set(true); },
        close: function () { set(false); },
        toggle: function () { set(!isOpen()); },
        destroy: off
      };
    }
  });

  /* ------------------------------------------------------------- toggle */
  /* Generic class toggler — the workhorse for "show this thing" wiring.     */

  bk.define('toggle', {
    selector: '[data-bk-toggle]',
    setup: function (trigger) {
      var targetSel = trigger.getAttribute('data-bk-toggle');
      var cls = trigger.getAttribute('data-bk-toggle-class') || 'bk-is-open';
      var off = bk.on(trigger, 'click', function (e) {
        var target = bk.resolve(targetSel);
        if (!target) return;
        e.preventDefault();
        var on = target.classList.toggle(cls);
        trigger.setAttribute('aria-expanded', on ? 'true' : 'false');
        bk.emit(target, 'bk:toggle', { open: on, trigger: trigger });
      });
      return { destroy: off };
    }
  });

  /* ---------------------------------------------------------- scrollspy */

  bk.define('scrollspy', {
    selector: '[data-bk-scrollspy]',
    setup: function (nav) {
      var scope = bk.resolve(nav.getAttribute('data-bk-scrollspy')) || document;
      var links = bk.$$('a[href^="#"]', nav);
      if (!links.length) return null;
      var offset = parseInt(nav.getAttribute('data-bk-offset') || '80', 10);

      var targets = links.map(function (a) {
        var id = a.getAttribute('href').slice(1);
        return id ? (scope.getElementById ? scope.getElementById(id) : document.getElementById(id)) : null;
      });

      function update() {
        var best = -1, bestTop = -Infinity;
        targets.forEach(function (t, i) {
          if (!t) return;
          var top = t.getBoundingClientRect().top - offset;
          if (top <= 0 && top > bestTop) { bestTop = top; best = i; }
        });
        if (best < 0) best = 0;
        links.forEach(function (a, i) {
          a.classList.toggle('bk-is-active', i === best);
          if (i === best) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }

      var onScroll = bk.throttle(update, 100);
      bk.on(window, 'scroll', onScroll, { passive: true });
      bk.on(window, 'resize', onScroll, { passive: true });
      update();
      return { update: update, destroy: function () {} };
    }
  });

  /* ------------------------------------------------------ navbar scroll */

  bk.define('navbar-scroll', {
    selector: '[data-bk-navbar-scroll]',
    setup: function (nav) {
      var threshold = parseInt(nav.getAttribute('data-bk-navbar-scroll') || '8', 10);
      var hideOnDown = nav.hasAttribute('data-bk-hide-on-scroll');
      var lastY = window.scrollY;
      var onScroll = bk.throttle(function () {
        var y = window.scrollY;
        nav.classList.toggle('bk-is-scrolled', y > threshold);
        if (hideOnDown) {
          var down = y > lastY && y > 120;
          nav.style.transform = down ? 'translateY(-100%)' : '';
          nav.style.transition = 'transform 240ms var(--bk-ease)';
        }
        lastY = y;
      }, 80);
      bk.on(window, 'scroll', onScroll, { passive: true });
      onScroll();
      return { destroy: function () {} };
    }
  });

  /* ------------------------------------------------------- back to top */

  bk.define('to-top', {
    selector: '[data-bk-to-top]',
    setup: function (btn) {
      var after = parseInt(btn.getAttribute('data-bk-to-top') || '400', 10);
      var onScroll = bk.throttle(function () {
        btn.classList.toggle('bk-is-visible', window.scrollY > after);
      }, 120);
      bk.on(window, 'scroll', onScroll, { passive: true });
      bk.on(btn, 'click', function () {
        window.scrollTo({ top: 0, behavior: bk.prefersReducedMotion() ? 'auto' : 'smooth' });
      });
      onScroll();
      return { destroy: function () {} };
    }
  });

  /* -------------------------------------------------------- smooth hash */

  bk.define('smooth-anchor', {
    selector: '[data-bk-smooth]',
    setup: function (root) {
      var offset = parseInt(root.getAttribute('data-bk-offset') || '0', 10);
      var off = bk.delegate(root, 'click', 'a[href^="#"]', function (e, a) {
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: top, behavior: bk.prefersReducedMotion() ? 'auto' : 'smooth' });
        history.pushState(null, '', '#' + id);
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
      return { destroy: off };
    }
  });
})(bk);
