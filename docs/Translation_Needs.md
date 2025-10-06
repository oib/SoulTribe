# Translation Status

This document tracks the internationalization (i18n) status of the SoulTribe.chat application.

## Current Status (2025-10-06)

✅ **Core UI strings remain translated across 28 languages.**

⚠️ **New content:** Guest-facing documentation (`web/docs/guest-jitsi-guide.html`) now has full `data-i18n` coverage. Only English, German, and Spanish include localized copy; all other locales currently fall back to English placeholders.

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

- **Fully localized (UI + guest guide):** English (en), German (de), Spanish (es)
- **UI localized, guest guide pending native copy:** French (fr), Italian (it), Portuguese (pt), Dutch (nl), Swedish (sv), Norwegian (no), Danish (da), Finnish (fi), Polish (pl), Czech (cs), Hungarian (hu), Romanian (ro), Bulgarian (bg), Slovak (sk), Croatian (hr), Lithuanian (lt), Slovenian (sl), Latvian (lv), Estonian (et), Irish (ga), Maltese (mt), Greek (el), Russian (ru), Turkish (tr), Ukrainian (uk)

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

- Guest Jitsi guide translations in progress; prioritize the languages listed under "guest guide pending".
- Translation memory will be updated once new locale strings are received.
- RTL language support remains available for previously localized surfaces.

## Implementation Notes

1. All pages use the i18n system with `data-i18n` attributes for static content
2. For dynamic content, use the JavaScript API: `SimpleI18n.t('key.path')`
3. Always update all language files when adding new keys to maintain consistency
4. Test the interface in different languages to catch any layout issues

## Pending Tasks

- **Guest guide localization rollout**
  1. Produce native translations for `guestGuide.*` keys in all locales beyond `en`, `de`, `es`.
  2. QA the updated guide in each language (layout, SVG captions, table wrapping).
  3. Update `docs/Translation_Status.md` once each locale ships.

- **Implement stepwise i18n directory migration** *(unchanged)*
  1. Mirror the current `web/i18n/` tree into `src/frontend/i18n/` without removing legacy files.
  2. Update `web/i18n/i18n.js` loaders to read from the new path while keeping compatibility with existing deployments.
  3. Extend the interim build process (see `docs/dirs.md`) to copy compiled translations into `web/i18n/` until the full migration completes.
  4. Validate all 28 language bundles, then delete the redundant `web/i18n/` sources once references are updated.


