/* =============================================================================
   MODULE — input
   Form-side behaviours: validation, OTP, tag inputs, dropzones, autoresize,
   character counters, password reveal, range fill, combobox and steppers.
   ========================================================================== */

(function (bk) {
  'use strict';

  /* ------------------------------------------------------- form validate */

  var MESSAGES = {
    valueMissing: 'This field is required.',
    typeMismatch: 'Please enter a valid value.',
    patternMismatch: 'Please match the requested format.',
    tooShort: 'This is too short.',
    tooLong: 'This is too long.',
    rangeUnderflow: 'The value is too small.',
    rangeOverflow: 'The value is too large.',
    stepMismatch: 'Please pick a valid step.',
    badInput: "We couldn't read that value.",
    customError: ''
  };

  function messageFor(field) {
    var custom = field.getAttribute('data-bk-message');
    if (custom) return custom;
    var v = field.validity;
    for (var key in MESSAGES) {
      if (v[key]) {
        var attr = field.getAttribute('data-bk-message-' + key.toLowerCase());
        return attr || (key === 'customError' ? field.validationMessage : MESSAGES[key]);
      }
    }
    return field.validationMessage;
  }

  function errorSlot(field) {
    var described = field.getAttribute('aria-errormessage');
    var slot = described ? document.getElementById(described) : null;
    if (slot) return slot;
    var wrap = field.closest('.bk-field') || field.parentElement;
    slot = wrap ? wrap.querySelector('.bk-error') : null;
    if (!slot && wrap) {
      slot = bk.el('div', { class: 'bk-error', id: bk.uid('bk-err') });
      wrap.appendChild(slot);
    }
    if (slot) {
      if (!slot.id) slot.id = bk.uid('bk-err');
      field.setAttribute('aria-errormessage', slot.id);
    }
    return slot;
  }

  function setFieldState(field, valid, message) {
    field.classList.toggle('bk-is-invalid', !valid);
    field.classList.toggle('bk-is-valid', valid && field.value !== '');
    field.setAttribute('aria-invalid', valid ? 'false' : 'true');
    var slot = errorSlot(field);
    if (slot) {
      slot.textContent = valid ? '' : message;
      slot.hidden = valid;
    }
  }

  bk.define('form-validate', {
    selector: 'form[data-bk-validate]',
    setup: function (form) {
      form.setAttribute('novalidate', '');
      form.classList.add('bk-form-validate');
      var fields = function () {
        return bk.$$('input,select,textarea', form).filter(function (f) {
          return !f.disabled && f.type !== 'hidden' && f.willValidate;
        });
      };

      function check(field, force) {
        if (!force && !field.dataset.bkTouched) return true;
        var valid = field.checkValidity();
        setFieldState(field, valid, valid ? '' : messageFor(field));
        return valid;
      }

      bk.on(form, 'blur', function (e) {
        var f = e.target;
        if (f.willValidate) { f.dataset.bkTouched = '1'; check(f, true); }
      }, true);

      bk.on(form, 'input', function (e) {
        var f = e.target;
        if (f.willValidate && f.dataset.bkTouched) check(f, true);
      });

      bk.on(form, 'submit', function (e) {
        var list = fields();
        var firstInvalid = null;
        list.forEach(function (f) {
          f.dataset.bkTouched = '1';
          if (!check(f, true) && !firstInvalid) firstInvalid = f;
        });
        if (firstInvalid) {
          e.preventDefault();
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ block: 'center', behavior: bk.prefersReducedMotion() ? 'auto' : 'smooth' });
          bk.announce('The form has errors. ' + messageFor(firstInvalid), true);
          bk.emit(form, 'bk:form:invalid', { field: firstInvalid });
        } else {
          bk.emit(form, 'bk:form:valid', {});
        }
      });

      return {
        validate: function () { return fields().every(function (f) { return check(f, true); }); },
        reset: function () {
          fields().forEach(function (f) {
            delete f.dataset.bkTouched;
            f.classList.remove('bk-is-invalid', 'bk-is-valid');
            f.removeAttribute('aria-invalid');
            var slot = errorSlot(f);
            if (slot) { slot.textContent = ''; slot.hidden = true; }
          });
        },
        destroy: function () {}
      };
    }
  });

  /* ------------------------------------------------------------ autosize */

  bk.define('autosize', {
    selector: 'textarea[data-bk-autosize]',
    setup: function (ta) {
      if (CSS && CSS.supports && CSS.supports('field-sizing', 'content')) {
        ta.style.fieldSizing = 'content';
        return { destroy: function () {} };
      }
      function resize() {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      }
      bk.on(ta, 'input', resize);
      bk.raf(resize);
      return { resize: resize, destroy: function () {} };
    }
  });

  /* ------------------------------------------------------------- counter */

  // Scoped to fields on purpose. The setup below reads field.value, so it has
  // nothing to say about any other element — and an unscoped [data-bk-count]
  // collided with the counter module's data-bk-counter on the demo pages,
  // where it tried to use "184" as a CSS selector and threw.
  bk.define('char-count', {
    selector: 'input[data-bk-count],textarea[data-bk-count],select[data-bk-count]',
    setup: function (field) {
      var out = bk.resolve(field.getAttribute('data-bk-count'));
      var max = parseInt(field.getAttribute('maxlength') || '0', 10);
      if (!out) return null;
      function update() {
        var n = field.value.length;
        out.textContent = max ? n + ' / ' + max : String(n);
        out.classList.toggle('bk-text-danger', max > 0 && n >= max);
        out.classList.toggle('bk-text-warning', max > 0 && n >= max * 0.9 && n < max);
      }
      bk.on(field, 'input', update);
      update();
      return { destroy: function () {} };
    }
  });

  /* ------------------------------------------------------ password toggle */

  bk.define('password-toggle', {
    selector: '[data-bk-password-toggle]',
    setup: function (btn) {
      var field = bk.resolve(btn.getAttribute('data-bk-password-toggle'));
      if (!field) return null;
      btn.setAttribute('aria-pressed', 'false');
      var off = bk.on(btn, 'click', function () {
        var shown = field.type === 'text';
        field.type = shown ? 'password' : 'text';
        btn.setAttribute('aria-pressed', shown ? 'false' : 'true');
        btn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
        var icon = btn.querySelector('.bk-icon');
        if (icon) icon.classList.toggle('bk-i-eye-off', !shown), icon.classList.toggle('bk-i-eye', shown);
      });
      return { destroy: off };
    }
  });

  /* ---------------------------------------------------------- range fill */

  bk.define('range', {
    selector: 'input[type="range"].bk-range',
    setup: function (input) {
      var output = input.getAttribute('data-bk-output') ? bk.resolve(input.getAttribute('data-bk-output')) : null;
      function update() {
        var min = parseFloat(input.min || '0');
        var max = parseFloat(input.max || '100');
        var val = parseFloat(input.value || '0');
        var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
        input.style.setProperty('--_progress', pct + '%');
        if (output) output.textContent = input.value;
      }
      bk.on(input, 'input change', update);
      update();
      return { update: update, destroy: function () {} };
    }
  });

  /* ---------------------------------------------------------------- OTP */

  bk.define('otp', {
    selector: '[data-bk-otp]',
    setup: function (root) {
      var length = parseInt(root.getAttribute('data-bk-otp') || '6', 10);
      var hidden = root.querySelector('input[type="hidden"]');
      var inputs = bk.$$('input:not([type="hidden"])', root);

      if (!inputs.length) {
        for (var i = 0; i < length; i++) {
          root.appendChild(bk.el('input', {
            type: 'text', inputmode: 'numeric', maxlength: '1',
            autocomplete: i === 0 ? 'one-time-code' : 'off',
            'aria-label': 'Digit ' + (i + 1)
          }));
        }
        inputs = bk.$$('input:not([type="hidden"])', root);
      }

      function value() { return inputs.map(function (i) { return i.value; }).join(''); }
      function sync() {
        var v = value();
        if (hidden) hidden.value = v;
        bk.emit(root, 'bk:otp:change', { value: v, complete: v.length === inputs.length });
        if (v.length === inputs.length) bk.emit(root, 'bk:otp:complete', { value: v });
      }

      inputs.forEach(function (input, idx) {
        bk.on(input, 'input', function () {
          input.value = input.value.replace(/[^0-9a-zA-Z]/g, '').slice(-1);
          if (input.value && idx < inputs.length - 1) inputs[idx + 1].focus();
          sync();
        });
        bk.on(input, 'keydown', function (e) {
          if (e.key === 'Backspace' && !input.value && idx > 0) {
            inputs[idx - 1].focus();
            inputs[idx - 1].value = '';
            sync();
            e.preventDefault();
          } else if (e.key === 'ArrowLeft' && idx > 0) { inputs[idx - 1].focus(); e.preventDefault(); }
          else if (e.key === 'ArrowRight' && idx < inputs.length - 1) { inputs[idx + 1].focus(); e.preventDefault(); }
        });
        bk.on(input, 'paste', function (e) {
          e.preventDefault();
          var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\s/g, '');
          for (var n = 0; n < inputs.length - idx; n++) inputs[idx + n].value = text[n] || '';
          var last = Math.min(idx + text.length, inputs.length - 1);
          inputs[last].focus();
          sync();
        });
        bk.on(input, 'focus', function () { input.select(); });
      });

      return {
        get value() { return value(); },
        clear: function () { inputs.forEach(function (i) { i.value = ''; }); inputs[0].focus(); sync(); },
        destroy: function () {}
      };
    }
  });

  /* --------------------------------------------------------- tags input */

  bk.define('tags', {
    selector: '[data-bk-tags]',
    setup: function (root) {
      var input = root.querySelector('input:not([type="hidden"])');
      var hidden = root.querySelector('input[type="hidden"]');
      if (!input) {
        input = bk.el('input', { type: 'text', 'aria-label': 'Add a tag' });
        root.appendChild(input);
      }
      var separator = root.getAttribute('data-bk-separator') || ',';
      var max = parseInt(root.getAttribute('data-bk-max') || '0', 10);
      var tags = [];

      function sync() {
        if (hidden) hidden.value = tags.join(separator);
        bk.emit(root, 'bk:tags:change', { tags: tags.slice() });
      }

      function render() {
        bk.$$('.bk-chip', root).forEach(function (c) { c.remove(); });
        tags.forEach(function (tag, i) {
          var chip = bk.el('span', { class: 'bk-chip' }, [
            document.createTextNode(tag),
            bk.el('button', { class: 'bk-chip-remove', type: 'button', 'aria-label': 'Remove ' + tag })
          ]);
          bk.on(chip.lastChild, 'click', function () { remove(i); });
          root.insertBefore(chip, input);
        });
      }

      function add(raw) {
        var value = String(raw).trim();
        if (!value) return false;
        if (tags.indexOf(value) !== -1) return false;
        if (max && tags.length >= max) return false;
        tags.push(value);
        render(); sync();
        return true;
      }

      function remove(index) {
        tags.splice(index, 1);
        render(); sync();
      }

      var initial = (hidden && hidden.value) || root.getAttribute('data-bk-value') || '';
      initial.split(separator).forEach(function (t) { if (t.trim()) tags.push(t.trim()); });
      render();

      bk.on(input, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === separator) {
          e.preventDefault();
          if (add(input.value)) input.value = '';
        } else if (e.key === 'Backspace' && !input.value && tags.length) {
          remove(tags.length - 1);
        }
      });
      bk.on(input, 'blur', function () { if (add(input.value)) input.value = ''; });
      bk.on(root, 'click', function (e) { if (e.target === root) input.focus(); });

      return {
        get tags() { return tags.slice(); },
        add: add,
        remove: remove,
        clear: function () { tags = []; render(); sync(); },
        destroy: function () {}
      };
    }
  });

  /* ----------------------------------------------------------- dropzone */

  bk.define('dropzone', {
    selector: '[data-bk-dropzone]',
    setup: function (zone) {
      var input = bk.resolve(zone.getAttribute('data-bk-dropzone')) || zone.querySelector('input[type="file"]');
      var listEl = zone.getAttribute('data-bk-file-list') ? bk.resolve(zone.getAttribute('data-bk-file-list')) : null;

      function humanSize(bytes) {
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return (i === 0 ? bytes : bytes.toFixed(1)) + ' ' + units[i];
      }

      function renderList(files) {
        if (!listEl) return;
        listEl.innerHTML = '';
        Array.prototype.forEach.call(files, function (f) {
          listEl.appendChild(bk.el('div', { class: 'bk-file-item' }, [
            bk.el('i', { class: 'bk-icon bk-i-file' }),
            bk.el('span', { class: 'bk-file-item-name bk-truncate' }, f.name),
            bk.el('span', { class: 'bk-file-item-size' }, humanSize(f.size))
          ]));
        });
      }

      ['dragenter', 'dragover'].forEach(function (t) {
        bk.on(zone, t, function (e) { e.preventDefault(); zone.classList.add('bk-is-dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (t) {
        bk.on(zone, t, function (e) {
          e.preventDefault();
          if (t === 'dragleave' && zone.contains(e.relatedTarget)) return;
          zone.classList.remove('bk-is-dragover');
        });
      });
      bk.on(zone, 'drop', function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;
        if (input) {
          var dt = new DataTransfer();
          Array.prototype.forEach.call(files, function (f) { dt.items.add(f); });
          input.files = dt.files;
          bk.emit(input, 'change');
        }
        renderList(files);
        bk.emit(zone, 'bk:dropzone:files', { files: files });
      });
      bk.on(zone, 'click', function (e) {
        if (input && e.target !== input && !e.target.closest('button')) input.click();
      });
      bk.on(zone, 'keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && input) { e.preventDefault(); input.click(); }
      });
      if (input) {
        bk.on(input, 'change', function () {
          renderList(input.files);
          bk.emit(zone, 'bk:dropzone:files', { files: input.files });
        });
      }
      if (!zone.hasAttribute('tabindex')) zone.setAttribute('tabindex', '0');
      if (!zone.hasAttribute('role')) zone.setAttribute('role', 'button');
      return { destroy: function () {} };
    }
  });

  /* ----------------------------------------------------------- combobox */

  bk.define('combobox', {
    selector: '[data-bk-combobox]',
    setup: function (root) {
      var input = root.querySelector('input');
      var list = root.querySelector('.bk-combobox-list');
      if (!input || !list) return null;
      var source = [];
      var raw = root.getAttribute('data-bk-options');
      if (raw) { try { source = JSON.parse(raw); } catch (e) { source = raw.split(','); } }
      else source = bk.$$('.bk-combobox-option', list).map(function (o) {
        return { label: o.textContent.trim(), value: o.getAttribute('data-bk-value') || o.textContent.trim() };
      });
      source = source.map(function (o) { return typeof o === 'string' ? { label: o, value: o } : o; });

      var activeIndex = -1;
      var matches = [];

      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'false');
      if (!list.id) list.id = bk.uid('bk-listbox');
      input.setAttribute('aria-controls', list.id);
      list.setAttribute('role', 'listbox');

      function render() {
        var q = input.value.trim().toLowerCase();
        matches = source.filter(function (o) { return !q || o.label.toLowerCase().indexOf(q) !== -1; });
        list.innerHTML = '';
        if (!matches.length) {
          list.appendChild(bk.el('li', { class: 'bk-combobox-empty' }, 'No matches'));
        } else {
          matches.forEach(function (o, i) {
            var li = bk.el('li', {
              class: 'bk-combobox-option', role: 'option',
              'data-bk-value': o.value, 'aria-selected': i === activeIndex ? 'true' : 'false'
            });
            var idx = q ? o.label.toLowerCase().indexOf(q) : -1;
            if (idx >= 0) {
              li.appendChild(document.createTextNode(o.label.slice(0, idx)));
              li.appendChild(bk.el('mark', {}, o.label.slice(idx, idx + q.length)));
              li.appendChild(document.createTextNode(o.label.slice(idx + q.length)));
            } else li.textContent = o.label;
            list.appendChild(li);
          });
        }
      }

      function open() { render(); list.classList.add('bk-is-open'); input.setAttribute('aria-expanded', 'true'); }
      function close() { list.classList.remove('bk-is-open'); input.setAttribute('aria-expanded', 'false'); activeIndex = -1; }

      function commit(option) {
        input.value = option.label;
        close();
        bk.emit(root, 'bk:combobox:select', { value: option.value, label: option.label });
      }

      bk.on(input, 'input', function () { activeIndex = -1; open(); });
      bk.on(input, 'focus', open);
      bk.on(input, 'blur', function () { setTimeout(close, 140); });
      bk.on(input, 'keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); render(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); render(); }
        else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); commit(matches[activeIndex]); }
        else if (e.key === 'Escape') close();
      });
      bk.on(list, 'mousedown', function (e) {
        var opt = e.target.closest('.bk-combobox-option');
        if (!opt) return;
        e.preventDefault();
        var i = bk.$$('.bk-combobox-option', list).indexOf(opt);
        commit(matches[i]);
      });

      return {
        setOptions: function (opts) { source = opts.map(function (o) { return typeof o === 'string' ? { label: o, value: o } : o; }); render(); },
        destroy: function () {}
      };
    }
  });

  /* ------------------------------------------------------------ stepper */

  bk.define('stepper', {
    selector: '[data-bk-stepper]',
    setup: function (root) {
      var input = root.querySelector('input[type="number"]');
      if (!input) return null;
      var dec = root.querySelector('[data-bk-step="-1"]') || root.querySelector('[data-bk-step-down]');
      var inc = root.querySelector('[data-bk-step="1"]') || root.querySelector('[data-bk-step-up]');
      function nudge(dir) {
        if (dir > 0) input.stepUp(); else input.stepDown();
        bk.emit(input, 'input', {}, { bubbles: true });
        bk.emit(input, 'change', {}, { bubbles: true });
      }
      if (dec) bk.on(dec, 'click', function (e) { e.preventDefault(); nudge(-1); });
      if (inc) bk.on(inc, 'click', function (e) { e.preventDefault(); nudge(1); });
      return { destroy: function () {} };
    }
  });

  /* ------------------------------------------------- indeterminate check */

  bk.define('check-all', {
    selector: '[data-bk-check-all]',
    setup: function (master) {
      var scope = bk.resolve(master.getAttribute('data-bk-check-all')) || document;
      function children() {
        return bk.$$('input[type="checkbox"][data-bk-check-item]', scope);
      }
      function syncMaster() {
        var list = children();
        var on = list.filter(function (c) { return c.checked; }).length;
        master.checked = on > 0 && on === list.length;
        master.indeterminate = on > 0 && on < list.length;
        bk.emit(master, 'bk:checkall:change', { checked: on, total: list.length });
      }
      bk.on(master, 'change', function () {
        children().forEach(function (c) { c.checked = master.checked; });
        master.indeterminate = false;
        bk.emit(master, 'bk:checkall:change', { checked: master.checked ? children().length : 0, total: children().length });
      });
      bk.on(scope, 'change', function (e) {
        if (e.target.matches('input[type="checkbox"][data-bk-check-item]')) syncMaster();
      });
      syncMaster();
      return { sync: syncMaster, destroy: function () {} };
    }
  });
})(bk);
