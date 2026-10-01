/* ===== 数据层：localStorage 持久化 ===== */
var Store = (function () {
  var KEY = 'macaron-ledger-v1';
  var VERSION = '1.1.0';

  /* 图标一律用 Font Awesome 6 类名（fa-solid/fa-brands + fa-xxx） */
  var ICON_TAG = 'fa-solid fa-tag';
  var ICON_CARD = 'fa-solid fa-credit-card';

  /* 旧存档里的 emoji → Font Awesome 映射（load 时自动迁移，幂等） */
  var EMOJI_ICON_MAP = {
    '💚': 'fa-brands fa-weixin',
    '💵': 'fa-solid fa-seedling',
    '💙': 'fa-brands fa-alipay',
    '💛': 'fa-solid fa-piggy-bank',
    '🏦': 'fa-solid fa-building-columns',
    '💳': 'fa-solid fa-credit-card',
    '🍜': 'fa-solid fa-utensils',
    '🚌': 'fa-solid fa-car',
    '🛍': 'fa-solid fa-cart-shopping',
    '🎮': 'fa-solid fa-gamepad',
    '🏠': 'fa-solid fa-house',
    '📦': 'fa-solid fa-ellipsis',
    '💰': 'fa-solid fa-money-bill-wave',
    '🧧': 'fa-solid fa-envelope-open-text',
    '📈': 'fa-solid fa-chart-line',
    '📥': 'fa-solid fa-ellipsis',
    '💧': 'fa-solid fa-droplet',
    '🏷': 'fa-solid fa-tag',
    '🐾': 'fa-solid fa-paw',
    '🧋': 'fa-solid fa-mug-hot',
    '☕': 'fa-solid fa-mug-hot',
    '🍎': 'fa-solid fa-apple-whole',
    '🏃': 'fa-solid fa-person-running',
    '📱': 'fa-solid fa-mobile-screen',
    '✈': 'fa-solid fa-plane',
    '🎁': 'fa-solid fa-gift',
    '⭐': 'fa-solid fa-star',
    '❤': 'fa-solid fa-heart'
  };
  /* 任意图标值（emoji 或 fa- 类名）统一成 Font Awesome 类名 */
  function faIcon(raw, fallback) {
    var v = raw == null ? '' : String(raw).trim();
    if (v.indexOf('fa-') === 0) return v;
    var key = v.replace(/[\uFE0E\uFE0F]/g, '');
    return EMOJI_ICON_MAP[key] || EMOJI_ICON_MAP[v] || fallback || ICON_TAG;
  }

  var DEFAULT_ACCOUNTS = [
    { id: 'a-wx',   name: '微信零钱',   icon: 'fa-brands fa-weixin',          color: '#BAFFC9', balance: 0, order: 0 },
    { id: 'a-wxt',  name: '微信零钱通', icon: 'fa-solid fa-seedling',         color: '#BAFFC9', balance: 0, order: 1 },
    { id: 'a-zfb',  name: '支付宝零钱', icon: 'fa-brands fa-alipay',          color: '#BAE1FF', balance: 0, order: 2 },
    { id: 'a-yeb',  name: '余额宝',     icon: 'fa-solid fa-piggy-bank',       color: '#FFFFBA', balance: 0, order: 3 },
    { id: 'a-icbc', name: '工商银行',   icon: 'fa-solid fa-building-columns', color: '#FFB3BA', balance: 0, order: 4 },
    { id: 'a-ccb',  name: '建设银行',   icon: 'fa-solid fa-landmark',         color: '#BAE1FF', balance: 0, order: 5 }
  ];

  var DEFAULT_CATEGORIES = [
    { id: 'c-food',   name: '餐饮', icon: 'fa-solid fa-utensils',          color: '#FFB3BA', kind: 'expense', order: 0 },
    { id: 'c-trans',  name: '交通', icon: 'fa-solid fa-car',               color: '#BAE1FF', kind: 'expense', order: 1 },
    { id: 'c-shop',   name: '购物', icon: 'fa-solid fa-cart-shopping',     color: '#BAFFC9', kind: 'expense', order: 2 },
    { id: 'c-fun',    name: '娱乐', icon: 'fa-solid fa-gamepad',           color: '#FFFFBA', kind: 'expense', order: 3 },
    { id: 'c-rent',   name: '房租', icon: 'fa-solid fa-house',             color: '#FFB3BA', kind: 'expense', order: 4 },
    { id: 'c-other',  name: '其他', icon: 'fa-solid fa-ellipsis',          color: '#BAE1FF', kind: 'expense', order: 5 },
    { id: 'c-salary', name: '工资', icon: 'fa-solid fa-money-bill-wave',   color: '#BAFFC9', kind: 'income', order: 6 },
    { id: 'c-hb',     name: '红包', icon: 'fa-solid fa-envelope-open-text', color: '#FFB3BA', kind: 'income', order: 7 },
    { id: 'c-inv',    name: '理财', icon: 'fa-solid fa-chart-line',        color: '#BAE1FF', kind: 'income', order: 8 },
    { id: 'c-inoth',  name: '其他', icon: 'fa-solid fa-ellipsis',          color: '#FFFFBA', kind: 'income', order: 9 }
  ];

  function blank() {
    return {
      accounts: DEFAULT_ACCOUNTS.map(function (a) { return Object.assign({}, a); }),
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      transactions: [],
      settings: { dark: false, nickname: 'Dora' }
    };
  }

  var state = blank();

  /* v1.1：把存档里的 emoji 图标统一迁移成 Font Awesome 图标（幂等） */
  function normalizeIcons() {
    var changed = false;
    state.accounts.forEach(function (a) {
      var v = faIcon(a.icon, ICON_CARD);
      if (v !== a.icon) { a.icon = v; changed = true; }
    });
    state.categories.forEach(function (c) {
      var v = faIcon(c.icon, ICON_TAG);
      if (v !== c.icon) { c.icon = v; changed = true; }
    });
    return changed;
  }

  /* 数据迁移：给旧存档补充后加的字段 */
  function migrate() {
    var changed = normalizeIcons();
    if (!state.categories.some(function (c) { return c.id === 'c-water'; })) {
      var idx = -1;
      state.categories.forEach(function (c, i) { if (c.id === 'c-food') idx = i; });
      state.categories.splice(idx >= 0 ? idx + 1 : 1, 0,
        { id: 'c-water', name: '桶装水', icon: 'fa-solid fa-droplet', color: '#BAE1FF', kind: 'expense', order: 0 });
      state.categories.forEach(function (c, i) { c.order = i; });
      changed = true;
    }
    /* v1.1：昵称字段 */
    if (!state.settings.nickname) { state.settings.nickname = 'Dora'; changed = true; }
    if (changed) save();
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.accounts && data.categories && data.transactions) {
          state = data;
          if (!state.settings) state.settings = { dark: false };
        }
      }
    } catch (e) { /* 数据损坏则用默认 */ }
    migrate();
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  /* ---- 账户 ---- */
  function getAccounts() {
    return state.accounts.slice().sort(function (a, b) { return a.order - b.order; });
  }
  function getAccount(id) {
    for (var i = 0; i < state.accounts.length; i++) if (state.accounts[i].id === id) return state.accounts[i];
    return null;
  }
  /* 当前余额 = 初始余额 + 收入 - 支出 - 转出 + 转入 */
  function accountBalance(id) {
    var acc = getAccount(id);
    if (!acc) return 0;
    var bal = acc.balance;
    state.transactions.forEach(function (t) {
      if (t.kind === 'transfer') {
        if (t.accountId === id) bal -= t.amount;
        if (t.toAccountId === id) bal += t.amount;
      } else if (t.accountId === id) {
        bal += (t.kind === 'income') ? t.amount : -t.amount;
      }
    });
    return Math.round(bal * 100) / 100;
  }
  function totalAssets() {
    return getAccounts().reduce(function (s, a) { return s + accountBalance(a.id); }, 0);
  }
  function updateAccount(id, patch) {
    var acc = getAccount(id);
    if (acc) { Object.assign(acc, patch); save(); }
  }
  function addAccount(name, icon, color) {
    var maxOrder = state.accounts.reduce(function (m, a) { return Math.max(m, a.order); }, -1);
    var acc = { id: uid('a'), name: name, icon: faIcon(icon, ICON_CARD), color: color || '#BAE1FF', balance: 0, order: maxOrder + 1 };
    state.accounts.push(acc); save(); return acc;
  }
  /* 把当前余额校准为 target（通过调整初始余额） */
  function setAccountBalance(id, target) {
    var acc = getAccount(id);
    if (!acc) return;
    var cur = accountBalance(id);
    acc.balance = Math.round((acc.balance + (target - cur)) * 100) / 100;
    save();
  }
  function reorderAccounts(ids) {
    ids.forEach(function (id, idx) {
      var acc = getAccount(id);
      if (acc) acc.order = idx;
    });
    save();
  }

  /* ---- 分类 ---- */
  function getCategories(kind) {
    return state.categories
      .filter(function (c) { return !kind || c.kind === kind; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function getCategory(id) {
    for (var i = 0; i < state.categories.length; i++) if (state.categories[i].id === id) return state.categories[i];
    return null;
  }
  function addCategory(name, icon, color, kind) {
    var maxOrder = state.categories.reduce(function (m, c) { return Math.max(m, c.order); }, -1);
    var cat = { id: uid('c'), name: name, icon: faIcon(icon, ICON_TAG), color: color || '#FFFFBA', kind: kind, order: maxOrder + 1 };
    state.categories.push(cat); save(); return cat;
  }
  function updateCategory(id, patch) {
    var c = getCategory(id);
    if (c) { Object.assign(c, patch); save(); }
  }
  function reorderCategories(ids) {
    ids.forEach(function (id, idx) {
      var c = getCategory(id);
      if (c) c.order = idx;
    });
    save();
  }
  function deleteCategory(id) {
    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    save();
  }

  /* ---- 交易 ---- */
  function getTransactions() {
    return state.transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.ts - a.ts;
    });
  }
  function addTransaction(t) {
    t.id = uid('t');
    t.ts = Date.now();
    state.transactions.push(t);
    save();
    return t;
  }
  function deleteTransaction(id) {
    state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
    save();
  }
  /* v1.1 新增：修改记录（分类 / 备注 / 类型），金额与账户不可改 */
  function updateTransaction(id, patch) {
    for (var i = 0; i < state.transactions.length; i++) {
      if (state.transactions[i].id === id) {
        Object.assign(state.transactions[i], patch);
        save();
        return state.transactions[i];
      }
    }
    return null;
  }
  /* 区间收支汇总，date 为 'YYYY-MM-DD'，含端点 */
  function summary(from, to) {
    var income = 0, expense = 0;
    state.transactions.forEach(function (t) {
      if (t.date < from || t.date > to || t.kind === 'transfer') return;
      if (t.kind === 'income') income += t.amount; else expense += t.amount;
    });
    return { income: r2(income), expense: r2(expense) };
  }
  function byCategory(from, to, kind) {
    var map = {};
    state.transactions.forEach(function (t) {
      if (t.date < from || t.date > to) return;
      if (t.kind !== kind) return;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.keys(map).map(function (cid) {
      var c = getCategory(cid);
      return {
        id: cid,
        name: c ? c.name : '其他',
        icon: c ? c.icon : ICON_TAG,
        color: c ? c.color : '#CCCCCC',
        value: r2(map[cid])
      };
    }).sort(function (a, b) { return b.value - a.value; });
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ---- 设置 / 数据 ---- */
  function settings() { return state.settings; }
  function setSetting(k, v) { state.settings[k] = v; save(); }
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    var data = JSON.parse(text);
    if (!data.accounts || !data.transactions) throw new Error('格式不对');
    state = data;
    if (!state.settings) state.settings = { dark: false };
    if (!state.settings.nickname) state.settings.nickname = 'Dora';
    if (!state.categories) state.categories = [];
    normalizeIcons();
    save();
  }
  function clearAll() { state = blank(); migrate(); }

  load();

  return {
    getAccounts: getAccounts, getAccount: getAccount, accountBalance: accountBalance,
    totalAssets: totalAssets, updateAccount: updateAccount, addAccount: addAccount,
    setAccountBalance: setAccountBalance, reorderAccounts: reorderAccounts,
    getCategories: getCategories, getCategory: getCategory, addCategory: addCategory,
    updateCategory: updateCategory, reorderCategories: reorderCategories, deleteCategory: deleteCategory,
    getTransactions: getTransactions, addTransaction: addTransaction, deleteTransaction: deleteTransaction,
    updateTransaction: updateTransaction,
    summary: summary, byCategory: byCategory,
    settings: settings, setSetting: setSetting,
    exportJSON: exportJSON, importJSON: importJSON, clearAll: clearAll,
    faIcon: faIcon, VERSION: VERSION
  };
})();
