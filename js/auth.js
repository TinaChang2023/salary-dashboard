// =========================================================
// auth.js — Supabase Authentication
// =========================================================

window.Auth = {
  async init() {
    // Toggle between login / forgot-password panels
    document.getElementById('show-forgot').addEventListener('click', () => {
      document.getElementById('login-panel').classList.add('hidden');
      document.getElementById('forgot-panel').classList.remove('hidden');
    });
    document.getElementById('show-login').addEventListener('click', () => {
      document.getElementById('forgot-panel').classList.add('hidden');
      document.getElementById('login-panel').classList.remove('hidden');
    });

    document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('forgot-form').addEventListener('submit', (e) => this.handleForgotPassword(e));

    // Check for an existing session (persisted by supabase-js)
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session && data.session.user) {
        await showModuleSelect(data.session.user);
      } else {
        showAuthScreen();
      }
    } catch (err) {
      console.error(err);
      showAuthScreen();
    } finally {
      document.getElementById('app-loading').classList.add('hidden');
    }

    // React to sign-in / sign-out from anywhere (e.g. token expiry)
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        showAuthScreen();
      }
    });
  },

  clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; el.classList.remove('show'); });
  },

  setFieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
  },

  async handleLogin(e) {
    e.preventDefault();
    this.clearFieldErrors();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit');

    if (!email) { this.setFieldError('login-email-error', '請輸入 Email'); return; }
    if (!password) { this.setFieldError('login-password-error', '請輸入密碼'); return; }

    await withLoading(submitBtn, async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        this.setFieldError('login-password-error', '登入失敗,請確認 Email 與密碼是否正確。');
        return;
      }
      toastSuccess('登入成功');
      await showModuleSelect(data.user);
    });
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    this.clearFieldErrors();
    const email = document.getElementById('forgot-email').value.trim();
    const submitBtn = document.getElementById('forgot-submit');
    if (!email) { this.setFieldError('forgot-email-error', '請輸入 Email'); return; }

    await withLoading(submitBtn, async () => {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) {
        toastError('無法寄送重設連結,請稍後再試。');
        return;
      }
      toastSuccess('重設密碼連結已寄出,請至信箱查看');
      document.getElementById('forgot-panel').classList.add('hidden');
      document.getElementById('login-panel').classList.remove('hidden');
    });
  },

  async logout() {
    await supabaseClient.auth.signOut();
    window.Accounts.reset();
    window.CreditCards?.reset();
    showAuthScreen();
  },
};
