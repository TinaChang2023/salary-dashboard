// =========================================================
// bills.js — V2 每月信用卡帳單紀錄
// Independent of V1 salary tables. A bill amount here is never
// added to, subtracted from, or compared against any salary/
// expense/saving/investment figure.
// =========================================================

window.Bills = {
  cache: null,

  async fetchBills() {
    const { data, error } = await supabaseClient
      .from('credit_card_bills')
      .select('*, credit_cards(card_name, is_active)')
      .order('bill_month', { ascending: false });
    if (error) {
      console.error(error);
      toastError('無法載入信用卡帳單');
      return [];
    }
    return data;
  },

  // -------------------------------------------------------
  // Render the "信用卡帳單" view
  // -------------------------------------------------------
  async load() {
    const container = document.getElementById('cc-bills-content');
    container.innerHTML = `<div class="skel skel-card" style="height:280px;"></div>`;
    await window.CreditCards.ensureLoaded();
    const bills = await this.fetchBills();
    this.cache = bills;
    this.render(bills);
  },

  render(bills) {
    const container = document.getElementById('cc-bills-content');
    if (bills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>還沒有任何信用卡帳單</h3>
          <p>點擊右上角「新增信用卡帳單」開始登錄第一筆帳單。</p>
        </div>`;
      return;
    }

    const rows = bills.map(b => `
      <tr data-bill-id="${b.id}">
        <td>${escapeHtml(b.credit_cards?.card_name || '(信用卡已刪除)')}${b.credit_cards && !b.credit_cards.is_active ? '(已停用)' : ''}</td>
        <td>${formatMonthLabelShort(b.bill_month)}</td>
        <td class="amount-cell">${formatMoney(b.amount)}</td>
        <td><span class="tag ${b.is_paid ? 'tag-paid' : 'tag-unpaid'}">${b.is_paid ? '已繳款' : '未繳款'}</span></td>
        <td>${b.paid_at ? formatDate(b.paid_at) : '-'}</td>
      </tr>`).join('');

    const cards = bills.map(b => `
      <div class="record-card" data-bill-id="${b.id}">
        <div class="record-card-top">
          <span class="record-card-date">${escapeHtml(b.credit_cards?.card_name || '(信用卡已刪除)')}</span>
          <span class="tag ${b.is_paid ? 'tag-paid' : 'tag-unpaid'}">${b.is_paid ? '已繳款' : '未繳款'}</span>
        </div>
        <div class="record-card-amount">${formatMoney(b.amount)}</div>
        <div class="record-card-breakdown">
          <span>${formatMonthLabelShort(b.bill_month)}</span>
          ${b.paid_at ? `<span>繳款日 ${formatDate(b.paid_at)}</span>` : ''}
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>信用卡</th><th>帳單月份</th><th>金額</th><th>狀態</th><th>實際繳款日期</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="record-cards" style="padding:2px 0;">${cards}</div>
      </div>
    `;

    container.querySelectorAll('[data-bill-id]').forEach(el => {
      el.addEventListener('click', () => {
        const bill = bills.find(b => b.id === el.dataset.billId);
        this.openEditModal(bill);
      });
    });
  },

  // -------------------------------------------------------
  // Add / edit modal
  // -------------------------------------------------------
  cardOptionsHtml(selectedId) {
    const active = window.CreditCards.getActive();
    let list = [...active];
    if (selectedId && !list.find(c => c.id === selectedId)) {
      const inactive = window.CreditCards.getById(selectedId);
      if (inactive) list.push(inactive);
    }
    if (list.length === 0) return `<option value="">— 尚無可用信用卡 —</option>`;
    return `<option value="">— 請選擇 —</option>` + list.map(c =>
      `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.card_name)}${c.is_active ? '' : '(已停用)'}</option>`
    ).join('');
  },

  openAddModal() {
    if (window.CreditCards.getActive().length === 0) {
      openModal({
        title: '新增信用卡帳單',
        bodyHtml: `<div class="empty-state" style="padding:20px 0;">
          <div class="icon">${icon('creditcard')}</div>
          <h3>請先加入至少一張信用卡</h3>
          <p>新增帳單前,需要先在「信用卡管理」加入信用卡。</p>
        </div>`,
        footerHtml: `<button class="btn btn-primary" id="goto-cards-btn">前往信用卡管理</button>`,
        onMount: () => {
          document.getElementById('goto-cards-btn').addEventListener('click', () => {
            closeModal();
            navigateTo('cc-cards');
          });
        },
      });
      return;
    }
    this.openForm(null);
  },

  openEditModal(bill) {
    this.openForm(bill);
  },

  openForm(bill) {
    const isEdit = !!bill;
    const monthValue = isEdit ? dateToMonthInput(bill.bill_month) : dateToMonthInput(todayISO());

    const bodyHtml = `
      <form id="bill-form">
        <div class="field">
          <label for="bill-card">所屬信用卡</label>
          <select id="bill-card">${this.cardOptionsHtml(isEdit ? bill.credit_card_id : null)}</select>
        </div>
        <div class="field">
          <label for="bill-month">帳單月份</label>
          <input type="month" id="bill-month" value="${monthValue}" required>
        </div>
        <div class="field">
          <label for="bill-amount">帳單金額</label>
          <input type="number" id="bill-amount" min="0" step="1" value="${isEdit ? bill.amount : ''}" placeholder="例如:8560">
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="bill-is-paid" ${isEdit && bill.is_paid ? 'checked' : ''}> 已繳款
          </label>
        </div>
        <div class="field" id="bill-paid-at-field" style="${isEdit && bill.is_paid ? '' : 'display:none;'}">
          <label for="bill-paid-at">實際繳款日期</label>
          <input type="date" id="bill-paid-at" value="${isEdit && bill.paid_at ? bill.paid_at : ''}">
          <div class="field-hint" id="bill-paid-at-hint"></div>
        </div>
        <div class="field">
          <label for="bill-notes">備註(選填)</label>
          <textarea id="bill-notes" rows="2" placeholder="例如:包含旅遊交通費">${isEdit && bill.notes ? escapeHtml(bill.notes) : ''}</textarea>
        </div>
        <div class="field-error" id="bill-form-error"></div>
      </form>
    `;
    const footerHtml = `
      ${isEdit ? `<button class="btn btn-danger" id="bill-delete-btn" style="margin-right:auto;">${icon('trash')}<span>刪除</span></button>` : ''}
      <button class="btn btn-secondary" id="bill-cancel-btn">取消</button>
      <button class="btn btn-primary" id="bill-save-btn">${isEdit ? '儲存變更' : '新增帳單'}</button>
    `;

    openModal({
      title: isEdit ? '編輯信用卡帳單' : '新增信用卡帳單',
      bodyHtml,
      footerHtml,
      onMount: () => {
        document.getElementById('bill-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('bill-save-btn').addEventListener('click', () => this.submitForm(bill));
        if (isEdit) {
          document.getElementById('bill-delete-btn').addEventListener('click', () => this.confirmDelete(bill));
        }

        const paidCheckbox = document.getElementById('bill-is-paid');
        const paidAtField = document.getElementById('bill-paid-at-field');
        const paidAtInput = document.getElementById('bill-paid-at');

        paidCheckbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            paidAtField.style.display = '';
            return;
          }
          if (paidAtInput.value) {
            // Unchecking "已繳款" while a date is already filled in —
            // confirm before clearing it, per spec section 5-4. Uses a
            // native confirm() here (not our custom modal) because this
            // modal only supports one overlay at a time, and opening a
            // second one on top would tear down this very form.
            const shouldClear = window.confirm('取消「已繳款」後,是否要一併清除實際繳款日期?');
            if (shouldClear) {
              paidAtInput.value = '';
              paidAtField.style.display = 'none';
            } else {
              e.target.checked = true; // keep marked as paid
              paidAtField.style.display = '';
            }
          } else {
            paidAtField.style.display = 'none';
          }
        });
      },
    });
  },

  async submitForm(existingBill) {
    const errorEl = document.getElementById('bill-form-error');
    errorEl.classList.remove('show');

    const credit_card_id = document.getElementById('bill-card').value;
    const monthValue = document.getElementById('bill-month').value;
    const amountRaw = document.getElementById('bill-amount').value;
    const is_paid = document.getElementById('bill-is-paid').checked;
    const paid_at = document.getElementById('bill-paid-at').value || null;
    const notes = document.getElementById('bill-notes').value.trim() || null;

    if (!credit_card_id) { errorEl.textContent = '請選擇所屬信用卡'; errorEl.classList.add('show'); return; }
    if (!monthValue) { errorEl.textContent = '請選擇帳單月份'; errorEl.classList.add('show'); return; }
    if (amountRaw === '' || Number(amountRaw) < 0) {
      errorEl.textContent = '請輸入有效的帳單金額(不可為負數)';
      errorEl.classList.add('show');
      return;
    }
    if (is_paid && !paid_at) {
      // Soft hint per spec ("給予合理提示"), not a hard block.
      errorEl.textContent = '提醒:已勾選「已繳款」但尚未填寫實際繳款日期,仍會繼續儲存。';
      errorEl.classList.add('show');
    }

    const payload = {
      credit_card_id,
      bill_month: monthInputToDate(monthValue),
      amount: Number(amountRaw),
      is_paid,
      paid_at: is_paid ? paid_at : null,
      notes,
    };
    const saveBtn = document.getElementById('bill-save-btn');

    await withLoading(saveBtn, async () => {
      let error;
      if (existingBill) {
        ({ error } = await supabaseClient.from('credit_card_bills').update(payload).eq('id', existingBill.id));
      } else {
        payload.user_id = App.currentUser.id;
        ({ error } = await supabaseClient.from('credit_card_bills').insert(payload));
      }

      if (error) {
        console.error(error);
        if (error.code === '23505') {
          // unique_violation on (user_id, credit_card_id, bill_month)
          errorEl.textContent = '這張信用卡在該帳單月份已經有一筆帳單了,請改用編輯既有帳單。';
        } else {
          errorEl.textContent = '無法儲存資料,請稍後再試。';
        }
        errorEl.classList.add('show');
        return;
      }
      closeModal();
      toastSuccess(existingBill ? '帳單已更新' : '帳單已新增');
      if (App.currentView === 'cc-bills') this.load();
    });
  },

  confirmDelete(bill) {
    confirmDialog({
      title: '刪除信用卡帳單',
      messageHtml: `確定要刪除「${formatMonthLabelShort(bill.bill_month)}」的帳單紀錄嗎?<span class="warn">此動作無法復原。</span>`,
      confirmLabel: '刪除',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabaseClient.from('credit_card_bills').delete().eq('id', bill.id);
        if (error) { toastError(); return; }
        closeModal();
        toastSuccess('帳單已刪除');
        if (App.currentView === 'cc-bills') this.load();
      },
    });
  },
};
