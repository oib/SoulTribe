#!/usr/bin/env node
/*
Add/Update dashboard.active_filter_hint across all locales.
Curated translations for many EU languages. Others default to English.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'web', 'i18n', 'locales');

const EN = 'Only users active in the last 30 days are shown.';

const MAP = {
  en: EN,
  de: 'Es werden nur Nutzer angezeigt, die in den letzten 30 Tagen aktiv waren.',
  es: 'Solo se muestran los usuarios activos en los últimos 30 días.',
  fr: 'Seuls les utilisateurs actifs au cours des 30 derniers jours sont affichés.',
  it: 'Sono mostrati solo gli utenti attivi negli ultimi 30 giorni.',
  pt: 'Apenas os utilizadores ativos nos últimos 30 dias são mostrados.',
  nl: 'Alleen gebruikers die de afgelopen 30 dagen actief waren worden weergegeven.',
  pl: 'Wyświetlani są tylko użytkownicy aktywni w ciągu ostatnich 30 dni.',
  cs: 'Zobrazují se pouze uživatelé, kteří byli aktivní za posledních 30 dní.',
  sk: 'Zobrazujú sa iba používatelia aktívni za posledných 30 dní.',
  sl: 'Prikazani so le uporabniki, ki so bili aktivni v zadnjih 30 dneh.',
  hr: 'Prikazuju se samo korisnici aktivni u posljednjih 30 dana.',
  ro: 'Sunt afișați doar utilizatorii activi în ultimele 30 de zile.',
  hu: 'Csak az elmúlt 30 napban aktív felhasználók jelennek meg.',
  bg: 'Показват се само потребители, активни през последните 30 дни.',
  el: 'Εμφανίζονται μόνο χρήστες που ήταν ενεργοί τις τελευταίες 30 ημέρες.',
  da: 'Kun brugere, der har været aktive inden for de sidste 30 dage, vises.',
  no: 'Bare brukere som har vært aktive de siste 30 dagene vises.',
  sv: 'Endast användare som varit aktiva de senaste 30 dagarna visas.',
  fi: 'Vain viimeisten 30 päivän aikana aktiiviset käyttäjät näytetään.',
  et: 'Kuvatakse ainult kasutajaid, kes on olnud viimase 30 päeva jooksul aktiivsed.',
  lv: 'Tiek rādīti tikai lietotāji, kuri pēdējo 30 dienu laikā bijuši aktīvi.',
  lt: 'Rodomi tik per pastarąsias 30 dienų buvę aktyvūs naudotojai.',
  mt: 'Juru biss l-utenti li kienu attivi fl-aħħar 30 jum.',
  ga: 'Ní thaispeántar ach úsáideoirí a bhí gníomhach le 30 lá anuas.',
  ru: 'Показываются только пользователи, активные за последние 30 дней.',
  uk: 'Показуються лише користувачі, які були активні за останні 30 днів.',
  tr: 'Son 30 gün içinde aktif olan kullanıcılar gösterilir.'
};

function updateFile(file, code){
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    if (!json.dashboard) json.dashboard = {};
    const val = MAP[code] || EN;
    json.dashboard.active_filter_hint = val;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
    console.log('Updated', path.relative(ROOT, file));
  } catch (e) {
    console.error('Failed', file, e.message);
  }
}

function main(){
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const code = dirent.name;
    const file = path.join(LOCALES_DIR, code, 'translation.json');
    if (!fs.existsSync(file)) continue;
    updateFile(file, code);
  }
}

main();
