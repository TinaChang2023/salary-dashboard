// =========================================================
// settings.js — allocation ratio settings (future records only)
// =========================================================

window.Settings = {
  current: null,

  async load() {
    const { data, error } = await supabaseClient.from('settings').select('*').single();
    if (error || !data) {
      toastError('無法載入設定');
      return;
    }
    this.current = data;
    document.getElementById('rate-expense').value = data.expense_rate;
    document.getElementById('rate-saving').value = data.saving_rate;
    document.getElementById('rate-investment').value = data.investment_rate;
    this.updateTotalDisplay();

    const form = document.getElementById('settings-form');
    // avoid stacking duplicate listeners across repeated view visits
    const freshForm = form.cloneNode(true);
    form.parentNode.replaceChild(freshForm, form);

    ['rate-expense', 'rate-saving', 'rate-investment'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateTotalDisplay());
    });
    freshForm.addEventListener('submit', (e) => this.handleSubmit(e));
  },

  getValues() {
    return {
      expense_rate: Number(document.getElementById('rate-expense').value) || 0,
      saving_rate: Number(document.getElementById('rate-saving').value) || 0,
      investment_rate: Number(document.getElementById('rate-investment').value) || 0,
    };
  },

  updateTotalDisplay() {
    const { expense_rate, saving_rate, investment_rate } = this.getValues();
    const total = Math.round((expense_rate + saving_rate + investment_rate) * 100) / 100;
    const el = document.getElementById('rate-total-display');
    el.textContent = `總和:${total}%`;
    el.classList.remove('good', 'bad');
    el.classList.add(total === 100 ? 'good' : 'bad');
    return total;
  },

  async handleSubmit(e) {
    e.preventDefault();
    const total = this.updateTotalDisplay();
    if (total !== 100) {
      toastError('三個比例總和必須等於 100%,目前無法儲存。');
      return;
    }
    const values = this.getValues();
    const submitBtn = document.getElementById('settings-submit');
    await withLoading(submitBtn, async () => {
      const { error } = await supabaseClient
        .from('settings')
        .update(values)
        .eq('user_id', App.currentUser.id);
      if (error) { console.error(error); toastError(); return; }
      toastSuccess('✓ 設定已儲存(僅影響未來新增的薪水)');
    });
  },
};
