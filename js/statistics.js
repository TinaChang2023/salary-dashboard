// =========================================================
// statistics.js — 統計:累積金額、依帳戶統計、每月趨勢圖、
// 儲蓄分布 Doughnut Chart(獨立於日期區間篩選)
// =========================================================

// Chart.js plugin: draws two lines of centered text inside a doughnut
// chart's hole (label + total amount). Only attached to the savings
// doughnut instance below — never registered globally — so it has no
// effect on the unrelated monthly trend line chart.
const doughnutCenterTextPlugin = {
  id: 'doughnutCenterText',
  afterDraw(chart, args, pluginOptions) {
    const { label, value } = pluginOptions || {};
    if (!label && !value) return;
    const { ctx, chartArea } = chart;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim();
    ctx.font = '600 12.5px "Noto Sans TC", sans-serif';
    ctx.fillText(label || '', centerX, centerY - 12);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.fillText(value || '', centerX, centerY + 10);
    ctx.restore();
  },
};

// A small, low-saturation palette cycled per account slice — kept
// visually consistent with the app's expense/saving/investment hues
// without forcing every account into just those 3 colors.
const DOUGHNUT_PALETTE = [
  '#2F7A8C', '#5B5A96', '#B9744F', '#4E8C6B',
  '#8C6B9E', '#A67C52', '#3E6E99', '#9C6B6B',
];

window.Statistics = {
  chartInstance: null,
  doughnutInstance: null,

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

    // The date-range-filtered query (existing behaviour, unchanged) and
    // the ALL-TIME savings breakdown (new, intentionally ignores the
    // date filter — see fetchSavingsBreakdown()) are independent and
    // fetched in parallel.
    const [rangeResult, savingsBreakdown] = await Promise.all([
      supabaseClient
        .from('salary_records')
        .select('*, salary_allocations(id, category, amount, account_id, accounts(name, is_active))')
        .gte('salary_date', startDate)
        .lte('salary_date', endDate)
        .order('salary_date', { ascending: true }),
      this.fetchSavingsBreakdown(),
    ]);

    const { data: records, error } = rangeResult;
    if (error) {
      console.error(error);
      toastError('無法載入統計資料');
      container.innerHTML = `<div class="empty-state"><p>無法載入資料,請稍後再試。</p></div>`;
      return;
    }

    let rangeSectionHtml;
    let monthKeys = [];
    let monthly = {};

    if (!records || records.length === 0) {
      rangeSectionHtml = `
        <div class="empty-state">
          <div class="icon">${icon('empty')}</div>
          <h3>此區間沒有薪水紀錄</h3>
          <p>試著調整開始 / 結束日期。</p>
        </div>`;
    } else {
      // --- Totals (unchanged logic) ---
      let totalSalary = 0, totalExpense = 0, totalSaving = 0, totalInvestment = 0;
      const accountTotals = {}; // account_id -> { name, is_active, total }
      monthly = {}; // 'YYYY-MM' -> { salary, expense, saving, investment }

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
      monthKeys = Object.keys(monthly).sort();

      rangeSectionHtml = `
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

        <div class="card" style="margin-bottom:20px;">
          <div class="section-title" style="margin-top:0;">依帳戶統計(此區間內的累積分配金額,非目前帳戶餘額)</div>
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
    }

    container.innerHTML = rangeSectionHtml + this.renderSavingsSectionHtml(savingsBreakdown);

    if (records && records.length > 0) this.renderChart(monthKeys, monthly);
    this.renderSavingsDoughnut(savingsBreakdown);
  },

  // -------------------------------------------------------
  // Savings breakdown — INTENTIONALLY independent of the
  // start/end date filter above. "起始累積金額" existed before this
  // app was ever used, so it (and everything accumulated since) must
  // keep showing regardless of which date range is currently selected.
  // = 起始儲蓄金額(account_initial_balances, category='saving')
  //   + 所有時間(不限日期區間)透過薪水分配進該帳戶的儲蓄金額
  // Returns an array of { account_id, name, is_active, total },
  // already sorted descending and with zero-total accounts dropped,
  // or null on error.
  // -------------------------------------------------------
  async fetchSavingsBreakdown() {
    const [allocResult, initialResult] = await Promise.all([
      supabaseClient
        .from('salary_allocations')
        .select('account_id, amount, accounts(name, is_active)')
        .eq('category', 'saving'),
      supabaseClient
        .from('account_initial_balances')
        .select('account_id, amount, accounts(name, is_active)')
        .eq('category', 'saving'),
    ]);

    if (allocResult.error || initialResult.error) {
      console.error(allocResult.error || initialResult.error);
      return null;
    }

    const totals = {}; // account_id -> { name, is_active, total }
    const addRow = (r) => {
      if (!totals[r.account_id]) {
        totals[r.account_id] = {
          account_id: r.account_id,
          name: r.accounts?.name || '(帳戶已刪除)',
          is_active: r.accounts?.is_active ?? true,
          total: 0,
        };
      }
      totals[r.account_id].total += Number(r.amount);
    };

    (initialResult.data || []).forEach(addRow);
    (allocResult.data || []).forEach(addRow);

    return Object.values(totals)
      .filter(a => a.total > 0) // don't force zero-total accounts into the chart
      .sort((a, b) => b.total - a.total);
  },

  renderSavingsSectionHtml(breakdown) {
    if (breakdown === null) {
      return `<div class="chart-card"><div class="section-title" style="margin-top:0;">儲蓄分布</div><p style="color:var(--ink-soft);font-size:13.5px;">無法載入儲蓄分布資料,請稍後再試。</p></div>`;
    }
    if (breakdown.length === 0) {
      return `
        <div class="chart-card">
          <div class="section-title" style="margin-top:0;">儲蓄分布</div>
          <p style="color:var(--ink-soft);font-size:13.5px;">目前還沒有累積儲蓄金額(可在帳戶管理設定「起始累積金額」,或新增薪水後累積)。</p>
        </div>`;
    }
    return `
      <div class="chart-card">
        <div class="section-title" style="margin-top:0;">儲蓄分布</div>
        <div class="subtitle" style="margin:-8px 0 16px;font-size:12.5px;color:var(--ink-soft);">
          目前累積儲蓄(含起始累積金額),不受上方日期區間篩選影響
        </div>
        <div class="doughnut-layout">
          <div class="doughnut-canvas-wrap"><canvas id="savings-doughnut-chart"></canvas></div>
          <div class="savings-legend" id="savings-legend"></div>
        </div>
      </div>`;
  },

  renderSavingsDoughnut(breakdown) {
    if (this.doughnutInstance) { this.doughnutInstance.destroy(); this.doughnutInstance = null; }
    if (!breakdown || breakdown.length === 0) return;

    const canvas = document.getElementById('savings-doughnut-chart');
    if (!canvas) return;

    const total = breakdown.reduce((sum, a) => sum + a.total, 0);
    const colors = breakdown.map((_, i) => DOUGHNUT_PALETTE[i % DOUGHNUT_PALETTE.length]);

    this.doughnutInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: breakdown.map(a => a.name + (a.is_active ? '' : '(已停用)')),
        datasets: [{
          data: breakdown.map(a => a.total),
          backgroundColor: colors,
          borderColor: '#FFFFFF',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false }, // custom legend below, for reliable mobile wrapping
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
                return `${ctx.label}:${formatMoney(ctx.parsed)}(${pct}%)`;
              },
            },
          },
          doughnutCenterText: { label: '累積儲蓄', value: formatMoney(total) },
        },
      },
      plugins: [doughnutCenterTextPlugin],
    });

    const legend = document.getElementById('savings-legend');
    if (legend) {
      legend.innerHTML = breakdown.map((a, i) => {
        const pct = total > 0 ? ((a.total / total) * 100).toFixed(1) : '0.0';
        return `
          <div class="legend-item">
            <span class="legend-dot" style="background:${colors[i]}"></span>
            <span class="legend-name">${escapeHtml(a.name)}${a.is_active ? '' : '(已停用)'}</span>
            <span class="legend-value">${formatMoney(a.total)}<span class="legend-pct">${pct}%</span></span>
          </div>`;
      }).join('');
    }
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
