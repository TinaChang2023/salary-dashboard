// =========================================================
// cc-statistics.js — V2 信用卡統計
// Entirely independent of V1 salary/account tables and of
// statistics.js's own state — reuses DOUGHNUT_PALETTE (declared as a
// top-level const in statistics.js, which loads before this file and
// therefore shares the same classic-script top-level scope) purely
// for visual consistency between the two modules' charts. No data,
// totals, or calculations are shared or combined between them.
// =========================================================

window.CCStatistics = {
  trendChart: null,
  selectedMonth: null, // 'YYYY-MM', for the 7-1 single-month total only

  async load() {
    const container = document.getElementById('cc-statistics-content');
    container.innerHTML = `<div class="skel skel-card" style="height:320px;"></div>`;

    if (!this.selectedMonth) this.selectedMonth = dateToMonthInput(todayISO());

    await window.CreditCards.ensureLoaded();
    const { data: bills, error } = await supabaseClient
      .from('credit_card_bills')
      .select('*, credit_cards(card_name, is_active)')
      .order('bill_month', { ascending: true });

    if (error) {
      console.error(error);
      toastError('無法載入信用卡統計');
      container.innerHTML = `<div class="empty-state"><p>無法載入資料,請稍後再試。</p></div>`;
      return;
    }

    this.cache = bills || [];
    this.render();
  },

  render() {
    const container = document.getElementById('cc-statistics-content');
    const bills = this.cache || [];

    if (bills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>還沒有任何信用卡帳單可供統計</h3>
          <p>先在「信用卡帳單」登錄至少一筆月結帳單。</p>
        </div>`;
      return;
    }

    // ---- 7-1: 選定月份的信用卡支出總額(所有帳單金額加總,不論是否已繳款) ----
    const monthTotal = bills
      .filter(b => b.bill_month.slice(0, 7) === this.selectedMonth)
      .reduce((sum, b) => sum + Number(b.amount), 0);

    // ---- 7-3: 各信用卡累積支出(所有時間、不論是否已繳款) ----
    const cardTotals = {}; // credit_card_id -> { name, is_active, total }
    bills.forEach(b => {
      if (!cardTotals[b.credit_card_id]) {
        cardTotals[b.credit_card_id] = {
          name: b.credit_cards?.card_name || '(信用卡已刪除)',
          is_active: b.credit_cards?.is_active ?? true,
          total: 0,
        };
      }
      cardTotals[b.credit_card_id].total += Number(b.amount);
    });
    const cardRows = Object.values(cardTotals).sort((a, b) => b.total - a.total);

    // ---- 7-4: 已繳款 / 未繳款總額(所有時間,付款狀態統計,非總支出) ----
    let paidTotal = 0, unpaidTotal = 0;
    bills.forEach(b => {
      if (b.is_paid) paidTotal += Number(b.amount);
      else unpaidTotal += Number(b.amount);
    });

    // ---- 7-2: 各信用卡每月支出趨勢 ----
    const monthKeys = [...new Set(bills.map(b => b.bill_month.slice(0, 7)))].sort();
    const cardIds = Object.keys(cardTotals);
    const monthlyByCard = {}; // credit_card_id -> { 'YYYY-MM': amount }
    cardIds.forEach(id => { monthlyByCard[id] = {}; monthKeys.forEach(m => { monthlyByCard[id][m] = 0; }); });
    bills.forEach(b => {
      const m = b.bill_month.slice(0, 7);
      monthlyByCard[b.credit_card_id][m] = (monthlyByCard[b.credit_card_id][m] || 0) + Number(b.amount);
    });

    container.innerHTML = `
      <div class="filter-bar">
        <div class="field">
          <label for="cc-stats-month">查看月份</label>
          <input type="month" id="cc-stats-month" value="${this.selectedMonth}">
        </div>
        <button class="btn btn-secondary" id="cc-stats-apply-btn">套用</button>
      </div>

      <div class="summary-strip">
        <div>
          <div class="month-label">${formatMonthLabelShort(this.selectedMonth + '-01')}信用卡支出總額</div>
          <div class="amount">${formatMoney(monthTotal)}</div>
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:20px;">
        <div class="stat-card"><div class="label">已繳款帳單金額(所有時間)</div><div class="value" style="color:var(--success)">${formatMoney(paidTotal)}</div></div>
        <div class="stat-card"><div class="label">未繳款帳單金額(所有時間)</div><div class="value" style="color:var(--danger)">${formatMoney(unpaidTotal)}</div></div>
      </div>

      <div class="chart-card">
        <div class="section-title" style="margin-top:0;">各信用卡每月支出趨勢</div>
        <div class="chart-wrap"><canvas id="cc-trend-chart"></canvas></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="section-title" style="margin-top:0;">各信用卡累積支出(所有時間、不論是否已繳款)</div>
        ${cardRows.map(c => `
          <div class="account-stat-row">
            <div>
              <div class="name">${escapeHtml(c.name)}${c.is_active ? '' : '(已停用)'}</div>
              <div class="type">累積支出</div>
            </div>
            <div class="value">${formatMoney(c.total)}</div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('cc-stats-apply-btn').addEventListener('click', () => {
      this.selectedMonth = document.getElementById('cc-stats-month').value || this.selectedMonth;
      this.render();
    });

    this.renderTrendChart(monthKeys, cardIds, cardTotals, monthlyByCard);
  },

  renderTrendChart(monthKeys, cardIds, cardTotals, monthlyByCard) {
    const canvas = document.getElementById('cc-trend-chart');
    if (this.trendChart) { this.trendChart.destroy(); this.trendChart = null; }
    if (!canvas || monthKeys.length === 0 || cardIds.length === 0) return;

    const datasets = cardIds.map((id, i) => {
      const color = DOUGHNUT_PALETTE[i % DOUGHNUT_PALETTE.length];
      const label = cardTotals[id].name + (cardTotals[id].is_active ? '' : '(已停用)');
      return {
        label,
        data: monthKeys.map(m => monthlyByCard[id][m] || 0),
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      };
    });

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: { labels: monthKeys, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + v.toLocaleString() } },
        },
      },
    });
  },
};
