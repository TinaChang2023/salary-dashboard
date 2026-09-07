// =========================================================
// accounts.js — Account management (CRUD, soft-deactivate)
// Also exposes a small in-memory cache other modules use to
// populate account <select> dropdowns without refetching.
// =========================================================

window.Accounts = {
  cache: null, // array of account rows, or null if not loaded yet

  reset() {
    this.cache = null;
  },

  async ensureLoaded(force = false) {
    if (this.cache && !force) return this.cache;
    const { data, error } = await supabaseClient
      .from('accounts')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });
    if (error) {
      console.error(error);
      toastError('無法載入帳戶資料');
      this.cache = [];
      return this.cache;
    }
    this.cache = data;
    return this.cache;
  },

  getById(id) {
    return (this.cache || []).find(a => a.id === id) || null;
  },

  getForCategory(category, { activeOnly = true } = {}) {
    const key = { expense: 'allow_expense', saving: 'allow_saving', investment: 'allow_investment' }[category];
    return (this.cache || []).filter(a => a[key] && (!activeOnly || a.is_active));
  },

  // -------------------------------------------------------
  // Render the "帳戶管理" view
  // -------------------------------------------------------
  async load() {
    const container = document.getElementById('accounts-content');
    container.innerHTML = `<div class="account-grid"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`;
    await this.ensureLoaded(true);
    this.render();
  },

  render() {
    const container = document.getElementById('accounts-content');
    const accounts = this.cache || [];
    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>還沒有任何帳戶</h3>
          <p>新增一個帳戶,之後新增薪水時就能指定分配到這裡。</p>
          <button class="btn btn-accent" id="empty-add-account">${icon('plus')}<span>新增帳戶</span></button>
        </div>`;
      document.getElementById('empty-add-account').addEventListener('click', () => this.openEditModal(null));
      return;
    }

    container.innerHTML = `<div class="account-grid">${accounts.map(a => this.renderCard(a)).join('')}</div>`;

    accounts.forEach(a => {
      document.getElementById(`acct-edit-${a.id}`)?.addEventListener('click', () => this.openEditModal(a));
      document.getElementById(`acct-toggle-${a.id}`)?.addEventListener('click', () => this.toggleActive(a));
    });
  },

  renderCard(a) {
    const tags = [];
    if (a.allow_expense) tags.push('<span class="tag tag-expense">花費</span>');
    if (a.allow_saving) tags.push('<span class="tag tag-saving">儲蓄</span>');
    if (a.allow_investment) tags.push('<span class="tag tag-investment">投資</span>');

    const notes = [];
    if (a.interest_rate !== null && a.interest_rate !== undefined && a.interest_rate !== '') {
      notes.push(`<div class="account-note"><b>優惠利率 ${Number(a.interest_rate)}%</b>${a.interest_note ? ' · ' + escapeHtml(a.interest_note) : ''}</div>`);
    }
    if (a.note) notes.push(`<div class="account-note">${escapeHtml(a.note)}</div>`);

    return `
      <div class="account-card ${a.is_active ? '' : 'is-inactive'}">
        <div class="account-card-top">
          <div class="account-card-name">${escapeHtml(a.name)}</div>
          <span class="account-card-type">${escapeHtml(a.account_type)}</span>
        </div>
        <div class="account-tags">${tags.join('')}${a.is_active ? '' : '<span class="tag" style="background:var(--surface-alt);color:var(--ink-soft);">已停用</span>'}</div>
        ${notes.join('')}
        <div class="account-card-actions">
          <button class="btn btn-secondary btn-sm" id="acct-edit-${a.id}">${icon('edit')}<span>編輯</span></button>
          <button class="btn ${a.is_active ? 'btn-danger' : 'btn-secondary'} btn-sm" id="acct-toggle-${a.id}">
            <span>${a.is_active ? '停用' : '啟用'}</span>
          </button>
        </div>
      </div>`;
  },

  async toggleActive(account) {
    const nextState = !account.is_active;
    confirmDialog({
      title: nextState ? '啟用帳戶' : '停用帳戶',
      messageHtml: nextState
        ? `確定要重新啟用「${escapeHtml(account.name)}」嗎?`
        : `確定要停用「${escapeHtml(account.name)}」嗎?<span class="warn">停用後這個帳戶不會出現在新增薪水的選項中,但歷史紀錄仍會保留。</span>`,
      confirmLabel: nextState ? '啟用' : '停用',
      danger: !nextState,
      onConfirm: async () => {
        const { error } = await supabaseClient
          .from('accounts')
          .update({ is_active: nextState })
          .eq('id', account.id);
        if (error) { toastError(); return; }
        closeModal();
        toastSuccess(nextState ? '帳戶已啟用' : '帳戶已停用');
        await this.ensureLoaded(true);
        this.render();
      },
    });
  },

  // -------------------------------------------------------
  // Add / edit modal
  // -------------------------------------------------------
  openEditModal(account) {
    const isEdit = !!account;
    const bodyHtml = `
      <form id="account-form">
        <div class="field">
          <label for="acct-name">帳戶名稱</label>
          <input type="text" id="acct-name" required value="${isEdit ? escapeHtml(account.name) : ''}" placeholder="例如:國泰世華">
        </div>
        <div class="field">
          <label for="acct-type">帳戶類型</label>
          <select id="acct-type">
            <option value="銀行" ${isEdit && account.account_type === '銀行' ? 'selected' : ''}>銀行</option>
            <option value="證券" ${isEdit && account.account_type === '證券' ? 'selected' : ''}>證券</option>
            <option value="其他" ${isEdit && account.account_type === '其他' ? 'selected' : ''}>其他</option>
          </select>
        </div>
        <div class="field">
          <label>用途(可複選)</label>
          <div class="account-tags" style="margin-top:6px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" id="acct-allow-expense" ${!isEdit || account.allow_expense ? 'checked' : ''}> 花費</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" id="acct-allow-saving" ${isEdit && account.allow_saving ? 'checked' : ''}> 儲蓄</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" id="acct-allow-investment" ${isEdit && account.allow_investment ? 'checked' : ''}> 投資</label>
          </div>
        </div>
        <div class="field">
          <label for="acct-interest-rate">優惠活存利率 (%,選填)</label>
          <input type="number" id="acct-interest-rate" step="0.01" min="0" value="${isEdit && account.interest_rate !== null ? account.interest_rate : ''}" placeholder="例如:1.5">
        </div>
        <div class="field">
          <label for="acct-interest-note">利率資訊備註(選填)</label>
          <textarea id="acct-interest-note" rows="2" placeholder="例如:優惠至 2027/03/31,每月 10 日入息。">${isEdit && account.interest_note ? escapeHtml(account.interest_note) : ''}</textarea>
        </div>
        <div class="field">
          <label for="acct-note">其他備註(選填)</label>
          <textarea id="acct-note" rows="2" placeholder="例如:主要作為緊急預備金。">${isEdit && account.note ? escapeHtml(account.note) : ''}</textarea>
        </div>
        <div class="field-error" id="account-form-error"></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="account-cancel-btn">取消</button>
      <button class="btn btn-primary" id="account-save-btn">${isEdit ? '儲存變更' : '新增帳戶'}</button>
    `;
    openModal({
      title: isEdit ? '編輯帳戶' : '新增帳戶',
      bodyHtml,
      footerHtml,
      onMount: () => {
        document.getElementById('account-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('account-save-btn').addEventListener('click', () => this.submitForm(account));
      },
    });
  },

  async submitForm(existingAccount) {
    const errorEl = document.getElementById('account-form-error');
    errorEl.classList.remove('show');

    const name = document.getElementById('acct-name').value.trim();
    const account_type = document.getElementById('acct-type').value;
    const allow_expense = document.getElementById('acct-allow-expense').checked;
    const allow_saving = document.getElementById('acct-allow-saving').checked;
    const allow_investment = document.getElementById('acct-allow-investment').checked;
    const interestRateRaw = document.getElementById('acct-interest-rate').value;
    const interest_rate = interestRateRaw === '' ? null : Number(interestRateRaw);
    const interest_note = document.getElementById('acct-interest-note').value.trim() || null;
    const note = document.getElementById('acct-note').value.trim() || null;

    if (!name) { errorEl.textContent = '請輸入帳戶名稱'; errorEl.classList.add('show'); return; }
    if (!allow_expense && !allow_saving && !allow_investment) {
      errorEl.textContent = '請至少選擇一個用途';
      errorEl.classList.add('show');
      return;
    }

    const payload = { name, account_type, allow_expense, allow_saving, allow_investment, interest_rate, interest_note, note };
    const saveBtn = document.getElementById('account-save-btn');

    await withLoading(saveBtn, async () => {
      let error;
      if (existingAccount) {
        ({ error } = await supabaseClient.from('accounts').update(payload).eq('id', existingAccount.id));
      } else {
        payload.user_id = App.currentUser.id;
        payload.is_active = true;
        ({ error } = await supabaseClient.from('accounts').insert(payload));
      }
      if (error) {
        console.error(error);
        errorEl.textContent = '無法儲存資料,請稍後再試。';
        errorEl.classList.add('show');
        return;
      }
      closeModal();
      toastSuccess(existingAccount ? '帳戶已更新' : '帳戶已新增');
      await this.ensureLoaded(true);
      if (App.currentView === 'accounts') this.render();
    });
  },
};
