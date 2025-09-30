// Utility script to update the navigation bar in all HTML files
const fs = require('fs');
const path = require('path');

const htmlFiles = [
  'index.html',
  'login.html',
  'dashboard.html',
  'profile.html',
  'privacy.html',
  'terms.html',
  'imprint.html',
  'reset-password.html',
  'admin/stats.html'
];

const navTemplate = `
  <div class="topbar">
    <div class="brand">
      <a href="/" class="link-unstyled">SoulTribe.chat</a>
    </div>
    <div class="actions">
      <select id="language-selector" class="language-selector" aria-label="Select language">
        <option value="de">DE Deutsch</option>
        <option value="en">EN English</option>
        <option value="es">ES Español</option>
        <option value="fr">FR Français</option>
        <option value="it">IT Italiano</option>
        <option value="pt">PT Português</option>
        <option value="nl">NL Nederlands</option>
        <option value="sv">SV Svenska</option>
        <option value="no">NO Norsk</option>
        <option value="da">DA Dansk</option>
        <option value="fi">FI Suomi</option>
        <option value="pl">PL Polski</option>
        <option value="cs">CS Čeština</option>
        <option value="hu">HU Magyar</option>
        <option value="ro">RO Română</option>
        <option value="bg">BG Български</option>
        <option value="el">EL Ελληνικά</option>
        <option value="ru">RU Русский</option>
        <option value="uk">UK Українська</option>
        <option value="tr">TR Türkçe</option>
        <option value="ar">AR العربية</option>
        <option value="he">HE עברית</option>
        <option value="fa">FA فارسی</option>
        <option value="hi">HI हिन्दी</option>
        <option value="bn">BN বাংলা</option>
        <option value="zh">ZH 中文</option>
        <option value="ja">JA 日本語</option>
        <option value="ko">KO 한국어</option>
      </select>
      <a id="btn-login-link" class="button secondary" href="/login.html">Login</a>
      <a id="btn-dashboard-link" class="button" href="/dashboard.html">Dashboard</a>
      <a id="btn-admin-link" class="button secondary" href="/admin/stats.html" style="display:none;">Admin</a>
    </div>
  </div>`;

function updateNavInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = content.replace(
      /<div class="topbar">[\s\S]*?<\/div>\s*<\/div>/,
      navTemplate
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated navigation in ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Process all HTML files
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    updateNavInFile(filePath);
  } else {
    console.log(`Skipping non-existent file: ${filePath}`);
  }
});

console.log('Navigation update complete!');
