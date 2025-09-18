// Simple vanilla JS i18n implementation
window.SimpleI18n = {
  currentLang: 'en',
  translations: {},
  
  // Available languages with their display names
  languages: {
    // Western & Central Europe
    'en': 'English',
    'de': 'Deutsch',
    'fr': 'Français',
    'es': 'Español',
    'it': 'Italiano',
    'pt': 'Português',
    'nl': 'Nederlands',
    'sv': 'Svenska',
    'no': 'Norsk',
    'da': 'Dansk',
    'fi': 'Suomi',
    'is': 'Íslenska',
    'ga': 'Gaeilge',
    'cy': 'Cymraeg',
    'mt': 'Malti',
    'lb': 'Lëtzebuergesch',
    'ca': 'Català',
    'gl': 'Galego',
    'eu': 'Euskara',
    // Eastern & Southeastern Europe
    'pl': 'Polski',
    'cs': 'Čeština',
    'sk': 'Slovenčina',
    'hu': 'Magyar',
    'ro': 'Română',
    'bg': 'Български',
    'hr': 'Hrvatski',
    'sr': 'Српски',
    'sl': 'Slovenščina',
    'mk': 'Македонски',
    'sq': 'Shqip',
    'bs': 'Bosanski',
    'et': 'Eesti',
    'lv': 'Latviešu',
    'lt': 'Lietuvių',
    'el': 'Ελληνικά',
    'tr': 'Türkçe',
    'ru': 'Русский',
    'uk': 'Українська',
    'be': 'Беларуская'
  },

  async init() {
    // Load saved language or detect from browser
    const saved = localStorage.getItem('selectedLanguage');
    const detected = navigator.language?.split('-')[0] || 'en';
    this.currentLang = saved || (this.languages[detected] ? detected : 'en');
    
    // Load translations for current language
    await this.loadTranslations(this.currentLang);
    // Ensure English baseline is available for fallback
    if (this.currentLang !== 'en' && !this.translations['en']) {
      await this.loadTranslations('en');
    }
    // Initial UI sync
    try { this.updateUI(); } catch {}
    return this;
  },

  async loadTranslations(lang) {
    try {
      // In development (localhost/127.0.0.1), add cache-busting to avoid stale JSON
      const base = `/i18n/locales/${lang}/translation.json`;
      let url = base;
      try {
        const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
        if (host === 'localhost' || host === '127.0.0.1') {
          url = `${base}?v=${Date.now()}`;
        }
      } catch {}
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (response.ok) {
        this.translations[lang] = await response.json();
      }
    } catch (e) {
      console.warn(`Failed to load translations for ${lang}:`, e);
    }
  },

  async changeLanguage(lang) {
    if (lang !== this.currentLang) {
      this.currentLang = lang;
      localStorage.setItem('selectedLanguage', lang);
      if (!this.translations[lang]) {
        await this.loadTranslations(lang);
      }
      // Keep English loaded for fallback
      if (!this.translations['en']) {
        await this.loadTranslations('en');
      }
      this.updateUI();
    }
  },

  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value !== 'undefined') return value;
    // Fallback to English
    let fallback = this.translations['en'];
    for (const k of keys) {
      fallback = fallback?.[k];
    }
    return (typeof fallback !== 'undefined') ? fallback : key;
  },

  updateUI() {
    try { document.documentElement.setAttribute('lang', this.currentLang || 'en'); } catch {}
    // Update inner text for elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    // Update inner HTML for elements with data-i18n-html (use cautiously)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const html = this.t(key);
      if (typeof html === 'string') {
        el.innerHTML = html;
      }
    });
    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = this.t(key);
      if (val && typeof el.setAttribute === 'function') el.setAttribute('placeholder', val);
    });
    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = this.t(key);
      if (val && typeof el.setAttribute === 'function') el.setAttribute('title', val);
    });
    
    // Emit language change event
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: this.currentLang } 
    }));
  }
};
