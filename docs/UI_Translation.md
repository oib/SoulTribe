# UI Translation System

This document explains how the internationalization (i18n) system works in the SoulTribe.chat application.

## Overview

The application uses a client-side JavaScript-based i18n system that loads translations from JSON files based on the user's language preference. The system supports multiple languages and allows for dynamic language switching without page reload.

## Core Components

### 1. i18n.js

The main translation logic is in `web/i18n/i18n.js`. This file provides:
- Language detection and management
- Translation loading and caching
- DOM update functionality
- Public API for translations

### 2. Translation Files

Translation files are stored in `web/i18n/locales/{language_code}/translation.json` where `{language_code}` is a two-letter language code (e.g., 'en', 'de', 'fr').

### 3. HTML Integration

Translations are applied to the UI using data attributes:
- `data-i18n`: For element text content
- `data-i18n-placeholder`: For input placeholders
- `data-i18n-title`: For title attributes

## Supported Languages

The application supports the following languages:

| Code | Language | Status |
|------|----------|--------|
| en | English | ✅ Complete |
| de | Deutsch (German) | ✅ Complete |
| fr | Français (French) | ✅ Complete |
| es | Español (Spanish) | ✅ Complete |
| it | Italiano (Italian) | ✅ Complete |
| pt | Português (Portuguese) | ✅ Complete |
| nl | Nederlands (Dutch) | ✅ Complete |
| sv | Svenska (Swedish) | ✅ Complete |
| no | Norsk (Norwegian) | ✅ Complete |
| da | Dansk (Danish) | ✅ Complete |
| fi | Suomi (Finnish) | ✅ Complete |
| pl | Polski (Polish) | ✅ Complete |
| cs | Čeština (Czech) | ✅ Complete |
| hu | Magyar (Hungarian) | ✅ Complete |
| ro | Română (Romanian) | ✅ Complete |
| bg | Български (Bulgarian) | ✅ Complete |
| sk | Slovenčina (Slovak) | ✅ Complete |
| hr | Hrvatski (Croatian) | ✅ Complete |
| lt | Lietuvių (Lithuanian) | ✅ Complete |
| sl | Slovenščina (Slovenian) | ✅ Complete |
| lv | Latviešu (Latvian) | ✅ Complete |
| et | Eesti (Estonian) | ✅ Complete |
| ga | Gaeilge (Irish) | ✅ Complete |
| mt | Malti (Maltese) | ✅ Complete |
| el | Ελληνικά (Greek) | ✅ Complete |
| ru | Русский (Russian) | ✅ Complete |
| tr | Türkçe (Turkish) | ✅ Complete |
| uk | Українська (Ukrainian) | ✅ Complete |
| bs | Bosanski (Bosnian) | ✅ Complete |
| ca | Català (Catalan) | ✅ Complete |
| gl | Galego (Galician) | ✅ Complete |
| is | Íslenska (Icelandic) | ✅ Complete |
| lb | Lëtzebuergesch (Luxembourgish) | ⚠️ Basic |
| sq | Shqip (Albanian) | ❌ Not started |

## How to Use

### 1. Adding a New Translation

1. Create or edit the translation file for the target language at `web/i18n/locales/{code}/translation.json`
2. Follow the structure of the English translation file (`en/translation.json`)
3. Add or update key-value pairs as needed

### 2. Using Translations in HTML

```html
<!-- For element text -->
<h2 data-i18n="welcome.title">Default text</h2>

<!-- For input placeholders -->
<input type="text" data-i18n-placeholder="login.email" />

<!-- For title attributes -->
<button data-i18n-title="button.help" title="Help">?</button>
```

### 3. Translation Keys

Translation keys use dot notation to represent the hierarchy. For example:

```json
{
  "login": {
    "title": "Welcome",
    "email": "Email address"
  }
}
```

Would be referenced as:
- `login.title`
- `login.email`

### 4. Adding a New Language

1. Add the language to the `languages` object in `i18n.js`
2. Create a new directory in `web/i18n/locales/` with the language code (skip if it already exists)
3. Add a `translation.json` file with all the required translations

## Technical Details

### Initialization

The i18n system initializes automatically when the page loads. It:
1. Checks for a saved language preference in `localStorage`
2. Falls back to browser language detection
3. Loads the appropriate translation file
4. Updates the UI with translated content

### Language Switching

Users can change their language preference, which:
1. Updates the `currentLang` in the i18n instance
2. Saves the preference to `localStorage`
3. Loads the new translation file if not already cached
4. Updates all translated elements on the page

### Translation Loading

Translations are loaded asynchronously when needed and cached in memory. The system will only make a network request for a translation file once per session.

## Best Practices

1. Always provide a default fallback text in the HTML
2. Use meaningful, hierarchical keys that describe the context
3. Keep translations in the appropriate language file only (don't duplicate content)
4. Test all UI elements after adding new translations
5. Consider text expansion/contraction in different languages when designing layouts

## Troubleshooting

- If a translation is missing, the key will be displayed instead
- Check the browser console for any failed network requests to translation files
- Ensure all required keys are present in all language files
- Verify that the language code in the URL matches an existing translation directory
