# Translation Needs

This document lists all UI elements that need to be internationalized in the SoulTribe.chat application.

## Implemented

- Imprint Page (`/imprint.html`): navigation links, page heading, footer links are now wired with `data-i18n` and strings added to `web/i18n/locales/en/translation.json` under `nav.*`, `imprint.title`, and `footer.*`. i18n is initialized on the page.
- Reset Password Page (`/reset-password.html`): heading, intro text, labels/placeholders, and submit button now use `data-i18n` / `data-i18n-placeholder`. Keys added under `reset_password.*`. i18n is initialized on the page.

## Imprint Page (`/imprint.html`)

### Headers & Text
- Page title: "Imprint • SoulTribe.chat"
- Main heading: "Imprint" (implemented: `imprint.title`)
- Address section labels (currently hardcoded in English)

### Buttons & Links
- "Welcome" button in top navigation (implemented: `nav.welcome`)
- "Dashboard" button in top navigation (implemented: `nav.dashboard`)
- Footer links: "Terms", "Privacy", "Imprint" (implemented: `footer.terms`, `footer.privacy`, `footer.imprint`)

## Reset Password Page (`/reset-password.html`)

### Headers & Text
- Page title
- "Reset Password" heading (implemented: `reset_password.title`)
- "Choose a new password for your account" description (implemented: `reset_password.intro`)
- Input labels and placeholders:
  - "New password" (implemented: `reset_password.new_password_label`, `reset_password.new_password_placeholder`)
  - "Confirm new password" (implemented: `reset_password.confirm_password_label`, `reset_password.confirm_password_placeholder`)
- Button text: "Set new password" (implemented: `reset_password.submit`)

## Admin Pages (`/admin/*`)

### Stats Page (`/admin/stats.html`)
- Page title: "Admin Stats"
- Section headers: "Recent Activity", "Breakdown"
- Filter buttons: "Users", "Slots", "Matches", "Meetups", "Other", "Reset"

### Dev Console (`/admin/dev.html`)
- Page title: "SoulTribe.chat — Dev Console"
- Navigation links: "Welcome", "Login", "Dashboard", "Stats"
- Section headers: "Auth", "Profile", "Availability", "Match", "Meetup", "Output"
- All form labels and placeholders
- All button texts
- Status messages and tooltips

## Profile Page (`/profile.html`)

### Basic Information Section
- "Username" label
- Input placeholder: "username"

### Current Location Section
- Input placeholder: "Current city (autocomplete)"
- Button text: "Use my location"
- Timezone detection text: "Detected timezone:"

### Birth Information Section
- Section title: "Birth Information (for Astrology)"
- Input placeholder: "Birth date"
- Time selector labels: "Hour", "Minute"
- Timezone selector label
- "Unknown" option for birth time

### Radix Section
- Section title: "Your Radix"
- Placeholder text: "If you have set your birth data, your radix snapshot will appear here."

## Common Elements

### Buttons
- "Admin" button in top navigation
- "Use my location" button
- Various form submission buttons

### Form Elements
- All date/time pickers
- All select dropdowns without i18n support
- All tooltips and help text

## Recommendations

1. **Extract all hardcoded strings** from HTML files into translation JSON files
2. **Use consistent key naming** following the pattern: `page.section.element`
   - Example: `imprint.title`, `reset_password.form.new_password`
3. **Add ARIA labels** for accessibility in multiple languages
4. **Consider text expansion** - Some languages may require more space than English
5. **Test with RTL languages** if planning to support them

## Implementation Notes

1. For each page, create a new section in the translation files
2. Use the existing i18n system with `data-i18n` attributes
3. For dynamic content, use the JavaScript API: `SimpleI18n.t('key.path')`
4. Remember to update all language files when adding new keys

## Next Steps

1. Prioritize translating the most visible elements first (navigation, buttons, form labels)
2. Test the interface in different languages to catch any layout issues
3. Consider adding a language selector in the UI if not already present
4. Document the translation process for contributors
