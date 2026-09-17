/* =============================================================================
   BUKALEMUN — scripts/html-data.mjs
   VS Code HTML custom data: autocomplete and hover docs for every data-bk-*
   attribute the runtime and the CSS read. build.mjs writes it to
   dist/bukalemun.html-data.json; point "html.customData" at that file.

   The descriptions are written by hand because a selector cannot say what an
   attribute is for. tests/run.mjs keeps them honest in both directions: every
   attribute here must appear in src/, and every author-facing attribute in
   src/ must appear here.
   ========================================================================== */

const MODES = [
  ['auto', 'Follow the operating system preference.'],
  ['light', 'Always light.'],
  ['dark', 'Always dark.']
];

const PLACEMENTS = ['top', 'bottom', 'left', 'right']
  .flatMap((side) => [side, `${side}-start`, `${side}-end`]);

const values = (pairs) => pairs.map(([name, description]) => (description ? { name, description } : { name }));

/**
 * @param {{ skins: string[], meta: Record<string, {label: string, blurb: string}>, accents: string[] }} theme
 *   what the built runtime knows about its skins and accents
 */
export function htmlData({ skins, meta, accents }) {
  const skinValues = values(['default', ...skins].map((s) =>
    [s, meta[s] ? `${meta[s].label}. ${meta[s].blurb}` : undefined]));
  const accentValues = values([['none', "The skin's own accent."],
    ...accents.map((a) => [a, `The skin's accent rotated ${a === 'warm' ? 'toward red' : a === 'cool' ? 'toward blue' : a}.`])]);
  const modeValues = values(MODES);
  const placementValues = values(PLACEMENTS.map((p) => [p]));

  const a = (name, description, extra) => ({ name, description, ...extra });

  const globalAttributes = [
    // ---------------------------------------------------------- theming
    a('data-bk-style', 'The skin for the page, set on <html>. Omit it for the default skin.', { values: skinValues }),
    a('data-bk-theme', 'Colour mode, set on <html>.', { values: modeValues }),
    a('data-bk-accent', 'Accent variant, set on <html>: the skin\'s accent turned warmer or cooler.', { values: accentValues }),
    a('data-bk-density', 'Spacing scale for everything inside.', { values: values([['compact', 'Tighter spacing.'], ['comfortable', 'Looser spacing.']]) }),
    a('data-bk-radius', 'Corner radius override, independent of the skin.', { values: values([['none', 'Square corners.'], ['sm', 'Half the skin\'s radius.'], ['lg', 'A larger radius.'], ['full', 'Pill-shaped controls.']]) }),
    a('data-bk-theme-toggle', 'Click toggles light and dark mode. The value, if any, becomes its accessible label.'),
    a('data-bk-mode-set', 'Click sets this colour mode. aria-pressed tracks the current mode.', { values: modeValues }),
    a('data-bk-style-set', 'Click switches to this skin. aria-pressed tracks the current skin.', { values: skinValues }),
    a('data-bk-style-select', 'On a <select>: switches the skin on change and follows it when changed elsewhere.'),
    a('data-bk-style-cycle', 'Click moves to the next or previous skin.', { values: values([['next'], ['prev']]) }),
    a('data-bk-accent-set', 'Click sets this accent variant.', { values: accentValues }),
    a('data-bk-accent-select', 'On a <select>: switches the accent variant on change.'),
    a('data-bk-accent-cycle', 'Click moves to the next accent variant.'),
    a('data-bk-skins', 'On the no-flash.js <script>: URL template for lazy skins, with {skin} standing for the name.'),
    a('data-bk-manual', 'On the bundle <script>: do not boot automatically; call bk.start() yourself.'),

    // --------------------------------------------------------- overlays
    a('data-bk-open', 'Click opens the modal or drawer this selector points at.'),
    a('data-bk-toggle-overlay', 'Click opens or closes the modal or drawer this selector points at.'),
    a('data-bk-close', 'Click closes the overlay this selector points at, or the enclosing dialog when empty or "true".'),
    a('data-bk-modal-root', 'Treat this element as a modal even though it is not a dialog.bk-modal.'),
    a('data-bk-modal-mode', 'On a modal: "non-modal" opens it without a backdrop or inert page.', { values: values([['non-modal']]) }),
    a('data-bk-dismissable', 'On a modal or drawer: "false" stops a backdrop click from closing it.', { values: values([['false']]) }),
    a('data-bk-static', 'On a modal or drawer: "true" ignores Esc and shakes instead of closing.', { values: values([['true']]) }),
    a('data-bk-initial-focus', 'On a modal or drawer: selector of the element that receives focus on open.'),
    a('data-bk-cmdk', 'Command palette dialog. The value is its hotkey, "mod+k" by default.'),
    a('data-bk-keywords', 'On a command palette item: extra words it matches when searching.'),
    a('data-bk-value', 'On a menu, command palette or combobox item: the value reported when it is chosen.'),
    a('data-bk-keep-open', 'On a menu or command palette item: "true" keeps the panel open after choosing it.', { values: values([['true']]) }),

    // --------------------------------------------------------- floating
    a('data-bk-tooltip', 'Tooltip text, shown on hover and keyboard focus.'),
    a('data-bk-title', 'CSS-only tooltip text, shown on hover without the runtime.'),
    a('data-bk-popover', 'Click toggles the popover panel this selector points at.'),
    a('data-bk-menu', 'Click toggles the dropdown menu this selector points at, with arrow-key navigation.'),
    a('data-bk-placement', 'Where a tooltip, popover or menu opens. It flips when there is no room.', { values: placementValues }),
    a('data-bk-delay', 'On a tooltip: milliseconds before it shows. Default 120.'),

    // ------------------------------------------------------- navigation
    a('data-bk-tabs', 'Accessible tabs with arrow-key navigation on this container.'),
    a('data-bk-activation', 'On tabs: "manual" moves focus with the arrows and activates on Enter or Space.', { values: values([['manual']]) }),
    a('data-bk-remember', 'On tabs: storage key that remembers the chosen tab across visits.'),
    a('data-bk-panel', 'On a tab: selector of the panel it shows.'),
    a('data-bk-accordion', 'Accordion on this container. "single" keeps only one section open.', { values: values([['single']]) }),
    a('data-bk-collapse', 'Click expands or collapses the panel this selector points at.'),
    a('data-bk-toggle', 'Click toggles a class on the element this selector points at.'),
    a('data-bk-toggle-class', 'With data-bk-toggle: the class to toggle. Default bk-is-open.'),
    a('data-bk-scrollspy', 'On a nav: marks the link whose section is in view. The value can scope the sections.'),
    a('data-bk-offset', 'On scrollspy or smooth scrolling: pixels to leave for a sticky header.'),
    a('data-bk-navbar-scroll', 'On a navbar: adds a scrolled state after this many pixels. Default 8.'),
    a('data-bk-hide-on-scroll', 'With data-bk-navbar-scroll: hide the navbar while scrolling down.'),
    a('data-bk-to-top', 'Back-to-top button that appears after this many pixels. Default 400.'),
    a('data-bk-smooth', 'Smooth scrolling for in-page links inside this element.'),

    // ------------------------------------------------------------- data
    a('data-bk-table', 'On a <table>: sortable columns, plus filtering with data-bk-filter.'),
    a('data-bk-sort', 'On a <th>: makes the column sortable, compared as this type.', { values: values([['text'], ['number'], ['date']]) }),
    a('data-bk-sort-value', 'On a cell: the value to sort by instead of its text.'),
    a('data-bk-filter', 'On a table: selector of the search input that filters its rows.'),
    a('data-bk-count-into', 'On a table: selector of the element that shows how many rows match.'),
    a('data-bk-carousel', 'Carousel with scroll snapping, dots and previous and next buttons.'),
    a('data-bk-autoplay', 'On a carousel: milliseconds between slides. 0 or absent means no autoplay.'),
    a('data-bk-loop', 'On a carousel: "false" stops at the last slide.', { values: values([['false']]) }),
    a('data-bk-counter', 'Counts up to this number when scrolled into view.'),
    a('data-bk-duration', 'On a counter: animation length in milliseconds. Default 1400.'),
    a('data-bk-decimals', 'On a counter: decimal places to show.'),
    a('data-bk-prefix', 'On a counter: text before the number.'),
    a('data-bk-suffix', 'On a counter: text after the number.'),
    a('data-bk-progress', 'Progress bar or ring value from 0 to 100.'),
    a('data-bk-copy', 'Click copies the text of the element this selector points at, or the value itself.'),
    a('data-bk-copied-label', 'On a copy button: confirmation text. Default "Copied".'),
    a('data-bk-copy-swap', 'On a copy button: briefly swap its label for the confirmation.'),
    a('data-bk-copy-toast', 'On a copy button: confirm with a toast.'),
    a('data-bk-hotkey', 'Keyboard shortcut that clicks this element, such as "mod+k" or "shift+/".'),
    a('data-bk-reveal', 'Fades the element in when it scrolls into view.'),
    a('data-bk-reveal-once', 'On a reveal: "false" hides it again when it leaves the view.', { values: values([['false']]) }),
    a('data-bk-reveal-delay', 'On a reveal: delay in milliseconds.'),
    a('data-bk-ripple', 'Material-style ripple on press.'),
    a('data-bk-marquee', 'Scrolling marquee. The value, if a number, is the loop length in seconds.'),
    a('data-bk-toast', 'Toast declared in markup. The value is how long it stays, in milliseconds. Default 4000.'),
    a('data-bk-position', 'On a toast: where it stacks.', { values: values(['top-start', 'top-center', 'top-end', 'bottom-start', 'bottom-center', 'bottom-end'].map((p) => [p])) }),

    // ------------------------------------------------------------ forms
    a('data-bk-validate', 'On a <form>: inline validation messages instead of the browser bubbles.'),
    a('data-bk-message', 'On a field: the one message shown for any validation failure.'),
    ...['valueMissing', 'typeMismatch', 'patternMismatch', 'tooShort', 'tooLong', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput']
      .map((k) => a(`data-bk-message-${k.toLowerCase()}`, `On a field: message shown for ${k}.`)),
    a('data-bk-autosize', 'On a <textarea>: grows with its content.'),
    a('data-bk-count', 'On an input, textarea or select: selector of the element that shows its character count.'),
    a('data-bk-output', 'On a .bk-range input: selector of the element that shows its value.'),
    a('data-bk-password-toggle', 'Click shows or hides the password field this selector points at.'),
    a('data-bk-otp', 'One-time code input with this many boxes. Default 6.'),
    a('data-bk-tags', 'Tag input: type and press Enter or the separator to add a tag.'),
    a('data-bk-separator', 'On a tag input: the character that ends a tag. Default ",".'),
    a('data-bk-max', 'On a tag input: the most tags allowed. 0 means no limit.'),
    a('data-bk-dropzone', 'File drop area. The value can point at its file input.'),
    a('data-bk-file-list', 'On a dropzone: selector of the element that lists the chosen files.'),
    a('data-bk-combobox', 'Searchable combobox with keyboard navigation.'),
    a('data-bk-options', 'On a combobox: its options as a JSON array, or a comma-separated list.'),
    a('data-bk-stepper', 'Number stepper with increment and decrement buttons.'),
    a('data-bk-step', 'Inside a stepper: "1" for the increment button, "-1" for the decrement button.', { values: values([['1'], ['-1']]) }),
    a('data-bk-step-up', 'Inside a stepper: the increment button.'),
    a('data-bk-step-down', 'Inside a stepper: the decrement button.'),
    a('data-bk-check-all', 'Checkbox that checks every data-bk-check-item. The value can scope them.'),
    a('data-bk-check-item', 'Checkbox controlled by a data-bk-check-all.')
  ];

  return {
    version: 1.1,
    globalAttributes: globalAttributes.map((attr) => ({
      ...attr,
      description: { kind: 'markdown', value: attr.description }
    }))
  };
}
