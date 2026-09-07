// =========================================================
// statistics.js — 統計:累積金額、依帳戶統計、每月趨勢圖
// =========================================================

window.Statistics = {
  chartInstance: null,

  defaultStartDate() {
    const y = new Date().getFullYear();
    return `${y}-01-01`;
  },

  async load() {
    const startInput = document.getElementById('stats-start-date');
    const endInput = document.getElementById('stats-end-date');
    if (!startInput.value) startInput.value = this.defaultStartDate();
    if (!endInput.value) endInput.value = todayISO();

    document.getElementById('stats-apply-btn').onclick = () => this.render();
    await window.Accounts.ensureLoaded();
    await this.render();
  },

  async render() {
    const container = document.getElementById('statistics-content');
    container.innerHTML = `<div class="skel skel-card" style="height:320px;"></div>`;

    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    const { data: records, error } = await supabaseClient
      .from('salary_records')
      .select('*, salary_allocations(id, category, amount, account_id, accounts(name, is_active))')
      .gte('salary_date', startDate)
      .lte('salary_date', endDate)
      .order('salary_date', { ascending: true });

    if (error) {
      console.error(error);
      toastError('無法載入統計資料');
      container.innerHTML = `<div class="empty-state"><p>無法載入資料,請稍後再試。</p></div>`;
      return;
    }

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>此區間沒有薪水紀錄</h3>
          <p>試著調整開始 / 結束日期。</p>
        </div>`;
      return;
    }

    // --- Totals ---
    let totalSalary = 0, totalExpense = 0, totalSaving = 0, totalInvestment = 0;
    const accountTotals = {}; // account_id -> { name, is_active, total }
    const monthly = {}; // 'YYYY-MM' -> { salary, expense, saving, investment }

    records.forEach(r => {
      totalSalary += Number(r.salary_amount);
      const monthKey = r.salary_date.slice(0, 7);
      if (!monthly[monthKey]) monthly[monthKey] = { salary: 0, expense: 0, saving: 0, investment: 0 };
      monthly[monthKey].salary += Number(r.salary_amount);

      (r.salary_allocations || []).forEach(a => {
        const amt = Number(a.amount);
        if (a.category === 'expense') { totalExpense += amt; monthly[monthKey].expense += amt; }
        if (a.category === 'saving') { totalSaving += amt; monthly[monthKey].saving += amt; }
        if (a.category === 'investment') { totalInvestment += amt; monthly[monthKey].investment += amt; }

        if (!accountTotals[a.account_id]) {
          accountTotals[a.account_id] = {
            name: a.accounts?.name || '(帳戶已刪除)',
            is_active: a.accounts?.is_active ?? true,
            total: 0,
          };
        }
        accountTotals[a.account_id].total += amt;
      });
    });

    const accountRows = Object.values(accountTotals).sort((a, b) => b.total - a.total);
    const monthKeys = Object.keys(monthly).sort();

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="label">累積薪水</div><div class="value">${formatMoney(totalSalary)}</div></div>
        <div class="stat-card"><div class="label">累積花費</div><div class="value" style="color:var(--expense)">${formatMoney(totalExpense)}</div></div>
        <div class="stat-card"><div class="label">累積儲蓄</div><div class="value" style="color:var(--saving)">${formatMoney(totalSaving)}</div></div>
        <div class="stat-card"><div class="label">累積投資</div><div class="value" style="color:var(--investment)">${formatMoney(totalInvestment)}</div></div>
      </div>

      <div class="chart-card">
        <div class="section-title" style="margin-top:0;">每月趨勢</div>
        <div class="chart-wrap"><canvas id="trend-chart"></canvas></div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">依帳戶統計(累積分配金額,非目前帳戶餘額)</div>
        ${accountRows.map(a => `
          <div class="account-stat-row">
            <div>
              <div class="name">${escapeHtml(a.name)}${a.is_active ? '' : '(已停用)'}</div>
              <div class="type">累積分配</div>
            </div>
            <div class="value">${formatMoney(a.total)}</div>
          </div>
        `).join('')}
      </div>
    `;

    this.renderChart(monthKeys, monthly);
  },

  renderChart(monthKeys, monthly) {
    const ctx = document.getElementById('trend-chart');
    if (this.chartInstance) { this.chartInstance.destroy(); this.chartInstance = null; }

    const styles = getComputedStyle(document.documentElement);
    const colorExpense = styles.getPropertyValue('--expense').trim();
    const colorSaving = styles.getPropertyValue('--saving').trim();
    const colorInvestment = styles.getPropertyValue('--investment').trim();
    const colorInk = styles.getPropertyValue('--ink').trim();

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthKeys,
        datasets: [
          { label: '薪水', data: monthKeys.map(k => monthly[k].salary), borderColor: colorInk, backgroundColor: colorInk, tension: 0.3, borderWidth: 2, pointRadius: 3 },
          { label: '花費', data: monthKeys.map(k => monthly[k].expense), borderColor: colorExpense, backgroundColor: colorExpense, tension: 0.3, borderWidth: 2, pointRadius: 3 },
          { label: '儲蓄', data: monthKeys.map(k => monthly[k].saving), borderColor: colorSaving, backgroundColor: colorSaving, tension: 0.3, borderWidth: 2, pointRadius: 3 },
          { label: '投資', data: monthKeys.map(k => monthly[k].investment), borderColor: colorInvestment, backgroundColor: colorInvestment, tension: 0.3, borderWidth: 2, pointRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        },
        scales: {
          y: { ticks: { callback: (v) => '$' + v.toLocaleString() } },
        },
      },
    });
  },
};
