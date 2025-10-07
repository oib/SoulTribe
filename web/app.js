(() => {
  // Theme bootstrapping: default to dark; honor saved preference if present
  try {
    const savedTheme = localStorage.getItem('theme');
    const theme = savedTheme ? savedTheme : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch {}
  const $ = (id) => document.getElementById(id);
// Safely bind click handlers on pages where the element may not exist
const bindClick = (id, handler) => {
  const el = $(id);
  if (el) el.onclick = handler;
  return !!el;
};
  const out = $("out");
  let token = null;
  let currentUserId = null;
  // Expose initial currentUserId to window so other modules can read it as a value
  try { window.currentUserId = currentUserId; } catch {}

  const parseJwt = (t) => {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) { return null; }
  };


  // Prefill availability (date + hour selects) to next full hour and +1h
  const pad2 = (n) => String(n).padStart(2, '0');
  const nextFullHour = () => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    if (Date.now() > d.getTime()) d.setHours(d.getHours() + 1);
    return d;
  };
  const setDateInput = (el, d) => {
    if (!el) return;
    el.value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const populateHour = (sel) => {
    if (!sel || !sel.options) return;
    if (!sel.options.length) {
      for (let h=0; h<24; h++) {
        const opt = document.createElement('option');
        opt.value = String(h);
        opt.textContent = `${pad2(h)}:00`;
        sel.appendChild(opt);
      }
    }
  };
  // Derive offset minutes for a given Date in a target IANA timezone
  function tzOffsetMinutesAt(date, tz) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset'
      });
      const parts = fmt.formatToParts(date);
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
      const m = tzName.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
      if (!m) return 0;
      const sign = m[1] === '-' ? -1 : 1;
      const hh = parseInt(m[2] || '0', 10);
      const mm = parseInt(m[3] || '0', 10);
      return sign * (hh * 60 + mm);
    } catch { return 0; }
  }

  // Build UTC ISO from a wall time expressed in a specific IANA timezone
  function buildUtcIsoFromTz(dateStr, hourStr, tz) {
    try {
      if (!dateStr || hourStr === '' || hourStr === null || hourStr === undefined) return null;
      const [y, m, d] = String(dateStr).split('-').map(x => parseInt(x, 10));
      const h = parseInt(hourStr, 10);
      if (!y || !m || !d || isNaN(h)) return null;
      
      console.log(`Converting ${dateStr} ${h}:00 from ${tz} to UTC`);
      
      // Create a date representing the wall time in the target timezone
      // Use a more reliable method with Intl.DateTimeFormat
      const wallTimeStr = `${dateStr}T${h.toString().padStart(2, '0')}:00:00`;
      
      // Parse as if it's in the target timezone
      const tempDate = new Date(wallTimeStr);
      const offsetAtTime = tzOffsetMinutesAt(tempDate, tz);
      console.log(`Timezone offset for ${tz} at ${wallTimeStr}: ${offsetAtTime} minutes`);
      
      // Create UTC timestamp by subtracting the timezone offset
      const utcTimestamp = Date.UTC(y, m - 1, d, h, 0, 0, 0) - (offsetAtTime * 60000);
      const result = new Date(utcTimestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
      
      console.log(`Result: ${wallTimeStr} ${tz} → ${result} UTC`);
      return result;
    } catch (e) { 
      console.error('buildUtcIsoFromTz error:', e);
      return null; 
    }
  }

  // Build a UTC ISO string (ending with Z) from a local date string (YYYY-MM-DD) and hour (0-23)
  function buildUtcIso(dateStr, hourStr) {
    try {
      if (!dateStr || hourStr === '' || hourStr === null || hourStr === undefined) return null;
      const [y, m, d] = String(dateStr).split('-').map(x => parseInt(x, 10));
      const h = parseInt(hourStr, 10);
      if (!y || !m || !d || isNaN(h)) return null;
      const local = new Date(y, m - 1, d, h, 0, 0, 0);
      return local.toISOString().replace(/\.\d{3}Z$/, 'Z');
    } catch { return null; }
  }

  // Populate timezone select with full IANA list if available
  const populateTimezones = () => {
    const sel = $("liveTz");
    if (!sel) return;
    let zones = [];
    try {
      if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf('timeZone');
    } catch {}
    if (!zones || !zones.length) {
      zones = [
        'Europe/Vienna','Europe/Berlin','Europe/Paris','Europe/London','America/New_York','America/Los_Angeles','America/Sao_Paulo','Asia/Tokyo','Asia/Singapore','Australia/Sydney','Africa/Johannesburg'
      ];
    }
    // Keep current value if already set
    const current = sel.value;
    // Clear and repopulate
    sel.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Select timezone (city)';
    sel.appendChild(def);
    for (const z of zones) {
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z;
      sel.appendChild(opt);
    }
    if (current) sel.value = current;
  };
  // Populate TZ list ASAP
  try { populateTimezones(); } catch {}

  // Searchable timezone: filter options as user types
  const bindTzSearch = () => {
    const input = $("tzSearch");
    const sel = $("liveTz");
    if (!input || !sel) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().replaceAll(' ', '_');
      for (const opt of sel.options) {
        if (!opt.value) { opt.hidden = false; continue; }
        const txt = String(opt.textContent || '').toLowerCase();
        const val = String(opt.value || '').toLowerCase();
        opt.hidden = !(txt.includes(q) || val.includes(q));
      }
    });

  // Delete availability slot (delegated)
  document.addEventListener('click', async (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLElement)) return;
    if (!el.classList.contains('btn-delete-slot')) return;
    try {
      el.disabled = true;
      const id = parseInt(el.getAttribute('data-id') || '0', 10);
      if (!id) { el.disabled = false; return; }
      const data = await api(`/api/availability/${id}`, { method: 'DELETE', auth: true });
      show('availability.delete', data);
      toast('Availability slot deleted');
      try {
        if (window.fetchAvailList) await window.fetchAvailList();
      } catch {}
      // Also refresh matches to reflect removed overlaps
      try { if (window.fetchAndRenderMatches) await window.fetchAndRenderMatches(); } catch {}
    } catch (e) {
      show('availability.delete:ERROR', e);
    } finally {
      try { el.disabled = false; } catch {}
    }
  });

  // Unconfirm
  document.addEventListener('click', async (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLElement)) return;
    if (!el.classList.contains('btn-unconfirm-meetup')) return;
    try {
      el.disabled = true;
      const id = parseInt(el.getAttribute('data-id') || '0', 10);
      if (!id) { el.disabled = false; return; }
      const data = await api('/api/meetup/unconfirm', { method: 'POST', auth: true, body: { meetup_id: id } });
      show('meetup.unconfirm', data);
      toast('Meetup unconfirmed');
      try { if (window.fetchAndRenderMeetups) await window.fetchAndRenderMeetups(); } catch {}
    } catch (e) { show('meetup.unconfirm:ERROR', e); } finally { try { el.disabled = false; } catch {} }
  });

  // Cancel
  
  };

  // Register handler moved to login.js
  try { bindTzSearch(); } catch {}
  const updAvailHint = () => {
    const sDate = $("availStartDate").value;
    const sHour = $("availStartHour").value;
    const eDate = $("availEndDate").value;
    const eHour = $("availEndHour").value;
    const su = buildUtcIso(sDate, sHour);
    const eu = buildUtcIso(eDate, eHour);
    $("availUtcHint").textContent = (su && eu) ? `Will save as UTC: ${su} → ${eu}` : '';
  };
  (function initAvailDefaults(){
    const sDate = $("availStartDate");
    const sHour = $("availStartHour");
    const eDate = $("availEndDate");
    const eHour = $("availEndHour");
    if (!sDate || !sHour || !eDate || !eHour) return; // Not on a page with availability inputs
    populateHour(sHour);
    populateHour(eHour);
    const start = nextFullHour();
    const end = new Date(start.getTime() + 60*60*1000);
    setDateInput(sDate, start);
    setDateInput(eDate, end);
    sHour.value = String(start.getHours());
    eHour.value = String(end.getHours());
    [sDate,sHour,eDate,eHour].forEach(el => { try { el.addEventListener('change', updAvailHint); } catch {} });
    updAvailHint();
  })();
  // Query parameter auto-fill moved to login.js

  // Fetch profile and preselect UI (live_tz, languages)
  const prefillProfileUI = async () => {
    if (!token) return;
    try {
      const prof = await api('/api/profile', { auth: true });
      if (prof && typeof prof.display_name !== 'undefined') {
        const dn = $('displayName');
        if (dn) dn.value = prof.display_name || '';
        // Update topbar label to display_name when available
        const uidEl = $('currentUserId');
        if (uidEl && prof.display_name) uidEl.textContent = prof.display_name;
      }
      if (prof && prof.live_tz) {
        const tzSel = $('liveTz');
        if (tzSel) tzSel.value = prof.live_tz;
        const tzLabel = document.getElementById('liveTzLabel');
        if (tzLabel) tzLabel.textContent = prof.live_tz;
      } else {
        // Auto-detect and save timezone once if not set
        try {
          const tzSel = $('liveTz');
          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (detected && tzSel && !tzSel.value) {
            populateTimezones();
            tzSel.value = detected;
            await api('/api/profile', { method: 'PUT', body: { live_tz: detected }, auth: true });
            const tzLabel = document.getElementById('liveTzLabel');
            if (tzLabel) tzLabel.textContent = detected;
          }
        } catch {}
      }
      if (prof && Array.isArray(prof.languages) && prof.languages.length) {
        const languageSet = new Set(prof.languages.map(s => String(s)));
        const languageCheckboxes = document.querySelectorAll('.language-option input[type="checkbox"]');
        
        languageCheckboxes.forEach(checkbox => {
          checkbox.checked = languageSet.has(checkbox.value);
        });
        
        // Update selected languages display
        if (typeof updateSelectedLanguages === 'function') {
          updateSelectedLanguages();
        }
      }
      // Prefill birth data fields
      try {
        const bdate = $('birthDate');
        const btime = $('birthTime');
        const bplace = $('birthPlace');
        const blat = $('birthLat');
        const blon = $('birthLon');
        const btz = $('birthTz');
        if (bdate && prof.birth_dt_utc) {
          const d = new Date(prof.birth_dt_utc);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth()+1).padStart(2,'0');
          const dd = String(d.getUTCDate()).padStart(2,'0');
          bdate.value = `${yyyy}-${mm}-${dd}`;
          // Prefill time if backend says time known
          if (btime && prof.birth_time_known) {
            const hh = String(d.getUTCHours()).padStart(2,'0');
            const mi = String(d.getUTCMinutes()).padStart(2,'0');
            btime.value = `${hh}:${mi}`;
          }
        }
        if (bplace && prof.birth_place_name) bplace.value = prof.birth_place_name;
        if (blat && typeof prof.birth_lat === 'number') blat.value = String(prof.birth_lat);
        if (blon && typeof prof.birth_lon === 'number') blon.value = String(prof.birth_lon);
        if (btz && prof.birth_tz) btz.value = prof.birth_tz;
      } catch {}
    } catch (e) { /* ignore */ }
  };
  // Try prefill shortly after load and also after login/register
  setTimeout(prefillProfileUI, 200);

  // Radix fetching moved to profile.js

  // Birth place autocomplete moved to profile.js

  // Delegate clicks for generic actions in Output (dashboard-specific handlers live in dashboard.js)
  // Intentionally no-op here to avoid duplicate meetup/match handlers.

  // Availability
  bindClick("btn-avail-create", async () => {
    try {
      // Use profile timezone if known, otherwise cached value, otherwise browser tz, else UTC
      let tz = (typeof window !== 'undefined' && window.liveTz) ? window.liveTz : null;
      if (!tz) {
        try { tz = localStorage.getItem('live_tz'); } catch {}
      }
      if (!tz) {
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
      }
      if (!tz) tz = 'UTC';
      console.log('Creating slot with timezone:', tz, 'date:', $("availStartDate").value, 'hour:', $("availStartHour").value);
      const start_iso = buildUtcIsoFromTz($("availStartDate").value, $("availStartHour").value, tz);
      console.log('Converted to UTC ISO:', start_iso);
      const durationH = parseInt($("availDurationHours").value || '1', 10);
      if (!start_iso || isNaN(durationH)) throw new Error("Please pick valid start and duration");
      // Compute end as start + duration hours in UTC
      const sDate = new Date(start_iso);
      const end_iso = new Date(sDate.getTime() + durationH * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (!start_iso || !end_iso) throw new Error("Please pick valid start and end datetimes");
      if (new Date(end_iso) <= new Date(start_iso)) throw new Error("End must be after start");
      // Use original user input for local times (profile timezone wall time),
      // and avoid toISOString which shifts to UTC. Build ISO-like strings directly.
      const inputDate = $("availStartDate").value; // YYYY-MM-DD
      const inputHour = parseInt($("availStartHour").value, 10);
      const [yLocal, mLocal, dLocal] = inputDate.split('-').map(Number);

      function fmt2(n){ return String(n).padStart(2,'0'); }
      function isoLocal(y, m, d, h){ return `${y}-${fmt2(m)}-${fmt2(d)}T${fmt2(h)}:00:00`; }
      function addDays(y, m, d, days){
        const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0)); // noon UTC to avoid DST issues
        dt.setUTCDate(dt.getUTCDate() + days);
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth()+1, d: dt.getUTCDate() };
      }

      const startLocalIso = isoLocal(yLocal, mLocal, dLocal, inputHour);
      let endHourLocal = inputHour + durationH;
      let y2 = yLocal, m2 = mLocal, d2 = dLocal;
      while (endHourLocal >= 24) { endHourLocal -= 24; ({y: y2, m: m2, d: d2} = addDays(y2, m2, d2, 1)); }
      const endLocalIso = isoLocal(y2, m2, d2, endHourLocal);
      const payload = {
        start_dt_utc: start_iso,
        end_dt_utc: end_iso,
        start_dt_local: startLocalIso,
        end_dt_local: endLocalIso,
        timezone: tz
      };
      const data = await api("/api/availability", { method: "POST", body: payload, auth: true });
      show("availability.create", data);
      // Refresh availability list on dashboard if present
      try { if (window.fetchAvailList) await window.fetchAvailList(); } catch {}
      // Also refresh matches so new overlaps appear without a manual reload
      try { if (window.fetchAndRenderMatches) await window.fetchAndRenderMatches(); } catch {}
      toast('Availability slot created');
    } catch (e) {
      show("availability.create:ERROR", e);
      try { toast(errorMessage(e, 'Failed to create availability'), 'error'); } catch {}
    }
  });

  // Availability list handler moved to dashboard.js

  bindClick("btn-avail-delete", async () => {
    try {
      const id = parseInt($("availDeleteId").value, 10);
      const data = await api(`/api/availability/${id}`, { method: "DELETE", auth: true });
      show("availability.delete", data);
      // Refresh availability list on dashboard if present
      try { await document.getElementById('btn-avail-list')?.click(); } catch {}
    } catch (e) { show("availability.delete:ERROR", e); }
  });

  const api = async (path, { method = "GET", body, auth = false, returnResponse = false } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (auth && token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw { status: res.status, data, response: res };
    return returnResponse ? { data, response: res } : data;
  };

  const show = (label, data) => {
    const el = document.getElementById('out');
    const ts = new Date().toISOString();
    const msg = `[${ts}] ${label}:\n` + JSON.stringify(data, null, 2) + "\n\n";
    if (el) {
      el.textContent = msg + el.textContent;
    } else {
      // Fallback when no Output panel exists (e.g., on dashboard/login pages)
      try { console.info(label, data); } catch {}
    }
  };

  // Expose fetchAndRenderMatches globally for dashboard
  window.fetchAndRenderMatches = null; // Will be set by dashboard.js

  // Match handlers moved to dashboard.js

  // Meetup
  // Meetup handlers moved to dashboard.js

  const updateTokenPreview = () => {
    const tp = $("tokenPreview");
    if (tp) tp.textContent = token ? token.slice(0, 32) + "…" : "(none)";
    const payload = token ? parseJwt(token) : null;
    currentUserId = payload && payload.sub ? parseInt(payload.sub, 10) : null;
    // Keep global in sync so dashboard.js and others can read it
    try { window.currentUserId = currentUserId; } catch {}
    const uidEl = $("currentUserId");
    if (uidEl) uidEl.textContent = (currentUserId ?? "(unknown)");
    // Prefill find user field with current user id for convenience (only if present)
    const fuid = $("findUserId");
    if (currentUserId && fuid && !fuid.value) {
      fuid.value = String(currentUserId);
    }
  };

  // Toast and error helper from toast.js
  const localToast = (...args) => { try { console.log('[toast]', ...args); } catch {} };
  let __toastDepth = 0;
  const toast = (...args) => {
    // Prevent recursion if window.toast points back to this function
    if (__toastDepth > 2) return;
    __toastDepth++;
    try {
      const wt = (typeof window !== 'undefined') ? window.toast : null;
      if (typeof wt === 'function' && wt !== toast) return wt(...args);
      return localToast(...args);
    } finally { __toastDepth--; }
  };
  const errorMessage = (err, fb) => {
    if (typeof window.errorMessage === 'function') return window.errorMessage(err, fb);
    try { return (err && err.data && err.data.detail) ? err.data.detail : (err?.message || fb || 'Error'); } catch { return fb || 'Error'; }
  };

  const setToken = (t) => {
    token = t || null;
    try { window.token = token; } catch {}
    if (token) {
      try { localStorage.setItem("access_token", token); } catch {}
    } else {
      try { localStorage.removeItem("access_token"); } catch {}
    }
    updateTokenPreview();
  };

  // Login handler moved to login.js

  // Update authentication UI based on login state
  function updateAuthUI() {
    const isLoggedIn = !!token;
    const profileLink = $("btn-profile-link");
    const loginLink = $("btn-login-link");
    const logoutBtn = $("btn-logout");

    if (profileLink) profileLink.style.display = isLoggedIn ? "inline-flex" : "none";
    if (loginLink) loginLink.style.display = isLoggedIn ? "none" : "inline-flex";
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  }

  // Initialize auth UI on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Ensure toast.js is loaded so toast() is available
    try {
      const ensureToastLoaded = () => {
        if (typeof window.toast === 'function') return;
        // Only inject once
        if (!document.getElementById('toast-js')) {
          const s = document.createElement('script');
          s.src = '/js/toast.js';
          s.id = 'toast-js';
          document.head.appendChild(s);
        }
      };
      ensureToastLoaded();
    } catch {}

    updateAuthUI();
    initLanguageSelector();
    // Register Service Worker for offline + background notifications
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          try { window.__swReg = reg; } catch {}
        }).catch(() => {});
      }
    } catch {}
  });

  // Notification permission + SW helper (top-level)
  async function ensureNotificationPermission() {
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const p = await Notification.requestPermission();
      return p === 'granted';
    } catch { return false; }
  }

  async function notifyViaSW(title, body, data = {}, tag) {
    try {
      const ok = await ensureNotificationPermission();
      if (!ok) return false;
      const reg = window.__swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
      if (reg && navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'notify', title, body, data, tag });
        return true;
      }
      // Fallback to direct Notification API
      try { new Notification(title, { body }); } catch {}
      return true;
    } catch { return false; }
  }

  try { window.ensureNotificationPermission = ensureNotificationPermission; } catch {}
  try { window.notifyViaSW = notifyViaSW; } catch {}

  // Track if we're currently changing the language
  let isChangingLanguage = false;

  // Function to update the language selector options with only available languages
  async function updateLanguageSelector(selector) {
    if (!selector || !window.SimpleI18n) return;
    
    // Get the list of supported languages
    const supportedLangs = await window.SimpleI18n.detectSupportedLanguages();
    const currentLang = window.SimpleI18n.currentLang || 'en';
    
    // Filter languages to only include supported ones
    const availableLanguages = Object.entries(window.SimpleI18n.languages || {})
      .filter(([code]) => supportedLangs.includes(code));
    
    if (availableLanguages.length === 0) {
      // Fallback to English if no languages are available
      selector.innerHTML = `<option value="en" selected>EN - English</option>`;
      return;
    }
    
    // Sort languages alphabetically by name
    availableLanguages.sort((a, b) => a[1].localeCompare(b[1]));
    
    // Generate options
    selector.innerHTML = availableLanguages
      .map(([code, name]) => {
        const displayName = `${code.toUpperCase()} - ${name}`;
        return `<option value="${code}" ${code === currentLang ? 'selected' : ''}>${displayName}</option>`;
      })
      .join('');
  }

  // Initialize language selector
  async function initLanguageSelector() {
    const selector = document.getElementById('language-selector');
    if (!selector) return;

    try {
      // Initial population of the selector
      await updateLanguageSelector(selector);
      
      // Handle language changes from the selector
      selector.addEventListener('change', async (e) => {
        if (isChangingLanguage) return;
        
        const selectedLang = e.target.value;
        const previousLang = window.SimpleI18n?.currentLang;
        
        if (!selectedLang || selectedLang === previousLang) {
          return;
        }
        
        isChangingLanguage = true;
        selector.disabled = true;
        
        try {
          // Try to change the language
          const success = await window.SimpleI18n.changeLanguage(selectedLang);
          
          if (!success) {
            // Revert to previous language on failure
            selector.value = previousLang || 'en';
            toast(`Failed to load ${selectedLang} translations. Using ${previousLang || 'English'} instead.`, 'error');
          } else {
            // Update the selector with the new language
            await updateLanguageSelector(selector);
            const langName = window.SimpleI18n.languages[selectedLang] || selectedLang;
            toast(`Language changed to ${langName}`, 'success');
          }
        } catch (error) {
          console.error('Error changing language:', error);
          selector.value = previousLang || 'en';
          toast('An error occurred while changing the language.', 'error');
        } finally {
          selector.disabled = false;
          isChangingLanguage = false;
        }
      });
      
      // Listen for language changes from other parts of the app
      window.addEventListener('languageChanged', async (ev) => {
        if (ev.detail?.language && selector.value !== ev.detail.language) {
          selector.value = ev.detail.language;
          await updateLanguageSelector(selector);
        }
      });
      
    } catch (error) {
      console.error('Error initializing language selector:', error);
      // Fallback to English if there's an error
      selector.innerHTML = '<option value="en" selected>EN - English</option>';
    }
  }

  // Ensure liveTz is available (from profile) for timezone-aware conversions
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.liveTz && typeof token !== 'undefined' && token) {
        const prof = await api('/api/profile', { auth: true });
        if (prof && prof.live_tz) {
          window.liveTz = prof.live_tz;
          try { localStorage.setItem('live_tz', prof.live_tz); } catch {}
        } else {
          try {
            const cached = localStorage.getItem('live_tz');
            if (cached) window.liveTz = cached;
          } catch {}
        }
        // Also ensure UI language follows backend's lang_primary if present (global hook)
        try {
          const lng = prof && prof.lang_primary ? String(prof.lang_primary) : null;
          const hasI18n = (typeof window.SimpleI18n !== 'undefined');
          if (lng) {
            // Check previous before persisting to drive one-time toast
            let prevLng = null; try { prevLng = localStorage.getItem('selectedLanguage'); } catch {}
            // Always persist so i18n picks it up even if not yet loaded
            try { localStorage.setItem('selectedLanguage', lng); } catch {}
            // If i18n is already available and supports this lang, change immediately
            if (hasI18n && window.SimpleI18n.languages && window.SimpleI18n.languages[lng]) {
              try { await window.SimpleI18n.changeLanguage(lng); } catch {}
            } else {
              // Fallback: set html lang for accessibility until i18n initializes
              try { document.documentElement.setAttribute('lang', lng); } catch {}
            }
            // One-time toast when language changes
            try {
              if (lng && prevLng !== lng && typeof window.toast === 'function') {
                const i18n = window.SimpleI18n;
                const name = (i18n && i18n.languages && i18n.languages[lng]) ? i18n.languages[lng] : lng;
                const prefix = (i18n && typeof i18n.t === 'function') ? i18n.t('notifications.language_set_to') : 'Language set to';
                window.toast(`${prefix} ${name}`);
              }
            } catch {}
          }
        } catch {}
      }
      
      // Update timezone hint display
      updateTimezoneHint();

      // Replace language code badges like <span class="badge">en</span> with full names (e.g., English)
      try { updateLanguageBadges(); } catch {}

      // Ensure a site footer exists with Terms | Privacy | Imprint links
      try { injectSiteFooter(); } catch {}

      // Bind global logout handler (works on any page with app.js)
      try {
        const btn = document.getElementById('btn-logout');
        if (btn) {
          btn.onclick = () => {
            try { setToken(null); } catch {}
            try { localStorage.removeItem('access_token'); } catch {}
            try { updateAuthUI(); } catch {}
            try { window.location.href = '/login.html'; } catch {}
          };
        }
      } catch {}
    } catch {}
  });

  // Update the timezone hint display
  function updateTimezoneHint() {
    const hintEl = document.getElementById('availTzHint');
    if (!hintEl) return;
    
    let tz = window.liveTz;
    if (!tz) {
      try { tz = localStorage.getItem('live_tz'); } catch {}
    }
    if (!tz) {
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    }
    if (!tz) tz = 'UTC';
    
    hintEl.textContent = `Using timezone: ${tz}`;
  }

  // Replace any badge whose text is a known language code with its display name
  function updateLanguageBadges() {
    try {
      const i18n = window.SimpleI18n;
      const map = (i18n && i18n.languages) ? i18n.languages : null;
      if (!map) return;
      const nodes = document.querySelectorAll('.badge');
      nodes.forEach((el) => {
        try {
          const txt = (el.textContent || '').trim();
          // Only replace if the badge text is exactly a 2-letter code that exists in the map
          if (/^[A-Za-z]{2}$/.test(txt)) {
            const code = txt.toLowerCase();
            if (map[code]) {
              el.textContent = map[code];
            }
          }
        } catch {}
      });
    } catch {}
  }

  // Update language badges whenever the i18n language changes
  try {
    window.addEventListener('languageChanged', () => { try { updateLanguageBadges(); } catch {} });
  } catch {}

  // Inject a consistent footer across pages
  function injectSiteFooter() {
    try {
      // Skip injection if a footer component or existing footer is already present
      if (document.querySelector('[data-component="footer"]')) return;
      if (document.querySelector('.site-footer')) return;
      if (document.getElementById('siteFooter')) return;
      const footer = document.createElement('footer');
      footer.id = 'siteFooter';
      footer.className = 'site-footer';
      footer.innerHTML = `
        <div class="site-footer-inner">
          <a href="/terms.html" data-i18n="footer.terms">Terms</a>
          <span class="sep">|</span>
          <a href="/privacy.html" data-i18n="footer.privacy">Privacy</a>
          <span class="sep">|</span>
          <a href="/imprint.html" data-i18n="footer.imprint">Imprint</a>
        </div>
      `;
      document.body.appendChild(footer);
      // Re-run i18n binding if available so injected nodes are localized
      try { if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') window.SimpleI18n.updateUI(); } catch {}
    } catch {}
  }

  // Initialize availability form defaults
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const dateEl = $('availStartDate');
      const startHourEl = $('availStartHour');
      const endHourEl = null; // removed; replaced by duration
      const durationEl = $('availDurationHours');
      
      if (dateEl) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateEl.value = `${yyyy}-${mm}-${dd}`;
      }
      
      if (startHourEl && durationEl) {
        const now = new Date();
        const currentHour = now.getHours();
        startHourEl.value = String(currentHour);
        durationEl.value = '1';
      }
    } catch (e) { /* ignore initialization errors */ }
  });

  // Logout handler moved to login.js

  // Form submission handler moved to login.js

  // Profile update handler moved to profile.js

  // Restore token from localStorage on load
  try {
    const savedToken = localStorage.getItem("access_token");
    if (savedToken) {
      setToken(savedToken);
      updateAuthUI();
    }
  } catch (e) { /* ignore */ }

  // Ensure window.token is initialized even if no saved token
  try { if (typeof window.token === 'undefined') window.token = token; } catch {}

  updateTokenPreview();

  // Dashboard auto-run moved to dashboard.js

  // Expose global functions for dashboard.js, profile.js, and login.js
  window.api = api;
  window.show = show;
  // Provide safe fallbacks so other modules can use toast/errorMessage immediately
  try { if (typeof window.toast !== 'function') window.toast = toast; } catch {}
  try { if (typeof window.errorMessage !== 'function') window.errorMessage = errorMessage; } catch {}
  window.bindClick = bindClick;
  window.parseJwt = parseJwt;
  window.setToken = setToken;
  window.updateAuthUI = updateAuthUI;
  window.fetchAndRenderRadix = null; // Will be set by profile.js
})();
