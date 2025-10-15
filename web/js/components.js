/**
 * Components Initialization
 * Handles loading and initializing all UI components
 */

// Function to initialize all components
async function initializeComponents() {
  try {
    console.log('Initializing components...');
    // Ensure i18n is initialized before rendering components to avoid missing-key flashes
    try {
      if (window.SimpleI18n) {
        // If no translations loaded for currentLang, init
        const cur = window.SimpleI18n.currentLang || 'en';
        const hasCur = !!(window.SimpleI18n.translations && window.SimpleI18n.translations[cur]);
        if (!hasCur) {
          await window.SimpleI18n.init();
        }
      }
    } catch (e) { console.warn('i18n init in components failed (continuing):', e); }
    
    // Load components first
    await loadComponents();
    
    // Initialize mobile menu
    initMobileMenu();
    
    // Initialize language selectors (both in navbar and footer)
    initLanguageSelector('language-selector');
    initLanguageSelector('footer-language-selector');
    
    console.log('Components initialized');
  } catch (error) {
    console.error('Error initializing components:', error);
  }
}

// Initialize components when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
  // DOMContentLoaded has already fired
  initializeComponents();
}

// Listen for component loaded events
document.addEventListener('componentLoaded', (event) => {
  console.log(`Component loaded: ${event.detail.component}`);
  
  if (event.detail.component === 'navbar') {
    // Re-initialize mobile menu if navbar was just loaded
    initMobileMenu();
    initLanguageSelector('language-selector');
  }
});

/**
 * Loads HTML components into elements with data-component attribute
 */
async function loadComponents() {
  const components = document.querySelectorAll('[data-component]');
  
  for (const component of components) {
    const componentName = component.getAttribute('data-component');
    console.log(`Loading component: ${componentName}`);
    
    try {
      // Add a cache-busting query param to ensure latest component markup is fetched
      const cacheBust = (window.APP_BUILD_VERSION || Date.now());
      const response = await fetch(`/components/${componentName}.html?v=${cacheBust}`);
      if (!response.ok) {
        throw new Error(`Failed to load component: ${componentName}`);
      }
      
      const html = await response.text();
      
      // Only update if we got content
      if (html && html.trim()) {
        component.innerHTML = html;
        console.log(`Successfully loaded component: ${componentName}`);
        
        // Ensure any <script> tags inside the loaded component execute
        const scriptTags = component.querySelectorAll('script');
        scriptTags.forEach(oldScript => {
          const newScript = document.createElement('script');
          // Copy attributes (e.g., src, type)
          for (const attr of oldScript.attributes) {
            newScript.setAttribute(attr.name, attr.value);
          }
          // Inline script content
          if (!oldScript.src) {
            newScript.textContent = oldScript.textContent;
          }
          // Replace script to trigger execution
          oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        // Localize any new nodes introduced by this component
        try {
          if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') {
            window.SimpleI18n.updateUI();
          }
        } catch {}

        // Dispatch an event that this component was loaded
        component.dispatchEvent(new CustomEvent('componentLoaded', {
          detail: { component: componentName, element: component }
        }));
        
        // Initialize specific component features
        if (componentName === 'navbar') {
          initMobileMenu();
          initLanguageSelector('language-selector');
          // Update auth-driven UI if available (defined in navbar component script)
          if (typeof window.updateNavbarAuthUI === 'function') {
            try { window.updateNavbarAuthUI(); } catch (e) { console.warn('updateNavbarAuthUI error:', e); }
          } else if (typeof window.updateAuthState === 'function') {
            // Fallback to page-level updater
            try { window.updateAuthState(); } catch (e) { console.warn('updateAuthState error:', e); }
          }
        } else if (componentName === 'footer') {
          initLanguageSelector('footer-language-selector');
        }
      } else {
        console.warn(`Empty component: ${componentName}`);
        component.innerHTML = `<!-- Empty component: ${componentName} -->`;
      }
    } catch (error) {
      console.error(`Error loading component ${componentName}:`, error);
      component.innerHTML = `<!-- Error loading component: ${componentName} -->`;
    }
  }
}

/**
 * Initialize mobile menu toggle
 */
function initMobileMenu() {
  const toggle = document.querySelector('.navbar-toggle');
  const menu = document.querySelector('.navbar-menu');
  const closeBtn = document.querySelector('.navbar-menu-close');
  
  if (toggle && menu) {
    if (toggle.dataset.bound === 'true') return;

    const closeMenu = () => {
      menu.classList.remove('active');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('navbar-menu-open');
    };

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('active');
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.classList.toggle('navbar-menu-open', isOpen);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeMenu());
    }

    menu.querySelectorAll('a, button').forEach((item) => {
      item.addEventListener('click', () => closeMenu());
    });

    toggle.dataset.bound = 'true';
  }
}

/**
 * Initialize language selector
 * @param {string} selectorId - The ID of the language selector element
 */
async function initLanguageSelector(selectorId) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;
  
  // Track if we're currently changing the language
  let isChangingLanguage = false;
  
  // Function to update the language selector options with only available languages
  async function updateLanguageSelector() {
    if (!selector || !window.SimpleI18n) return;
    
    // Get the list of supported languages
    const supportedLangs = await window.SimpleI18n.detectSupportedLanguages();
    const currentLang = window.SimpleI18n.currentLang || 'en';
    
    // Filter languages to only include supported ones
    const availableLanguages = Object.entries(window.SimpleI18n.languages || {})
      .filter(([code]) => supportedLangs.includes(code));
    
    if (availableLanguages.length === 0) {
      // Fallback to English if no languages are available
      selector.innerHTML = `<option value="en" selected>English</option>`;
      return;
    }
    
    // Sort languages alphabetically by name (case-insensitive, locale-aware)
    availableLanguages.sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
    
    // Generate options
    selector.innerHTML = availableLanguages
      .map(([code, name]) => {
        const displayName = name;
        return `<option value="${code}" ${code === currentLang ? 'selected' : ''}>${displayName}</option>`;
      })
      .join('');
  }
  
  // Initial population of the selector
  await updateLanguageSelector();
  
  // Handle language changes from the selector
  selector.addEventListener('change', async (e) => {
    if (isChangingLanguage) return;
    
    const selectedLang = e.target.value;
    const previousLang = window.SimpleI18n?.currentLang;
    
    if (!selectedLang || selectedLang === previousLang) {
      return;
    }
    
    isChangingLanguage = true;
    // Disable all language selectors during change
    document.querySelectorAll('.language-selector').forEach(s => {
      s.disabled = true;
    });
    
    try {
      // Try to change the language
      const success = await window.SimpleI18n.changeLanguage(selectedLang);
      
      if (!success) {
        // Revert to previous language on failure
        document.querySelectorAll('.language-selector').forEach(s => {
          s.value = previousLang || 'en';
        });
        toast(`Failed to load ${selectedLang} translations. Using ${previousLang || 'English'} instead.`, 'error');
      } else {
        // Update all language selectors with the new language
        document.querySelectorAll('.language-selector').forEach(s => {
          if (s !== selector) {
            s.value = selectedLang;
          }
        });
        if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') {
          try { window.SimpleI18n.updateUI(); } catch {}
        }
        const langName = window.SimpleI18n.languages[selectedLang] || selectedLang;
        // Use console.log instead of toast if toast is not available
        if (typeof toast === 'function') {
          toast(`Language changed to ${langName}`, 'success');
        } else {
          console.log(`Language changed to ${langName}`);
        }
      }
    } catch (error) {
      console.error('Error changing language:', error);
      document.querySelectorAll('.language-selector').forEach(s => {
        s.value = previousLang || 'en';
      });
      if (typeof toast === 'function') {
        toast('An error occurred while changing the language.', 'error');
      } else {
        console.error('An error occurred while changing the language.');
      }
    } finally {
      document.querySelectorAll('.language-selector').forEach(s => {
        s.disabled = false;
      });
      isChangingLanguage = false;
    }
  });
  
  // Listen for language changes from other parts of the app
  window.addEventListener('languageChanged', async (ev) => {
    if (ev.detail?.language && selector.value !== ev.detail.language) {
      selector.value = ev.detail.language;
      await updateLanguageSelector();
      if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') {
        try { window.SimpleI18n.updateUI(); } catch {}
      }
    }
  });
}
