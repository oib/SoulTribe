// Login/Auth/Session functionality
(() => {
  // Helper functions for login
  const $ = (id) => document.getElementById(id);
  
  // Get global functions from app.js
  const api = window.api;
  const show = window.show;
  const toast = window.toast;
  const bindClick = window.bindClick;
  const parseJwt = window.parseJwt;
  const setToken = window.setToken;
  const updateAuthUI = window.updateAuthUI;

  // Login/Auth specific event handlers
  document.addEventListener('DOMContentLoaded', () => {
    // Register (on login page)
    bindClick("btn-register", async () => {
      try {
        const email = $("email")?.value.trim();
        const password = $("password")?.value;
        const passwordConfirm = $("passwordConfirm")?.value;
        if (typeof passwordConfirm === 'string' && passwordConfirm.length) {
          if (password !== passwordConfirm) {
            try { toast(SimpleI18n.t('login.password_mismatch'), 'error'); } catch {}
            return;
          }
        }
        // Backend requires display_name. Prefer explicit field, else email local-part.
        const explicitName = $("displayName")?.value?.trim();
        const display_name = explicitName && explicitName.length
          ? explicitName
          : ((email && email.includes('@')) ? email.split('@')[0] : 'Friend');

        if (!email || !password || !display_name) {
          return toast(SimpleI18n.t('login.required_fields'), "error");
        }

        // Debug: show payload being sent (without password)
        try { console.debug("register:payload", { email, display_name }); } catch {}

        const data = await api("/api/auth/register", { method: "POST", body: { email, password, display_name } });
        setToken(data.access_token);
        // Notify user and then redirect to profile to complete details (including display name)
        try { toast(SimpleI18n.t('login.registration_success'), "success"); } catch {}
        setTimeout(() => { try { window.location.href = "/profile.html"; } catch {} }, 700);
      } catch (e) {
        show("register:ERROR", e);
        try {
          const detail = e && e.data && e.data.detail ? e.data.detail : null;
          if (detail) {
            console.error("register:ERROR.detail", detail);
            // If FastAPI validation error, surface first message
            const first = Array.isArray(detail) && detail.length ? detail[0] : null;
            const msg = first && first.msg ? first.msg : (typeof detail === 'string' ? detail : 'Registration failed');
            toast(msg, 'error');
          }
        } catch {}
      }
    });

    // Reset password request handler
    bindClick("btn-reset-request", async () => {
      try {
        const email = $("email")?.value.trim();
        if (!email) return toast(SimpleI18n.t('login.enter_email_first'), "error");
        const res = await api("/api/auth/reset-request", { method: "POST", body: { email } });
        show("reset-request", res);
        toast(SimpleI18n.t('login.reset_sent'), "success");
      } catch (e) {
        // Even on error we return a generic success toast for privacy
        show("reset-request:ERROR", e);
        toast(SimpleI18n.t('login.reset_sent'), "success");
      }
    });

    // Resend verification email handler
    bindClick("btn-resend-verification", async (e) => {
      e.preventDefault();
      try {
        const email = $("email")?.value.trim();
        if (!email) return toast(SimpleI18n.t('login.enter_email_first'), "error");
        
        const res = await api("/api/auth/resend-verification", { 
          method: "POST", 
          body: { email } 
        });
        
        show("resend-verification", res);
        toast(SimpleI18n.t('login.verification_sent'), "success");
      } catch (e) {
        show("resend-verification:ERROR", e);
        // Always show success for privacy, even on error
        toast(SimpleI18n.t('login.verification_sent'), "success");
      }
    });

    // Login button handler
    bindClick("btn-login", async () => {
      try {
        const email = $("email")?.value.trim();
        const password = $("password")?.value;
        if (!email || !password) return toast(SimpleI18n.t('login.login_required'), "error");
        
        const res = await api("/api/auth/login", {
          method: "POST",
          body: { email, password }
        });
        
        if (res.access_token) {
          setToken(res.access_token);
          try { localStorage.setItem("access_token", res.access_token); } catch {}
          updateAuthUI();
          window.location.href = "/dashboard.html";
        }
      } catch (e) {
        show("login:ERROR", e);
        try {
          const detail = e && e.data && e.data.detail ? e.data.detail : null;
          let msg = detail ? (typeof detail === 'string' ? detail : (detail[0]?.msg || 'Login failed'))
                          : (e.status === 401 ? 'Invalid credentials' : 'Login failed');
          
          // Show resend verification link if email exists but is not verified
          if (e.status === 401 && detail === 'Email not verified') {
            const email = $("email")?.value.trim();
            if (email) {
              const resendContainer = document.getElementById('resend-verification-container');
              if (resendContainer) {
                resendContainer.classList.remove('hidden');
                // Pre-fill the email in the resend link
                const resendLink = document.getElementById('btn-resend-verification');
                if (resendLink) {
                  resendLink.dataset.email = email;
                }
              }
            }
          }
          toast(msg, 'error');
        } catch {}
      }
    });

    // Logout button handler
    bindClick("btn-logout", () => {
      setToken(null);
      try { localStorage.removeItem("access_token"); } catch {}
      updateAuthUI();
      window.location.href = "/login.html";
    });

    // Form submission handler
    const form = document.getElementById("authForm");
    if (form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try {
          const email = $("email").value.trim();
          const password = $("password").value;
          const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
          setToken(data.access_token);
          show("login", data);
          // Clear password and strip query params to avoid auto-login loops
          $("password").value = "";
          try { history.replaceState(null, "", window.location.pathname); } catch {}
          // Redirect to dashboard when logging in from login page
          try {
            const path = String(window.location.pathname || "");
            if (path.endsWith("/login.html") || path === "/login") {
              window.location.href = "/dashboard.html";
            }
          } catch {}
        } catch (e) {
          show("login:ERROR", e);
          try {
            const detail = e && e.data && e.data.detail ? e.data.detail : null;
            const msg = detail ? (typeof detail === 'string' ? detail : (detail[0]?.msg || 'Login failed'))
                               : (e.status === 401 ? 'Invalid credentials' : 'Login failed');
            toast(msg, 'error');
          } catch {}
        }
      });
    }

    // Auto-fill from query parameters
    try {
      const params = new URLSearchParams(window.location.search);
      const qsEmail = params.get("email");
      const qsPass = params.get("password");
      if (qsEmail) $("email").value = qsEmail;
      if (qsPass) $("password").value = qsPass;
      if (qsEmail && qsPass) {
        const form = document.getElementById("authForm");
        if (form) {
          // Defer to allow DOM to settle, then submit to trigger password manager capture
          setTimeout(() => {
            if (form.requestSubmit) form.requestSubmit(); else $("btn-login").click();
            // Immediately strip query params so we don't auto-submit again on refresh
            try { history.replaceState(null, "", window.location.pathname); } catch {}
          }, 100);
        }
      }
    } catch {}
  });
})();
