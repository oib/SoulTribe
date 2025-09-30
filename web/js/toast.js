(function(){
  'use strict';

  // Extract a human-friendly error message from API errors
  function errorMessage(err, fallback = 'Action failed') {
    try {
      if (!err) return fallback;
      if (typeof err === 'string') return err;
      if (err.data && typeof err.data.detail === 'string') return err.data.detail;
      if (err.data && typeof err.data.message === 'string') return err.data.message;
      if (typeof err.message === 'string') return err.message;
      return fallback;
    } catch { return fallback; }
  }

  // Toast notifications
  function toast(message, kind = 'info') {
    const isDark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
                   (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.style.position = 'fixed';
      box.style.left = '50%';
      box.style.bottom = '16px';
      box.style.transform = 'translateX(-50%)';
      box.style.zIndex = '9999';
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.alignItems = 'center';
      box.style.width = '100%';
      box.style.pointerEvents = 'none';
      document.body.appendChild(box);
    }

    const colors = {
      info:  isDark ? { bg: '#0b1220', fg: '#e5e7eb', border: '#334155' } : { bg: '#eef2ff', fg: '#1f2937', border: '#c7d2fe' },
      error: isDark ? { bg: '#2a1616', fg: '#fecaca', border: '#7f1d1d' } : { bg: '#fee2e2', fg: '#7f1d1d', border: '#fecaca' },
      success: isDark ? { bg: '#0f2d17', fg: '#86efac', border: '#14532d' } : { bg: '#dcfce7', fg: '#14532d', border: '#bbf7d0' },
      warn: isDark ? { bg: '#3b2e0a', fg: '#fde68a', border: '#92400e' } : { bg: '#fef3c7', fg: '#92400e', border: '#fde68a' }
    };
    const theme = colors[kind] || colors.info;

    const item = document.createElement('div');
    item.textContent = message;
    item.style.pointerEvents = 'auto';
    item.style.maxWidth = '92vw';
    item.style.width = 'max-content';
    item.style.background = theme.bg;
    item.style.color = theme.fg;
    item.style.border = `1px solid ${theme.border}`;
    item.style.padding = '10px 14px';
    item.style.marginTop = '8px';
    item.style.borderRadius = '10px';
    item.style.boxShadow = isDark ? '0 8px 16px rgba(0,0,0,0.35)' : '0 8px 16px rgba(0,0,0,0.12)';
    item.style.fontSize = '14px';
    item.style.fontWeight = '600';
    item.style.backdropFilter = 'saturate(150%) blur(4px)';

    const timeout = setTimeout(() => { try { box.removeChild(item); } catch {} }, 2500);
    item.addEventListener('click', () => { try { clearTimeout(timeout); box.removeChild(item); } catch {} });

    box.appendChild(item);
  }

  try { window.toast = toast; } catch {}
  try { window.errorMessage = errorMessage; } catch {}
})();
