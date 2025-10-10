// Profile-specific functionality
(() => {
  // Helper functions for profile
  const $ = (id) => document.getElementById(id);
  
  // Get global functions from app.js
  const api = window.api;
  const show = window.show;
  const toast = window.toast;
  const bindClick = window.bindClick;
  const token = () => window.token;

  function parseFloatOrNull(value) {
    const str = (value ?? '').toString().trim();
    if (!str) return null;
    const num = Number.parseFloat(str);
    return Number.isFinite(num) ? num : null;
  }

  function buildBirthIso() {
    const dateEl = document.getElementById('birthDate');
    const hourEl = document.getElementById('birthHour');
    const minuteEl = document.getElementById('birthMinute');
    const dateVal = (dateEl?.value || '').trim();
    if (!dateVal) return null;
    const hourVal = hourEl?.value ?? '';
    const minuteVal = minuteEl?.value ?? '';
    const hasTime = hourVal !== '' && minuteVal !== '';
    const hh = hasTime ? String(hourVal).padStart(2, '0') : '00';
    const mm = hasTime ? String(minuteVal).padStart(2, '0') : '00';
    return `${dateVal}T${hh}:${mm}:00`;
  }

  // --- Top timezone badge helpers ---
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
  function tzOffsetLabel(tz, atDateISO) {
    try {
      const at = new Date(String(atDateISO));
      const mins = tzOffsetMinutesAt(at, tz);
      const sign = mins < 0 ? '-' : '+';
      const abs = Math.abs(mins);
      const hh = String(Math.floor(abs / 60)).padStart(2, '0');
      const mm = String(abs % 60).padStart(2, '0');
      return `UTC${sign}${hh}:${mm}`;
    } catch { return ''; }
  }
  function resolveLiveTz() {
    let tz = null;
    try { tz = window.liveTz || null; } catch {}
    if (!tz) { try { tz = localStorage.getItem('live_tz'); } catch {} }
    if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {} }
    return tz || 'UTC';
  }
  function updateTopTzBadge() {
    try {
      const el = document.getElementById('tzTopBadgeText');
      if (!el) return;
      const tz = resolveLiveTz();
      const off = tzOffsetLabel(tz, new Date().toISOString());
      el.textContent = `Using timezone: ${tz}${off ? ` (${off})` : ''}`;
    } catch {}
  }

  // Fetch and render user's radix JSON on profile page
  async function fetchAndRenderRadix() {
    if (!token()) return;
    const pre = document.getElementById('radixJson');
    const pretty = document.getElementById('radixPretty');
    if (!pre) return; // not on profile page
    try {
      console.log('[profile] fetching /api/profile/radix …');
      pre.textContent = '(loading…)';
      if (pretty) pretty.innerHTML = '';
      const data = await api('/api/profile/radix', { auth: true });
      console.info('profile.radix', data);
      pre.textContent = JSON.stringify(data, null, 2);

      // Pretty render: planets and aspect grid
      try {
        if (pretty) {
          const planets = data && data.bodies ? data.bodies : {};
          const planetOrder = [
            ['MOON','Moon','☽'], ['SUN','Sun','☉'], ['MERCURY','Mercury','☿'],
            ['VENUS','Venus','♀'], ['MARS','Mars','♂'], ['JUPITER','Jupiter','♃'], ['SATURN','Saturn','♄'],
            ['URANUS','Uranus','♅'], ['NEPTUNE','Neptune','♆'], ['PLUTO','Pluto','♇']
          ];
          const zsigns = ['♈︎','♉︎','♊︎','♋︎','♌︎','♍︎','♎︎','♏︎','♐︎','♑︎','♒︎','♓︎'];
          const fmtPos = (deg) => {
            if (typeof deg !== 'number' || Number.isNaN(deg)) return '';
            const d = ((deg % 360) + 360) % 360;
            const sign = Math.floor(d / 30);
            const within = d - sign * 30; // 0..30
            const degrees = Math.floor(within);
            const minutes = Math.round((within - degrees) * 60);
            const dd = String(degrees).padStart(2, '0');
            const mm = String(minutes).padStart(2, '0');
            return `${dd}°${zsigns[sign]}${mm}′`;
          };

          // Build planet positions table with House column
          // Prepare house index function if houses are provided
          let houseIdxFn = null;
          let houseCusps = null; // normalized 12-length array of cusp longitudes
          try {
            const housesData = data && data.houses ? data.houses : null;
            if (housesData && Array.isArray(housesData.cusps) && housesData.cusps.length >= 1) {
              const rawCusps = Array.isArray(housesData.cusps) ? housesData.cusps : [];
              const cusps = Array.from({length:12}).map((_, i) => {
                const v = rawCusps[i];
                return (typeof v === 'number') ? ((v % 360) + 360) % 360 : NaN;
              });
              houseCusps = cusps;
              const nextValid = (i) => { for (let k=1;k<=12;k++){ const j=(i+k)%12; if(!Number.isNaN(cusps[j])) return j; } return -1; };
              houseIdxFn = (lon) => {
                const x = ((lon % 360) + 360) % 360;
                for (let i=0;i<12;i++) {
                  const a = cusps[i]; if (Number.isNaN(a)) continue;
                  const j = nextValid(i); if (j === -1 || j === i) continue;
                  const b = cusps[j]; if (Number.isNaN(b)) continue;
                  if (a <= b) { if (x >= a && x < b) return i; }
                  else { if (x >= a || x < b) return i; }
                }
                return -1;
              };
            }
          } catch {}

          const rows = planetOrder
            .filter(([k]) => planets[k])
            .map(([k, name, sym]) => {
              const lon = planets[k].lon;
              const hIdx = (houseIdxFn && typeof lon === 'number') ? houseIdxFn(lon) : -1;
              const houseCell = (hIdx >= 0) ? String(hIdx + 1) : '';
              return `<tr><td class="mono">${sym}</td><td>${name}</td><td class="mono">${fmtPos(lon)}</td><td class="mono">${houseCell}</td></tr>`;
            }).join('');
          const planetTable = `
            <table class="list planets-table">
              <colgroup>
                <col class="icon" />
                <col />
                <col class="pos" />
                <col class="house" />
              </colgroup>
              <thead>
                <tr>
                  <th>Pl</th>
                  <th>Planet</th>
                  <th>Position</th>
                  <th>House</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`;

          // Aspect grid (0, 60, 90, 120, 180) with small orb
          const aspects = [
            {deg:0, label:'0°', sym:'☌', orb:5},
            {deg:60, label:'60°', sym:'✶', orb:4},
            {deg:90, label:'90°', sym:'□', orb:4},
            {deg:120, label:'120°', sym:'△', orb:4},
            {deg:180, label:'180°', sym:'☍', orb:5},
          ];
          const keys = planetOrder.filter(([k]) => planets[k]).map(([k]) => k);
          const delta = (a,b) => {
            let d = Math.abs(a-b) % 360; if (d>180) d=360-d; return d;
          };
          const aspectHits = (a,b) => {
            const d=delta(a,b);
            for (const asp of aspects) {
              if (Math.abs(d-asp.deg) <= asp.orb) return asp;
            }
            return null;
          };
          // Build a combined table: Pl, Planet, Sign, Deg, House, Cusp°, aspects...
          let combined = '<table class="list planets-table">';
          const combinedColgroup = '<colgroup><col class="icon"><col class="planet"><col class="sign"><col class="deg"><col class="house"><col class="cusp">' + new Array(aspects.length).fill('<col class="aspect">').join('') + '</colgroup>';
          combined += combinedColgroup;
          const headerCells = ['<th></th>','<th>Planet</th>','<th>Sign</th>','<th>Deg</th>','<th>House</th>','<th>Cusp°</th>'].concat(aspects.map(a=>`<th scope="col">${a.sym} ${a.label}</th>`)).join('');
          combined += `<thead><tr>${headerCells}</tr></thead><tbody>`;
          for (let i=0;i<keys.length;i++) {
            const ki = keys[i];
            const nameSym = planetOrder.find(([k])=>k===ki)?.[2] || ki;
            const pname = planetOrder.find(([k,n])=>k===ki)?.[1] || ki;
            const lon = planets[ki]?.lon;
            const hIdx = (typeof lon === 'number' && typeof houseIdxFn === 'function') ? houseIdxFn(lon) : -1;
            const houseCell = (hIdx >= 0) ? String(hIdx + 1) : '';
            // Compute sign glyph and degrees within sign
            const d = ((lon % 360) + 360) % 360;
            const signIdx = Math.floor(d / 30);
            const within = d - signIdx * 30;
            const deg = Math.floor(within);
            const min = Math.round((within - deg) * 60);
            const dd = String(deg).padStart(2, '0');
            const mm = String(min).padStart(2, '0');
            const signGlyph = zsigns[signIdx] || '';
            // Compute cusp degree display for the planet's house
            let cuspDisp = '';
            if (hIdx >= 0 && Array.isArray(houseCusps)) {
              const cLon = houseCusps[hIdx];
              if (typeof cLon === 'number' && !Number.isNaN(cLon)) {
                const cx = ((cLon % 360) + 360) % 360;
                const cWithin = cx - Math.floor(cx/30)*30;
                const cDeg = Math.floor(cWithin);
                const cMin = Math.round((cWithin - cDeg) * 60);
                const cdd = String(cDeg).padStart(2, '0');
                const cmm = String(cMin).padStart(2, '0');
                cuspDisp = `${cdd}°${cmm}′`;
              }
            }
            let row = `<tr><td class="mono">${nameSym}</td><td>${pname}</td><td class="mono">${signGlyph}</td><td class="mono">${dd}°${mm}′</td><td class="mono">${houseCell}</td><td class="mono">${cuspDisp}</td>`;
            for (const a of aspects) {
              const hits=[];
              for (let j=0;j<keys.length;j++) {
                if (j===i) continue;
                const kj = keys[j];
                const asp = aspectHits(planets[ki].lon, planets[kj].lon);
                if (asp && asp.deg===a.deg) {
                  const sym = planetOrder.find(([k])=>k===kj)?.[2] || kj;
                  hits.push(sym);
                }
              }
              row += `<td>${hits.join(' ')}</td>`;
            }
            row += '</tr>';
            combined += row;
          }
          // Add ASC and MC rows (no aspect columns)
          try {
            const housesData = data && data.houses ? data.houses : null;
            if (housesData) {
              const addAngle = (label, lonVal) => {
                if (typeof lonVal !== 'number') return '';
                const x = ((lonVal % 360) + 360) % 360;
                const sIdx = Math.floor(x / 30);
                const within = x - sIdx * 30;
                const dg = Math.floor(within);
                const mn = Math.round((within - dg) * 60);
                const dd = String(dg).padStart(2, '0');
                const mm = String(mn).padStart(2, '0');
                const signGlyph = zsigns[sIdx] || '';
                // Angles (ASC, MC) are not planets; do not assign a house number
                const houseCell = '';
                // Also show label in the first narrow column (icon slot)
                let row = `<tr><td class=\"mono\">${label}</td><td>${label}</td><td class=\"mono\">${signGlyph}</td><td class=\"mono\">${dd}°${mm}′</td><td class=\"mono\">${houseCell}</td><td class=\"mono\"></td>`;
                // Compute aspects between this angle and all planets
                for (const a of aspects) {
                  const hits = [];
                  for (let j=0;j<keys.length;j++) {
                    const kj = keys[j];
                    const pj = planets[kj];
                    if (!pj || typeof pj.lon !== 'number') continue;
                    const asp = aspectHits(x, pj.lon);
                    if (asp && asp.deg === a.deg) {
                      const sym = planetOrder.find(([k])=>k===kj)?.[2] || kj;
                      hits.push(sym);
                    }
                  }
                  row += `<td>${hits.join(' ')}</td>`;
                }
                row += '</tr>';
                return row;
              };
              combined += addAngle('ASC', housesData.asc);
              combined += addAngle('MC', housesData.mc);
            }
          } catch {}

          combined += '</tbody></table>';

          // Build houses table with planets per house if available
          let housesHtml = '';
          const houses = data && data.houses ? data.houses : null;
          if (houses && Array.isArray(houses.cusps) && houses.cusps.length >= 1) {
            const ascStr = (typeof houses.asc === 'number') ? fmtPos(houses.asc) : '';
            const mcStr  = (typeof houses.mc  === 'number') ? fmtPos(houses.mc)  : '';
            const sysStr = houses.system ? String(houses.system) : 'Houses';

            // Normalize cusps and create helper to find house index for a longitude
            const rawCusps = Array.isArray(houses.cusps) ? houses.cusps : [];
            const cusps = Array.from({length:12}).map((_, i) => {
              const v = rawCusps[i];
              return (typeof v === 'number') ? ((v % 360) + 360) % 360 : NaN;
            });

            // Helper: find next valid cusp index after i (wrapping), or -1 if none
            const nextValid = (i) => {
              for (let k = 1; k <= 12; k++) {
                const j = (i + k) % 12;
                if (!Number.isNaN(cusps[j])) return j;
              }
              return -1;
            };

            const houseIndexFor = (lon) => {
              // Return 0..11 house index, or -1 if cannot classify
              const x = ((lon % 360) + 360) % 360;
              for (let i = 0; i < 12; i++) {
                const a = cusps[i];
                if (Number.isNaN(a)) continue;
                const j = nextValid(i);
                if (j === -1 || j === i) continue; // cannot form a segment
                const b = cusps[j];
                if (Number.isNaN(b)) continue;
                if (a <= b) {
                  if (x >= a && x < b) return i;
                } else {
                  // wrap over 360
                  if (x >= a || x < b) return i;
                }
              }
              return -1;
            };

            // Map bodies to symbols (use same order/symbols as planet table when possible)
            const symFor = (key) => (planetOrder.find(([k]) => k === key)?.[2]) || key;
            const bodyKeys = Object.keys(data.bodies || {});
            const tracked = ['MOON','SUN','MERCURY','VENUS','MARS','JUPITER','SATURN','URANUS','NEPTUNE','PLUTO'];
            const useKeys = bodyKeys.filter(k => tracked.includes(k));

            const planetsPerHouse = Array.from({length:12}, () => []);
            for (const k of useKeys) {
              const lon = data.bodies[k]?.lon;
              if (typeof lon !== 'number') continue;
              const idx = houseIndexFor(lon);
              if (idx >= 0) planetsPerHouse[idx].push(symFor(k));
            }

            const rows = Array.from({length:12}).map((_, idx) => {
              const hn = idx + 1;
              const deg = houses.cusps[idx];
              const pos = (typeof deg === 'number') ? fmtPos(deg) : '';
              const plist = planetsPerHouse[idx].join(' ');
              return `<tr>
                <td class=\"mono\">${hn}</td>
                <td class=\"mono\">${pos}</td>
                <td class=\"mono\">${plist}</td>
              </tr>`;
            }).join('');

            const header = `
              <div class=\"row\" style=\"margin:8px 0; gap:8px; align-items:center;\">
                <span class=\"badge\">${sysStr}</span>
                ${ascStr ? `<span class=\"badge mono\">ASC ${ascStr}</span>` : ''}
                ${mcStr  ? `<span class=\"badge mono\">MC ${mcStr}</span>`   : ''}
              </div>`;
            const table = `
              <table class=\"list houses-table\">
                <colgroup>
                  <col class=\"num\" />
                  <col class=\"cusp\" />
                  <col class=\"planets\" />
                </colgroup>
                <thead>
                  <tr>
                    <th>House</th>
                    <th>Cusp</th>
                    <th>Planets</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>`;
            // Suppress separate houses table since we show house in planets table
            housesHtml = '';
          }

          // Legend no longer needed; symbols are included in table header
          const legend = '';
          // Render a single panel with the combined table
          const singlePanel = `<div class=\"radix-panel\">${combined}</div>`;
          pretty.innerHTML = `<div class=\"radix-layout\">${singlePanel}</div>`;
        }
      } catch {}
    } catch (e) {
      console.error('profile.radix:ERROR', e);
      // 404 is expected when radix not yet computed
      pre.textContent = 'No radix available yet. Set your birth data and save your profile to compute it.';
      if (pretty) pretty.innerHTML = '';
    }
  }

  function renderLivePlaceList(items) {
    const list = document.getElementById('livePlaceList');
    if (!list) return;
    if (!items || !items.length) { list.style.display = 'none'; list.innerHTML = ''; return; }
    list.innerHTML = items.map((it, idx) => {
      const title = it.display_name.split(',')[0] || it.display_name;
      const sub = it.display_name.replace(title + ', ', '');
      return `<div class="autocomplete-item" data-idx="${idx}">
        <div class="title">${title}</div>
        <div class="sub">${sub}</div>
      </div>`;
    }).join('');
    list.style.display = 'block';
  }

  function attachLivePlaceAutocomplete() {
    const input = document.getElementById('livePlace');
    const list = document.getElementById('livePlaceList');
    if (!input || !list) return;
    let lastResults = [];
    let activeIndex = -1;

    const doSearch = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 2) { renderLivePlaceList([]); return; }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        lastResults = Array.isArray(data) ? data : [];
        activeIndex = -1;
        renderLivePlaceList(lastResults);
      } catch { renderLivePlaceList([]); }
    }, 250);

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) doSearch(); });
    input.addEventListener('keydown', (ev) => {
      if (list.style.display !== 'block') return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); activeIndex = Math.min(activeIndex + 1, lastResults.length - 1); highlight(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlight(); }
      else if (ev.key === 'Enter') { if (activeIndex >= 0) { ev.preventDefault(); pick(lastResults[activeIndex]); } }
      else if (ev.key === 'Escape') { list.style.display = 'none'; }
    });

    function highlight() {
      const children = list.querySelectorAll('.autocomplete-item');
      children.forEach((el, i) => { el.style.background = (i === activeIndex) ? 'var(--hl, rgba(124,58,237,0.12))' : ''; });
    }

    async function pick(item) {
      try { input.value = item.display_name || input.value; } catch {}
      const latEl = document.getElementById('liveLat');
      const lonEl = document.getElementById('liveLon');
      const tzSel = document.getElementById('liveTz');
      const tzLabel = document.getElementById('liveTzLabel');
      if (latEl) latEl.value = String(item.lat || '');
      if (lonEl) lonEl.value = String(item.lon || '');
      list.style.display = 'none';
      // Autofill timezone from backend
      try {
        const lat = parseFloat(latEl?.value || '');
        const lon = parseFloat(lonEl?.value || '');
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          const resp = await api('/api/timezone', { method: 'POST', body: { lat, lon } });
          const tz = resp && (resp.time_zone || resp.timezone || resp.tz);
          if (tz) {
            if (tzSel) tzSel.value = tz;
            if (tzLabel) tzLabel.textContent = tz;
            // Persist detected timezone for live usage
            try { window.liveTz = tz; } catch {}
            try { localStorage.setItem('live_tz', tz); } catch {}
          }
        }
      } catch (e) {
        try { if (tzLabel) tzLabel.textContent = '(auto failed)'; } catch {}
      }
    }

    list.addEventListener('click', (ev) => {
      const el = ev.target.closest('.autocomplete-item');
      if (!el) return;
      const idx = parseInt(el.getAttribute('data-idx') || '-1', 10);
      if (idx >= 0 && lastResults[idx]) pick(lastResults[idx]);
    });

    document.addEventListener('click', (ev) => {
      if (!list.contains(ev.target) && ev.target !== input) list.style.display = 'none';
    });
  }

  // Birth place autocomplete using OpenStreetMap Nominatim
  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function renderPlaceList(items) {
    const list = document.getElementById('birthPlaceList');
    if (!list) return;
    if (!items || !items.length) { list.style.display = 'none'; list.innerHTML = ''; return; }
    list.innerHTML = items.map((it, idx) => {
      const title = it.display_name.split(',')[0] || it.display_name;
      const sub = it.display_name.replace(title + ', ', '');
      return `<div class="autocomplete-item" data-idx="${idx}">
        <div class="title">${title}</div>
        <div class="sub">${sub}</div>
      </div>`;
    }).join('');
    list.style.display = 'block';
  }

  function attachBirthPlaceAutocomplete() {
    const input = document.getElementById('birthPlace');
    const list = document.getElementById('birthPlaceList');
    if (!input || !list) return;
    let lastResults = [];
    let activeIndex = -1;

    const doSearch = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 2) { renderPlaceList([]); return; }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        lastResults = Array.isArray(data) ? data : [];
        activeIndex = -1;
        renderPlaceList(lastResults);
      } catch { renderPlaceList([]); }
    }, 250);

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) doSearch(); });
    input.addEventListener('keydown', (ev) => {
      if (list.style.display !== 'block') return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); activeIndex = Math.min(activeIndex + 1, lastResults.length - 1); highlight(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlight(); }
      else if (ev.key === 'Enter') { if (activeIndex >= 0) { ev.preventDefault(); pick(lastResults[activeIndex]); } }
      else if (ev.key === 'Escape') { list.style.display = 'none'; }
    });

    function highlight() {
      const children = list.querySelectorAll('.autocomplete-item');
      children.forEach((el, i) => { el.style.background = (i === activeIndex) ? 'var(--hl, rgba(124,58,237,0.12))' : ''; });
    }

    async function pick(item) {
      try { input.value = item.display_name || input.value; } catch {}
      const latEl = document.getElementById('birthLat');
      const lonEl = document.getElementById('birthLon');
      const tzEl = document.getElementById('birthTz');
      const tzLabel = document.getElementById('birthTzLabel');
      if (latEl) latEl.value = String(item.lat || '');
      if (lonEl) lonEl.value = String(item.lon || '');
      list.style.display = 'none';
      // Autofill timezone from backend, if lat/lon are present
      try {
        const lat = parseFloat(latEl?.value || '');
        const lon = parseFloat(lonEl?.value || '');
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          const resp = await api('/api/timezone', { method: 'POST', body: { lat, lon } });
          const tz = resp && (resp.time_zone || resp.timezone || resp.tz);
          if (tz) {
            if (tzEl) tzEl.value = tz;
            if (tzLabel) tzLabel.textContent = tz;
            // Persist detected timezone to localStorage and window.liveTz
            try { window.liveTz = tz; } catch {}
            try { localStorage.setItem('live_tz', tz); } catch {}
          }
        }
      } catch (e) {
        try { if (tzLabel) tzLabel.textContent = '(auto failed)'; } catch {}
      }
    }

    list.addEventListener('click', (ev) => {
      const el = ev.target.closest('.autocomplete-item');
      if (!el) return;
      const idx = parseInt(el.getAttribute('data-idx') || '-1', 10);
      if (idx >= 0 && lastResults[idx]) pick(lastResults[idx]);
    });

    document.addEventListener('click', (ev) => {
      if (!list.contains(ev.target) && ev.target !== input) list.style.display = 'none';
    });
  }

  // Force 24-hour format for time inputs
  function force24HourFormat() {
    const timeInputs = document.querySelectorAll('input[type="time"]');
    timeInputs.forEach(input => {
      // Set step to 60 seconds (minutes only)
      input.step = 60;
      // Force 24-hour format by setting a pattern
      input.setAttribute('pattern', '[0-9]{2}:[0-9]{2}');
      // Add event listener to ensure 24-hour format
      input.addEventListener('input', function() {
        const value = this.value;
        if (value && value.includes(' ')) {
          // Remove AM/PM if present
          this.value = value.split(' ')[0];
        }
      });
    });
  }

  // Profile-specific event handlers
  document.addEventListener('DOMContentLoaded', async () => {
    const notifyBrowserEl = document.getElementById('notifyBrowser');
    const notifyEmailEl = document.getElementById('notifyEmail');
    const notifyEmailDisabled = document.getElementById('notifyEmailDisabled');
    let emailVerified = !!(window.profileMeta && window.profileMeta.email_verified);
    let profileData = null;

    const updateEmailToggleState = () => {
      if (notifyEmailEl && notifyEmailDisabled) {
        notifyEmailEl.disabled = !emailVerified;
        notifyEmailDisabled.style.display = emailVerified ? 'none' : '';
      }
    };

    const applyNotificationPrefs = (source) => {
      if (!source) return;
      if (notifyBrowserEl && typeof source.notify_browser_meetups === 'boolean') {
        notifyBrowserEl.checked = source.notify_browser_meetups;
      }
      if (notifyEmailEl && typeof source.notify_email_meetups === 'boolean') {
        notifyEmailEl.checked = source.notify_email_meetups;
      }
      updateEmailToggleState();
    };

    updateEmailToggleState();

    if (notifyBrowserEl) {
      notifyBrowserEl.addEventListener('change', async () => {
        try {
          if (notifyBrowserEl.checked && ('Notification' in window)) {
            const granted = await window.ensureNotificationPermission?.();
            if (!granted) {
              notifyBrowserEl.checked = false;
            }
          }
        } catch (err) {
          console.error('notifyBrowser change failed', err);
          notifyBrowserEl.checked = false;
        }
      });
    }

    try {
      const me = await api('/api/profile/me', { auth: true });
      if (me && typeof me.email_verified !== 'undefined') {
        window.profileMeta = { email_verified: !!me.email_verified };
        emailVerified = !!me.email_verified;
        updateEmailToggleState();
      }
    } catch (err) {
      console.error('profile.loadMe failed', err);
    }

    try {
      profileData = await api('/api/profile', { auth: true });
      applyNotificationPrefs(profileData);
    } catch (err) {
      console.error('profile.loadProfile failed', err);
    }

    // Initialize top timezone badge and keep it updated when live_tz changes
    try { updateTopTzBadge(); } catch {}
    try {
      window.addEventListener('storage', (ev) => {
        if (ev && ev.key === 'live_tz') updateTopTzBadge();
      });
    } catch {}
    force24HourFormat();
    // Attach autocompletes after DOM is ready
    attachBirthPlaceAutocomplete();
    attachLivePlaceAutocomplete();

    // Initialize i18n and language tag input
    let selectedLanguages = new Set(['en']);
    let renderTags = () => {};

    try {
      // Load i18n system
      if (window.SimpleI18n) {
        await window.SimpleI18n.init();
      }
      
      const primarySelect = document.getElementById('primaryLanguage');
      const tagInput = document.getElementById('languageTagInput');
      const input = document.getElementById('languageInput');
      const selectedTags = document.getElementById('selectedTags');
      const autocomplete = document.getElementById('languageAutocomplete');
      
      if (primarySelect && tagInput && input && selectedTags && autocomplete) {
        const languages = window.SimpleI18n?.languages || {};
        // Expose globally for save handler
        try { window.selectedLanguages = selectedLanguages; } catch {}
        let highlightedIndex = -1;
        
        // Populate primary language select
        try {
          const sortedLanguages = Object.entries(languages)
            .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));

          primarySelect.innerHTML = sortedLanguages
            .map(([code, name]) => `<option value="${code}">${name}</option>`)
            .join('');
          // Set initial based on i18n current
          const initial = (window.SimpleI18n && window.SimpleI18n.currentLang) || 'en';
          primarySelect.value = initial;
        } catch {}
        
        // Debounce function for search
        const debounce = (fn, delay) => {
          let timeoutId;
          return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
          };
        };
        
        // Render selected language tags
        renderTags = () => {
          selectedTags.innerHTML = Array.from(selectedLanguages).map(langCode => {
            const langName = languages[langCode] || langCode;
            return `<span class="language-tag" data-lang="${langCode}" title="Click to make primary">${langName} <button type="button" class="tag-remove" data-lang="${langCode}" aria-label="Remove">×</button></span>`;
          }).join('');
        };
        
        // Filter and show autocomplete results
        const showAutocomplete = (query) => {
          const filtered = Object.entries(languages).filter(([code, name]) => {
            if (selectedLanguages.has(code)) return false;
            if (primarySelect && code === primarySelect.value) return false;
            const searchText = query.toLowerCase();
            return name.toLowerCase().includes(searchText) || code.toLowerCase().includes(searchText);
          }).slice(0, 8);
          
          if (filtered.length === 0 || query.trim() === '') {
            autocomplete.style.display = 'none';
            return;
          }
          
          autocomplete.innerHTML = filtered.map(([code, name], index) => 
            `<div class="language-autocomplete-item" data-lang="${code}" data-index="${index}">${name}</div>`
          ).join('');
          autocomplete.style.display = 'block';
          highlightedIndex = -1;
        };
        
        // Add language tag
        const addLanguage = (langCode) => {
          if (primarySelect && langCode === primarySelect.value) return; // cannot add primary as secondary
          if (languages[langCode] && !selectedLanguages.has(langCode)) {
            selectedLanguages.add(langCode);
            try { window.selectedLanguages = selectedLanguages; } catch {}
            renderTags();
            input.value = '';
            autocomplete.style.display = 'none';
            
            // Update i18n if this is the only selected language
            if (selectedLanguages.size === 1 && window.SimpleI18n) {
              window.SimpleI18n.changeLanguage(langCode);
            }
          }
        };
        
        // Remove language tag
        const removeLanguage = (langCode) => {
          selectedLanguages.delete(langCode);
          try { window.selectedLanguages = selectedLanguages; } catch {}
          renderTags();
        };
        
        // Handle keyboard navigation
        const handleKeyDown = (e) => {
          const items = autocomplete.querySelectorAll('.language-autocomplete-item');
          
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            updateHighlight(items);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, -1);
            updateHighlight(items);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
              const langCode = items[highlightedIndex].dataset.lang;
              addLanguage(langCode);
            }
          } else if (e.key === 'Escape') {
            autocomplete.style.display = 'none';
            highlightedIndex = -1;
          }
        };
        
        // Update visual highlight
        const updateHighlight = (items) => {
          items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === highlightedIndex);
          });
        };
        
        // Event listeners
        const debouncedSearch = debounce((query) => showAutocomplete(query), 200);
        
        input.addEventListener('input', (e) => {
          debouncedSearch(e.target.value);
        });
        
        input.addEventListener('keydown', handleKeyDown);
        
        input.addEventListener('focus', () => {
          if (input.value.trim()) {
            showAutocomplete(input.value);
          }
        });

        // Primary select change: switch UI language and remove from secondaries if present
        primarySelect.addEventListener('change', async () => {
          const lng = primarySelect.value;
          try { await window.SimpleI18n?.changeLanguage(lng); } catch {}
          if (selectedLanguages.has(lng)) {
            selectedLanguages.delete(lng);
            try { window.selectedLanguages = selectedLanguages; } catch {}
            renderTags();
          }
          // Refresh autocomplete suggestions
          if (input.value.trim()) showAutocomplete(input.value);
        });
        
        // Handle autocomplete clicks
        autocomplete.addEventListener('click', (e) => {
          const item = e.target.closest('.language-autocomplete-item');
          if (item) {
            addLanguage(item.dataset.lang);
          }
        });
        
        // Handle tag removal
        selectedTags.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('.tag-remove');
          if (removeBtn) { removeLanguage(removeBtn.dataset.lang); return; }
          const tag = e.target.closest('.language-tag');
          if (tag) {
            const code = tag.getAttribute('data-lang');
            // Promote to primary
            if (primarySelect && code && languages[code]) {
              primarySelect.value = code;
              // Also remove from secondaries if present
              if (selectedLanguages.has(code)) {
                selectedLanguages.delete(code);
                try { window.selectedLanguages = selectedLanguages; } catch {}
                renderTags();
              }
              // Switch UI language
              try { window.SimpleI18n?.changeLanguage(code); } catch {}
            }
          }
        });
        
        // Close autocomplete on outside click
        document.addEventListener('click', (e) => {
          if (!tagInput.contains(e.target)) {
            autocomplete.style.display = 'none';
            highlightedIndex = -1;
          }
        });
        
        // Prefill from backend profile (sanitize to available European languages)
        try {
          const prof = profileData || await api('/api/profile', { auth: true });
          if (!profileData) profileData = prof;
          applyNotificationPrefs(prof);
          const isValid = (code) => !!languages[code];
          // Resolve primary
          const storedPrimary = prof && prof.lang_primary;
          const initialPrimary = (storedPrimary && isValid(storedPrimary)) ? storedPrimary : primarySelect.value;
          primarySelect.value = initialPrimary;
          try { await window.SimpleI18n?.changeLanguage(primarySelect.value); } catch {}

          // Resolve secondaries: only valid, exclude primary, de-dupe
          const secsRaw = Array.isArray(prof?.languages) ? prof.languages : [];
          const secs = secsRaw
            .filter((code) => code && isValid(code) && code !== primarySelect.value);
          selectedLanguages = new Set(secs.length ? secs : Array.from(selectedLanguages));
          try { window.selectedLanguages = selectedLanguages; } catch {}
          // --- Prefill birth data and location from profile so values persist across navigation ---
          try {
            // Display name
            if (prof?.display_name && $("displayName")) $("displayName").value = prof.display_name;
            // Birth date/time known
            const birthTimeKnown = !!prof?.birth_time_known;
            // Prefer backend birth_dt_local if provided to avoid browser TZ discrepancies
            const bdtLocal = prof?.birth_dt_local ? String(prof.birth_dt_local) : null;
            // Fallback: use backend birth_dt_utc and convert to birth_tz for UI fields
            const bdtUtc = prof?.birth_dt_utc ? String(prof.birth_dt_utc) : null;
            // Start with backend tz, then normalize for Vienna if needed
            let btz = prof?.birth_tz ? String(prof.birth_tz) : null;
            try {
              const place0 = $("birthPlace")?.value || prof.birth_place_name || '';
              const blat0 = typeof prof?.birth_lat === 'number' ? prof.birth_lat : NaN;
              const blon0 = typeof prof?.birth_lon === 'number' ? prof.birth_lon : NaN;
              const nearVienna0 = (!Number.isNaN(blat0) && !Number.isNaN(blon0) && blat0 >= 48.1 && blat0 <= 48.35 && blon0 >= 16.2 && blon0 <= 16.6);
              const mentionsVienna0 = /\b(Vienna|Wien)\b/i.test(place0);
              if ((mentionsVienna0 || nearVienna0) && (!btz || btz === 'Europe/Paris')) btz = 'Europe/Vienna';
            } catch {}
            const birthDateEl = $("birthDate");
            const birthHourEl = $("birthHour");
            const birthMinuteEl = $("birthMinute");
            if (bdtLocal) {
              try {
                // Expect format like "1976-08-26 17:55:00" (from backend)
                const dateStr = bdtLocal.slice(0, 10);
                const hh = bdtLocal.slice(11, 13);
                const mm = bdtLocal.slice(14, 16);
                if (birthDateEl && dateStr) birthDateEl.value = dateStr;
                if (birthHourEl) birthHourEl.value = birthTimeKnown ? hh : '';
                if (birthMinuteEl) birthMinuteEl.value = birthTimeKnown ? mm : '';
                try {
                  const lbl = document.getElementById('birthLocalLabel');
                  const tzDisp = btz || (prof?.birth_tz ? String(prof.birth_tz) : '');
                  if (lbl) lbl.textContent = `${dateStr} ${hh}:${mm}${tzDisp ? ` (${tzDisp})` : ''}`;
                } catch {}
              } catch {}
            } else if (bdtUtc && btz) {
              try {
                // Ensure UTC parsing by appending Z if not present
                const isoUtc = /Z$/i.test(bdtUtc) ? bdtUtc : (bdtUtc + 'Z');
                const d = new Date(isoUtc);
                const fmt = new Intl.DateTimeFormat('en-CA', {
                  timeZone: btz,
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', hour12: false,
                });
                const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
                const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
                const hh = parts.hour || '';
                const mm = parts.minute || '';
                if (birthDateEl && dateStr) birthDateEl.value = dateStr;
                if (birthHourEl) birthHourEl.value = birthTimeKnown ? hh : '';
                if (birthMinuteEl) birthMinuteEl.value = birthTimeKnown ? mm : '';
                try {
                  const lbl = document.getElementById('birthLocalLabel');
                  if (lbl) lbl.textContent = `${dateStr} ${hh}:${mm} (${btz})`;
                } catch {}
              } catch {}
            }
            // Birth place fields
            if (prof?.birth_place_name && $("birthPlace")) $("birthPlace").value = String(prof.birth_place_name);
            if (typeof prof?.birth_lat === 'number' && $("birthLat")) $("birthLat").value = String(prof.birth_lat);
            if (typeof prof?.birth_lon === 'number' && $("birthLon")) $("birthLon").value = String(prof.birth_lon);
            if (prof?.birth_tz) {
              const tzEl = $("birthTz");
              const tzLabel = document.getElementById('birthTzLabel');
              let tzVal = String(prof.birth_tz);
              // Normalize Vienna naming if backend stored Europe/Paris erroneously
              try {
                const place = $("birthPlace")?.value || prof.birth_place_name || '';
                const blat = typeof prof?.birth_lat === 'number' ? prof.birth_lat : NaN;
                const blon = typeof prof?.birth_lon === 'number' ? prof.birth_lon : NaN;
                const nearVienna = (!Number.isNaN(blat) && !Number.isNaN(blon) && blat >= 48.1 && blat <= 48.35 && blon >= 16.2 && blon <= 16.6);
                const mentionsVienna = /\b(Vienna|Wien)\b/i.test(place);
                if ((mentionsVienna || nearVienna) && (!tzVal || tzVal === 'Europe/Paris')) tzVal = 'Europe/Vienna';
              } catch {}
              if (tzEl) tzEl.value = tzVal;
              if (tzLabel) tzLabel.textContent = tzVal;
            }
          } catch {}
          // Render initial tags
          renderTags();
          // Wire tag UI events
        } catch {}

        // Initial render
        renderTags();
      }
    } catch (e) {
      console.error('Language tag input init failed:', e);
    }

    // Keep window.liveTz and localStorage in sync when user changes live timezone manually
    try {
      const tzSel = document.getElementById('liveTz');
      const tzLabel = document.getElementById('liveTzLabel');
      if (tzSel) {
        tzSel.addEventListener('change', () => {
          const tz = tzSel.value || '';
          if (tz) {
            try { window.liveTz = tz; } catch {}
            try { localStorage.setItem('live_tz', tz); } catch {}
            if (tzLabel) tzLabel.textContent = tz;
            try { updateTopTzBadge(); } catch {}
            try { window.setNavbarTzBadge && window.setNavbarTzBadge(); } catch {}
          }
        });
      }
    } catch {}

    // Attempt to load radix shortly after page load
    setTimeout(fetchAndRenderRadix, 300);

    // Manual refresh for radix
    bindClick('btn-radix-refresh', async () => {
      try { await fetchAndRenderRadix(); toast('Radix refreshed'); } catch {}
    });

    bindClick('btn-account-delete', async () => {
      if (!token()) {
        toast('Please login again before deleting your account', 'error');
        return;
      }
      const confirmText = window.SimpleI18n?.t ? window.SimpleI18n.t('profile.delete_account_confirm', 'Are you sure? This cannot be undone.') : 'Are you sure? This cannot be undone.';
      if (!window.confirm(confirmText)) return;
      const button = document.getElementById('btn-account-delete');
      if (button) button.disabled = true;
      try {
        await api('/api/profile', { method: 'DELETE', auth: true });
        toast('Account deleted');
        try { localStorage.removeItem('access_token'); } catch {}
        try { localStorage.removeItem('refresh_token'); } catch {}
        window.location.href = '/goodbye.html';
      } catch (err) {
        console.error('Account deletion failed', err);
        toast('Failed to delete account', 'error');
      } finally {
        if (button) button.disabled = false;
      }
    });

    // --- AI Interpretation ---
    const aiMessagesEl = document.getElementById('aiMessages');
    const aiInputEl = document.getElementById('aiUserMsg');
    let aiHistory = [];

    function renderAiMessages() {
      if (!aiMessagesEl) return;
      const items = aiHistory.map((t) => {
        return `<li class=\"item-card\"><div class=\"item-sub\">${t.content.replace(/</g,'&lt;')}</div></li>`;
      }).join('');
      aiMessagesEl.innerHTML = items ? `<ul class="list">${items}</ul>` : '';
      // If there are any messages, ensure the follow-up input row is visible
      try {
        const follow = document.getElementById('aiFollowRow');
        if (follow && aiHistory.length > 0) {
          follow.style.removeProperty('display');
          follow.style.display = 'flex';
        }
      } catch {}
    }

    async function callInterpret(message) {
      // Determine preferred language order:
      // 1) Currently selected primary language on the page
      // 2) SimpleI18n current language
      // 3) Omit lang to let backend use profile.lang_primary
      let langPref = null;
      try { langPref = document.getElementById('primaryLanguage')?.value || null; } catch {}
      if (!langPref) langPref = (window.SimpleI18n && window.SimpleI18n.currentLang) || null;
      const body = { message: message || null, history: aiHistory };
      if (langPref) body.lang = langPref;
      const resp = await api('/api/profile/interpret', { method: 'POST', body, auth: true });
      const reply = resp && resp.reply ? String(resp.reply) : '';
      if (reply) {
        aiHistory.push({ role: 'assistant', content: reply });
        renderAiMessages();
      }
    }

    bindClick('btn-interpret-initial', async () => {
      try {
        // Reset history and ask for initial reading
        aiHistory = [];
        renderAiMessages();
        await callInterpret(null);
        try {
          const follow = document.getElementById('aiFollowRow');
          if (follow) {
            follow.style.removeProperty('display');
            follow.style.display = 'flex';
            try { follow.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
          }
        } catch {}
      } catch (e) {
        show('profile.interpret:ERROR', e);
        const msg = window.SimpleI18n?.t('ai.error_initial') || 'Failed to get interpretation';
        toast(msg, 'error');
      }
    });

    bindClick('btn-interpret-send', async () => {
      if (!aiInputEl) return;
      const msg = (aiInputEl.value || '').trim();
      if (!msg) return;
      aiHistory.push({ role: 'user', content: msg });
      aiInputEl.value = '';
      renderAiMessages();
      try {
        await callInterpret(msg);
      } catch (e) {
        show('profile.interpret.send:ERROR', e);
        const msg = window.SimpleI18n?.t('ai.error_followup') || 'Failed to send message';
        toast(msg, 'error');
      }
    });

    // Geolocation helpers
    async function reverseGeocode(lat, lon) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('Reverse geocoding failed');
      return res.json();
    }

    async function geolocateOnce() {
      // Try device GPS / browser Geolocation API first
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000,
            });
          });
          return { lat: pos.coords.latitude, lon: pos.coords.longitude };
        } catch (_) {
          // continue to IP fallback
        }
      }
      // Fallback: use a non-Google IP geolocation provider (ipwho.is)
      // Docs: https://ipwho.is/ (no API key required for basic usage)
      try {
        const res = await fetch('https://ipwho.is/?fields=latitude,longitude,success', { headers: { 'Accept': 'application/json' } });
        const j = await res.json();
        if (j && j.success && typeof j.latitude === 'number' && typeof j.longitude === 'number') {
          return { lat: j.latitude, lon: j.longitude };
        }
      } catch {}
      throw new Error('Unable to determine location');
    }

    // Use my location for current location
    bindClick('btn-live-geolocate', async () => {
      try {
        const { lat, lon } = await geolocateOnce();
        const rev = await reverseGeocode(lat, lon);
        const label = rev && (rev.display_name || (rev.address && rev.address.city) || '');
        const livePlace = document.getElementById('livePlace');
        const liveLat = document.getElementById('liveLat');
        const liveLon = document.getElementById('liveLon');
        const liveTzSel = document.getElementById('liveTz');
        const liveTzLabel = document.getElementById('liveTzLabel');
        if (livePlace && label) livePlace.value = label;
        if (liveLat) liveLat.value = String(lat);
        if (liveLon) liveLon.value = String(lon);
        try {
          const resp = await api('/api/timezone', { method: 'POST', body: { lat, lon } });
          const tz = resp && (resp.time_zone || resp.timezone || resp.tz);
          if (tz) {
            if (liveTzSel) liveTzSel.value = tz;
            if (liveTzLabel) liveTzLabel.textContent = tz;
            // Persist detected timezone and keep window.liveTz in sync
            try { window.liveTz = tz; } catch {}
            try { localStorage.setItem('live_tz', tz); } catch {}
          }
        } catch {}
        toast('Current location detected');
      } catch (e) {
        toast('Could not detect current location', 'error');
      }
    });

    // Use my location for birth location (convenience; user can adjust date/time)
    bindClick('btn-birth-geolocate', async () => {
      try {
        const { lat, lon } = await geolocateOnce();
        const rev = await reverseGeocode(lat, lon);
        const label = rev && (rev.display_name || (rev.address && rev.address.city) || '');
        const birthPlace = document.getElementById('birthPlace');
        const birthLat = document.getElementById('birthLat');
        const birthLon = document.getElementById('birthLon');
        const birthTz = document.getElementById('birthTz');
        const birthTzLabel = document.getElementById('birthTzLabel');
        if (birthPlace && label) birthPlace.value = label;
        if (birthLat) birthLat.value = String(lat);
        if (birthLon) birthLon.value = String(lon);
        try {
          const resp = await api('/api/timezone', { method: 'POST', body: { lat, lon } });
          const tz = resp && (resp.time_zone || resp.timezone || resp.tz);
          if (tz) {
            if (birthTz) birthTz.value = tz;
            if (birthTzLabel) birthTzLabel.textContent = tz;
            // Do NOT sync window.liveTz for birth timezone
          }
        } catch {}
        toast('Birth location prefilled from current location');
      } catch (e) {
        toast('Could not fetch device location', 'error');
      }
    });

    // Profile update handler
    bindClick("btn-profile-update", async () => {
      try {
        const display_name = $("displayName")?.value || null;
        const live_tz_raw = $("liveTz")?.value?.trim ? $("liveTz").value.trim() : $("liveTz")?.value;
        const live_tz_label = document.getElementById('liveTzLabel')?.textContent;
        // Read languages from tag-input selection and primary selector (sanitize to available set)
        const primarySelectEl = document.getElementById('primaryLanguage');
        let lang_primary = primarySelectEl ? primarySelectEl.value || null : null;
        // Ensure primary is valid; if not, fallback to SimpleI18n.currentLang or 'en'
        if (!lang_primary || !((window.SimpleI18n?.languages||{})[lang_primary])) {
          lang_primary = (window.SimpleI18n?.currentLang && (window.SimpleI18n.languages[window.SimpleI18n.currentLang])) ? window.SimpleI18n.currentLang : 'en';
        }
        let languagesArr = Array.from((window.selectedLanguages instanceof Set) ? window.selectedLanguages : new Set());
        // Filter secondaries to valid set
        const isValid = (code) => !!(window.SimpleI18n?.languages||{})[code];
        let languages = languagesArr.filter((c) => isValid(c));
        // Ensure primary is not duplicated among secondaries
        if (lang_primary) languages = languages.filter((c) => c !== lang_primary);
        // Birth data
        const birth_date_input = $("birthDate");
        const birth_date = birth_date_input?.value || null; // YYYY-MM-DD
        if (!birth_date) {
          try { birth_date_input?.reportValidity?.(); } catch {}
          toast('Birth date is required', 'error');
          return;
        }
        const birth_hour = $("birthHour")?.value || "";
        const birth_minute = $("birthMinute")?.value || "";
        const body = {
          display_name,
          birth_dt: buildBirthIso(),
          birth_time_known: $('birthHour')?.value !== '' && $('birthMinute')?.value !== '',
          birth_place_name: $('birthPlace')?.value || null,
          birth_lat: parseFloatOrNull($('birthLat')?.value),
          birth_lon: parseFloatOrNull($('birthLon')?.value),
          birth_tz: $('birthTz')?.value || null,
          live_place_name: $('livePlace')?.value || null,
          live_lat: parseFloatOrNull($('liveLat')?.value),
          live_lon: parseFloatOrNull($('liveLon')?.value),
          live_tz: resolveLiveTz(),
          lang_primary,
          lang_secondary: null,
          languages,
          house_system: $('houseSystem')?.value || null,
        };
        // Prefer the select value; if empty but we have a detected label, use it
        if (live_tz_raw) body.live_tz = live_tz_raw;
        else if (live_tz_label && live_tz_label !== '(auto or select)') body.live_tz = live_tz_label;
        if (lang_primary) body.lang_primary = lang_primary;
        // Optionally set lang_secondary as the first secondary if present
        if (languages && languages.length) {
          body.languages = languages;
          body.lang_secondary = languages[0];
        }
        // Build birth_dt. If time is provided, include it; if not, send date-only (00:00) for backend noon fallback
        console.log('profile.update:BODY', body);
        body.notify_browser_meetups = notifyBrowserEl ? !!notifyBrowserEl.checked : undefined;
        body.notify_email_meetups = notifyEmailEl ? !!notifyEmailEl.checked : undefined;
        if (profileData) {
          profileData = { ...profileData, ...body };
        }

        const data = await api("/api/profile", { method: "PUT", body, auth: true });
        console.info('profile.update', data);
        show("profile.update", data);
        try {
          if (primarySelectEl && data && data.lang_primary) {
            primarySelectEl.value = data.lang_primary;
            try { await window.SimpleI18n?.changeLanguage(data.lang_primary); } catch {}
          }
          if (Array.isArray(data?.languages)) {
            selectedLanguages = new Set(
              data.languages.filter((code) => code && code !== primarySelectEl?.value)
            );
            try { window.selectedLanguages = selectedLanguages; } catch {}
            renderTags();
          }
          profileData = { ...profileData, ...data };
          applyNotificationPrefs(profileData);
        } catch (syncErr) {
          console.error('profile.update:sync failed', syncErr);
          toast('Profile update failed', 'error');
        }
        try { if (window.setNavbarTzBadge) window.setNavbarTzBadge(); } catch {}
        try {
          const lbl = document.getElementById('birthLocalLabel');
          if (lbl && data && data.birth_dt_utc && (data.birth_tz || body.birth_tz)) {
            const btz2 = data.birth_tz || body.birth_tz;
            const isoUtc2 = /Z$/i.test(String(data.birth_dt_utc)) ? String(data.birth_dt_utc) : `${data.birth_dt_utc}Z`;
            const d2 = new Date(isoUtc2);
            const fmt2 = new Intl.DateTimeFormat('en-CA', { timeZone: btz2, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
            const parts2 = Object.fromEntries(fmt2.formatToParts(d2).map(p => [p.type, p.value]));
            lbl.textContent = `${parts2.year}-${parts2.month}-${parts2.day} ${parts2.hour}:${parts2.minute} (${btz2})`;
          }
        } catch (err) {
          console.error('profile.update:render failed', err);
          toast('Profile update failed', 'error');
        }
        // Reflect new display_name in topbar immediately
        const uidEl = $('currentUserId');
        if (uidEl && display_name) uidEl.textContent = display_name;
        // Force a quick page reload so all components pick up the freshest profile state
        try {
          toast('Profile updated successfully');
          setTimeout(() => { try { window.location.reload(); } catch {} }, 80);
        } catch {}
      } catch (e) { 
        console.error('profile.update:ERROR', e);
        try { if (e && e.status) console.error('status', e.status); } catch {}
        try { if (e && e.data) console.error('data', e.data); } catch {}
        show("profile.update:ERROR", e);
        toast('Profile update failed', 'error');
      }
    });
  });

  // Expose fetchAndRenderRadix globally for use in app.js
  window.fetchAndRenderRadix = fetchAndRenderRadix;
})();
