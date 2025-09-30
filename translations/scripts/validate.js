#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

// Configuration
const TRANSLATIONS_DIR = path.join(__dirname, '../../web/i18n/locales');
const REFERENCE_LANG = 'en';

async function validateTranslations() {
  try {
    // Read all language directories
    const langDirs = (await readdir(TRANSLATIONS_DIR, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    if (langDirs.length === 0) {
      console.error('No language directories found.');
      process.exit(1);
    }

    // Read reference (English) translations
    const refPath = path.join(TRANSLATIONS_DIR, REFERENCE_LANG, 'translation.json');
    const refTranslations = JSON.parse(await readFile(refPath, 'utf8'));
    
    console.log(`Validating translations against ${REFERENCE_LANG} (${refPath})`);
    console.log('='.repeat(80));

    // Validate each language
    for (const lang of langDirs) {
      if (lang === REFERENCE_LANG) continue;
      
      const langPath = path.join(TRANSLATIONS_DIR, lang, 'translation.json');
      const langTranslations = JSON.parse(await readFile(langPath, 'utf8'));
      
      console.log(`\nValidating ${lang}:`);
      
      // Check for missing or extra keys
      const { missing, extra, todo } = compareTranslations(refTranslations, langTranslations, lang);
      
      // Report results
      if (missing.length > 0) {
        console.log(`\n  ❌ Missing ${missing.length} translation(s):`);
        missing.forEach(key => console.log(`    - ${key}`));
      }
      
      if (extra.length > 0) {
        console.log(`\n  ⚠️  Found ${extra.length} extra translation(s) (not in ${REFERENCE_LANG}):`);
        extra.forEach(key => console.log(`    - ${key}`));
      }
      
      if (todo.length > 0) {
        console.log(`\n  🔄 Found ${todo.length} TODO translation(s):`);
        todo.forEach(key => console.log(`    - ${key}`));
      }
      
      if (missing.length === 0 && extra.length === 0 && todo.length === 0) {
        console.log('  ✅ All translations are valid and complete!');
      }
    }
    
    console.log('\nValidation complete.');
    
  } catch (error) {
    console.error('Error validating translations:', error);
    process.exit(1);
  }
}

function compareTranslations(ref, trans, lang, prefix = '') {
  const missing = [];
  const extra = [];
  const todo = [];
  
  // Check for missing or TODO translations
  for (const [key, value] of Object.entries(ref)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (!(key in trans)) {
      missing.push(fullKey);
    } else if (typeof value === 'object') {
      // Recurse into nested objects
      const subResult = compareTranslations(
        value, 
        trans[key], 
        lang, 
        fullKey
      );
      
      missing.push(...subResult.missing);
      extra.push(...subResult.extra);
      todo.push(...subResult.todo);
    } else if (typeof trans[key] === 'string' && 
              (trans[key].startsWith('[TODO]') || trans[key].startsWith('TODO:'))) {
      todo.push(fullKey);
    }
  }
  
  // Check for extra keys (in translation but not in reference)
  for (const key of Object.keys(trans)) {
    if (!(key in ref)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      extra.push(fullKey);
    }
  }
  
  return { missing, extra, todo };
}

// Run the validation
validateTranslations();
