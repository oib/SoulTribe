(function(){
  'use strict';

  function getToken(){
    return localStorage.getItem('access_token');
  }

  async function fetchJSON(url, opts={}){
    const t = getToken();
    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers||{});
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function el(tag, attrs={}, children=[]) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
    });
    children.forEach(c=> e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  function renderCards(data){
    const root = document.getElementById('cards');
    if (!root) return;
    root.innerHTML = '';
    const items = [
      { label: 'Users (total)', value: data.users },
      { label: 'Users (verified)', value: data.users_verified },
      { label: 'Profiles with full radix', value: data.profiles_with_full_radix },
      { label: 'Availability slots', value: data.slots },
      { label: 'Matches', value: data.matches },
      { label: 'Meetups', value: data.meetups },
      { label: 'AI comments', value: data.ai_comments },
    ];
    items.forEach(it => {
      const card = el('div', { class: 'card stat-card' }, [
        el('div', { class: 'stat-label', text: it.label }),
        el('div', { class: 'stat-value', text: String(it.value ?? '-') }),
      ]);
      root.appendChild(card);
    });
  }

  function renderRecent(data){
    const tbody = document.querySelector('#recentTable tbody');
    const empty = document.getElementById('recentEmpty');
    const filters = document.getElementById('recentFilters');
    if (!tbody || !filters) return;

    let active = new Set(Array.from(filters.querySelectorAll('.toggle.active')).map(b=>b.dataset.type));

    function apply(){
      tbody.innerHTML = '';
      const recent = Array.isArray(data.recent) ? data.recent : [];
      const filtered = recent.filter(r => active.has(r.type) || (active.has('other') && !['user','slot','match','meetup'].includes(r.type)));
      if (filtered.length === 0) {
        if (empty) empty.style.display = '';
        return;
      }
      if (empty) empty.style.display = 'none';
      filtered.forEach(r => {
        const tr = el('tr',{},[
          el('td', { text: r.ts || '' }),
          el('td', { text: r.type || '' }),
          el('td', { text: r.info || '' }),
        ]);
        tbody.appendChild(tr);
      });
    }

    filters.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('button.toggle');
      if (!btn) return;
      const type = btn.dataset.type;
      if (type === 'reset') {
        filters.querySelectorAll('button.toggle').forEach(b=> b.classList.remove('active'));
        ['user','slot','match','meetup'].forEach(t=>{
          const b = filters.querySelector(`button.toggle[data-type="${t}"]`);
          if (b) b.classList.add('active');
        });
      } else {
        btn.classList.toggle('active');
      }
      active = new Set(Array.from(filters.querySelectorAll('.toggle.active')).map(b=>b.dataset.type));
      apply();
    });

    apply();
  }

  function renderBreakdown(data){
    const tbody = document.querySelector('#breakdownTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const bd = data.breakdown || {};
    Object.entries(bd).forEach(([k,v])=>{
      const tr = el('tr',{},[
        el('td', { text: k }),
        el('td', { text: String(v) })
      ]);
      tbody.appendChild(tr);
    });
  }

  async function loadStats(){
    const cardsError = document.getElementById('cardsError');
    try {
      // quick admin check
      await fetchJSON('/api/admin/ping');
      const data = await fetchJSON('/api/admin/stats');
      renderCards(data);
      renderRecent(data);
      renderBreakdown(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      if (cardsError) {
        cardsError.style.display = '';
        cardsError.textContent = 'Failed to load stats. Are you logged in as admin?';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', loadStats);
})();
