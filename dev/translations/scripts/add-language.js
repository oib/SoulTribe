#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readline = require('readline');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function addLanguage() {
  try {
    // Get language code and name from command line arguments
    const langCode = process.argv[2];
    const langName = process.argv[3];

    if (!langCode || !langName) {
      console.error('Usage: node dev/translations/scripts/add-language.js <language-code> "<language-name>"');
      console.error('Example: node dev/translations/scripts/add-language.js fr "French"');
      process.exit(1);
    }

    const translationsDir = path.join(__dirname, '../../../src/frontend/i18n/locales');
    const newLangDir = path.join(translationsDir, langCode);
    const enDir = path.join(translationsDir, 'en');
    
    // Check if the language already exists
    if (fs.existsSync(newLangDir)) {
      console.error(`Language ${langCode} already exists.`);
      process.exit(1);
    }

    // Create the language directory
    await mkdir(newLangDir, { recursive: true });
    console.log(`Created directory: ${newLangDir}`);

    // Get the English translation as a template
    const enTranslation = require(path.join(enDir, 'translation.json'));
    
    // Create a new translation file with [TODO] placeholders
    const newTranslation = addTodoPlaceholders(enTranslation);
    
    // Write the new translation file
    const translationPath = path.join(newLangDir, 'translation.json');
    await writeFile(
      translationPath, 
      JSON.stringify(newTranslation, null, 2) + '\n',
      'utf8'
    );
    
    console.log(`Created translation file: ${translationPath}`);
    
    // Update the i18n.js file to include the new language
    await updateI18nConfig(langCode, langName);
    
    console.log(`\nSuccessfully added ${langName} (${langCode}) to the application.`);
    console.log('Next steps:');
    console.log(`1. Edit ${translationPath} to add translations`);
    console.log('2. Test the language in the application');
    console.log('3. Commit the changes to version control');
    
  } catch (error) {
    console.error('Error adding language:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function addTodoPlaceholders(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = addTodoPlaceholders(value);
    } else {
      result[key] = `[TODO] ${value || key.split('.').pop()}`;
    }
  }
  return result;
}

async function updateI18nConfig(langCode, langName) {
  const i18nPath = path.join(__dirname, '../../../src/frontend/i18n/i18n.js');
  let content = await readFile(i18nPath, 'utf8');
  
  // Find the languages object in the i18n.js file
  const langRegex = /languages:\s*\{([^}]*)\}/s;
  const match = content.match(langRegex);
  
  if (match) {
    const languagesBlock = match[1].trim();
    const newLangEntry = `\n    '${langCode}': '${langName}',`;
    
    // Add the new language to the languages object
    const updatedLanguagesBlock = languagesBlock + newLangEntry;
    content = content.replace(langRegex, `languages: {${updatedLanguagesBlock}\n  }`);
    
    await writeFile(i18nPath, content, 'utf8');
    console.log(`Updated i18n.js with ${langName} (${langCode})`);
  } else {
    console.warn('Could not find languages object in i18n.js. Please add the language manually.');
  }
}

// Run the script
addLanguage();
