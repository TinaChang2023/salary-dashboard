// =========================================================
// app.js — shared app shell: icons, toasts, modal, router,
// formatting helpers, and boot sequence.
// =========================================================

const App = {
  currentUser: null,
  currentView: 'dashboard',
};

// ---------------------------------------------------------
// Icons (inline SVG, stroke-based, no external icon font)
// ---------------------------------------------------------
const ICONS = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V16a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3.5a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V10"/></svg>',
  list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
  chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M17 12h4v4h-4a2 2 0 1 1 0-4Z"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  expense: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
  saving: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5-1.5-5-2-8-1C7 5 5 8 5 11c0 1 .3 2 1 3l-1 4 4-1c1 .6 2 .9 3 .9 3 0 6-2 7-5 .8-2.3.5-5.4-1-6.9Z"/><circle cx="15.5" cy="9.5" r=".8" fill="currentColor" stroke="none"/></svg>',
  investment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  empty: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  mark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/></svg>',
};

const CATEGORY_META = {
  expense: { label: '花費', icon: 'expense', cssVar: '--expense' },
  saving: { label: '儲蓄', icon: 'saving', cssVar: '--saving' },
  investment: { label: '投資', icon: 'investment', cssVar: '--investment' },
};

function icon(name) { return ICONS[name] || ''; }

// ---------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------
function formatMoney(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.replace(/-/g, '/');
}

function formatMonthLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

// Format a Date object as a LOCAL (not UTC) 'YYYY-MM-DD' string.
// date.toISOString() converts to UTC first, which in a UTC+8 timezone
// like Taiwan silently rolls the date back by one day for any local
// time between 00:00 and 07:59. Every date-only value in this app
// (salary_date, statistics filters, "today", month boundaries) must
// be built from local Y/M/D components via this helper instead of
// toISOString(). Timestamps (completed_at) are unaffected — those are
// full timestamptz values where UTC is correct and unambiguous.
function toLocalISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayISO() {
  return toLocalISODate(new Date());
}

function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------------------------------------------------------
// Toasts
// ---------------------------------------------------------
function showToast(message, type = 'default') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

function toastSuccess(msg) { showToast(msg, 'success'); }
function toastError(msg) { showToast(msg || '無法儲存資料,請稍後再試。', 'error'); }

// Friendly wrapper around Supabase calls used throughout the app.
async function withLoading(button, fn) {
  const original = button ? button.innerHTML : null;
  if (button) {
    button.disabled = true;
    button.dataset.loading = '1';
    button.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
  }
  try {
    return await fn();
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

// ---------------------------------------------------------
// Modal
// ---------------------------------------------------------
function openModal({ title, bodyHtml, footerHtml, wide = false, onMount, onClose }) {
  closeModal(); // only one modal at a time
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" id="modal-close-btn" aria-label="關閉">${icon('close')}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.appendChild(overlay);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  App._onModalClose = onClose || null;
  if (onMount) onMount(overlay);
}

function closeModal() {
  const overlay = document.getElementById('active-modal-overlay');
  if (overlay) overlay.remove();
  if (App._onModalClose) {
    const cb = App._onModalClose;
    App._onModalClose = null;
    cb();
  }
}

function confirmDialog({ title, messageHtml, confirmLabel = '確定', danger = true, onConfirm }) {
  openModal({
    title,
    bodyHtml: `<div class="confirm-text">${messageHtml}</div>`,
    footerHtml: `
      <button class="btn btn-secondary" id="confirm-cancel-btn">取消</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">${escapeHtml(confirmLabel)}</button>
    `,
    onMount: () => {
      document.getElementById('confirm-cancel-btn').addEventListener('click', closeModal);
      document.getElementById('confirm-ok-btn').addEventListener('click', async () => {
        const btn = document.getElementById('confirm-ok-btn');
        await withLoading(btn, async () => { await onConfirm(); });
      });
    },
  });
}

// ---------------------------------------------------------
// Navigation / router
// ---------------------------------------------------------
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'records', label: '薪水紀錄', icon: 'list' },
  { id: 'statistics', label: '統計', icon: 'chart' },
  { id: 'accounts', label: '帳戶管理', icon: 'wallet' },
  { id: 'settings', label: '設定', icon: 'settings' },
];

function renderNav() {
  const sidebarNav = document.getElementById('sidebar-nav');
  sidebarNav.innerHTML = NAV_ITEMS.map(item => `
    <li>
      <button class="nav-item ${App.currentView === item.id ? 'active' : ''}" data-view="${item.id}">
        ${icon(item.icon)}<span>${item.label}</span>
      </button>
    </li>
  `).join('');
  sidebarNav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  const bottomNav = document.getElementById('bottom-nav-list');
  bottomNav.innerHTML = NAV_ITEMS.map(item => `
    <li style="flex:1;">
      <button class="bottom-nav-item ${App.currentView === item.id ? 'active' : ''}" data-view="${item.id}">
        ${icon(item.icon)}<span>${item.label}</span>
      </button>
    </li>
  `).join('');
  bottomNav.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  document.getElementById('logout-btn-desktop').innerHTML = `${icon('logout')}<span>登出</span>`;
  document.getElementById('logout-btn-mobile').innerHTML = icon('logout');
}

const VIEW_LOADERS = {
  dashboard: () => window.Dashboard.load(),
  records: () => window.Salary.loadRecordsView(),
  statistics: () => window.Statistics.load(),
  accounts: () => window.Accounts.load(),
  settings: () => window.Settings.load(),
};

function navigateTo(viewId) {
  App.currentView = viewId;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${viewId}`).classList.remove('hidden');
  renderNav();
  window.scrollTo({ top: 0 });
  const loader = VIEW_LOADERS[viewId];
  if (loader) loader();
}

// ---------------------------------------------------------
// Boot
// ---------------------------------------------------------
function setBrandIcons() {
  document.getElementById('icon-slot-brand').innerHTML = icon('mark');
  document.getElementById('icon-slot-brand-2').innerHTML = icon('mark');
}

function renderIconSlots(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

async function showAppShell(user) {
  App.currentUser = user;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('user-email-label').textContent = user.email;
  document.getElementById('user-avatar').textContent = (user.email || '?').charAt(0).toUpperCase();
  renderNav();
  renderIconSlots();
  await window.Accounts.ensureLoaded(true);
  navigateTo('dashboard');
}

function showAuthScreen() {
  App.currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  setBrandIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  renderIconSlots();
  document.getElementById('btn-add-salary').addEventListener('click', () => window.Salary.openAddModal());
  document.getElementById('btn-add-salary-2').addEventListener('click', () => window.Salary.openAddModal());
  document.getElementById('btn-add-account').addEventListener('click', () => window.Accounts.openEditModal(null));
  document.getElementById('logout-btn-desktop').addEventListener('click', () => window.Auth.logout());
  document.getElementById('logout-btn-mobile').addEventListener('click', () => window.Auth.logout());

  window.Auth.init();
});
