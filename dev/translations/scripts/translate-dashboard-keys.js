#!/usr/bin/env node
/*
Replace English placeholders for dashboard keys with machine translations for remaining locales.
Keys:
- dashboard.propose_time
- dashboard.generate_ai_comment
- dashboard.slot_delete
- dashboard.slot_edit
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const LOCALES_DIR = path.join(ROOT, 'web', 'i18n', 'locales');

const TX = {
  bg: {
    propose_time: 'Предложи час',
    generate_ai_comment: 'Генерирай ИИ коментар',
    slot_delete: 'Изтрий',
    slot_edit: 'Редактирай',
  },
  cs: {
    propose_time: 'Navrhnout čas',
    generate_ai_comment: 'Vygenerovat komentář AI',
    slot_delete: 'Smazat',
    slot_edit: 'Upravit',
  },
  da: {
    propose_time: 'Foreslå tidspunkt',
    generate_ai_comment: 'Generér AI-kommentar',
    slot_delete: 'Slet',
    slot_edit: 'Rediger',
  },
  el: {
    propose_time: 'Πρότεινε ώρα',
    generate_ai_comment: 'Δημιούργησε σχόλιο AI',
    slot_delete: 'Διαγραφή',
    slot_edit: 'Επεξεργασία',
  },
  et: {
    propose_time: 'Paku aega',
    generate_ai_comment: 'Genereeri tehisaru kommentaar',
    slot_delete: 'Kustuta',
    slot_edit: 'Muuda',
  },
  fi: {
    propose_time: 'Ehdota aikaa',
    generate_ai_comment: 'Luo tekoälykommentti',
    slot_delete: 'Poista',
    slot_edit: 'Muokkaa',
  },
  ga: {
    propose_time: 'Mol am',
    generate_ai_comment: 'Gin trácht AI',
    slot_delete: 'Scrios',
    slot_edit: 'Cuir in eagar',
  },
  hr: {
    propose_time: 'Predloži vrijeme',
    generate_ai_comment: 'Generiraj AI komentar',
    slot_delete: 'Izbriši',
    slot_edit: 'Uredi',
  },
  hu: {
    propose_time: 'Időpont javaslata',
    generate_ai_comment: 'Mesterséges intelligencia megjegyzés készítése',
    slot_delete: 'Törlés',
    slot_edit: 'Szerkesztés',
  },
  lt: {
    propose_time: 'Pasiūlyti laiką',
    generate_ai_comment: 'Sugeneruoti DI komentarą',
    slot_delete: 'Ištrinti',
    slot_edit: 'Redaguoti',
  },
  lv: {
    propose_time: 'Piedāvāt laiku',
    generate_ai_comment: 'Ģenerēt MI komentāru',
    slot_delete: 'Dzēst',
    slot_edit: 'Rediģēt',
  },
  mt: {
    propose_time: 'Ipproponi ħin',
    generate_ai_comment: 'Iġġenera kumment AI',
    slot_delete: 'Ħassar',
    slot_edit: 'Editja',
  },
  nl: {
    propose_time: 'Tijd voorstellen',
    generate_ai_comment: 'Genereer AI-opmerking',
    slot_delete: 'Verwijderen',
    slot_edit: 'Bewerken',
  },
  no: {
    propose_time: 'Foreslå tidspunkt',
    generate_ai_comment: 'Generer KI-kommentar',
    slot_delete: 'Slett',
    slot_edit: 'Rediger',
  },
  pl: {
    propose_time: 'Zaproponuj godzinę',
    generate_ai_comment: 'Wygeneruj komentarz AI',
    slot_delete: 'Usuń',
    slot_edit: 'Edytuj',
  },
  pt: {
    propose_time: 'Propor hora',
    generate_ai_comment: 'Gerar comentário de IA',
    slot_delete: 'Eliminar',
    slot_edit: 'Editar',
  },
  ro: {
    propose_time: 'Propune oră',
    generate_ai_comment: 'Generează comentariu AI',
    slot_delete: 'Șterge',
    slot_edit: 'Editează',
  },
  ru: {
    propose_time: 'Предложить время',
    generate_ai_comment: 'Сгенерировать комментарий ИИ',
    slot_delete: 'Удалить',
    slot_edit: 'Редактировать',
  },
  sk: {
    propose_time: 'Navrhnúť čas',
    generate_ai_comment: 'Vygenerovať komentár AI',
    slot_delete: 'Vymazať',
    slot_edit: 'Upraviť',
  },
  sl: {
    propose_time: 'Predlagaj čas',
    generate_ai_comment: 'Ustvari komentar UI',
    slot_delete: 'Izbriši',
    slot_edit: 'Uredi',
  },
  sv: {
    propose_time: 'Föreslå tid',
    generate_ai_comment: 'Skapa AI-kommentar',
    slot_delete: 'Ta bort',
    slot_edit: 'Redigera',
  },
  tr: {
    propose_time: 'Zaman öner',
    generate_ai_comment: 'Yapay zeka yorumu oluştur',
    slot_delete: 'Sil',
    slot_edit: 'Düzenle',
  },
  uk: {
    propose_time: 'Запропонувати час',
    generate_ai_comment: 'Згенерувати коментар ШІ',
    slot_delete: 'Видалити',
    slot_edit: 'Редагувати',
  },
};

function processFile(file, code) {
  const tx = TX[code];
  if (!tx) return false;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    if (!json.dashboard || typeof json.dashboard !== 'object') json.dashboard = {};
    let changed = false;
    for (const [k, v] of Object.entries(tx)) {
      if (json.dashboard[k] !== v) {
        json.dashboard[k] = v;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      console.log('Translated', path.relative(ROOT, file));
    } else {
      console.log('No change', path.relative(ROOT, file));
    }
    return changed;
  } catch (e) {
    console.error('Failed', file, e.message);
    return false;
  }
}

function main() {
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const code = dirent.name;
    const file = path.join(LOCALES_DIR, code, 'translation.json');
    if (!fs.existsSync(file)) continue;
    // Skip languages we already curated (en, de, es, fr, it)
    if (["en","de","es","fr","it"].includes(code)) { console.log('Skip curated', code); continue; }
    processFile(file, code);
  }
}

main();
