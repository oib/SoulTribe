#!/usr/bin/env node
/*
Add missing dashboard i18n keys across all locales with English placeholders (Option A).
Keys added under "dashboard":
- propose_time: "Propose time"
- generate_ai_comment: "Generate AI comment"
- slot_delete: "Delete"
- slot_edit: "Edit"

Usage: node dev/translations/scripts/add-dashboard-keys.js
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const LOCALES_DIR = path.join(ROOT, 'web', 'i18n', 'locales');

const KEYS = {
  propose_time: 'Propose time',
  generate_ai_comment: 'Generate AI comment',
  slot_delete: 'Delete',
  slot_edit: 'Edit',
};

function processFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    if (!json.dashboard || typeof json.dashboard !== 'object') {
      json.dashboard = {};
    }
    let changed = false;
    for (const [k, v] of Object.entries(KEYS)) {
      if (typeof json.dashboard[k] === 'undefined') {
        json.dashboard[k] = v; // English placeholder (Option A)
        changed = true;
      }
    }
    if (changed) {
      const pretty = JSON.stringify(json, null, 2) + '\n';
      fs.writeFileSync(file, pretty, 'utf8');
      console.log('Updated', path.relative(ROOT, file));
    } else {
      console.log('No change', path.relative(ROOT, file));
    }
  } catch (e) {
    console.error('Failed', file, e.message);
  }
}

function main() {
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const p = path.join(LOCALES_DIR, dirent.name, 'translation.json');
    if (fs.existsSync(p)) processFile(p);
  }
}

main();
