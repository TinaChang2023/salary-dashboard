// =========================================================
// dashboard.js — current month overview
// =========================================================

window.Dashboard = {
  currentRecord: null,

  async load() {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = `
      <div class="skel skel-card" style="margin-bottom:16px;height:110px;"></div>
      <div class="card-grid-3">
        <div class="skel skel-card"></div>
        <div class="skel skel-card"></div>
        <div class="skel skel-card"></div>
      </div>`;

    document.getElementById('dashboard-month-label').textContent = formatMonthLabel(todayISO());
    await window.Accounts.ensureLoaded();

    const start = firstDayOfMonthISO();
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = toLocalISODate(nextMonth);

    const { data, error } = await supabaseClient
      .from('salary_records')
      .select('*, salary_allocations(id, category, amount, is_completed, completed_at, account_id, accounts(name, is_active))')
      .gte('salary_date', start)
      .lt('salary_date', end)
      .order('salary_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error(error);
      toastError('無法載入本月薪水資料');
      container.innerHTML = `<div class="empty-state"><p>無法載入資料,請稍後再試。</p></div>`;
      return;
    }

    const record = data && data[0] ? data[0] : null;
    this.currentRecord = record;
    this.render(record);
  },

  render(record) {
    const container = document.getElementById('dashboard-content');

    if (!record) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>本月還沒有新增薪水</h3>
          <p>點擊「＋ 新增薪水」開始這個月的分配。</p>
          <button class="btn btn-accent" id="empty-add-salary">${icon('plus')}<span>新增薪水</span></button>
        </div>`;
      document.getElementById('empty-add-salary').addEventListener('click', () => window.Salary.openAddModal());
      return;
    }

    const allocFor = (cat) => (record.salary_allocations || []).find(a => a.category === cat);
    const e = allocFor('expense');
    const s = allocFor('saving');
    const i = allocFor('investment');

    container.innerHTML = `
      <div class="summary-strip">
        <div>
          <div class="month-label">本月薪水 · ${formatDate(record.salary_date)}</div>
          <div class="amount">${formatMoney(record.salary_amount)}</div>
        </div>
      </div>
      <div class="card-grid-3">
        ${this.renderCard('expense', record.expense_rate, e)}
        ${this.renderCard('saving', record.saving_rate, s)}
        ${this.renderCard('investment', record.investment_rate, i)}
      </div>
    `;

    ['expense', 'saving', 'investment'].forEach(cat => {
      const alloc = allocFor(cat);
      const btn = document.getElementById(`dash-toggle-${cat}`);
      if (btn && alloc) {
        btn.addEventListener('click', () => this.toggleCompletion(alloc, !alloc.is_completed));
      }
    });
  },

  renderCard(category, ratePct, alloc) {
    const meta = CATEGORY_META[category];
    const acctName = alloc?.accounts?.name || '-';
    const inactive = alloc?.accounts && !alloc.accounts.is_active;
    const done = !!alloc?.is_completed;
    return `
      <div class="alloc-card cat-${category}">
        <div class="alloc-card-top">
          <div class="alloc-card-label">
            <span class="alloc-card-icon">${icon(meta.icon)}</span>
            <span>${meta.label}</span>
          </div>
          <span class="alloc-card-pct">${ratePct}%</span>
        </div>
        <div class="alloc-card-amount">${formatMoney(alloc?.amount)}</div>
        <div class="alloc-card-progress"><span style="width:${ratePct}%;"></span></div>
        <div class="alloc-card-account">${icon('wallet')} 帳戶:${escapeHtml(acctName)}${inactive ? '(已停用)' : ''}</div>
        <button class="complete-toggle ${done ? 'is-done' : ''}" id="dash-toggle-${category}">
          <span class="box">${done ? icon('check') : ''}</span>
          <span>${done ? '已完成' : '尚未完成'}</span>
        </button>
      </div>`;
  },

  async toggleCompletion(alloc, nextState) {
    const { error } = await supabaseClient
      .from('salary_allocations')
      .update({ is_completed: nextState, completed_at: nextState ? new Date().toISOString() : null })
      .eq('id', alloc.id);
    if (error) { console.error(error); toastError(); return; }
    toastSuccess(nextState ? '✓ 已標記為完成' : '已取消完成');
    this.load();
  },
};
