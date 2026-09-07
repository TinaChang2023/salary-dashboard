// =========================================================
// salary.js — 新增薪水 / 薪水紀錄 (add, edit, list, delete)
// =========================================================

window.Salary = {
  currentRates: null, // { expense_rate, saving_rate, investment_rate } — used for the ADD modal preview only

  buildAccountOptions(category, selectedId) {
    const active = window.Accounts.getForCategory(category, { activeOnly: true });
    let list = [...active];
    if (selectedId && !list.find(a => a.id === selectedId)) {
      const inactive = window.Accounts.getById(selectedId);
      if (inactive) list.push(inactive);
    }
    if (list.length === 0) {
      return `<option value="">— 尚無可用帳戶 —</option>`;
    }
    return list.map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(a.name)}${a.is_active ? '' : '(已停用)'}</option>`).join('');
  },

  renderAllocPreviewRow(category, amount, selectedAccountId) {
    const meta = CATEGORY_META[category];
    return `
      <div class="alloc-preview-row cat-${category}">
        <div class="alloc-preview-row-inner">
          <div class="row-main">
            <span class="name">${icon(meta.icon)} ${meta.label}</span>
            <span class="amount" id="preview-amount-${category}">${formatMoney(amount)}</span>
          </div>
          <select id="account-select-${category}" required>
            ${this.buildAccountOptions(category, selectedAccountId)}
          </select>
        </div>
      </div>`;
  },

  recomputePreview(amountInputId, rates) {
    const amount = Number(document.getElementById(amountInputId).value) || 0;
    const expenseAmt = Math.round(amount * rates.expense_rate) / 100;
    const savingAmt = Math.round(amount * rates.saving_rate) / 100;
    const investmentAmt = Math.round((amount - expenseAmt - savingAmt) * 100) / 100;
    document.getElementById('preview-amount-expense').textContent = formatMoney(expenseAmt);
    document.getElementById('preview-amount-saving').textContent = formatMoney(savingAmt);
    document.getElementById('preview-amount-investment').textContent = formatMoney(investmentAmt);
  },

  // -------------------------------------------------------
  // Add salary modal
  // -------------------------------------------------------
  async openAddModal() {
    await window.Accounts.ensureLoaded();
    const { data: settings, error } = await supabaseClient.from('settings').select('*').single();
    if (error || !settings) { toastError('無法載入分配比例設定'); return; }
    this.currentRates = settings;

    const noAccountsAtAll = window.Accounts.getForCategory('expense').length === 0
      && window.Accounts.getForCategory('saving').length === 0
      && window.Accounts.getForCategory('investment').length === 0;

    if (noAccountsAtAll) {
      openModal({
        title: '新增薪水',
        bodyHtml: `<div class="empty-state" style="padding:20px 0;">
          <div class="icon">${icon('wallet')}</div>
          <h3>請先新增至少一個帳戶</h3>
          <p>新增薪水前,需要先在「帳戶管理」建立可以分配的帳戶。</p>
        </div>`,
        footerHtml: `<button class="btn btn-primary" id="goto-accounts-btn">前往帳戶管理</button>`,
        onMount: () => {
          document.getElementById('goto-accounts-btn').addEventListener('click', () => {
            closeModal();
            navigateTo('accounts');
          });
        },
      });
      return;
    }

    const bodyHtml = `
      <form id="salary-form">
        <div class="field">
          <label for="salary-date">薪水日期</label>
          <input type="date" id="salary-date" value="${todayISO()}" required>
        </div>
        <div class="field">
          <label for="salary-amount">本月薪水</label>
          <input type="number" id="salary-amount" min="0" step="1" placeholder="例如:40000" required>
        </div>
        <div class="section-title" style="margin-top:20px;">分配預覽(依目前設定:花費 ${settings.expense_rate}% / 儲蓄 ${settings.saving_rate}% / 投資 ${settings.investment_rate}%)</div>
        <div class="alloc-preview">
          ${this.renderAllocPreviewRow('expense', 0, null)}
          ${this.renderAllocPreviewRow('saving', 0, null)}
          ${this.renderAllocPreviewRow('investment', 0, null)}
        </div>
        <div class="field-error" id="salary-form-error"></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="salary-cancel-btn">取消</button>
      <button class="btn btn-primary" id="salary-save-btn">新增薪水</button>
    `;

    openModal({
      title: '新增薪水',
      bodyHtml,
      footerHtml,
      onMount: () => {
        document.getElementById('salary-amount').addEventListener('input', () => this.recomputePreview('salary-amount', settings));
        document.getElementById('salary-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('salary-save-btn').addEventListener('click', () => this.submitAdd());
      },
    });
  },

  async submitAdd() {
    const errorEl = document.getElementById('salary-form-error');
    errorEl.classList.remove('show');

    const salary_date = document.getElementById('salary-date').value;
    const salary_amount = Number(document.getElementById('salary-amount').value);
    const expenseAccountId = document.getElementById('account-select-expense').value;
    const savingAccountId = document.getElementById('account-select-saving').value;
    const investmentAccountId = document.getElementById('account-select-investment').value;

    if (!salary_date) { errorEl.textContent = '請選擇薪水日期'; errorEl.classList.add('show'); return; }
    if (!salary_amount || salary_amount <= 0) { errorEl.textContent = '請輸入有效的薪水金額'; errorEl.classList.add('show'); return; }
    if (!expenseAccountId || !savingAccountId || !investmentAccountId) {
      errorEl.textContent = '請為每個用途指定一個帳戶';
      errorEl.classList.add('show');
      return;
    }

    const saveBtn = document.getElementById('salary-save-btn');
    await withLoading(saveBtn, async () => {
      const { error } = await supabaseClient.rpc('create_salary_record', {
        p_salary_date: salary_date,
        p_salary_amount: salary_amount,
        p_expense_account_id: expenseAccountId,
        p_saving_account_id: savingAccountId,
        p_investment_account_id: investmentAccountId,
      });
      if (error) {
        console.error(error);
        errorEl.textContent = '無法儲存資料,請稍後再試。';
        errorEl.classList.add('show');
        return;
      }
      closeModal();
      toastSuccess('✓ 薪水紀錄已新增');
      if (App.currentView === 'dashboard') window.Dashboard.load();
      if (App.currentView === 'records') this.loadRecordsView();
    });
  },

  // -------------------------------------------------------
  // Records list view
  // -------------------------------------------------------
  async fetchRecordsWithAllocations(filters = {}) {
    let query = supabaseClient
      .from('salary_records')
      .select('*, salary_allocations(id, category, amount, is_completed, completed_at, account_id, accounts(name, is_active))')
      .order('salary_date', { ascending: false });
    if (filters.startDate) query = query.gte('salary_date', filters.startDate);
    if (filters.endDate) query = query.lte('salary_date', filters.endDate);
    const { data, error } = await query;
    if (error) { console.error(error); toastError('無法載入薪水紀錄'); return []; }
    return data;
  },

  async loadRecordsView() {
    const container = document.getElementById('records-content');
    container.innerHTML = `<div class="skel skel-card" style="height:280px;"></div>`;
    await window.Accounts.ensureLoaded();
    const records = await this.fetchRecordsWithAllocations();
    this._recordsCache = records;
    this.renderRecordsView(records);
  },

  allocFor(record, category) {
    return (record.salary_allocations || []).find(a => a.category === category);
  },

  completionPct(record) {
    const allocs = record.salary_allocations || [];
    if (allocs.length === 0) return 0;
    const done = allocs.filter(a => a.is_completed).length;
    return Math.round((done / allocs.length) * 100);
  },

  renderRecordsView(records) {
    const container = document.getElementById('records-content');
    if (records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>還沒有任何薪水紀錄</h3>
          <p>點擊右上角「新增薪水」開始記錄第一筆分配。</p>
        </div>`;
      return;
    }

    const rows = records.map(r => {
      const e = this.allocFor(r, 'expense');
      const s = this.allocFor(r, 'saving');
      const i = this.allocFor(r, 'investment');
      const pct = this.completionPct(r);
      return `
        <tr data-record-id="${r.id}">
          <td>${formatDate(r.salary_date)}</td>
          <td class="amount-cell">${formatMoney(r.salary_amount)}</td>
          <td class="amount-cell">${formatMoney(e?.amount)}</td>
          <td class="amount-cell">${formatMoney(s?.amount)}</td>
          <td class="amount-cell">${formatMoney(i?.amount)}</td>
          <td><span class="progress-pill ${pct === 100 ? 'full' : ''}">${pct === 100 ? icon('check') : ''} ${pct}%</span></td>
        </tr>`;
    }).join('');

    const cards = records.map(r => {
      const e = this.allocFor(r, 'expense');
      const s = this.allocFor(r, 'saving');
      const i = this.allocFor(r, 'investment');
      const pct = this.completionPct(r);
      return `
        <div class="record-card" data-record-id="${r.id}">
          <div class="record-card-top">
            <span class="record-card-date">${formatDate(r.salary_date)}</span>
            <span class="progress-pill ${pct === 100 ? 'full' : ''}">${pct}%</span>
          </div>
          <div class="record-card-amount">${formatMoney(r.salary_amount)}</div>
          <div class="record-card-breakdown">
            <span>花費 ${formatMoney(e?.amount)}</span>
            <span>儲蓄 ${formatMoney(s?.amount)}</span>
            <span>投資 ${formatMoney(i?.amount)}</span>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>日期</th><th>薪水</th><th>花費</th><th>儲蓄</th><th>投資</th><th>完成度</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="record-cards" style="padding:2px 0;">${cards}</div>
      </div>
    `;

    container.querySelectorAll('[data-record-id]').forEach(el => {
      el.addEventListener('click', () => {
        const record = records.find(r => r.id === el.dataset.recordId);
        this.openDetailModal(record);
      });
    });
  },

  // -------------------------------------------------------
  // Detail / edit / delete
  // -------------------------------------------------------
  openDetailModal(record) {
    const e = this.allocFor(record, 'expense');
    const s = this.allocFor(record, 'saving');
    const i = this.allocFor(record, 'investment');

    const rowHtml = (alloc, category) => {
      const meta = CATEGORY_META[category];
      const acctName = alloc?.accounts?.name || '-';
      const inactive = alloc?.accounts && !alloc.accounts.is_active;
      return `
        <div class="alloc-preview-row cat-${category}">
          <div class="alloc-preview-row-inner">
            <div class="row-main">
              <span class="name">${icon(meta.icon)} ${meta.label} · ${escapeHtml(acctName)}${inactive ? '(已停用)' : ''}</span>
              <span class="amount">${formatMoney(alloc?.amount)}</span>
            </div>
            <button class="complete-toggle ${alloc?.is_completed ? 'is-done' : ''}" data-alloc-id="${alloc?.id}" style="margin-top:8px;">
              <span class="box">${alloc?.is_completed ? icon('check') : ''}</span>
              <span>${alloc?.is_completed ? `已完成 · ${alloc.completed_at ? new Date(alloc.completed_at).toLocaleString('zh-TW') : ''}` : '尚未完成'}</span>
            </button>
          </div>
        </div>`;
    };

    const bodyHtml = `
      <div class="alloc-preview">
        ${rowHtml(e, 'expense')}
        ${rowHtml(s, 'saving')}
        ${rowHtml(i, 'investment')}
      </div>
      <div class="section-title">薪水資訊</div>
      <div style="font-size:13.5px;color:var(--ink-soft);display:flex;flex-direction:column;gap:6px;">
        <div>日期:${formatDate(record.salary_date)}</div>
        <div>薪水金額:${formatMoney(record.salary_amount)}</div>
        <div>分配比例快照:花費 ${record.expense_rate}% / 儲蓄 ${record.saving_rate}% / 投資 ${record.investment_rate}%</div>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-danger" id="record-delete-btn">${icon('trash')}<span>刪除</span></button>
      <button class="btn btn-secondary" id="record-edit-btn">${icon('edit')}<span>編輯</span></button>
    `;

    openModal({
      title: `${formatDate(record.salary_date)} 的薪水紀錄`,
      bodyHtml,
      footerHtml,
      wide: true,
      onMount: (overlay) => {
        overlay.querySelectorAll('.complete-toggle').forEach(btn => {
          btn.addEventListener('click', () => this.toggleCompletion(btn.dataset.allocId, !btn.classList.contains('is-done'), record));
        });
        document.getElementById('record-delete-btn').addEventListener('click', () => this.confirmDelete(record));
        document.getElementById('record-edit-btn').addEventListener('click', () => this.openEditModal(record));
      },
    });
  },

  async toggleCompletion(allocId, nextState, record) {
    const { error } = await supabaseClient
      .from('salary_allocations')
      .update({
        is_completed: nextState,
        completed_at: nextState ? new Date().toISOString() : null,
      })
      .eq('id', allocId);
    if (error) { console.error(error); toastError(); return; }

    // refresh underlying data + whichever view is open
    const refreshed = await this.fetchRecordsWithAllocations();
    this._recordsCache = refreshed;
    const updatedRecord = refreshed.find(r => r.id === record.id);
    if (updatedRecord) this.openDetailModal(updatedRecord);
    if (App.currentView === 'dashboard') window.Dashboard.load();
    if (App.currentView === 'records') this.renderRecordsView(refreshed);
  },

  async openEditModal(record) {
    await window.Accounts.ensureLoaded();
    const e = this.allocFor(record, 'expense');
    const s = this.allocFor(record, 'saving');
    const i = this.allocFor(record, 'investment');

    const bodyHtml = `
      <form id="salary-edit-form">
        <div class="field">
          <label for="edit-salary-date">薪水日期</label>
          <input type="date" id="edit-salary-date" value="${record.salary_date}" required>
        </div>
        <div class="field">
          <label for="edit-salary-amount">本月薪水</label>
          <input type="number" id="edit-salary-amount" min="0" step="1" value="${record.salary_amount}" required>
        </div>
        <div class="field-hint">比例快照(花費 ${record.expense_rate}% / 儲蓄 ${record.saving_rate}% / 投資 ${record.investment_rate}%)維持不變,僅重新依此比例計算金額。</div>
        <div class="section-title" style="margin-top:16px;">分配預覽</div>
        <div class="alloc-preview">
          ${this.renderAllocPreviewRow('expense', e?.amount || 0, e?.account_id)}
          ${this.renderAllocPreviewRow('saving', s?.amount || 0, s?.account_id)}
          ${this.renderAllocPreviewRow('investment', i?.amount || 0, i?.account_id)}
        </div>
        <div class="field-error" id="salary-edit-form-error"></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="salary-edit-cancel-btn">取消</button>
      <button class="btn btn-primary" id="salary-edit-save-btn">儲存變更</button>
    `;

    const rates = { expense_rate: record.expense_rate, saving_rate: record.saving_rate, investment_rate: record.investment_rate };

    openModal({
      title: '編輯薪水紀錄',
      bodyHtml,
      footerHtml,
      onMount: () => {
        document.getElementById('edit-salary-amount').addEventListener('input', () => this.recomputePreview('edit-salary-amount', rates));
        document.getElementById('salary-edit-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('salary-edit-save-btn').addEventListener('click', () => this.submitEdit(record));
      },
    });
  },

  async submitEdit(record) {
    const errorEl = document.getElementById('salary-edit-form-error');
    errorEl.classList.remove('show');

    const salary_date = document.getElementById('edit-salary-date').value;
    const salary_amount = Number(document.getElementById('edit-salary-amount').value);
    const expenseAccountId = document.getElementById('account-select-expense').value;
    const savingAccountId = document.getElementById('account-select-saving').value;
    const investmentAccountId = document.getElementById('account-select-investment').value;

    if (!salary_date || !salary_amount || salary_amount <= 0) {
      errorEl.textContent = '請輸入有效的日期與金額';
      errorEl.classList.add('show');
      return;
    }
    if (!expenseAccountId || !savingAccountId || !investmentAccountId) {
      errorEl.textContent = '請為每個用途指定一個帳戶';
      errorEl.classList.add('show');
      return;
    }

    const saveBtn = document.getElementById('salary-edit-save-btn');
    await withLoading(saveBtn, async () => {
      const { error } = await supabaseClient.rpc('update_salary_record', {
        p_salary_record_id: record.id,
        p_salary_date: salary_date,
        p_salary_amount: salary_amount,
        p_expense_account_id: expenseAccountId,
        p_saving_account_id: savingAccountId,
        p_investment_account_id: investmentAccountId,
      });
      if (error) {
        console.error(error);
        errorEl.textContent = '無法儲存資料,請稍後再試。';
        errorEl.classList.add('show');
        return;
      }
      closeModal();
      toastSuccess('✓ 薪水紀錄已更新');
      if (App.currentView === 'dashboard') window.Dashboard.load();
      if (App.currentView === 'records') this.loadRecordsView();
    });
  },

  confirmDelete(record) {
    confirmDialog({
      title: '刪除薪水紀錄',
      messageHtml: `確定要刪除 ${formatDate(record.salary_date)} 的薪水紀錄嗎?<span class="warn">該筆薪水的花費、儲蓄、投資分配資料也會一起刪除,此動作無法復原。</span>`,
      confirmLabel: '刪除',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabaseClient.from('salary_records').delete().eq('id', record.id);
        if (error) { console.error(error); toastError(); return; }
        closeModal();
        toastSuccess('薪水紀錄已刪除');
        if (App.currentView === 'dashboard') window.Dashboard.load();
        if (App.currentView === 'records') this.loadRecordsView();
      },
    });
  },
};
