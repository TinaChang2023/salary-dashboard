// =========================================================
// creditcards.js — V2 信用卡管理 (CRUD, soft-deactivate + hard delete)
// Fully independent of accounts.js / V1 tables — only shares the
// logged-in user. Never reads or writes any salary_* or accounts
// table, and nothing here is read by any V1 module.
// =========================================================

window.CreditCards = {
  cache: null,

  reset() {
    this.cache = null;
  },

  async ensureLoaded(force = false) {
    if (this.cache && !force) return this.cache;
    const { data, error } = await supabaseClient
      .from('credit_cards')
      .select('*')
      .order('is_active', { ascending: false })
      .order('card_name', { ascending: true });
    if (error) {
      console.error(error);
      toastError('無法載入信用卡資料');
      this.cache = [];
      return this.cache;
    }
    this.cache = data;
    return this.cache;
  },

  getById(id) {
    return (this.cache || []).find(c => c.id === id) || null;
  },

  getActive() {
    return (this.cache || []).filter(c => c.is_active);
  },

  // -------------------------------------------------------
  // Render the "信用卡管理" view
  // -------------------------------------------------------
  async load() {
    const container = document.getElementById('cc-cards-content');
    container.innerHTML = `<div class="account-grid"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`;
    await this.ensureLoaded(true);
    this.render();
  },

  render() {
    const container = document.getElementById('cc-cards-content');
    const cards = this.cache || [];
    if (cards.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('creditcard')}</div>
          <h3>還沒有任何信用卡</h3>
          <p>加入一張信用卡,之後就能登錄每月帳單。</p>
          <button class="btn btn-accent" id="empty-add-card">${icon('plus')}<span>加入信用卡</span></button>
        </div>`;
      document.getElementById('empty-add-card').addEventListener('click', () => this.openEditModal(null));
      return;
    }

    container.innerHTML = `<div class="account-grid">${cards.map(c => this.renderCard(c)).join('')}</div>`;

    cards.forEach(c => {
      document.getElementById(`card-edit-${c.id}`)?.addEventListener('click', () => this.openEditModal(c));
      document.getElementById(`card-toggle-${c.id}`)?.addEventListener('click', () => this.toggleActive(c));
      document.getElementById(`card-delete-${c.id}`)?.addEventListener('click', () => this.confirmDelete(c));
    });
  },

  renderCard(c) {
    const notes = [];
    if (c.bank_name) notes.push(`<div class="account-note">發卡銀行:${escapeHtml(c.bank_name)}</div>`);
    if (c.closing_day) notes.push(`<div class="account-note">結帳日:每月 ${c.closing_day} 日</div>`);
    if (c.payment_method) notes.push(`<div class="account-note">繳款方式:${escapeHtml(c.payment_method)}</div>`);
    if (c.notes) notes.push(`<div class="account-note">${escapeHtml(c.notes)}</div>`);

    return `
      <div class="account-card ${c.is_active ? '' : 'is-inactive'}">
        <div class="account-card-top">
          <div class="account-card-name">${escapeHtml(c.card_name)}</div>
          <span class="account-card-type">${c.is_active ? '啟用中' : '已停用'}</span>
        </div>
        ${notes.join('')}
        <div class="account-card-actions">
          <button class="btn btn-secondary btn-sm" id="card-edit-${c.id}">${icon('edit')}<span>編輯</span></button>
          <button class="btn ${c.is_active ? 'btn-danger' : 'btn-secondary'} btn-sm" id="card-toggle-${c.id}">
            <span>${c.is_active ? '停用' : '重新啟用'}</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="card-delete-${c.id}" title="刪除">${icon('trash')}</button>
        </div>
      </div>`;
  },

  async toggleActive(card) {
    const nextState = !card.is_active;
    confirmDialog({
      title: nextState ? '重新啟用信用卡' : '停用信用卡',
      messageHtml: nextState
        ? `確定要重新啟用「${escapeHtml(card.card_name)}」嗎?`
        : `確定要停用「${escapeHtml(card.card_name)}」嗎?<span class="warn">停用後無法再用這張卡新增帳單,但既有的帳單紀錄仍會保留、可在信用卡帳單中查看。</span>`,
      confirmLabel: nextState ? '啟用' : '停用',
      danger: !nextState,
      onConfirm: async () => {
        const { error } = await supabaseClient.from('credit_cards').update({ is_active: nextState }).eq('id', card.id);
        if (error) { toastError(); return; }
        closeModal();
        toastSuccess(nextState ? '信用卡已啟用' : '信用卡已停用');
        await this.ensureLoaded(true);
        this.render();
      },
    });
  },

  confirmDelete(card) {
    confirmDialog({
      title: '刪除信用卡',
      messageHtml: `確定要刪除「${escapeHtml(card.card_name)}」嗎?<span class="warn">這張卡的所有歷史帳單紀錄也會一併刪除,此動作無法復原。如果只是暫時不用這張卡,建議改用「停用」以保留歷史帳單。</span>`,
      confirmLabel: '刪除',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabaseClient.from('credit_cards').delete().eq('id', card.id);
        if (error) { toastError(); return; }
        closeModal();
        toastSuccess('信用卡已刪除');
        await this.ensureLoaded(true);
        this.render();
      },
    });
  },

  // -------------------------------------------------------
  // Add / edit modal
  // -------------------------------------------------------
  openEditModal(card) {
    const isEdit = !!card;
    const bodyHtml = `
      <form id="card-form">
        <div class="field">
          <label for="card-name">信用卡名稱</label>
          <input type="text" id="card-name" required value="${isEdit ? escapeHtml(card.card_name) : ''}" placeholder="例如:現金回饋卡">
        </div>
        <div class="field">
          <label for="card-bank">發卡銀行(選填)</label>
          <input type="text" id="card-bank" value="${isEdit && card.bank_name ? escapeHtml(card.bank_name) : ''}" placeholder="例如:中國信託">
        </div>
        <div class="field">
          <label for="card-closing-day">結帳日(選填,1-31)</label>
          <input type="number" id="card-closing-day" min="1" max="31" step="1" value="${isEdit && card.closing_day ? card.closing_day : ''}" placeholder="例如:15">
        </div>
        <div class="field">
          <label for="card-payment-method">繳款方式</label>
          <select id="card-payment-method">
            <option value="">— 未設定 —</option>
            <option value="自動扣款" ${isEdit && card.payment_method === '自動扣款' ? 'selected' : ''}>自動扣款</option>
            <option value="手動轉帳" ${isEdit && card.payment_method === '手動轉帳' ? 'selected' : ''}>手動轉帳</option>
            <option value="其他" ${isEdit && card.payment_method === '其他' ? 'selected' : ''}>其他</option>
          </select>
        </div>
        <div class="field">
          <label for="card-notes">備註(選填)</label>
          <textarea id="card-notes" rows="2" placeholder="例如:主要日常消費使用">${isEdit && card.notes ? escapeHtml(card.notes) : ''}</textarea>
        </div>
        <div class="field-error" id="card-form-error"></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="card-cancel-btn">取消</button>
      <button class="btn btn-primary" id="card-save-btn">${isEdit ? '儲存變更' : '加入信用卡'}</button>
    `;
    openModal({
      title: isEdit ? '編輯信用卡' : '加入信用卡',
      bodyHtml,
      footerHtml,
      onMount: () => {
        document.getElementById('card-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('card-save-btn').addEventListener('click', () => this.submitForm(card));
      },
    });
  },

  async submitForm(existingCard) {
    const errorEl = document.getElementById('card-form-error');
    errorEl.classList.remove('show');

    const card_name = document.getElementById('card-name').value.trim();
    const bank_name = document.getElementById('card-bank').value.trim() || null;
    const closingDayRaw = document.getElementById('card-closing-day').value;
    const closing_day = closingDayRaw === '' ? null : Number(closingDayRaw);
    const payment_method = document.getElementById('card-payment-method').value || null;
    const notes = document.getElementById('card-notes').value.trim() || null;

    if (!card_name) { errorEl.textContent = '請輸入信用卡名稱'; errorEl.classList.add('show'); return; }
    if (closing_day !== null && (closing_day < 1 || closing_day > 31)) {
      errorEl.textContent = '結帳日必須介於 1 到 31 之間';
      errorEl.classList.add('show');
      return;
    }

    const payload = { card_name, bank_name, closing_day, payment_method, notes };
    const saveBtn = document.getElementById('card-save-btn');

    await withLoading(saveBtn, async () => {
      let error;
      if (existingCard) {
        ({ error } = await supabaseClient.from('credit_cards').update(payload).eq('id', existingCard.id));
      } else {
        payload.user_id = App.currentUser.id;
        payload.is_active = true;
        ({ error } = await supabaseClient.from('credit_cards').insert(payload));
      }
      if (error) {
        console.error(error);
        errorEl.textContent = '無法儲存資料,請稍後再試。';
        errorEl.classList.add('show');
        return;
      }
      closeModal();
      toastSuccess(existingCard ? '信用卡已更新' : '信用卡已加入');
      await this.ensureLoaded(true);
      if (App.currentView === 'cc-cards') this.render();
    });
  },
};
