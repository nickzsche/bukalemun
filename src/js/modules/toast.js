/* =============================================================================
   MODULE — toast
   A queue of transient messages. Programmatic (bk.toast(...)) with promise and
   update support; also picks up markup-declared toasts on init.
   ========================================================================== */

(function (bk) {
  'use strict';

  var containers = {};
  var DEFAULT_POSITION = 'bottom-end';
  var active = [];
  var MAX = 6;

  function container(position) {
    var pos = position || DEFAULT_POSITION;
    if (containers[pos] && document.body.contains(containers[pos])) return containers[pos];
    var node = bk.el('div', {
      class: 'bk-toaster',
      'data-position': pos,
      role: 'region',
      'aria-label': 'Notifications'
    });
    document.body.appendChild(node);
    containers[pos] = node;
    return node;
  }

  function dismiss(entry) {
    if (!entry || entry.dismissed) return;
    entry.dismissed = true;
    clearTimeout(entry.timer);
    entry.node.classList.add('bk-is-leaving');
    bk.afterMotion(entry.node, function () {
      entry.node.remove();
      active = active.filter(function (a) { return a !== entry; });
      if (entry.onClose) entry.onClose();
    }, 400);
  }

  function build(opts) {
    var node = bk.el('div', {
      class: 'bk-toast' + (opts.variant ? ' bk-toast-' + opts.variant : ''),
      role: opts.variant === 'danger' ? 'alert' : 'status',
      'aria-live': opts.variant === 'danger' ? 'assertive' : 'polite'
    });
    var body = bk.el('div', { class: 'bk-toast-body' });
    if (opts.title) body.appendChild(bk.el('div', { class: 'bk-toast-title' }, opts.title));
    if (opts.message) body.appendChild(bk.el('div', { class: 'bk-toast-text' }, opts.message));
    node.appendChild(body);

    if (opts.action) {
      var btn = bk.el('button', { class: 'bk-btn bk-btn-sm bk-btn-ghost bk-btn-primary bk-toast-action', type: 'button' },
        opts.action.label || 'Undo');
      bk.on(btn, 'click', function () {
        if (opts.action.onClick) opts.action.onClick();
        dismiss(node.__entry);
      });
      node.appendChild(btn);
    }
    if (opts.dismissible !== false) {
      var close = bk.el('button', { class: 'bk-close', type: 'button', 'aria-label': 'Dismiss' });
      bk.on(close, 'click', function () { dismiss(node.__entry); });
      node.appendChild(close);
    }
    if (opts.duration && opts.duration > 0 && opts.progress !== false) {
      node.style.setProperty('--bk-toast-duration', opts.duration + 'ms');
      node.appendChild(bk.el('div', { class: 'bk-toast-progress' }));
    }
    return node;
  }

  function show(opts) {
    if (typeof opts === 'string') opts = { message: opts };
    opts = Object.assign({ duration: 4000, position: DEFAULT_POSITION }, opts || {});
    if (opts.variant === 'loading') opts.duration = 0;

    var node = build(opts);
    var host = container(opts.position);
    host.appendChild(node);

    var entry = { node: node, opts: opts, onClose: opts.onClose, dismissed: false };
    node.__entry = entry;
    active.push(entry);

    while (active.length > MAX) dismiss(active[0]);

    if (opts.duration > 0) {
      entry.timer = setTimeout(function () { dismiss(entry); }, opts.duration);
      bk.on(node, 'mouseenter', function () { clearTimeout(entry.timer); node.style.setProperty('animation-play-state', 'paused'); });
      bk.on(node, 'mouseleave', function () {
        entry.timer = setTimeout(function () { dismiss(entry); }, Math.max(1200, opts.duration / 2));
      });
    }

    var handle = {
      el: node,
      dismiss: function () { dismiss(entry); },
      update: function (patch) {
        var merged = Object.assign({}, entry.opts, patch);
        var replacement = build(merged);
        replacement.__entry = entry;
        node.replaceWith(replacement);
        entry.node = replacement;
        entry.opts = merged;
        clearTimeout(entry.timer);
        if (merged.duration > 0) entry.timer = setTimeout(function () { dismiss(entry); }, merged.duration);
        handle.el = replacement;
        return handle;
      }
    };
    return handle;
  }

  var toast = function (opts) { return show(opts); };
  ['success', 'danger', 'warning', 'info'].forEach(function (variant) {
    toast[variant] = function (message, opts) {
      return show(Object.assign({ message: message, variant: variant }, opts || {}));
    };
  });
  toast.loading = function (message, opts) {
    return show(Object.assign({ message: message, variant: 'loading', dismissible: false }, opts || {}));
  };
  toast.dismissAll = function () { active.slice().forEach(dismiss); };
  toast.position = function (pos) { DEFAULT_POSITION = pos; return DEFAULT_POSITION; };

  /** Attach a toast lifecycle to a promise. */
  toast.promise = function (promise, msgs) {
    msgs = msgs || {};
    var handle = toast.loading(msgs.loading || 'Working…');
    return Promise.resolve(promise).then(function (value) {
      handle.update({
        variant: 'success',
        message: typeof msgs.success === 'function' ? msgs.success(value) : (msgs.success || 'Done'),
        duration: 3500, dismissible: true
      });
      return value;
    }, function (err) {
      handle.update({
        variant: 'danger',
        message: typeof msgs.error === 'function' ? msgs.error(err) : (msgs.error || 'Something went wrong'),
        duration: 6000, dismissible: true
      });
      throw err;
    });
  };

  bk.toast = toast;

  /* Markup-declared toasts: <div class="bk-toast" data-bk-toast>…</div>       */
  bk.define('toast-markup', {
    selector: '[data-bk-toast]',
    setup: function (node) {
      var duration = parseInt(node.getAttribute('data-bk-toast') || '4000', 10);
      var pos = node.getAttribute('data-bk-position') || DEFAULT_POSITION;
      container(pos).appendChild(node);
      var entry = { node: node, opts: { duration: duration }, dismissed: false };
      node.__entry = entry;
      active.push(entry);
      bk.$$('.bk-close', node).forEach(function (c) {
        bk.on(c, 'click', function () { dismiss(entry); });
      });
      if (duration > 0) entry.timer = setTimeout(function () { dismiss(entry); }, duration);
      return { dismiss: function () { dismiss(entry); }, destroy: function () { clearTimeout(entry.timer); } };
    }
  });
})(bk);
