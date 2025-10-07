// Dashboard-specific functionality
(() => {
  // Helper functions for dashboard
  const $ = (id) => document.getElementById(id);
  
  // Helper to convert IANA tz to friendly city name
  function friendlyCity(tz) {
    try {
      const parts = String(tz).split('/');
      const leaf = parts[parts.length - 1];
      return leaf.replace(/_/g, ' ');
    } catch { return tz; }
  }

  const MATCH_REFRESH_INTERVAL_MS = 15000;

  // Validate IANA timezone identifier
  function isValidIanaTimeZone(tz) {
    try {
      if (!tz || typeof tz !== 'string') return false;
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch { return false; }
  }

  // Build UTC ISO from a wall time expressed in a specific IANA timezone
  function buildUtcIsoFromTz(dateStr, hourStr, tz) {
    try {
      if (!dateStr || hourStr === '' || hourStr === null || hourStr === undefined) return null;
      const [y, m, d] = String(dateStr).split('-').map(x => parseInt(x, 10));
      const h = parseInt(hourStr, 10);
      if (!y || !m || !d || isNaN(h)) return null;
      const wallTimeStr = `${dateStr}T${String(h).padStart(2,'0')}:00:00`;
      // Use our tz offset helper to derive UTC
      const offsetAtTime = tzOffsetMinutesAt(new Date(wallTimeStr), tz);
      const utcTimestamp = Date.UTC(y, m - 1, d, h, 0, 0, 0) - (offsetAtTime * 60000);
      return new Date(utcTimestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
    } catch { return null; }
  }

  // Compute offset minutes for a given Date in an IANA timezone
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

  // --- Top timezone badge ---
  function resolveLiveTz() {
    let tz = null;
    try { tz = window.liveTz || null; } catch {}
    if (!tz) { try { tz = localStorage.getItem('live_tz'); } catch {}
    }
    if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    }
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

  // Parse a datetime string assuming UTC when timezone info is missing
  function parseAsUTC(isoLike) {
    try {
      const s = String(isoLike);
      // If it already has a timezone (Z or ±hh:mm), parse directly
      if (/Z$|[\+\-]\d{2}:?\d{2}$/.test(s)) {
        return new Date(s);
      }
      // If it has seconds and maybe milliseconds but no tz, append Z
      return new Date(s + 'Z');
    } catch { return new Date(isoLike); }
  }

  // Extract YYYY-MM-DD from an ISO-like string (e.g., 2025-09-10T21:00:00+02:00)
  function extractDate(localIso) {
    try {
      const s = String(localIso);
      const tIdx = s.indexOf('T');
      return tIdx > 0 ? s.slice(0, tIdx) : s;
    } catch { return String(localIso); }
  }

  // Extract HH:MM from an ISO-like string without seconds/tz suffix
  function extractTime(localIso) {
    try {
      const s = String(localIso);
      const tIdx = s.indexOf('T');
      if (tIdx < 0) return s;
      const rest = s.slice(tIdx + 1); // e.g., 21:00:00+02:00
      const hh = rest.slice(0, 2);
      const mm = rest.slice(3, 5);
      if (!/^[0-9]{2}$/.test(hh) || !/^[0-9]{2}$/.test(mm)) {
        // Fallback to Date parsing
        const d = new Date(localIso);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      }
      return `${hh}:${mm}`;
    } catch {
      try {
        const d = new Date(localIso);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      } catch { return String(localIso); }
    }
  }

  // Human duration between two UTC ISO strings
  function humanDuration(startUtcIso, endUtcIso) {
    try {
      const ms = (new Date(endUtcIso)).getTime() - (new Date(startUtcIso)).getTime();
      const totalMin = Math.max(0, Math.round(ms / 60000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h > 0 && m === 0) return h === 1 ? '1 hour' : `${h} hours`;
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } catch { return ''; }
  }

  // Pad numbers to 2 digits
  const pad2 = (n) => String(n).padStart(2, '0');

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

  // Ensure a 0..23 hour options list exists in a select
  function populateHourOptions(sel) {
    try {
      if (!sel) return;
      if (!sel.options || sel.options.length) return;
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = String(h);
        opt.textContent = `${pad2(h)}:00`;
        sel.appendChild(opt);
      }
    } catch {}
  }

  // Get API function from global scope
  const api = window.api;
  const show = window.show;
  const toast = (...args) => {
    try {
      const t = (typeof window !== 'undefined') ? window.toast : null;
      if (typeof t === 'function') return t(...args);
    } catch {}
    try { console.log('[toast]', ...args); } catch {}
  };
  const currentUserId = window.currentUserId;
  const token = () => window.token;
  const errorMessage = (err, fb) => {
    try { if (typeof window.errorMessage === 'function') return window.errorMessage(err, fb); } catch {}
    try { return (err && err.data && err.data.detail) ? err.data.detail : (err?.message || fb || 'Error'); } catch { return fb || 'Error'; }
  };

  // --- Browser Notifications for Meetups ---
  function ensureNotificationPermission() {
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      Notification.requestPermission().catch(() => {});
    } catch {}
    return false;
  }

  function getNotifiedMeetups() {
    try {
      const raw = localStorage.getItem('notified_meetups');
      const set = new Set(JSON.parse(raw || '[]'));
      return set;
    } catch { return new Set(); }
  }

  function saveNotifiedMeetups(set) {
    try {
      localStorage.setItem('notified_meetups', JSON.stringify(Array.from(set)));
    } catch {}
  }

  function notifyProposedMeetup(item) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const otherLabel = item.other_display_name ? item.other_display_name : `user ${item.other_user_id}`;
      const when = item.proposed_dt_utc ? new Date(item.proposed_dt_utc) : null;
      const hh = when ? String(when.getHours()).padStart(2,'0') : '';
      const mm = when ? String(when.getMinutes()).padStart(2,'0') : '';
      const date = when ? `${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}-${String(when.getDate()).padStart(2,'0')}` : '';
      const title = 'Meetup proposed — needs your confirmation';
      const body = otherLabel && when ? `${otherLabel} proposed ${date} ${hh}:${mm} (UTC)` : 'A meetup has been proposed.';
      const n = new Notification(title, { body });
      n.onclick = () => {
        try { n.close(); } catch {}
        try {
          if (window && window.location) {
            // Navigate to dashboard; if already there, just focus
            if (!/\/dashboard\.html$/i.test(window.location.pathname)) {
              window.location.href = '/dashboard.html';
            } else {
              window.focus();
            }
          }
        } catch {}
      };
    } catch {}
  }

  // Helper to fetch and render matches based on current input fields
  const matchPagination = {
    limit: 10,
    offset: 0,
    total: 0,
    hasMore: false,
    filters: {
      min_score: 50,
      lookahead_days: 14,
      max_overlaps: 5,
    },
  };

  const renderMatchesPager = () => {
    const pager = document.getElementById('matchesPager');
    if (!pager) return;
    const { limit, offset, total, hasMore } = matchPagination;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = total ? Math.ceil(total / limit) : page;
    const prevDisabled = offset <= 0;
    const nextDisabled = !hasMore;
    pager.innerHTML = `
      <div class="pager">
        <button class="button secondary pager-prev" ${prevDisabled ? 'disabled' : ''} data-i18n="dashboard.prev">Previous</button>
        <span class="pager-status">Page ${page}${totalPages ? ` / ${totalPages}` : ''}</span>
        <button class="button secondary pager-next" ${nextDisabled ? 'disabled' : ''} data-i18n="dashboard.next">Next</button>
      </div>
    `;
    try { if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') window.SimpleI18n.updateUI(); } catch {}
  };

  const fetchAndRenderMatches = async ({ useOffset } = {}) => {
    const user_id = currentUserId;
    if (!user_id) {
      console.warn('No user ID available for match finding');
      return;
    }
    if (typeof useOffset === 'number') {
      matchPagination.offset = Math.max(0, useOffset);
    }
    const body = {
      user_id,
      limit: matchPagination.limit,
      offset: matchPagination.offset,
      ...matchPagination.filters,
    };
    const { data, response } = await api("/api/match/find", { method: "POST", body, auth: true, returnResponse: true });
    const totalHeader = response.headers.get('X-Total-Count');
    const hasMoreHeader = response.headers.get('X-Has-More');
    matchPagination.total = totalHeader ? parseInt(totalHeader, 10) || 0 : (Array.isArray(data) ? data.length : 0);
    matchPagination.hasMore = hasMoreHeader ? hasMoreHeader.toLowerCase() === 'true' : false;

    const determineViewerLang = () => {
      try {
        if (window.SimpleI18n && typeof window.SimpleI18n.currentLang === 'string') {
          const lang = window.SimpleI18n.currentLang.trim();
          if (lang) return lang.toLowerCase();
        }
      } catch {}
      try {
        const stored = localStorage.getItem('selectedLanguage');
        if (stored) return stored.trim().toLowerCase();
      } catch {}
      try {
        const nav = navigator?.language || navigator?.userLanguage;
        if (nav) return String(nav).split('-')[0].toLowerCase();
      } catch {}
      return 'en';
    };

    const viewerLang = determineViewerLang();

    const getLangName = (code) => {
      if (!code) return '';
      const normalized = String(code).toLowerCase();
      try {
        const map = window.SimpleI18n?.languages;
        if (map && map[normalized]) {
          return map[normalized];
        }
      } catch {}
      return normalized.toUpperCase();
    };

    const formatLangList = (list = []) => {
      if (!Array.isArray(list)) return '';
      return list.filter(Boolean).map(code => getLangName(code)).join(', ');
    };

    // Pretty render: candidates with score and overlaps (UTC + local)
    const cont = document.getElementById('matches');
    if (cont) {
      let items = '';
      // Show current page of candidates; if none overlaps, render without overlap chips
      const list = Array.isArray(data) ? data : [];
      for (const cand of list) {
        const otherName = (cand.other_display_name && String(cand.other_display_name).trim())
          ? String(cand.other_display_name).trim()
          : `user ${cand.user_id}`;
        let chips = '';
        if (Array.isArray(cand.overlaps) && cand.overlaps.length) {
          for (const ov of cand.overlaps) {
            const youCity = ov.a_tz || null;
            const otherCity = ov.b_tz || null;
            const startIso = String(ov.start_dt_utc);
            const utc = `${ov.start_dt_utc} → ${ov.end_dt_utc} (UTC)`; // kept for fallback / debug
            const dur = humanDuration(ov.start_dt_utc, ov.end_dt_utc);
            const youBlock = (ov.a_local_start && ov.a_local_end && ov.a_tz)
              ? `
                <div class=\"chip-col\">
                  <div class=\"meta\">you${youCity ? ' ('+youCity+(tzOffsetLabel(youCity, ov.start_dt_utc) ? ' ('+tzOffsetLabel(youCity, ov.start_dt_utc)+')' : '')+')' : ''}</div>
                  <div class=\"meta\">${extractDate(ov.a_local_start)}</div>
                  <div class=\"meta\">${extractTime(ov.a_local_start)}</div>
                  <div class=\"meta\">${dur}</div>
                </div>
              ` : '';
            const otherBlock = (ov.b_local_start && ov.b_local_end && ov.b_tz)
              ? `
                <div class=\"chip-col\">
                  <div class=\"meta\">${otherName.trim() || `user ${cand.user_id}`}${otherCity ? ' ('+otherCity+(tzOffsetLabel(otherCity, ov.start_dt_utc) ? ' ('+tzOffsetLabel(otherCity, ov.start_dt_utc)+')' : '')+')' : ''}</div>
                  <div class=\"meta\">${extractDate(ov.b_local_start)}</div>
                  <div class=\"meta\">${extractTime(ov.b_local_start)}</div>
                  <div class=\"meta\">${dur}</div>
                </div>
              ` : '';
            chips += `
              <div class="chip">
                <div class="chip-grid">
                  <div class="chip-col">
                    <div class="meta">UTC</div>
                    <div class="meta">${extractDate(ov.start_dt_utc)}</div>
                    <div class="meta">${extractTime(ov.start_dt_utc)}</div>
                    <div class="meta">${dur}</div>
                  </div>
                  ${youBlock}
                  ${otherBlock}
                </div>
                <div class="item-actions">
                  <button class="button btn-meet-from-overlap" data-cand="${cand.user_id}" data-start="${startIso}" data-i18n="dashboard.propose_time">Propose time</button>
                </div>
              </div>`;
          }
        }
        const title = `${otherName}`;
        const score = `<span class="badge">score ${cand.score}</span>`;
        // Prepare a single language badge (first shared language) to show in the header
        let headerLangBadge = '';
        try {
          if (Array.isArray(cand.shared_languages) && cand.shared_languages.length) {
            const c = cand.shared_languages[0];
            const i18n = window.SimpleI18n;
            const name = (i18n && i18n.languages && i18n.languages[c]) ? i18n.languages[c] : c;
            headerLangBadge = `<span class='badge'>${name}</span>`;
          }
        } catch {}
        // Remove languages block from body to avoid duplication
        const langBadges = '';
        const safeComment = cand.comment ? String(cand.comment).replace(/</g,'&lt;') : '';
        const commentLang = cand.comment_lang ? String(cand.comment_lang).toLowerCase() : null;
        const availableLangsRaw = Array.isArray(cand.available_comment_langs) ? cand.available_comment_langs : [];
        const availableLangs = availableLangsRaw.map(code => String(code).toLowerCase());

        let commentMeta = '';
        if (commentLang) {
          const badgeClass = (viewerLang && commentLang === viewerLang) ? 'badge success' : 'badge secondary';
          const otherLangs = availableLangs.filter(code => code !== commentLang);
          const viewerHint = (viewerLang && commentLang !== viewerLang)
            ? `<span class="meta muted">${getLangName(viewerLang)} preferred</span>`
            : '';
          const otherHint = otherLangs.length
            ? `<span class="meta muted">${formatLangList(otherLangs)}</span>`
            : '';
          commentMeta = `
            <div class="item-sub comment-lang-meta">
              <span class="${badgeClass}">${getLangName(commentLang)}</span>
              ${viewerHint}
              ${otherHint}
            </div>
          `;
        } else if (availableLangs.length) {
          commentMeta = `
            <div class="item-sub comment-lang-meta muted">
              ${formatLangList(availableLangs)}
            </div>
          `;
        }

        let commentBlock = '';
        if (safeComment) {
          commentBlock = `
            <div class="chips">
              <div class="chip">
                <div class="item-sub">“${safeComment}”</div>
                ${commentMeta || ''}
              </div>
            </div>
          `;
        } else if (commentMeta) {
          commentBlock = `
            <div class="chips">
              <div class="chip">
                ${commentMeta}
              </div>
            </div>
          `;
        }

        const preferredLang = viewerLang || 'en';
        const baseAnnotateLabel = (window.SimpleI18n && typeof window.SimpleI18n.t === 'function')
          ? window.SimpleI18n.t('dashboard.generate_ai_comment')
          : 'Generate AI comment';
        let annotateLabel = baseAnnotateLabel;
        if (cand.comment && preferredLang) {
          annotateLabel = `${baseAnnotateLabel} (${getLangName(preferredLang)})`;
        }
        const shouldOfferAnnotate = !cand.comment || cand.has_other_comment_langs;
        const matchAttr = cand.match_id ? ` data-match-id="${cand.match_id}"` : '';
        const annotateBtn = shouldOfferAnnotate
          ? `<div class="item-actions center"><button class="button secondary btn-annotate-match" data-cand="${cand.user_id}" data-lang="${preferredLang}"${matchAttr}>${annotateLabel}</button></div>`
          : '';

        items += `
          <li class="item-card">
            <div class="item-head">
              <div class="item-title">${title}</div>
              <div style="display:flex; gap:8px; align-items:center;">${headerLangBadge}${score}</div>
            </div>
            ${chips ? `<div class="chips">${chips}</div>` : ''}
            ${commentBlock}
            ${annotateBtn}
          </li>`;
      }
      cont.innerHTML = `<ul class="list">${items}</ul>`;
      try { if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') window.SimpleI18n.updateUI(); } catch {}
      if (!items) {
        // Optional: hint when no overlaps found
        cont.innerHTML = `<div class="muted">No overlapping slots found. Add availability or try again later.</div>`;
      }
    } else {
      const ts = new Date().toISOString();
      let html = `[${ts}] match.find:`;
      html += "<ul>";
      for (const cand of data) {
        const otherName = cand.other_display_name ? cand.other_display_name : `user ${cand.user_id}`;
        html += `<li>${otherName} — score ${cand.score}`;
        if (cand.comment) {
          html += `<br/><small>AI comment:</small> ${cand.comment}`;
        } else {
          html += ` <button class="btn-annotate-match" data-cand="${cand.user_id}" title="Generate a short AI summary for this match">Generate AI comment</button>`;
        }
        if (Array.isArray(cand.overlaps) && cand.overlaps.length) {
          html += "<br/><small>overlaps:</small><ul>";
          for (const ov of cand.overlaps) {
            const utc = `${ov.start_dt_utc} → ${ov.end_dt_utc} (UTC)`;
            const youLoc = (ov.a_local_start && ov.a_local_end && ov.a_tz)
              ? ` | you: ${ov.a_local_start} → ${ov.a_local_end} (${ov.a_tz})` : "";
            const otherLoc = (ov.b_local_start && ov.b_local_end && ov.b_tz)
              ? ` | ${otherName}: ${ov.b_local_start} → ${ov.b_local_end} (${ov.b_tz})` : "";
            const startIso = String(ov.start_dt_utc);
            html += `<li>${utc}${youLoc}${otherLoc} ` +
              `<button class="btn-meet-from-overlap" data-cand="${cand.user_id}" data-start="${startIso}">Meet here</button>` +
              `</li>`;
          }
          html += "</ul>";
        }
        html += "</li>";
      }
      html += "</ul><br/>";
      const out = document.getElementById('out');
      if (out) out.innerHTML = html + out.innerHTML;
    }
  };

  // Helper to fetch and render meetups
  const fetchAndRenderMeetups = async () => {
    try {
      const data = await api("/api/meetup/list", { auth: true });
      const cont = document.getElementById('meetups');
      if (cont) {
        // Prepare notification tracking set
        const notified = getNotifiedMeetups();
        // Filter to upcoming meetups only (either proposed or confirmed is in the future)
        const now = new Date();
        const upcoming = (data || []).filter((item) => {
          const p = item.proposed_dt_utc ? new Date(item.proposed_dt_utc) : null;
          const c = item.confirmed_dt_utc ? new Date(item.confirmed_dt_utc) : null;
          const pFuture = p && p.getTime() >= now.getTime();
          const cFuture = c && c.getTime() >= now.getTime();
          return pFuture || cFuture; // keep if any future time exists
        }).sort((a,b) => {
          const ad = new Date(a.confirmed_dt_utc || a.proposed_dt_utc || 0).getTime();
          const bd = new Date(b.confirmed_dt_utc || b.proposed_dt_utc || 0).getTime();
          return ad - bd;
        });

        let items = '';
        for (const item of upcoming) {
          const title = `Meetup #${item.meetup_id}`;
          const otherLabel = (item.other_display_name && String(item.other_display_name).trim())
            ? String(item.other_display_name).trim()
            : `user ${item.other_user_id}`;
          const subtitle = `Match #${item.match_id} • with ${otherLabel}`;
          const status = `<span class="badge ${item.status==='confirmed'?'success': (item.status==='canceled'?'error':'info')}">${item.status}</span>`;

          const buildChip = (label, dtUtc, byline) => {
            if (!dtUtc) return '';
            const utcDate = extractDate(dtUtc);
            const utcTime = extractTime(dtUtc);
            const d = new Date(dtUtc);
            const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const localTime = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            // Determine user's timezone label and offset
            let userTz = window.liveTz || null;
            if (!userTz) { try { userTz = localStorage.getItem('live_tz'); } catch {} }
            if (!userTz) { try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {} }
            if (!userTz) userTz = 'UTC';
            const tzOff = tzOffsetLabel(userTz, dtUtc);
            return `
              <div class="chip">
                ${label !== 'Proposed' ? `<div class="meta" style="font-weight:700;">${label}</div>` : ''}
                ${byline ? `<div class="meta">${byline}</div>` : ''}
                <div class="chip-grid">
                  <div class="chip-col">
                    <div class="meta">UTC</div>
                    <div class="meta">${utcDate}</div>
                    <div class="meta">${utcTime}</div>
                  </div>
                  <div class="chip-col">
                    <div class="meta tz-inline">${userTz}${tzOff ? ' ('+tzOff+')' : ''}</div>
                    <div class="meta">${localDate}</div>
                    <div class="meta">${localTime}</div>
                  </div>
                </div>
              </div>`;
          };

          const proposedChip = buildChip('Proposed', item.proposed_dt_utc);
          const confirmedChip = buildChip('Confirmed', item.confirmed_dt_utc);
          const whoProposed = '';
          const whoConfirmed = '';
          const join = (item.status==='confirmed' && item.jitsi_url)
            ? `<a class="button" href="${String(item.jitsi_url).replace(/\"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">Join</a>`
            : '';
          const canConfirm = (item.status==='proposed' && item.proposed_dt_utc && item.proposer_user_id !== currentUserId);
          const confirmBtn = canConfirm
            ? `<button class="button btn-confirm-meetup" data-id="${item.meetup_id}" data-dt="${item.proposed_dt_utc}">Confirm</button>`
            : '';
          const canUnconfirm = (item.status==='confirmed' && item.confirmer_user_id === currentUserId);
          const unconfirmBtn = canUnconfirm ? `<button class="button secondary btn-unconfirm-meetup" data-id="${item.meetup_id}">Unconfirm</button>` : '';
          const delBtn = `<button class="button danger btn-delete-meetup" data-id="${item.meetup_id}">Delete</button>`;
          // Only show "Propose meetup" if no time has been proposed yet
          const canPropose = !item.proposed_dt_utc;
          const meetProposeBtn = canPropose ? `<button class="button secondary btn-meet-propose" data-id="${item.meetup_id}">Propose meetup</button>` : '';
          const headerRight = `<div style="display:flex; gap:8px; align-items:center;">${status} ${join} ${delBtn}</div>`;

          items += `
            <li class="item-card">
              <div class="item-head">
                <div class="item-title">${subtitle}</div>
                ${headerRight}
              </div>
              <div class="chips">
                ${proposedChip}
                ${confirmedChip}
              </div>
              ${whoProposed}
              ${whoConfirmed}
              <div class="item-actions">${confirmBtn} ${unconfirmBtn} ${meetProposeBtn}</div>
            </li>`;
        }
        cont.innerHTML = `<ul class="list">${items}</ul>`;

        // After render: send browser notifications for any newly proposed meetups awaiting confirmation
        try {
          if (ensureNotificationPermission()) {
            for (const item of upcoming) {
              const isAwaiting = item.status === 'proposed' && item.proposed_dt_utc && item.proposer_user_id !== currentUserId;
              if (!isAwaiting) continue;
              const key = String(item.meetup_id);
              if (!notified.has(key)) {
                notifyProposedMeetup(item);
                notified.add(key);
              }
            }
            saveNotifiedMeetups(notified);
          }
        } catch {}
      } else {
        const ts = new Date().toISOString();
        let html = `[${ts}] meetup.list:`;
        html += "<ul>";
        for (const item of data) {
          const base = `#${item.meetup_id} (match ${item.match_id}) other_user=${item.other_user_id} status=${item.status}`;
          html += `<li>${base}`;
          if (item.status === 'confirmed' && item.jitsi_url) {
            const safeUrl = String(item.jitsi_url).replace(/"/g, '&quot;');
            html += ` — <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Join</a>`;
          }
          html += "</li>";
        }
        html += "</ul><br/>";
        const out = document.getElementById('out');
        if (out) out.innerHTML = html + out.innerHTML;
      }
    } catch (e) { show("meetup.list:ERROR", e); }
  };

  // Availability handlers
  async function fetchAvailList() {
      try {
        const data = await api("/api/availability", { auth: true });
        const cont = document.getElementById('availList');
        if (cont) {
          const items = data.map(s => {
            const dur = humanDuration(s.start_dt_utc, s.end_dt_utc);
            // Use stored local times from database if available, otherwise fallback to conversion
            let localDate, localTime, tzLabel, tzOffset;
            
            if (s.start_dt_local && s.timezone) {
              // Use stored local time and timezone from database
              localDate = extractDate(s.start_dt_local);
              localTime = extractTime(s.start_dt_local);
              // Validate timezone; fallback to a safe IANA value
              let tzCandidate = s.timezone;
              if (!isValidIanaTimeZone(tzCandidate)) {
                tzCandidate = (window.liveTz || localStorage.getItem('live_tz') || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
              }
              tzLabel = tzCandidate;
              tzOffset = isValidIanaTimeZone(tzCandidate) ? tzOffsetLabel(tzCandidate, s.start_dt_utc) : '';
            } else {
              // Fallback: convert UTC to user's profile timezone
              const startUTC = new Date(s.start_dt_utc);
              let userTz = window.liveTz || localStorage.getItem('live_tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
              if (!isValidIanaTimeZone(userTz)) userTz = 'UTC';
              const startLocal = new Date(startUTC.toLocaleString("en-US", {timeZone: userTz}));
              
              localDate = `${startLocal.getFullYear()}-${pad2(startLocal.getMonth()+1)}-${pad2(startLocal.getDate())}`;
              localTime = `${pad2(startLocal.getHours())}:${pad2(startLocal.getMinutes())}`;
              tzLabel = userTz;
              tzOffset = isValidIanaTimeZone(userTz) ? tzOffsetLabel(userTz, s.start_dt_utc) : '';
            }
            
            const utcDate = extractDate(s.start_dt_utc);
            const utcTime = extractTime(s.start_dt_utc);
            return `
            <li class="item-card">
              <div class="item-head">
                <div class="item-title">Slot #${s.id}</div>
                <div class="item-actions">
                  <button class="button secondary btn-edit-slot"
                    data-id="${s.id}"
                    data-start="${s.start_dt_utc}"
                    data-end="${s.end_dt_utc}"
                    data-local-date="${localDate}"
                    data-local-hour="${localTime.slice(0,2)}"
                    data-tz="${isValidIanaTimeZone(tzLabel) ? tzLabel : 'UTC'}" data-i18n="dashboard.slot_edit">Edit</button>
                  <button class="button secondary btn-delete-slot" data-id="${s.id}" data-i18n="dashboard.slot_delete">Delete</button>
                </div>
              </div>
              <div class="chips">
                <div class="chip">
                  <div class="chip-grid">
                    <div class="chip-col">
                      <div class="meta">UTC</div>
                      <div class="time">${utcDate}</div>
                      <div class="time">${utcTime}</div>
                      <div class="duration">${dur}</div>
                    </div>
                    <div class="chip-col">
                      <div class="meta tz-inline">${tzLabel}${tzOffset ? ' ('+tzOffset+')' : ''}</div>
                      <div class="time">${localDate}</div>
                      <div class="time">${localTime}</div>
                      <div class="duration">${dur}</div>
                    </div>
                  </div>
                  
                  <div class="edit-row" style="display:none; margin-top:8px;">
                    <div class="avail-grid">
                      <div class="avail-group">
                        <input type="date" class="edit-start-date" />
                        <select class="edit-start-hour" title="Start hour (0–23)"></select>
                        <select class="edit-duration-hours" title="Duration (hours)">
                          <option value="1">1 hour</option>
                          <option value="2">2 hours</option>
                          <option value="3">3 hours</option>
                        </select>
                      </div>
                    </div>
                    <div class="item-actions" style="margin-top:8px;">
                      <button class="button btn-save-slot" data-id="${s.id}">Save</button>
                      <button class="button secondary btn-cancel-edit">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            </li>`;
          }).join('');
          cont.innerHTML = `<ul class="list">${items}</ul>`;
          try { if (window.SimpleI18n && typeof window.SimpleI18n.updateUI === 'function') window.SimpleI18n.updateUI(); } catch {}
        } else {
          const ts = new Date().toISOString();
          let html = `[${ts}] availability.list:`;
          html += "<ul>";
          for (const item of data) {
            html += `<li>#${item.id} ${item.start_dt_utc} → ${item.end_dt_utc}</li>`;
          }
          html += "</ul><br/>";
          const out = document.getElementById('out');
          if (out) out.innerHTML = html + out.innerHTML;
        }
      } catch (e) { show("availability.list:ERROR", e); }
  }

  // Expose functions globally
  window.fetchAndRenderMatches = fetchAndRenderMatches;
  window.fetchAvailList = fetchAvailList;

  // Dashboard-specific event handlers
  document.addEventListener('DOMContentLoaded', () => {
    const bindClick = window.bindClick;
    // Initialize top timezone badge
    try { updateTopTzBadge(); } catch {}
    // Keep badge in sync across tabs when localStorage changes
    try {
      window.addEventListener('storage', (ev) => {
        if (ev && ev.key === 'live_tz') updateTopTzBadge();
      });
    } catch {}
    
    // Bind button if present, but allow direct calls elsewhere
    bindClick("btn-avail-list", fetchAvailList);

    // Match: we trigger fetch directly on load; button is optional and no longer required

    // Remove deprecated Meetups refresh button if still present in DOM
    try { document.getElementById('btn-meet-list')?.remove(); } catch {}

    bindClick("btn-match-create", async () => {
      try {
        const a_user_id = parseInt($("createA").value, 10);
        const b_user_id = parseInt($("createB").value, 10);
        const data = await api("/api/match/create", { method: "POST", body: { a_user_id, b_user_id }, auth: true });
        show("match.create", data);
        // Periodically refresh meetups to catch new proposals and trigger notifications (every 20 minutes)
        try { setInterval(() => { fetchAndRenderMeetups().catch(()=>{}); }, 1200000); } catch {}
      } catch (e) { show("match.create:ERROR", e); }
    });

    // Meetup handlers
    bindClick("btn-meet-propose", async () => {
      try {
        const match_id = parseInt($("meetMatchId").value, 10);
        const data = await api("/api/meetup/propose", { method: "POST", body: { match_id }, auth: true });
        show("meetup.propose", data);
        // Refresh meetups list on dashboard if present
        try { await document.getElementById('btn-meet-list')?.click(); } catch {}
        toast('Meetup proposed');
      } catch (e) { show("meetup.propose:ERROR", e); }
    });

    bindClick("btn-meet-list", async () => {
      try {
        const data = await api("/api/meetup/list", { auth: true });
        const cont = document.getElementById('meetups');
        if (cont) {
          // Filter to upcoming meetups only (either proposed or confirmed is in the future)
          const now = new Date();
          const upcoming = (data || []).filter((item) => {
            const p = item.proposed_dt_utc ? new Date(item.proposed_dt_utc) : null;
            const c = item.confirmed_dt_utc ? new Date(item.confirmed_dt_utc) : null;
            const pFuture = p && p.getTime() >= now.getTime();
            const cFuture = c && c.getTime() >= now.getTime();
            return pFuture || cFuture; // keep if any future time exists
          }).sort((a,b) => {
            const ad = new Date(a.confirmed_dt_utc || a.proposed_dt_utc || 0).getTime();
            const bd = new Date(b.confirmed_dt_utc || b.proposed_dt_utc || 0).getTime();
            return ad - bd;
          });

          let items = '';
          for (const item of upcoming) {
            const title = `Meetup #${item.meetup_id}`;
            const otherLabel = item.other_display_name ? item.other_display_name : `user ${item.other_user_id}`;
            const subtitle = `Match #${item.match_id} • with ${otherLabel}`;
            const status = `<span class="badge ${item.status==='confirmed'?'success': (item.status==='canceled'?'error':'info')}">${item.status}</span>`;

            const buildChip = (label, dtUtc, byline) => {
              if (!dtUtc) return '';
              const utcDate = extractDate(dtUtc);
              const utcTime = extractTime(dtUtc);
              const d = new Date(dtUtc);
              const localDate = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
              const localTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
              // Determine user's timezone label and offset
              let userTz = window.liveTz || null;
              if (!userTz) { try { userTz = localStorage.getItem('live_tz'); } catch {} }
              if (!userTz) { try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {} }
              if (!userTz) userTz = 'UTC';
              const tzOff = tzOffsetLabel(userTz, dtUtc);
              return `
                <div class="chip">
                  ${label !== 'Proposed' ? `<div class="meta" style="font-weight:700;">${label}</div>` : ''}
                  ${byline ? `<div class="meta">${byline}</div>` : ''}
                  <div class="chip-grid">
                    <div class="chip-col">
                      <div class="meta">UTC</div>
                      <div class="meta">${utcDate}</div>
                      <div class="meta">${utcTime}</div>
                    </div>
                    <div class="chip-col">
                      <div class="meta tz-inline">${userTz}${tzOff ? ' ('+tzOff+')' : ''}</div>
                      <div class="meta">${localDate}</div>
                      <div class="meta">${localTime}</div>
                    </div>
                  </div>
                </div>`;
            };

            const proposedChip = buildChip('Proposed', item.proposed_dt_utc);
            const confirmedChip = buildChip('Confirmed', item.confirmed_dt_utc);
            const whoProposed = '';
            const whoConfirmed = '';
            const join = (item.status==='confirmed' && item.jitsi_url)
              ? `<a class="button" href="${String(item.jitsi_url).replace(/\"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">Join</a>`
              : '';
            const canConfirm = (item.status==='proposed' && item.proposed_dt_utc && item.proposer_user_id !== currentUserId);
            const confirmBtn = canConfirm
              ? `<button class="button btn-confirm-meetup" data-id="${item.meetup_id}" data-dt="${item.proposed_dt_utc}">Confirm</button>`
              : '';
            const canUnconfirm = (item.status==='confirmed' && item.confirmer_user_id === currentUserId);
            const unconfirmBtn = canUnconfirm ? `<button class="button secondary btn-unconfirm-meetup" data-id="${item.meetup_id}">Unconfirm</button>` : '';
            const delBtn = `<button class="button danger btn-delete-meetup" data-id="${item.meetup_id}">Delete</button>`;
            items += `
              <li class="item-card">
                <div class="item-head">
                  <div class="item-title">${subtitle}</div>
                  <div style="display:flex; gap:8px; align-items:center;">${status} ${join} ${delBtn}</div>
                </div>
                <div class="chips">
                  ${proposedChip}
                  ${confirmedChip}
                </div>
                ${whoProposed}
                ${whoConfirmed}
                <div class="item-actions">${confirmBtn} ${unconfirmBtn}</div>
              </li>`;
          }
          cont.innerHTML = `<ul class="list">${items}</ul>`;
        } else {
          const ts = new Date().toISOString();
          let html = `[${ts}] meetup.list:`;
          html += "<ul>";
          for (const item of data) {
            const base = `#${item.meetup_id} (match ${item.match_id}) other_user=${item.other_user_id} status=${item.status}`;
            html += `<li>${base}`;
            if (item.status === 'confirmed' && item.jitsi_url) {
              const safeUrl = String(item.jitsi_url).replace(/"/g, '&quot;');
              html += ` — <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Join</a>`;
            }
            html += "</li>";
          }
          html += "</ul><br/>";
          const out = document.getElementById('out');
          if (out) out.innerHTML = html + out.innerHTML;
        }
      } catch (e) { show("meetup.list:ERROR", e); }
    });

    // Event delegation for dynamically created buttons
    document.addEventListener('click', async (e) => {
      // Allow normal link behavior for external links (including Jitsi)
      try {
        const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
        if (a && a.href && (
              a.href.includes('jitsi') || a.target === '_blank' ||
              !a.href.startsWith(window.location.origin)
            )) {
          return; // Let the browser handle the link normally
        }
      } catch {}
      if (e.target.classList.contains('btn-unconfirm-meetup')) {
        const meetupId = parseInt(e.target.dataset.id, 10);
        const ok = window.confirm('Unconfirm this meetup? The time will return to proposed status.');
        if (!ok) return;
        try {
          await api('/api/meetup/unconfirm', { method: 'POST', body: { meetup_id: meetupId }, auth: true });
          toast('Meetup unconfirmed');
          await fetchAndRenderMeetups();
        } catch (err) {
          toast(errorMessage(err, 'Failed to unconfirm meetup'), 'error');
          show('meetup.unconfirm:ERROR', err);
        }
        return;
      }

      if (e.target.classList.contains('btn-cancel-meetup')) {
        const meetupId = parseInt(e.target.dataset.id, 10);
        const ok = window.confirm('Cancel this meetup for both participants?');
        if (!ok) return;
        try {
          await api('/api/meetup/cancel', { method: 'POST', body: { meetup_id: meetupId }, auth: true });
          toast('Meetup canceled');
          await fetchAndRenderMeetups();
        } catch (err) {
          toast(errorMessage(err, 'Failed to cancel meetup'), 'error');
          show('meetup.cancel:ERROR', err);
        }
        return;
      }

      if (e.target.classList.contains('btn-delete-meetup')) {
        const meetupId = parseInt(e.target.dataset.id, 10);
        try {
          await api(`/api/meetup/${meetupId}`, { method: 'DELETE', auth: true });
          toast('Meetup deleted');
          try { if (window.fetchAndRenderMeetups) await window.fetchAndRenderMeetups(); } catch {}
        } catch (err) {
          toast(errorMessage(err, 'Failed to delete meetup'), 'error');
          show('meetup.delete:ERROR', err);
        }
      }

      
      if (e.target.classList.contains('btn-confirm-meetup')) {
        const meetupId = parseInt(e.target.dataset.id, 10);
        const dt = e.target.dataset.dt;
        try {
          await api(`/api/meetup/confirm`, { method: 'POST', body: { meetup_id: meetupId, confirmed_dt_utc: dt }, auth: true });
          toast('Meetup confirmed');
          await fetchAndRenderMeetups();
        } catch (err) {
          toast(errorMessage(err, 'Failed to confirm meetup'), 'error');
          show('meetup.confirm:ERROR', err);
        }
      }
      
      if (e.target.classList.contains('btn-delete-slot')) {
        const slotId = e.target.dataset.id;
        try {
          await api(`/api/availability/${slotId}`, { method: 'DELETE', auth: true });
          toast('Slot deleted');
          // Auto-refresh availability list like create slot does
          try { if (window.fetchAvailList) await window.fetchAvailList(); } catch {}
          // Also refresh matches so the overlaps list updates immediately
          try { if (window.fetchAndRenderMatches) await window.fetchAndRenderMatches(); } catch {}
        } catch (err) {
          toast(errorMessage(err, 'Failed to delete slot'), 'error');
          show('availability.delete:ERROR', err);
        }
      }
      
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.btn-edit-slot')) {
        const btn = e.target.closest('.btn-edit-slot');
        const item = btn.closest('.item-card');
        if (!item) return;
        const editor = item.querySelector('.edit-row');
        if (!editor) return;
        // Populate inputs with current values
        const startUtc = btn.dataset.start;
        const endUtc = btn.dataset.end;
        const dStart = new Date(startUtc);
        const dEnd = new Date(endUtc);
        const sDateEl = editor.querySelector('.edit-start-date');
        const sHourEl = editor.querySelector('.edit-start-hour');
        // Ensure the hour select has 0..23 options
        try { populateHourOptions(sHourEl); } catch {}
        const durEl = editor.querySelector('.edit-duration-hours');
        populateHourOptions(sHourEl);
        // Prefer local prefilled values from data- attributes when available
        const preLocalDate = btn.dataset.localDate;
        const preLocalHour = btn.dataset.localHour;
        if (sDateEl && preLocalDate) {
          sDateEl.value = preLocalDate;
        } else if (sDateEl && dStart instanceof Date && !isNaN(dStart.getTime())) {
          sDateEl.value = `${dStart.getFullYear()}-${pad2(dStart.getMonth()+1)}-${pad2(dStart.getDate())}`;
        }
        if (sHourEl && preLocalHour) {
          sHourEl.value = String(parseInt(preLocalHour, 10));
        } else if (sHourEl && dStart instanceof Date && !isNaN(dStart.getTime())) {
          sHourEl.value = String(dStart.getHours());
        }
        if (durEl && dStart instanceof Date && dEnd instanceof Date && !isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
          const hours = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / 3600000));
          durEl.value = String(Math.max(1, Math.min(3, hours)));
        }
        editor.style.display = 'block';
      }

      if (e.target.classList.contains('btn-cancel-edit')) {
        const editor = e.target.closest('.edit-row');
        if (editor) editor.style.display = 'none';
      }

      if (e.target.classList.contains('btn-save-slot')) {
        const btn = e.target;
        const slotId = btn.dataset.id;
        const editor = btn.closest('.edit-row');
        if (!editor) return;
        const sDateEl = editor.querySelector('.edit-start-date');
        const sHourEl = editor.querySelector('.edit-start-hour');
        const durEl = editor.querySelector('.edit-duration-hours');
        const sDate = sDateEl ? sDateEl.value : null;
        const sHour = sHourEl ? sHourEl.value : null;
        const dur = durEl ? parseInt(durEl.value || '1', 10) : 1;
        try {
          // Prefer stored timezone from the button, then profile/browser
          let tz = btn.dataset.tz || ((typeof window !== 'undefined' && window.liveTz) ? window.liveTz : null);
          if (!tz) { try { tz = localStorage.getItem('live_tz'); } catch {} }
          if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {} }
          if (!tz) tz = 'UTC';
          const startIso = buildUtcIsoFromTz(sDate, sHour, tz);
          if (!startIso || isNaN(dur)) {
            toast('Please provide valid date, start hour and duration', 'error');
            return;
          }
          const endDate = new Date(new Date(startIso).getTime() + dur*3600*1000);
          const endIso = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
          if (new Date(endIso) <= new Date(startIso)) {
            toast('End must be after start', 'error');
            return;
          }
          // Also send local wall times and timezone to persist historical local context
          function fmt2(n){ return String(n).padStart(2,'0'); }
          function isoLocal(y, m, d, h){ return `${y}-${fmt2(m)}-${fmt2(d)}T${fmt2(h)}:00:00`; }
          function addDays(y, m, d, days){
            const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
            dt.setUTCDate(dt.getUTCDate() + days);
            return { y: dt.getUTCFullYear(), m: dt.getUTCMonth()+1, d: dt.getUTCDate() };
          }
          const [yLocal, mLocal, dLocal] = sDate.split('-').map(Number);
          let endHourLocal = parseInt(sHour, 10) + dur;
          let y2 = yLocal, m2 = mLocal, d2 = dLocal;
          while (endHourLocal >= 24) { endHourLocal -= 24; ({y: y2, m: m2, d: d2} = addDays(y2, m2, d2, 1)); }
          const startLocalIso = isoLocal(yLocal, mLocal, dLocal, parseInt(sHour, 10));
          const endLocalIso = isoLocal(y2, m2, d2, endHourLocal);
          await api(`/api/availability/${slotId}`, { method: 'PATCH', auth: true, body: {
            start_dt_utc: startIso,
            end_dt_utc: endIso,
            start_dt_local: startLocalIso,
            end_dt_local: endLocalIso,
            timezone: tz
          } });
          toast('Slot updated');
          editor.style.display = 'none';
          try { if (window.fetchAvailList) await window.fetchAvailList(); } catch {}
          // Also refresh matches after updating a slot
          try { if (window.fetchAndRenderMatches) await window.fetchAndRenderMatches(); } catch {}
        } catch (err) {
          toast(errorMessage(err, 'Failed to update slot'), 'error');
          show('availability.patch:ERROR', err);
        }
      }
      
      if (e.target.classList.contains('btn-meet-from-overlap')) {
        const btn = e.target;
        const candId = parseInt(btn.dataset.cand, 10);
        const startDt = btn.dataset.start;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Proposing…';
        try {
          // Create a match between current user and candidate, then propose at selected time
          const mc = await api('/api/match/create', { method: 'POST', auth: true, body: { a_user_id: currentUserId, b_user_id: candId } });
          await api('/api/meetup/propose', { method: 'POST', auth: true, body: { match_id: mc.match_id, proposed_dt_utc: startDt } });
          toast('Meetup proposed');
          // Replace the button with a status badge in-place
          const actions = btn.closest('.item-actions');
          if (actions) actions.innerHTML = '<span class="badge info">Proposed — awaiting confirm</span>';
          // Refresh meetups (list is auto-run on dashboard but ensure visibility)
          try { if (window.fetchAndRenderMeetups) await window.fetchAndRenderMeetups(); } catch {}
        } catch (err) {
          // Revert UI on error
          btn.disabled = false;
          btn.textContent = originalText || 'Propose this time';
          toast(errorMessage(err, 'Failed to propose meetup'), 'error');
          show('meetup.propose:ERROR', err);
        }
      }
      
      if (e.target.classList.contains('btn-annotate-match')) {
        const candId = parseInt(e.target.dataset.cand, 10);
        const targetLang = e.target.dataset.lang || (window.SimpleI18n?.currentLang) || 'en';
        try {
          // Ensure a match exists, then annotate
          const mc = await api('/api/match/create', { method: 'POST', auth: true, body: { a_user_id: currentUserId, b_user_id: candId } });
          await api('/api/match/annotate', { method: 'POST', auth: true, body: { match_id: mc.match_id, lang: targetLang } });
          toast('AI comment generated');
          await fetchAndRenderMatches();
        } catch (err) {
          toast(errorMessage(err, 'Failed to generate comment'), 'error');
          show('match.annotate:ERROR', err);
        }
      }
    });

    // Auto-run lists on dashboard if token present
    try {
      if (token()) {
        try { updateTopTzBadge(); } catch {}
        try { fetchAvailList(); } catch {}
        // Delay match finding to ensure user ID is loaded, then call directly
        setTimeout(() => { try { fetchAndRenderMatches(); } catch {} }, 100);
        try { fetchAndRenderMeetups(); } catch {}
      }
    } catch (e) { /* ignore */ }
  });

  document.addEventListener('click', async (e) => {
    const pagerPrev = e.target && e.target.classList && e.target.classList.contains('pager-prev');
    const pagerNext = e.target && e.target.classList && e.target.classList.contains('pager-next');
    if (!pagerPrev && !pagerNext) return;
    e.preventDefault();
    if (pagerPrev && matchPagination.offset > 0) {
      const nextOffset = Math.max(0, matchPagination.offset - matchPagination.limit);
      await fetchAndRenderMatches({ useOffset: nextOffset });
    }
    if (pagerNext && matchPagination.hasMore) {
      const nextOffset = matchPagination.offset + matchPagination.limit;
      await fetchAndRenderMatches({ useOffset: nextOffset });
    }
  });

  // Expose functions globally for cross-file calls
  try { window.fetchAvailList = fetchAvailList; } catch {}
  try { window.fetchAndRenderMatches = fetchAndRenderMatches; } catch {}
  try { window.fetchAndRenderMeetups = fetchAndRenderMeetups; } catch {}

})();
