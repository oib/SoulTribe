#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Configuration
const SOURCE_DIRS = ['src/frontend/pages', 'src/frontend/js'];
const OUTPUT_FILE = path.join(__dirname, '../../src/frontend/i18n/translation-keys.json');
const EXCLUDE_PATTERNS = ['**/node_modules/**', '**/i18n/**', '**/*.min.js'];

// Regular expressions to find translation keys
const REGEXES = [
  // data-i18n attributes
  /data-i18n=["']([^"'\s]+)["']/g,
  // SimpleI18n.t() calls
  /SimpleI18n\.t\(['"]([^"']+)['"]/g,
  // i18next.t() calls
  /i18next\.t\(['"]([^"']+)['"]/g,
];

async function extractStrings() {
  const keys = new Set();
  
  // Process all relevant files
  for (const dir of SOURCE_DIRS) {
    const files = await glob(`${dir}/**/*.{js,jsx,ts,tsx,html}`, { 
      ignore: EXCLUDE_PATTERNS,
      nodir: true,
      absolute: true 
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Apply all regex patterns
        for (const regex of REGEXES) {
          let match;
          while ((match = regex.exec(content)) !== null) {
            const key = match[1];
            // Skip empty keys and template literals
            if (key && !key.includes('${')) {
              keys.add(key);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }
  }

  // Convert to a sorted array
  const sortedKeys = Array.from(keys).sort();
  
  // Create a nested object structure
  const result = {};
  for (const key of sortedKeys) {
    const parts = key.split('.');
    let current = result;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      
      if (isLast) {
        current[part] = ''; // Empty string as placeholder
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  // Write the result to a file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Extracted ${sortedKeys.length} translation keys to ${OUTPUT_FILE}`);
}

// Run the extraction
extractStrings().catch(console.error);
