# Translation Status

This document tracks the internationalization (i18n) status of the SoulTribe.chat application.

## Current Status (2025-09-18)

✅ **All UI elements have been translated to 28 languages** including:

- Core authentication flows (login, registration, password reset)
- Navigation and UI elements
- User profile and settings
- Onboarding process
- Error messages and notifications

## Implementation Details

### Completed Components

- **Authentication Flow**
  - Login page (`/login.html`)
  - Registration form (`/register.html`)
  - Password reset (`/reset-password.html`)
  - Email verification

- **Navigation**
  - Main navigation menu
  - Footer links
  - Breadcrumbs

- **User Profile**
  - Profile edit form
  - Settings pages
  - Account management

- **Onboarding**
  - Welcome screens
  - Tutorial steps
  - Tooltips

- **Notifications**
  - System messages
  - Email templates
  - Push notifications

- **Error Messages**
  - Form validation
  - API errors
  - 404/500 pages

### Translation Coverage

All translations are complete for the following 28 languages:

1. English (en) - Source language
2. German (de)
3. French (fr)
4. Spanish (es)
5. Italian (it)
6. Portuguese (pt)
7. Dutch (nl)
8. Swedish (sv)
9. Norwegian (no)
10. Danish (da)
11. Finnish (fi)
12. Polish (pl)
13. Czech (cs)
14. Hungarian (hu)
15. Romanian (ro)
16. Bulgarian (bg)
17. Slovak (sk)
18. Croatian (hr)
19. Lithuanian (lt)
20. Slovenian (sl)
21. Latvian (lv)
22. Estonian (et)
23. Irish (ga)
24. Maltese (mt)
25. Greek (el)
26. Russian (ru)
27. Turkish (tr)
28. Ukrainian (uk)

## Maintenance

### Adding New Languages

To add support for a new language:

1. Create a new directory in `web/i18n/locales/` with the language code (e.g., `fr` for French)
2. Copy the English translation file (`en/translation.json`) as a starting point
3. Translate all strings while maintaining the same JSON structure
4. Add the language to the language selector in the UI
5. Update the documentation with the new language

### Updating Translations

When making changes to the English source strings:

1. Update the English translation file first
2. Update all other language files with the same keys
3. Mark any untranslated strings with `[TODO]` for later translation
4. Update the translation status in the documentation

### Translation Guidelines

1. Use formal language where appropriate
2. Maintain consistent terminology
3. Keep translations concise
4. Use gender-neutral language when possible
5. Consider cultural context
6. Test UI with different text lengths
7. Verify RTL language support when applicable

## Notes

- All translations have been reviewed by native speakers
- The translation memory is updated after each batch of changes
- The UI has been tested with different text lengths and character sets
- Right-to-left (RTL) language support is implemented for applicable languages

## Implementation Notes

1. All pages use the i18n system with `data-i18n` attributes for static content
2. For dynamic content, use the JavaScript API: `SimpleI18n.t('key.path')`
3. Always update all language files when adding new keys to maintain consistency
4. Test the interface in different languages to catch any layout issues

## Pending Tasks

- **Implement stepwise i18n directory migration**
  1. Mirror the current `web/i18n/` tree into `src/frontend/i18n/` without removing legacy files.
  2. Update `web/i18n/i18n.js` loaders to read from the new path while keeping compatibility with existing deployments.
  3. Extend the interim build process (see `docs/dirs.md`) to copy compiled translations into `web/i18n/` until the full migration completes.
  4. Validate all 28 language bundles, then delete the redundant `web/i18n/` sources once references are updated.


