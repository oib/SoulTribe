// Simple vanilla JS i18n implementation
window.SimpleI18n = {
  currentLang: 'en',
  translations: {},
  _ready: false,
  
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
    this._ready = false;
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
    // Deep-merge missing keys from English into the active language to avoid early missing-key logs
    try {
      if (this.currentLang !== 'en' && this.translations['en'] && this.translations[this.currentLang]) {
        const deepMergeMissing = (target, fallback) => {
          for (const k of Object.keys(fallback)) {
            const fval = fallback[k];
            const tval = target[k];
            if (tval === undefined) {
              target[k] = fval;
            } else if (typeof tval === 'object' && tval && typeof fval === 'object' && fval) {
              deepMergeMissing(tval, fval);
            }
          }
        };
        deepMergeMissing(this.translations[this.currentLang], this.translations['en']);
      }
    } catch {}
    // Initial UI sync
    try { this._ready = true; this.updateUI(); } catch { this._ready = true; }
    return this;
  },

  // Track which languages have been checked for availability
  availableLanguages: {},
  
  // Predefined list of languages we know we have translations for
  // This will be populated on first load
  supportedLanguages: null,
  
  async detectSupportedLanguages() {
    if (this.supportedLanguages) return this.supportedLanguages;
    
    // Default set of all available languages
    const defaultSupported = [
      'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et',
      'fi', 'fr', 'ga', 'hr', 'hu', 'it', 'lt', 'lv',
      'mt', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk',
      'sl', 'sv', 'tr', 'uk'
    ];
    
    // In a browser environment, we can check which translations exist
    if (typeof fetch === 'function') {
      try {
        const response = await fetch('/i18n/available-languages.json');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            this.supportedLanguages = data;
            return data;
          }
        }
      } catch (e) {
        console.warn('Could not load available languages list, using defaults', e);
      }
    }
    
    // Fall back to the default list if we couldn't load the manifest
    this.supportedLanguages = defaultSupported;
    return defaultSupported;
  },
  
  async loadTranslations(lang) {
    // Don't reload if already loaded
    if (this.translations[lang]) {
      return true;
    }
    
    // Check if we know this language is not available
    if (this.availableLanguages[lang] === false) {
      return false;
    }
    
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
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache', // Ensure we're not getting a cached version
        // Add a timeout to avoid hanging on missing files
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : null
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object') {
          // Normalize structure for known schema differences (e.g., arrays vs keyed items)
          const normalized = this.normalizeTranslations(data);
          this.translations[lang] = normalized;
          this.availableLanguages[lang] = true;
          console.log(`Successfully loaded translations for ${lang}`);
          return true;
        } else {
          console.warn(`Invalid translation data for ${lang}:`, data);
          this.availableLanguages[lang] = false;
        }
      } else if (response.status === 404) {
        console.warn(`No translations available for language: ${lang}`);
        this.availableLanguages[lang] = false;
      } else {
        console.warn(`Failed to load translations for ${lang}: ${response.status} ${response.statusText}`);
        this.availableLanguages[lang] = false;
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        console.warn(`Timeout loading translations for ${lang}`);
      } else {
        console.warn(`Error loading translations for ${lang}:`, e);
      }
      this.availableLanguages[lang] = false;
    }
    
    return false;
  },

  // Normalize translation object (handle array-based sections to keyed items)
  normalizeTranslations(obj) {
    try {
      const out = JSON.parse(JSON.stringify(obj)); // shallow clone
      // Helper to combine title + description into a single HTML string
      const combine = (item) => {
        if (item && typeof item === 'object') {
          const t = item.title || '';
          const d = item.description || '';
          if (t && d) return `<strong>${t}</strong> — ${d}`;
          if (t) return String(t);
          if (d) return String(d);
          return '';
        }
        return typeof item === 'string' ? item : '';
      };

      // Map landing.features.items[] -> landing.features.item1..itemN (as strings)
      try {
        const items = out?.landing?.features?.items;
        if (Array.isArray(items) && items.length) {
          if (!out.landing.features) out.landing.features = {};
          items.forEach((val, idx) => {
            out.landing.features[`item${idx+1}`] = combine(val);
          });
          // Keep original items for backward compat, but keyed entries will be read by UI
        }
      } catch {}

      // Map alternative schema: landing.howItWorks.steps[] -> landing.how.stepN
      try {
        const hiw = out?.landing?.howItWorks;
        if (hiw && Array.isArray(hiw.steps) && hiw.steps.length) {
          if (!out.landing.how) out.landing.how = {};
          if (hiw.title && !out.landing.how.title) out.landing.how.title = hiw.title;
          hiw.steps.forEach((val, idx) => {
            out.landing.how[`step${idx+1}`] = combine(val);
          });
        }
      } catch {}

      // If landing.how.steps[] exists (object array), normalize to stepN strings
      try {
        const how = out?.landing?.how;
        if (how && Array.isArray(how.steps) && how.steps.length) {
          how.steps.forEach((val, idx) => {
            how[`step${idx+1}`] = combine(val);
          });
        }
      } catch {}

      // Normalize privacy: if description/learnMore exist but item1.. are missing, map them
      try {
        const priv = out?.landing?.privacy;
        if (priv && typeof priv === 'object') {
          const hasItems = priv.item1 || priv.item2 || priv.item3;
          if (!hasItems) {
            if (priv.description && !priv.item1) priv.item1 = String(priv.description);
            if (priv.learnMore && !priv.item2) priv.item2 = String(priv.learnMore);
          }
        }
      } catch {}
      return out;
    } catch {
      return obj;
    }
  },

  async changeLanguage(lang) {
    if (!this.languages[lang]) {
      console.warn(`Language '${lang}' is not supported.`);
      return false;
    }
    
    if (lang === this.currentLang) {
      return true;
    }
    
    const previousLang = this.currentLang;
    
    try {
      // Set the new language
      this.currentLang = lang;
      localStorage.setItem('selectedLanguage', lang);
      
      // Try to load the selected language
      const loaded = await this.loadTranslations(lang);
      
      // If loading failed and it's not English, try English as fallback
      if (!loaded && lang !== 'en') {
        console.warn(`Failed to load translations for '${lang}'. Falling back to English.`);
        this.currentLang = 'en';
        await this.loadTranslations('en');
      }
      
      // Ensure English is loaded for fallback
      if (this.currentLang !== 'en' && !this.translations['en']) {
        await this.loadTranslations('en');
      }

      // After both are available, deep-merge missing keys from English into the active language
      try {
        if (this.currentLang !== 'en' && this.translations['en'] && this.translations[this.currentLang]) {
          const deepMergeMissing = (target, fallback) => {
            for (const k of Object.keys(fallback)) {
              const fval = fallback[k];
              const tval = target[k];
              if (tval === undefined) {
                target[k] = fval;
              } else if (typeof tval === 'object' && tval && typeof fval === 'object' && fval) {
                deepMergeMissing(tval, fval);
              }
            }
          };
          deepMergeMissing(this.translations[this.currentLang], this.translations['en']);
        }
      } catch {}
      
      // Update the UI with the new language
      this._ready = true;
      this.updateUI();
      
      // Dispatch language change event
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { 
          language: this.currentLang,
          previousLanguage: previousLang,
          success: loaded || this.currentLang === 'en'
        }
      }));
      
      return true;
      
    } catch (error) {
      console.error('Error changing language:', error);
      this.currentLang = previousLang;
      
      // Notify about the error
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { 
          language: this.currentLang,
          previousLanguage: previousLang,
          success: false,
          error: error.message
        }
      }));
      
      return false;
    }
  },

  t(key) {
    const keys = key.split('.');
    
    // Try current language first
    let value = this.translations[this.currentLang];
    let current = value;
    for (const k of keys) {
      current = current?.[k];
    }
    if (typeof current !== 'undefined') return current;
    
    // If not found in current language, try English
    if (this.currentLang !== 'en') {
      current = this.translations['en'];
      for (const k of keys) {
        current = current?.[k];
      }
      if (typeof current !== 'undefined') return current;
    }
    
    // If still not found, return the key as fallback
    // Suppress early warnings until languages are loaded
    const hasCurrent = !!this.translations[this.currentLang];
    const hasEn = !!this.translations['en'];
    if (this._ready && (hasCurrent || hasEn)) {
      console.warn(`Missing translation for key: ${key} in language: ${this.currentLang}`);
    }
    return key;
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
