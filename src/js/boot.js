/* =============================================================================
   BUKALEMUN — js/boot.js
   Wires everything up. Opt out entirely with <script data-bk-manual> or by
   setting window.BUKALEMUN_MANUAL = true before the bundle loads.
   ========================================================================== */

(function (bk) {
  'use strict';

  if (typeof document === 'undefined') {
    // Imported on a server: expose a no-op start() so isomorphic code is safe.
    bk.start = function () { return bk; };
    return;
  }

  var script = document.currentScript;
  var manual = (typeof window !== 'undefined' && window.BUKALEMUN_MANUAL === true) ||
    (script && script.hasAttribute('data-bk-manual'));

  document.documentElement.classList.remove('bk-no-js');
  document.documentElement.classList.add('bk-js');

  bk.start = function (root) {
    if (bk.theme) bk.theme.restore();
    bk.init(root || document);
    bk.observe(document.body);
    bk.emit(document, 'bk:ready', { version: bk.version });
    return bk;
  };

  // Deferred by a tick on purpose. The bundle is normally loaded with `defer`,
  // so by the time it evaluates the document is already parsed and ready()
  // fires synchronously — in the middle of the UMD wrapper, before it has
  // assigned the global. Any bk:ready listener reaching for `window.bk` would
  // find undefined. One tick costs nothing and makes the event trustworthy.
  if (!manual) bk.ready(function () { setTimeout(function () { bk.start(); }, 0); });
})(bk);
