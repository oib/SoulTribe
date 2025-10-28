# Translation Management System (TMS) Documentation

## Overview
The Translation Management System (TMS) is designed to streamline the process of managing and maintaining translations for SoulTribe.chat. This document provides a comprehensive guide to using the TMS effectively.

## Directory Structure

```
translations/
├── README.md           # General documentation and guidelines
├── scripts/
│   ├── extract-strings.js  # Extract translation keys from source code
│   ├── add-language.js     # Add support for a new language
│   └── validate.js         # Validate translation files
└── locales/            # Translation files (symlinked to web/i18n/locales)
    ├── en/             # English translations (source of truth)
    │   └── translation.json
    ├── de/             # German translations
    │   └── translation.json
    └── ...             # Other languages
```

## Available Scripts

### 1. Extracting Strings

To extract all translatable strings from the source code:

```bash
node dev/translations/scripts/extract-strings.js
```

This will scan the codebase for strings marked for translation and update the reference translation file.

### 2. Adding a New Language

To add support for a new language (e.g., French):

```bash
node dev/translations/scripts/add-language.js fr "French"
```

This will:
1. Create a new directory for the language
2. Generate a translation file with all keys from English
3. Mark all translations as `[TODO]`
4. Update the i18n configuration

### 3. Validating Translations

To check for missing or invalid translations:

```bash
node dev/translations/scripts/validate.js
```

This will:
1. Compare all language files against the reference (English)
2. Report missing translations
3. Identify unused or extra translation keys
4. Check for common issues like missing placeholders

## Translation File Format

Translation files follow a nested JSON structure:

```json
{
  "common": {
    "welcome": "Welcome to SoulTribe.chat",
    "login": "Login",
    "logout": "Logout"
  },
  "dashboard": {
    "title": "Your Dashboard",
    "welcome": "Welcome back, {{name}}!"
  }
}
```

## Best Practices

### 1. String Extraction
- Always use the extraction script to ensure all strings are captured
- Review the extracted strings before committing changes
- Keep the English version as the source of truth

### 2. Adding New Strings
1. Add the string to the English translation file first
2. Run the extraction script to update all language files
3. Notify translators about new strings that need translation

### 3. Translation Guidelines
- Maintain the same structure across all language files
- Use placeholders like `{{variable}}` for dynamic content
- Keep translations concise and natural in the target language
- Be aware of cultural differences in expressions and formats

### 4. Testing
- Always test the UI after adding or modifying translations
- Check for text overflow or layout issues
- Verify that all placeholders are properly replaced

## Common Issues and Solutions

### 1. Missing Translations
If a translation is missing, the system will fall back to English. To fix:
1. Add the missing translation to the appropriate language file
2. Ensure the key matches exactly with the English version

### 2. Placeholder Mismatch
If placeholders aren't being replaced:
1. Check that the placeholder names match exactly
2. Ensure special characters are properly escaped
3. Verify that the data being passed to the translation function is correct

### 3. RTL Languages
For right-to-left languages (e.g., Arabic, Hebrew):
1. Add the language to the RTL list in the i18n configuration
2. Test the layout to ensure proper text direction
3. Consider adding CSS overrides for RTL-specific styling

## Integration with Development Workflow

### 1. Feature Branches
- Create a separate branch for translation-related changes
- Include translation updates in the same PR as the feature they support

### 2. Code Reviews
- Review translation keys for consistency and clarity
- Ensure all new user-facing strings are marked for translation
- Verify that placeholders are used correctly

### 3. Continuous Integration
- Run the validation script as part of the CI pipeline
- Block merges with missing or invalid translations in production

## Localization Testing

To test a specific language:

1. Change your browser's language preference
2. Use the language selector in the UI
3. Verify that:
   - All text appears in the correct language
   - Dates, numbers, and currencies are formatted correctly
   - Text direction is appropriate for the language
   - No untranslated strings appear

## Adding a New Language (Detailed)

1. Add the language to `i18n.js` in the `languages` object
2. Create a new directory in `web/i18n/locales/` with the language code
3. Copy the English translation file as a starting point
4. Translate all strings, keeping the same structure
5. Test the language thoroughly before deployment

## Performance Considerations

- Only load the current language's translation file
- Lazy load additional languages as needed
- Consider using language packs for large applications
- Cache translation files in the browser for better performance

## Troubleshooting

### 1. Translations Not Updating
- Clear your browser cache
- Ensure the translation files were built and deployed correctly
- Check the browser's network tab for failed requests

### 2. Console Errors
- Check for 404 errors when loading translation files
- Look for syntax errors in the JSON files
- Verify that the i18n initialization completed successfully

## Getting Help

For translation-related issues, contact:
- Development Team: [team-email@example.com](mailto:team-email@example.com)
- Translation Coordinator: [translations@example.com](mailto:translations@example.com)

---

Last Updated: September 18, 2025
