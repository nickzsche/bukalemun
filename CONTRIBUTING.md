# Contributing

Thanks for looking. A few house rules that the test suite enforces, so you find
out in one second rather than in review.

## The one hard rule

**A component stylesheet may not name a colour, radius, shadow, font, border
width or duration.** It reads tokens. If you need a new knob, add it to
`src/core/tokens.css` with a sensible default, and it becomes something every
skin can reshape.

## Naming

- Classes: `bk-` prefix, kebab-case. State goes on `bk-is-*` (`bk-is-open`,
  `bk-is-active`).
- Custom properties: `--bk-*`. Use `--_name` for file-local privates that are
  not part of the public contract.
- Data attributes: `data-bk-*`.

## Before you push

```bash
npm run check     # build + structure suite + contrast audit
```

If the contrast audit fails, do not hand-pick a colour — run:

```bash
npm run contrast:fix
```

It preserves each accent's hue and saturation and moves only lightness, which
keeps the skin recognisable. Commit the regenerated block along with your change.

## Adding a skin

See "Adding a skin" in [PROJECT.md](PROJECT.md). Four steps, and the build finds
the file on its own.

## Accessibility

Non-negotiable, and mostly automatic if you use native elements. If you add an
interactive component:

- start from a real HTML element before reaching for `role=`
- keyboard support is part of the feature, not a follow-up
- respect `prefers-reduced-motion` in both the CSS and the runtime
- use logical properties so RTL keeps working
