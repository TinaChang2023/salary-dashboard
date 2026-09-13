// =========================================================
// cc-overview.js — V2 信用卡總覽(支出紀錄模組首頁)
// Read-only summary: today's month total, outstanding unpaid total,
// and the list of active cards. Never reads or computes anything
// from V1 salary/account tables.
// =========================================================

window.CCOverview = {
  async load() {
    const container = document.getElementById('cc-overview-content');
    container.innerHTML = `<div class="skel skel-card" style="height:200px;"></div>`;

    await window.CreditCards.ensureLoaded();
    const cards = window.CreditCards.cache || [];

    const { data: bills, error } = await supabaseClient
      .from('credit_card_bills')
      .select('*, credit_cards(card_name, is_active)');

    if (error) {
      console.error(error);
      toastError('無法載入信用卡總覽');
      container.innerHTML = `<div class="empty-state"><p>無法載入資料,請稍後再試。</p></div>`;
      return;
    }

    const thisMonthPrefix = todayISO().slice(0, 7);
    let thisMonthTotal = 0;
    let unpaidTotal = 0;

    (bills || []).forEach(b => {
      const amt = Number(b.amount);
      if (b.bill_month.slice(0, 7) === thisMonthPrefix) thisMonthTotal += amt;
      if (!b.is_paid) unpaidTotal += amt;
    });

    const activeCards = cards.filter(c => c.is_active);

    if (cards.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('creditcard')}</div>
          <h3>還沒有加入任何信用卡</h3>
          <p>先加入一張信用卡,就能開始登錄每月帳單。</p>
          <button class="btn btn-accent" id="overview-add-card">${icon('plus')}<span>加入信用卡</span></button>
        </div>`;
      document.getElementById('overview-add-card').addEventListener('click', () => window.CreditCards.openEditModal(null));
      return;
    }

    container.innerHTML = `
      <div class="stat-grid" style="margin-bottom:20px;">
        <div class="stat-card"><div class="label">${formatMonthLabel(todayISO())}信用卡支出</div><div class="value">${formatMoney(thisMonthTotal)}</div></div>
        <div class="stat-card"><div class="label">目前未繳款總額</div><div class="value" style="color:var(--danger)">${formatMoney(unpaidTotal)}</div></div>
        <div class="stat-card"><div class="label">啟用中信用卡</div><div class="value">${activeCards.length}</div></div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-top:0;">我的信用卡</div>
        ${cards.map(c => `
          <div class="account-stat-row">
            <div>
              <div class="name">${escapeHtml(c.card_name)}${c.is_active ? '' : '(已停用)'}</div>
              <div class="type">${c.bank_name ? escapeHtml(c.bank_name) : '未設定發卡銀行'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },
};
