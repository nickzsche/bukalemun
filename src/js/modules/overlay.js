/* =============================================================================
   MODULE — overlay
   Modal, drawer and command palette. All three ride on native <dialog>, so the
   top layer, ::backdrop, Esc handling and inertness come from the platform.
   ========================================================================== */

(function (bk) {
  'use strict';

  var openStack = [];

  function isDialog(node) { return node && node.tagName === 'DIALOG'; }

  function createController(node, kind) {
    var releaseFocus = null;
    var closing = false;

    function opened() { return node.hasAttribute('open'); }

    function open(opts) {
      if (opened() || closing) return ctl;
      if (!bk.emit(node, 'bk:' + kind + ':beforeopen', { controller: ctl })) return ctl;
      node.classList.remove('bk-is-closing');
      if (isDialog(node)) {
        if (node.getAttribute('data-bk-modal-mode') === 'non-modal') node.show();
        else node.showModal();
      } else {
        node.setAttribute('open', '');
        node.classList.add('bk-is-open');
      }
      bk.lockScroll();
      openStack.push(ctl);
      releaseFocus = bk.trapFocus(node, { initial: node.getAttribute('data-bk-initial-focus') });
      bk.emit(node, 'bk:' + kind + ':open', { controller: ctl });
      return ctl;
    }

    function close(reason) {
      if (!opened() || closing) return ctl;
      if (!bk.emit(node, 'bk:' + kind + ':beforeclose', { controller: ctl, reason: reason })) return ctl;
      closing = true;
      node.classList.add('bk-is-closing');
      bk.afterMotion(node, function () {
        node.classList.remove('bk-is-closing', 'bk-is-open');
        if (isDialog(node)) node.close(typeof reason === 'string' ? reason : '');
        else node.removeAttribute('open');
        bk.unlockScroll();
        openStack = openStack.filter(function (c) { return c !== ctl; });
        if (releaseFocus) { releaseFocus(true); releaseFocus = null; }
        closing = false;
        bk.emit(node, 'bk:' + kind + ':close', { controller: ctl, reason: reason });
      }, 500);
      return ctl;
    }

    function toggle() { return opened() ? close('toggle') : open(); }

    var ctl = {
      el: node, kind: kind,
      open: open, close: close, toggle: toggle,
      isOpen: opened,
      destroy: function () { if (opened()) { if (isDialog(node)) node.close(); bk.unlockScroll(); } }
    };

    // Light-dismiss: a click that lands on the dialog box itself (not its
    // content) is a backdrop click.
    if (node.getAttribute('data-bk-dismissable') !== 'false') {
      bk.on(node, 'mousedown', function (e) {
        if (e.target !== node) return;
        var r = node.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) close('backdrop');
      });
    }

    // Native `cancel` (Esc) — route through our animated close.
    bk.on(node, 'cancel', function (e) {
      e.preventDefault();
      if (node.getAttribute('data-bk-static') === 'true') {
        node.classList.add('bk-anim-shake', 'bk-animate');
        setTimeout(function () { node.classList.remove('bk-anim-shake', 'bk-animate'); }, 520);
        return;
      }
      close('escape');
    });

    bk.on(node, 'close', function () {
      bk.unlockScroll();
      openStack = openStack.filter(function (c) { return c !== ctl; });
      if (releaseFocus) { releaseFocus(true); releaseFocus = null; }
    });

    return ctl;
  }

  function controllerFor(node, kind) {
    var existing = bk.instance(node, kind);
    if (existing) return existing;
    return createController(node, kind);
  }

  /* ---------------------------------------------------------------- api -- */

  function factory(kind) {
    return function (target, action) {
      var node = bk.resolve(target);
      if (!node) return null;
      var ctl = bk.instance(node, kind) || bk.init(node) && bk.instance(node, kind) || controllerFor(node, kind);
      if (action === 'open') ctl.open();
      else if (action === 'close') ctl.close('api');
      else if (action === 'toggle') ctl.toggle();
      return ctl;
    };
  }

  bk.modal = factory('modal');
  bk.drawer = factory('drawer');

  bk.modal.closeAll = function () {
    openStack.slice().forEach(function (c) { c.close('closeAll'); });
  };
  bk.modal.top = function () { return openStack[openStack.length - 1] || null; };

  bk.define('modal', {
    selector: 'dialog.bk-modal,dialog.bk-cmdk,[data-bk-modal-root]',
    setup: function (node) { return createController(node, 'modal'); }
  });

  bk.define('drawer', {
    selector: 'dialog.bk-drawer',
    setup: function (node) {
      if (!node.hasAttribute('data-side')) node.setAttribute('data-side', 'end');
      return createController(node, 'drawer');
    }
  });

  /* --------------------------------------------------------- triggers --- */

  bk.define('overlay-trigger', {
    selector: '[data-bk-open],[data-bk-toggle-overlay]',
    setup: function (node) {
      var sel = node.getAttribute('data-bk-open') || node.getAttribute('data-bk-toggle-overlay');
      var toggleMode = node.hasAttribute('data-bk-toggle-overlay');
      var off = bk.on(node, 'click', function (e) {
        var target = bk.resolve(sel);
        if (!target) return;
        e.preventDefault();
        var kind = target.classList.contains('bk-drawer') ? 'drawer' : 'modal';
        var ctl = bk.instance(target, kind);
        if (!ctl) { bk.init(target); ctl = bk.instance(target, kind); }
        if (!ctl) ctl = controllerFor(target, kind);
        if (toggleMode) ctl.toggle(); else ctl.open();
      });
      return { destroy: off };
    }
  });

  bk.define('overlay-close', {
    selector: '[data-bk-close]',
    setup: function (node) {
      var off = bk.on(node, 'click', function (e) {
        e.preventDefault();
        var sel = node.getAttribute('data-bk-close');
        var target = sel && sel !== 'true' ? bk.resolve(sel) : node.closest('dialog,[data-bk-modal-root]');
        if (!target) return;
        var kind = target.classList.contains('bk-drawer') ? 'drawer' : 'modal';
        var ctl = bk.instance(target, kind) || controllerFor(target, kind);
        ctl.close('trigger');
      });
      return { destroy: off };
    }
  });

  /* -------------------------------------------------- confirm() helper --- */
  /* A promise-returning confirmation dialog built on the same primitives, for
     when you want a modal but do not want to write the markup.               */

  bk.confirm = function (opts) {
    opts = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise(function (resolve) {
      var titleId = bk.uid('bk-confirm-title');
      var dialog = bk.el('dialog', {
        class: 'bk-modal bk-modal-sm',
        'aria-labelledby': titleId
      });
      var confirmBtn = bk.el('button', {
        class: 'bk-btn ' + (opts.danger ? 'bk-btn-danger' : 'bk-btn-primary'),
        type: 'button'
      }, opts.confirmText || 'Confirm');
      var cancelBtn = bk.el('button', { class: 'bk-btn bk-btn-ghost bk-btn-neutral', type: 'button' },
        opts.cancelText || 'Cancel');

      var body = bk.el('div', { class: 'bk-modal-inner' }, [
        bk.el('div', { class: 'bk-modal-header' }, [
          bk.el('div', { class: 'bk-stack', style: { gap: 'var(--bk-space-1)' } }, [
            bk.el('h2', { class: 'bk-modal-title', id: titleId }, opts.title || 'Are you sure?'),
            opts.message ? bk.el('p', { class: 'bk-modal-desc' }, opts.message) : null
          ])
        ]),
        bk.el('div', { class: 'bk-modal-footer' }, [cancelBtn, confirmBtn])
      ]);
      dialog.appendChild(body);
      document.body.appendChild(dialog);

      var ctl = createController(dialog, 'modal');
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        ctl.close('confirm');
        setTimeout(function () { dialog.remove(); }, 600);
        resolve(value);
      }
      bk.on(confirmBtn, 'click', function () { finish(true); });
      bk.on(cancelBtn, 'click', function () { finish(false); });
      bk.on(dialog, 'bk:modal:close', function () { finish(false); });
      ctl.open();
    });
  };

  /* ------------------------------------------------------ command palette */

  bk.define('cmdk', {
    selector: '[data-bk-cmdk]',
    setup: function (node) {
      var input = node.querySelector('.bk-cmdk-input');
      var list = node.querySelector('.bk-cmdk-list');
      if (!input || !list) return null;
      var emptyEl = node.querySelector('.bk-cmdk-empty');
      var ctl = bk.instance(node, 'modal') || createController(node, 'modal');
      var hotkey = (node.getAttribute('data-bk-cmdk') || 'mod+k').toLowerCase();

      function items() {
        return bk.$$('.bk-cmdk-item', list).filter(function (i) { return !i.hidden && !i.closest('[hidden]'); });
      }

      function select(next) {
        var all = items();
        if (!all.length) return;
        var current = all.findIndex(function (i) { return i.getAttribute('aria-selected') === 'true'; });
        var idx = current < 0 ? 0 : (current + next + all.length) % all.length;
        all.forEach(function (i, n) { i.setAttribute('aria-selected', n === idx ? 'true' : 'false'); });
        all[idx].scrollIntoView({ block: 'nearest' });
      }

      function filter() {
        var q = input.value.trim().toLowerCase();
        var visible = 0;
        bk.$$('.bk-cmdk-item', list).forEach(function (i) {
          var hay = (i.getAttribute('data-bk-keywords') || '') + ' ' + i.textContent;
          var match = !q || hay.toLowerCase().indexOf(q) !== -1;
          i.hidden = !match;
          i.setAttribute('aria-selected', 'false');
          if (match) visible++;
        });
        bk.$$('.bk-cmdk-group', list).forEach(function (g) {
          g.hidden = !bk.$$('.bk-cmdk-item', g).some(function (i) { return !i.hidden; });
        });
        if (emptyEl) emptyEl.hidden = visible > 0;
        select(0);
      }

      bk.on(input, 'input', filter);
      bk.on(node, 'keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); select(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); select(-1); }
        else if (e.key === 'Enter') {
          var active = items().find(function (i) { return i.getAttribute('aria-selected') === 'true'; });
          if (active) { e.preventDefault(); active.click(); }
        }
      });
      bk.on(list, 'click', function (e) {
        var item = e.target.closest('.bk-cmdk-item');
        if (!item) return;
        bk.emit(node, 'bk:cmdk:select', { item: item, value: item.getAttribute('data-bk-value') });
        if (item.getAttribute('data-bk-keep-open') !== 'true') ctl.close('select');
      });
      bk.on(node, 'bk:modal:open', function () { input.value = ''; filter(); input.focus(); });

      if (hotkey && hotkey !== 'false' && bk.hotkey) bk.hotkey(hotkey, function () { ctl.toggle(); });

      return { controller: ctl, filter: filter, destroy: function () { ctl.destroy(); } };
    }
  });
})(bk);
