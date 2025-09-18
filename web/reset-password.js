(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.api;
  const show = window.show;
  const toast = window.toast;

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const hint = $('resetHint');
    if (!token) {
      if (hint) hint.textContent = 'Missing reset token in the URL.';
      return;
    }
    if (hint) hint.textContent = 'Token detected. Please enter a new password.';

    const form = $('resetForm');
    if (!form) return;

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const p1 = $('newPassword').value;
        const p2 = $('newPasswordConfirm').value;
        if (!p1 || !p2) return toast('Please fill both password fields', 'error');
        if (p1 !== p2) return toast('Passwords do not match', 'error');
        if (p1.length < 6) return toast('Password must be at least 6 characters', 'error');

        const res = await api('/api/auth/reset', { method: 'POST', body: { token, new_password: p1 } });
        show('password.reset', res);
        toast('Password has been reset. You can now log in.', 'success');
        setTimeout(() => { try { window.location.href = '/login.html'; } catch {} }, 900);
      } catch (e) {
        show('password.reset:ERROR', e);
        try {
          const detail = e && e.data && e.data.detail ? e.data.detail : null;
          const msg = detail ? (typeof detail === 'string' ? detail : (detail[0]?.msg || 'Reset failed'))
                             : 'Reset failed';
          toast(msg, 'error');
        } catch {}
      }
    });
  });
})();
