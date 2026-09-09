/* =============================================================================
   MODULE — float
   Tooltip, popover and dropdown menu. Anchored with the core positioning
   engine; dismissed by Esc, outside click and focus loss.
   ========================================================================== */

(function (bk) {
  'use strict';

  var openFloats = [];

  function closeAll(except) {
    openFloats.slice().forEach(function (f) { if (f !== except) f.close(); });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openFloats.length) {
        var top = openFloats[openFloats.length - 1];
        top.close();
        if (top.anchor && top.anchor.focus) top.anchor.focus();
      }
    });

    document.addEventListener('pointerdown', function (e) {
      openFloats.slice().forEach(function (f) {
        if (f.el.contains(e.target) || f.anchor.contains(e.target)) return;
        f.close();
      });
    }, true);
  }

  /* -------------------------------------------------------------- tooltip */

  bk.define('tooltip', {
    selector: '[data-bk-tooltip]',
    setup: function (anchor) {
      var text = anchor.getAttribute('data-bk-tooltip');
      if (!text) return null;
      var placement = anchor.getAttribute('data-bk-placement') || 'top';
      var delay = parseInt(anchor.getAttribute('data-bk-delay') || '120', 10);
      var tip = null, arrow = null, stop = null, timer = null;

      function build() {
        tip = bk.el('div', { class: 'bk-tooltip', role: 'tooltip', id: bk.uid('bk-tip') });
        tip.appendChild(document.createTextNode(text));
        arrow = bk.el('div', { class: 'bk-tooltip-arrow' });
        tip.appendChild(arrow);
        document.body.appendChild(tip);
        anchor.setAttribute('aria-describedby', tip.id);
      }

      function show() {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (!tip) build();
          tip.classList.add('bk-is-open');
          stop = bk.autoPosition(anchor, tip, { placement: placement, offset: 8, arrow: arrow, strategy: 'fixed' });
          openFloats.push(inst);
        }, delay);
      }

      function hide() {
        clearTimeout(timer);
        if (!tip) return;
        tip.classList.remove('bk-is-open');
        if (stop) { stop(); stop = null; }
        openFloats = openFloats.filter(function (f) { return f !== inst; });
      }

      var inst = {
        anchor: anchor,
        get el() { return tip || anchor; },
        show: show,
        close: hide,
        destroy: function () { hide(); if (tip) tip.remove(); }
      };

      bk.on(anchor, 'mouseenter focus', show);
      bk.on(anchor, 'mouseleave blur', hide);
      bk.on(anchor, 'click', hide);
      return inst;
    }
  });

  /* -------------------------------------------------------------- popover */

  function attachFloat(anchor, panel, opts) {
    opts = opts || {};
    var placement = opts.placement || anchor.getAttribute('data-bk-placement') || 'bottom-start';
    var arrow = panel.querySelector('.bk-popover-arrow');
    var stop = null;

    function isOpen() { return panel.classList.contains('bk-is-open'); }

    function open() {
      if (isOpen()) return;
      closeAll(inst);
      if (!bk.emit(panel, 'bk:float:beforeopen', { anchor: anchor })) return;
      if (panel.parentElement !== document.body && opts.portal !== false) {
        panel.setAttribute('data-bk-portal-home', '1');
        document.body.appendChild(panel);
      }
      panel.classList.add('bk-is-open');
      anchor.setAttribute('aria-expanded', 'true');
      stop = bk.autoPosition(anchor, panel, {
        placement: placement, offset: opts.offset == null ? 8 : opts.offset,
        arrow: arrow, strategy: 'fixed'
      });
      openFloats.push(inst);
      if (opts.focus !== false) {
        var first = bk.focusables(panel)[0];
        if (first) bk.raf(function () { first.focus({ preventScroll: true }); });
      }
      bk.emit(panel, 'bk:float:open', { anchor: anchor });
    }

    function close() {
      if (!isOpen()) return;
      panel.classList.remove('bk-is-open');
      anchor.setAttribute('aria-expanded', 'false');
      if (stop) { stop(); stop = null; }
      openFloats = openFloats.filter(function (f) { return f !== inst; });
      bk.emit(panel, 'bk:float:close', { anchor: anchor });
    }

    var inst = {
      anchor: anchor, el: panel,
      open: open, close: close,
      toggle: function () { isOpen() ? close() : open(); },
      isOpen: isOpen,
      destroy: function () { close(); }
    };

    anchor.setAttribute('aria-expanded', 'false');
    if (panel.id) anchor.setAttribute('aria-controls', panel.id);

    bk.on(anchor, 'click', function (e) { e.preventDefault(); inst.toggle(); });
    bk.on(anchor, 'keydown', function (e) {
      if (e.key === 'ArrowDown' && !isOpen()) { e.preventDefault(); open(); }
    });
    return inst;
  }

  bk.define('popover', {
    selector: '[data-bk-popover]',
    setup: function (anchor) {
      var panel = bk.resolve(anchor.getAttribute('data-bk-popover'));
      if (!panel) return null;
      panel.classList.add('bk-popover');
      return attachFloat(anchor, panel, { placement: anchor.getAttribute('data-bk-placement') || 'bottom' });
    }
  });

  /* ----------------------------------------------------------------- menu */

  bk.define('menu', {
    selector: '[data-bk-menu]',
    setup: function (anchor) {
      var panel = bk.resolve(anchor.getAttribute('data-bk-menu'));
      if (!panel) return null;
      panel.classList.add('bk-menu');
      panel.setAttribute('role', 'menu');
      bk.$$('.bk-menu-item', panel).forEach(function (i) {
        if (!i.hasAttribute('role')) i.setAttribute('role', 'menuitem');
        i.setAttribute('tabindex', '-1');
      });

      var inst = attachFloat(anchor, panel, {
        placement: anchor.getAttribute('data-bk-placement') || 'bottom-start',
        focus: false
      });

      function enabledItems() {
        return bk.$$('.bk-menu-item', panel).filter(function (i) {
          return !i.hasAttribute('disabled') && !i.classList.contains('bk-is-disabled') && !i.hidden;
        });
      }

      function move(step) {
        var list = enabledItems();
        if (!list.length) return;
        var idx = list.indexOf(document.activeElement);
        var next = idx < 0 ? (step > 0 ? 0 : list.length - 1) : (idx + step + list.length) % list.length;
        list[next].focus();
      }

      bk.on(panel, 'keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Home') { e.preventDefault(); (enabledItems()[0] || panel).focus(); }
        else if (e.key === 'End') { e.preventDefault(); var l = enabledItems(); (l[l.length - 1] || panel).focus(); }
        else if (e.key === 'Tab') { inst.close(); }
      });

      bk.on(panel, 'bk:float:open', function () { bk.raf(function () { move(1); }); });

      bk.on(panel, 'click', function (e) {
        var item = e.target.closest('.bk-menu-item');
        if (!item) return;
        if (item.getAttribute('role') === 'menuitemcheckbox' || item.classList.contains('bk-menu-check')) {
          var on = item.getAttribute('aria-checked') === 'true';
          item.setAttribute('aria-checked', on ? 'false' : 'true');
          bk.emit(panel, 'bk:menu:change', { item: item, checked: !on });
          return;
        }
        bk.emit(panel, 'bk:menu:select', { item: item, value: item.getAttribute('data-bk-value') });
        if (item.getAttribute('data-bk-keep-open') !== 'true') {
          inst.close();
          anchor.focus();
        }
      });

      bk.on(anchor, 'keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); inst.open(); bk.raf(function () { move(-1); }); }
      });
      anchor.setAttribute('aria-haspopup', 'menu');
      return inst;
    }
  });

  bk.tooltip = function (target) { return bk.instance(bk.resolve(target), 'tooltip'); };
  bk.popover = function (target) { return bk.instance(bk.resolve(target), 'popover'); };
  bk.menu = function (target) { return bk.instance(bk.resolve(target), 'menu'); };
  bk.closeFloats = closeAll;
})(bk);
