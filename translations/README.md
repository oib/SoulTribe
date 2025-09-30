# Translation Management System (TMS)

This directory contains tools and scripts to manage translations for the SoulTribe.chat application.

## Directory Structure

- `locales/` - Contains all translation files by language code (e.g., `en/translation.json`)
- `scripts/` - Utility scripts for managing translations
- `templates/` - Template files for new translations

## Available Scripts

### 1. Extract Strings

Extract all translatable strings from the source code:

```bash
node translations/scripts/extract-strings.js
```

### 2. Add New Language

Create a new translation file for a language:

```bash
node translations/scripts/add-language.js <language-code> <language-name>
```

Example:
```bash
node translations/scripts/add-language.js fr "French"
```

### 3. Validate Translations

Check for missing or invalid translations:

```bash
node translations/scripts/validate.js
```

## Translation Guidelines

1. Always use the English version as the source of truth
2. Keep the same structure in all translation files
3. Use placeholders like `{{variable}}` for dynamic content
4. Keep translations concise and natural in the target language
5. Test the UI after making changes to ensure proper rendering

## Adding New Strings

1. Add the new string to the English translation file first
2. Add the same key to all other language files with a `[TODO]` prefix
3. Notify translators about the new strings

## Best Practices

- Keep translations simple and clear
- Avoid hardcoded strings in the source code
- Use consistent terminology across the application
- Consider cultural differences in expressions and formats
- Test with different text lengths as translations may vary in size
