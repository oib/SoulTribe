# CSS Management Guide

This document explains how CSS is organized in the SoulTribe.chat web app and how to add or update styles cleanly.

## Top-level principles

- Keep global/theme rules in a single place.
- Keep page-specific rules next to the page that uses them.
- Avoid duplication: do not keep the same selector in multiple files.
- Prefer small, cohesive files over a single large stylesheet.

## File layout

- `web/theme.css`
  - Global theme tokens and shared components.
  - Topbar (`.topbar`) and footer (`.site-footer`) styles.
  - Dark theme overrides (`html[data-theme="dark"] …`) including inputs, badges, lists, buttons, scrollbars, etc.
  - This file is loaded on all pages.

- `web/styles.css`
  - Shared, generic utilities and components only (e.g., `.md` typography, generic buttons, badges, utilities).
  - No page-specific or theme-wide overrides should remain here.

- Page-specific styles
  - `web/index.css` — landing/welcome page (`.welcome-page …`).
  - `web/dashboard.css` — dashboard-only UI (two-column layout, availability grid, chips/item-cards).
  - `web/profile.css` — profile-only UI (Radix `#radixPretty …`, language selector, tag-input UI, profile autocomplete).
  - `web/login.css` — login/register UI.
  - `web/admin/stats.css` — admin stats dashboard.
  - `web/admin/dev.css` — admin/dev console.

## Load order in HTML

Load CSS in this order to ensure correct overrides:

1. `theme.css` (global theme, tokens, dark-mode)
2. `styles.css` (shared utilities)
3. Page-specific CSS (e.g., `dashboard.css`, `profile.css`, `index.css`, etc.)
4. `mobile.css` (shared responsive tweaks)

Example (from `web/dashboard.html`):

```html
<link rel="stylesheet" href="/theme.css" />
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="/dashboard.css" />
<link rel="stylesheet" href="/mobile.css" />
```

## Dark theme

- Prefer `data-theme` attribute (`html[data-theme="dark"]`) for explicit dark mode; this is applied by `app.js`.
- All dark theme overrides live in `theme.css`.
- Page-specific CSS should avoid dark-specific rules unless truly unique; rely on theme where possible.

## Where to put new styles

- Global component or token? → `theme.css`.
- Utility helper or shared pattern? → `styles.css`.
- Only used on one page? → that page’s `*.css` file.
- Admin-only page? → `web/admin/*.css` for that page.

## Refactoring rules

- If a selector exists in both `styles.css` and a page CSS, consolidate into the page CSS if it is page-specific, or into `theme.css` if it is global.
- If you add a new page, create `web/<page>.css` and link it after `styles.css`.

## Current mapping (as of 2025-09-14)

- Global/dark: `theme.css`.
- Generic utilities: `styles.css`.
- Landing: `index.css`.
- Dashboard: `dashboard.css`.
- Profile: `profile.css`.
- Login: `login.css`.
- Admin: `admin/stats.css`, `admin/dev.css`.

## Lint/conventions

- Use kebab-case class names.
- Keep selectors as shallow as possible.
- Prefer component-level classes over tag selectors.
- Co-locate @media rules with the component they affect.
- When migrating styles, remove the old block from its original file to avoid drift.

## FAQ

- "Where do I add a new dark override?"
  - In `theme.css` under the dark overrides section.
- "Where do I style a Radix table cell?"
  - In `profile.css` under the `#radixPretty` section.
- "How do I make the Admin button only visible to admins?"
  - Use the `/api/admin/ping` probe in a small inline script and toggle the `display` style.
