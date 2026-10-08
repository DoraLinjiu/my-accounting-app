/* ===== Dora 记账 主逻辑 ===== */
(function () {
  'use strict';

  /* ---------- PWA：安装完成提示（v1.3） ----------
     这里刻意不再监听 beforeinstallprompt、也不再调用 preventDefault：
     一旦拦截了这个事件却又不调用 prompt()，浏览器自己的「安装应用」入口就会被我们压掉。
     安装入口交给浏览器原生 UI（地址栏安装图标 / 菜单「安装应用」）。 */
  window.addEventListener('appinstalled', function () {
    toast('已安装到桌面，可从桌面图标直接打开');
  });

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function toStr(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function todayStr() { return toStr(new Date()); }
  function fmt(n) { return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- 图标（Font Awesome 6） ---------- */
  var FA_TAG = 'fa-solid fa-tag';
  var FA_CARD = 'fa-solid fa-credit-card';
  function ic(cls) {
    if (cls === 'custom-red-packet') return '<svg class="red-packet-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M5.5 3.5h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/>' +
      '<path d="M4 7.5c2.1 2.2 4.8 3.3 8 3.3s5.9-1.1 8-3.3"/>' +
      '<path d="m9.2 13 2.8 3.8 2.8-3.8M12 16.8v3M9.7 17.3h4.6"/>' +
      '</svg>';
    return '<i class="' + cls + '" aria-hidden="true"></i>';
  }
  function faOf(obj, fallback) {
    return Store.faIcon(obj && obj.icon ? obj.icon : '', fallback || FA_TAG);
  }
  function iconOf(obj, fallback) { return ic(faOf(obj, fallback || FA_TAG)); }

  /* 新增账户 / 分类时可选用的图标 */
  var ICON_CHOICES = [
    'fa-solid fa-utensils', 'fa-solid fa-cart-shopping', 'fa-solid fa-car', 'fa-solid fa-gamepad',
    'fa-solid fa-house', 'fa-solid fa-droplet', 'fa-solid fa-mug-hot', 'fa-solid fa-bus',
    'fa-solid fa-shirt', 'fa-solid fa-film', 'fa-solid fa-book', 'fa-solid fa-dumbbell',
    'fa-solid fa-plane', 'fa-solid fa-phone', 'fa-solid fa-wifi', 'fa-solid fa-gift', 'custom-red-packet',
    'fa-solid fa-heart', 'fa-solid fa-star', 'fa-solid fa-bolt', 'fa-solid fa-tag',
    'fa-solid fa-credit-card', 'fa-solid fa-wallet', 'fa-solid fa-piggy-bank', 'fa-solid fa-building-columns',
    'fa-solid fa-money-bill-wave', 'fa-solid fa-chart-line', 'fa-solid fa-envelope', 'fa-solid fa-briefcase',
    'fa-brands fa-weixin', 'fa-brands fa-alipay', 'fa-solid fa-coins', 'fa-solid fa-paw'
  ];
  function iconPickHtml(selected) {
    return ICON_CHOICES.map(function (cls) {
      return '<button type="button" class="icon-pick-btn' + (cls === selected ? ' on' : '') + '" data-icon="' + cls + '">' +
        ic(cls) + '</button>';
    }).join('');
  }
  function bindIconPick(root, onPick) {
    $$(root + ' .icon-pick-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $$(root + ' .icon-pick-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        onPick(b.getAttribute('data-icon'));
      });
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 1800);
  }
  function actionError(e, fallback) {
    var msg = e && e.message ? e.message : (fallback || '操作失败');
    toast(msg);
    return false;
  }
  function showFieldError(target, message) {
    $$('#sheetBody .field-error').forEach(function (n) { n.remove(); });
    $$('#sheetBody [aria-invalid="true"]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    if (!target) { toast(message); return; }
    target.setAttribute('aria-invalid', 'true');
    var p = document.createElement('div'); p.className = 'field-error'; p.setAttribute('role', 'alert'); p.textContent = message;
    target.insertAdjacentElement('afterend', p);
    if (target.focus) target.focus({ preventScroll: true });
  }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', Store.settings().dark ? 'dark' : 'light');
  }

  /* ---------- 弹层 ---------- */
  var sheetOpen = false;
  var sheetReturnFocus = null;
  /* v1.3 修复：弹层可以嵌套（记账表单上再开计算器）。
     sheetDismiss 记下"点上方空白该怎么办"：有它就回上一层，没有才真的关闭。
     以前这里一律 closeSheet()，所以在计算器界面点空白会把整个记账流程一起关掉、
     已填的内容也白填了；现在点空白只回到记账表单。*/
  var sheetDismiss = null;
  function openSheet(html, onDismiss) {
    if (!sheetOpen) sheetReturnFocus = document.activeElement;
    sheetDismiss = onDismiss || null;
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.remove('hidden');
    $('#sheetMask').classList.remove('hidden');
    sheetOpen = true;
    requestAnimationFrame(function () {
      var focusable = $('#sheetBody input, #sheetBody select, #sheetBody textarea, #sheetBody button');
      if (focusable) focusable.focus({ preventScroll: true });
    });
  }
  function closeSheet() {
    sheetDismiss = null;
    $('#sheet').classList.add('hidden');
    $('#sheetMask').classList.add('hidden');
    sheetOpen = false;
    if (sheetReturnFocus && sheetReturnFocus.focus) sheetReturnFocus.focus({ preventScroll: true });
    sheetReturnFocus = null;
  }
  $('#sheetMask').addEventListener('click', function () {
    if (sheetDismiss) { sheetDismiss(); return; }
    closeSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !sheetOpen) return;
    e.preventDefault();
    if (sheetDismiss) sheetDismiss(); else closeSheet();
  });

  /* ---------- 路由 ---------- */
  var pages = { home: renderHome, bills: renderBills, stats: renderStats, accounts: renderAccounts, settings: renderSettings };
  function go(page) {
    ['home', 'bills', 'stats', 'accounts', 'settings'].forEach(function (p) {
      $('#page-' + p).classList.toggle('hidden', p !== page);
    });
    $$('.nav-item[data-page]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-page') === page);
    });
    pages[page]();
  }
  $$('.nav-item[data-page]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-page')); });
  });
  $('#navAdd').addEventListener('click', function () { openRecordSheet(); });

  /* ---------- 首页 ---------- */
  function renderHome() {
    var today = todayStr();
    /* v1.3：汇总卡片显示哪个月由 homeState 决定，可左右翻 */
    var ym = homeState.ym;
    var isCurMonth = ym === today.slice(0, 7);
    var ymLabel = ym.slice(0, 4) + ' 年 ' + (+ym.slice(5, 7)) + ' 月';
    /* v1.1：顶栏显示自定义昵称（默认 Dora） */
    var nickEl = $('#topbarNick');
    if (nickEl) nickEl.textContent = Store.settings().nickname || 'Dora';

    var sumToday = Store.summary(today, today);
    var sumMonth = Store.summary(ym + '-01', ym + '-31');
    var monthLeft = Math.round((sumMonth.income - sumMonth.expense) * 100) / 100;
    var total = Store.totalAssets();

    var txs = Store.getTransactions().slice(0, 8);
    var groups = {};
    var order = [];
    txs.forEach(function (t) {
      if (!groups[t.date]) { groups[t.date] = []; order.push(t.date); }
      groups[t.date].push(t);
    });

    var listHtml = '';
    if (!order.length) {
      listHtml = '<div class="empty-tip">还没有记录，点底部中间的「记账」按钮吧</div>';
    } else {
      order.forEach(function (date) {
        var label = date === today ? '今天' : (date === toStr(new Date(Date.now() - 864e5)) ? '昨天' : date.slice(5).replace('-', '月') + '日');
        listHtml += '<div class="tx-date-group">' + label + '</div>';
        groups[date].forEach(function (t) { listHtml += txRow(t); });
      });
    }

    $('#page-home').innerHTML =
      '<div class="hero">' +
        '<div class="label">总资产 (元)</div>' +
        '<div class="total">¥ ' + fmt(total) + '</div>' +
        '<div class="hero-row">' +
          '<div class="hero-pill">今日支出<b>¥' + fmt(sumToday.expense) + '</b></div>' +
          '<div class="hero-pill">今日收入<b>¥' + fmt(sumToday.income) + '</b></div>' +
          '<div class="hero-pill">账户数<b>' + Store.getActiveAccounts().length + ' 个</b></div>' +
        '</div>' +
      '</div>' +
      /* v1.1 新增：本月汇总卡片；v1.3 月份可左右翻、点标题跳月 */
      '<div class="card">' +
        '<div class="card-title">' + (isCurMonth ? '本月汇总' : '月度汇总') +
          '<span class="period-nav pn-sm">' +
            '<button class="pn-btn" id="homePrev" aria-label="上一个月">' + ic('fa-solid fa-chevron-left') + '</button>' +
            '<button class="pn-label" id="homePick">' + ymLabel + '</button>' +
            '<button class="pn-btn" id="homeNext" aria-label="下一个月">' + ic('fa-solid fa-chevron-right') + '</button>' +
          '</span></div>' +
        '<div class="month-sum">' +
          '<div class="ms-item"><span class="ms-label">总支出</span><b class="ms-exp"><span class="cur">¥</span>' + fmt(sumMonth.expense) + '</b></div>' +
          '<div class="ms-item"><span class="ms-label">总收入</span><b class="ms-inc"><span class="cur">¥</span>' + fmt(sumMonth.income) + '</b></div>' +
          '<div class="ms-item"><span class="ms-label">结余</span><b><span class="cur">¥</span>' + fmt(monthLeft) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="card recent-card"><div class="card-title"><span>最近记录</span><button class="all-bills-link" id="allBills">查看全部 ' + ic('fa-solid fa-chevron-right') + '</button></div>' + listHtml + '</div>';

    $$('#page-home .tx-item').forEach(function (el) {
      el.addEventListener('click', function () { openTxEdit(el.getAttribute('data-id')); });
    });
    $('#allBills').addEventListener('click', function () { go('bills'); });
    /* v1.3：汇总卡片的月份导航 */
    $('#homePrev').addEventListener('click', function () { homeState.ym = shiftMonth(homeState.ym, -1); renderHome(); });
    $('#homeNext').addEventListener('click', function () { homeState.ym = shiftMonth(homeState.ym, 1); renderHome(); });
    $('#homePick').addEventListener('click', function () {
      openMonthPicker(homeState.ym, function (ym2) { homeState.ym = ym2; closeSheet(); renderHome(); });
    });
  }

  /* ---------- 全部账单 / 自由搜索 ---------- */
  var billState = { q: '', kind: 'all', month: 'all', accountId: 'all' };
  var billSearchTimer = null;

  function billSearchText(t) {
    var parts = [t.date, t.amount, t.note || ''];
    var from = Store.getAccount(t.accountId);
    if (from) parts.push(from.name);
    if (t.toAccountId) {
      var to = Store.getAccount(t.toAccountId);
      if (to) parts.push(to.name);
    }
    if (t.kind === 'transfer') parts.push('转账 互转');
    else {
      var cat = Store.getCategory(t.categoryId);
      if (cat) parts.push(cat.name);
      parts.push(t.kind === 'income' ? '收入' : '支出');
    }
    return parts.join(' ').toLowerCase();
  }

  function filteredBills() {
    var q = billState.q.trim().toLowerCase();
    return Store.getTransactions().filter(function (t) {
      if (billState.kind !== 'all' && t.kind !== billState.kind) return false;
      if (billState.month !== 'all' && t.date.slice(0, 7) !== billState.month) return false;
      if (billState.accountId !== 'all' && t.accountId !== billState.accountId && t.toAccountId !== billState.accountId) return false;
      return !q || billSearchText(t).indexOf(q) >= 0;
    });
  }

  function billOptions(items, selected, labelFn) {
    return items.map(function (x) {
      var value = typeof x === 'string' ? x : x.id;
      return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(labelFn(x)) + '</option>';
    }).join('');
  }

  function renderBills() {
    var all = Store.getTransactions();
    var txs = filteredBills();
    var months = [];
    all.forEach(function (t) { var m = t.date.slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
    var accounts = Store.getAccounts();
    var sum = txs.reduce(function (s, t) {
      if (t.kind === 'income') s.income += t.amount;
      if (t.kind === 'expense') s.expense += t.amount;
      return s;
    }, { income: 0, expense: 0 });
    var groups = {}, order = [];
    txs.forEach(function (t) { if (!groups[t.date]) { groups[t.date] = []; order.push(t.date); } groups[t.date].push(t); });
    var list = order.map(function (date) {
      var dayTotal = groups[date].reduce(function (n, t) { return n + (t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0); }, 0);
      return '<section class="bill-day"><div class="bill-day-head"><span>' + esc(date) + '</span><span>收支 ¥' + fmt(dayTotal) + '</span></div>' +
        groups[date].map(txRow).join('') + '</section>';
    }).join('');
    if (!list) list = '<div class="search-empty">' + ic('fa-solid fa-magnifying-glass') + '<b>没有找到匹配账单</b><span>换个关键词或清除筛选试试</span></div>';

    $('#page-bills').innerHTML =
      '<div class="bills-heading"><button class="back-button" id="billsBack" aria-label="返回首页">' + ic('fa-solid fa-chevron-left') + '</button><div><h1>全部账单</h1><p>每一笔，都能随时找到</p></div></div>' +
      '<div class="bill-search-card">' +
        '<label class="search-box">' + ic('fa-solid fa-magnifying-glass') + '<input id="billQuery" value="' + esc(billState.q) + '" placeholder="搜索分类、账户、备注、金额或日期"><button id="clearBillQuery" aria-label="清空搜索" class="' + (billState.q ? '' : 'hidden') + '">' + ic('fa-solid fa-circle-xmark') + '</button></label>' +
        '<div class="bill-kind" role="group" aria-label="账单类型">' +
          [['all','全部'],['expense','支出'],['income','收入'],['transfer','转账']].map(function (x) { return '<button data-bill-kind="' + x[0] + '" class="' + (billState.kind === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') +
        '</div>' +
        '<div class="bill-filters"><select id="billMonth" aria-label="按月份筛选"><option value="all">全部月份</option>' + billOptions(months, billState.month, function (m) { return m.slice(0,4) + ' 年 ' + (+m.slice(5,7)) + ' 月'; }) + '</select>' +
        '<select id="billAccount" aria-label="按账户筛选"><option value="all">全部账户</option>' + billOptions(accounts, billState.accountId, function (a) { return a.name + (a.archived ? ' · 已归档' : ''); }) + '</select></div>' +
      '</div>' +
      '<div class="bill-result-meta"><span>共 <b>' + txs.length + '</b> 笔</span><span class="bill-sum-exp">支出 ¥' + fmt(sum.expense) + '</span><span class="bill-sum-inc">收入 ¥' + fmt(sum.income) + '</span></div>' +
      '<div class="bill-list">' + list + '</div>';

    $('#billsBack').addEventListener('click', function () { go('home'); });
    var qInput = $('#billQuery');
    qInput.addEventListener('input', function () {
      billState.q = qInput.value;
      if (qInput.isComposing) return;
      clearTimeout(billSearchTimer);
      billSearchTimer = setTimeout(function () { renderBills(); var next = $('#billQuery'); next.focus(); next.setSelectionRange(next.value.length, next.value.length); }, 120);
    });
    qInput.addEventListener('compositionstart', function () { qInput.isComposing = true; });
    qInput.addEventListener('compositionend', function () { qInput.isComposing = false; billState.q = qInput.value; clearTimeout(billSearchTimer); renderBills(); var next = $('#billQuery'); next.focus(); next.setSelectionRange(next.value.length, next.value.length); });
    $('#clearBillQuery').addEventListener('click', function (e) { e.preventDefault(); billState.q = ''; renderBills(); $('#billQuery').focus(); });
    $$('[data-bill-kind]').forEach(function (b) { b.addEventListener('click', function () { billState.kind = b.getAttribute('data-bill-kind'); renderBills(); }); });
    $('#billMonth').addEventListener('change', function () { billState.month = this.value; renderBills(); });
    $('#billAccount').addEventListener('change', function () { billState.accountId = this.value; renderBills(); });
    $$('#page-bills .tx-item').forEach(function (el) { el.addEventListener('click', function () { openTxEdit(el.getAttribute('data-id')); }); });
  }

  function txRow(t) {
    var icon, name, sub, amt, cls;
    if (t.kind === 'transfer') {
      var fa = Store.getAccount(t.accountId), ta = Store.getAccount(t.toAccountId);
      icon = ic('fa-solid fa-arrow-right-arrow-left');
      name = '转账';
      sub = (fa ? fa.name : '已删除账户') + ' → ' + (ta ? ta.name : '已删除账户');
      amt = '¥' + fmt(t.amount); cls = '';
    } else {
      var c = Store.getCategory(t.categoryId);
      var a = Store.getAccount(t.accountId);
      icon = ic(faOf(c, FA_TAG));
      name = c ? c.name : '其他';
      sub = (a ? a.name : '已删除账户') + (t.note ? ' · ' + t.note : '');
      amt = (t.kind === 'income' ? '+' : '-') + '¥' + fmt(t.amount);
      cls = t.kind === 'income' ? 'income' : 'expense';
    }
    /* 图标气泡：底色与图标同取马卡龙色相。
       注意这里用 background-color（而不是 background 简写）——简写会把 CSS 里
       叠的那层降饱和白雾（background-image）重置掉；图标再统一压深成「同色系深一度」 */
    var tint = t.kind === 'transfer' ? 'var(--blue)' : ((Store.getCategory(t.categoryId) || {}).color || '#E6DEE1');
    return '<div class="tx-item" data-id="' + t.id + '">' +
      '<div class="tx-icon" style="background-color:' + tint + ';color:' + tint + '">' + icon + '</div>' +
      '<div class="tx-main"><div class="tx-name">' + esc(name) + '</div><div class="tx-sub">' + esc(sub) + '</div></div>' +
      '<div class="tx-amount ' + cls + '">' + amt + '</div></div>';
  }

  /* ---------- v1.1 通用二次确认 ---------- */
  function openConfirm(title, msg, okText, onOk, onCancel) {
    openSheet(
      '<div class="card-title">' + esc(title) + '</div>' +
      '<div style="font-size:13px;color:var(--text-sub);line-height:1.9">' + msg + '</div>' +
      '<button class="btn btn-danger" id="cfmYes">' + esc(okText || '确认') + '</button>' +
      '<button class="btn btn-ghost" id="cfmNo">取消</button>'
    );
    $('#cfmYes').addEventListener('click', function () { onOk(); });
    $('#cfmNo').addEventListener('click', onCancel || closeSheet);
  }

  /* ---------- v1.1 记录编辑面板 ---------- */
  var edit = null;

  function openTxEdit(id) {
    var t = Store.getTransactions().filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    edit = { id: id, kind: t.kind, categoryId: t.categoryId || null, accountId: t.accountId,
      toAccountId: t.toAccountId || null, note: t.note || '', date: t.date };
    renderTxEdit();
  }

  function renderTxEdit() {
    var t = Store.getTransactions().filter(function (x) { return x.id === edit.id; })[0];
    if (!t) { closeSheet(); return; }
    var isTransfer = t.kind === 'transfer';

    /* 类型：转账不可改（涉及两个账户，改了余额会凭空变化） */
    var kindHtml;
    if (isTransfer) {
      kindHtml = '<div class="field-label">类型</div>' +
        '<div class="read-val">' + ic('fa-solid fa-arrow-right-arrow-left') + ' 转账（转账记录不可改类型）</div>';
    } else {
      kindHtml = '<div class="field-label">类型（点一下切换）</div>' +
        '<div class="seg seg-sm">' +
          '<button data-ekind="expense" class="' + (edit.kind === 'expense' ? 'on expense' : '') + '">支出</button>' +
          '<button data-ekind="income" class="' + (edit.kind === 'income' ? 'on income' : '') + '">收入</button>' +
        '</div>';
    }

    /* 分类下拉：按当前类型取对应分类表 */
    var catHtml = '';
    if (!isTransfer) {
      var cats = Store.getCategories(edit.kind === 'income' ? 'income' : 'expense');
      if (!cats.some(function (c) { return c.id === edit.categoryId; })) {
        edit.categoryId = cats.length ? cats[0].id : null;
      }
      var opts = cats.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === edit.categoryId ? ' selected' : '') + '>' +
          esc(c.name) + '</option>';
      }).join('');
      catHtml = '<div class="field-label">分类</div>' +
        '<select class="select" id="editCat">' + opts + '</select>';
    }

    function accountOptions(selected) {
      var accounts = Store.getActiveAccounts();
      var current = Store.getAccount(selected);
      if (current && current.archived && !accounts.some(function (a) { return a.id === current.id; })) accounts.unshift(current);
      return accounts.map(function (a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' +
          esc(a.name) + (a.archived ? ' · 已归档' : '') + ' · ¥' + fmt(Store.accountBalance(a.id)) + '</option>';
      }).join('');
    }
    function accountPreview(selected, previewId) {
      var a = Store.getAccount(selected);
      if (!a) return '<div class="account-select-preview" id="' + previewId + '">账户不存在</div>';
      return '<div class="account-select-preview" id="' + previewId + '">' +
        '<span class="account-select-icon" style="color:' + (a.color || '#BAE1FF') + '">' + iconOf(a, FA_CARD) + '</span>' +
        '<span><b>' + esc(a.name) + '</b><small>¥ ' + fmt(Store.accountBalance(a.id)) + (a.archived ? ' · 已归档' : '') + '</small></span></div>';
    }
    var accountHtml = isTransfer
      ? '<div class="field-label">转出账户</div>' + accountPreview(edit.accountId, 'editFromPreview') + '<select class="select" id="editFromAcc">' + accountOptions(edit.accountId) + '</select>' +
        '<div class="field-label">转入账户</div>' + accountPreview(edit.toAccountId, 'editToPreview') + '<select class="select" id="editToAcc">' + accountOptions(edit.toAccountId) + '</select>'
      : '<div class="field-label">所属账户</div>' + accountPreview(edit.accountId, 'editAccountPreview') + '<select class="select" id="editAccount">' + accountOptions(edit.accountId) + '</select>';

    openSheet(
      '<div class="card-title">编辑记录</div>' +
      '<div class="edit-amount-wrap">' +
        '<div class="edit-amount-label">金额（只读，不可修改）</div>' +
        '<div class="edit-amount ' + (isTransfer ? '' : (t.kind === 'income' ? 'income' : 'expense')) + '">' +
          (isTransfer ? '¥' : (t.kind === 'income' ? '+¥' : '-¥')) + fmt(t.amount) +
        '</div>' +
      '</div>' +
      kindHtml + catHtml + accountHtml +
      '<div class="field-hint" id="accountChangeHint">更改账户后，相关账户余额会立即重新计算。</div>' +
      '<div class="field-label">日期（可修改）</div>' +
      '<input type="date" class="input" id="editDate" value="' + esc(edit.date || t.date) + '">' +
      '<div class="field-label">备注（可长文本，清空即删除）</div>' +
      '<textarea class="input ta" id="editNote" rows="3" placeholder="选填">' + esc(edit.note) + '</textarea>' +
      '<button class="btn btn-primary" id="editSave">保存修改</button>' +
      '<button class="btn btn-danger" id="editDel">删除这条记录</button>'
    );

    /* 类型切换：同步换分类表并要求重选 */
    $$('#sheetBody [data-ekind]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-ekind');
        if (k === edit.kind) return;
        edit.note = $('#editNote').value; edit.date = $('#editDate').value || edit.date;
        var ea0 = $('#editAccount'), ef0 = $('#editFromAcc'), et0 = $('#editToAcc');
        if (ea0) edit.accountId = ea0.value;
        if (ef0) edit.accountId = ef0.value;
        if (et0) edit.toAccountId = et0.value;
        edit.kind = k;
        var next = Store.getCategories(k === 'income' ? 'income' : 'expense');
        edit.categoryId = next.length ? next[0].id : null;
        renderTxEdit();
        toast('已切为' + (k === 'income' ? '收入' : '支出') + '，请确认分类');
      });
    });
    var sel = $('#editCat');
    if (sel) sel.addEventListener('change', function () { edit.categoryId = sel.value; });
    $('#editNote').addEventListener('input', function (e) { edit.note = e.target.value; });
    $('#editDate').addEventListener('change', function (e) { edit.date = e.target.value || edit.date; });
    var editAccount = $('#editAccount'), editFrom = $('#editFromAcc'), editTo = $('#editToAcc');
    function refreshAccountPreview(select, previewId) {
      if (!select) return;
      var a = Store.getAccount(select.value), box = $('#' + previewId);
      if (!a || !box) return;
      box.innerHTML = '<span class="account-select-icon" style="color:' + (a.color || '#BAE1FF') + '">' + iconOf(a, FA_CARD) + '</span>' +
        '<span><b>' + esc(a.name) + '</b><small>¥ ' + fmt(Store.accountBalance(a.id)) + (a.archived ? ' · 已归档' : '') + '</small></span>';
    }
    function updateAccountHint() {
      var oldFrom = Store.getAccount(t.accountId), newFrom = Store.getAccount(isTransfer ? editFrom.value : editAccount.value);
      var hint = $('#accountChangeHint');
      if (isTransfer) {
        var oldTo = Store.getAccount(t.toAccountId), newTo = Store.getAccount(editTo.value);
        hint.textContent = '将转账由“' + (oldFrom ? oldFrom.name : '未知账户') + ' → ' + (oldTo ? oldTo.name : '未知账户') +
          '”改为“' + (newFrom ? newFrom.name : '未知账户') + ' → ' + (newTo ? newTo.name : '未知账户') + '”。';
      } else {
        hint.textContent = newFrom && oldFrom && newFrom.id !== oldFrom.id
          ? '将这笔记录从“' + oldFrom.name + '”改到“' + newFrom.name + '”。'
          : '所属账户未变更。';
      }
    }
    [[editAccount, 'editAccountPreview'], [editFrom, 'editFromPreview'], [editTo, 'editToPreview']].forEach(function (pair) {
      if (pair[0]) pair[0].addEventListener('change', function () { refreshAccountPreview(pair[0], pair[1]); updateAccountHint(); });
    });
    updateAccountHint();

    $('#editSave').addEventListener('click', function () {
      edit.note = $('#editNote').value;
      edit.date = $('#editDate').value || edit.date;
      var patch = { note: edit.note, date: edit.date };
      if (isTransfer) {
        patch.accountId = $('#editFromAcc').value; patch.toAccountId = $('#editToAcc').value;
        if (patch.accountId === patch.toAccountId) { showFieldError($('#editToAcc'), '转出和转入账户不能相同'); return; }
      } else {
        patch.kind = edit.kind; patch.categoryId = edit.categoryId; patch.accountId = $('#editAccount').value;
      }
      try { Store.updateTransaction(edit.id, patch); }
      catch (e) { actionError(e, '保存失败'); return; }
      closeSheet(); toast('已保存修改'); rerender();
    });

    $('#editDel').addEventListener('click', function () {
      var label = isTransfer ? '转账 ¥' + fmt(t.amount) : ((Store.getCategory(t.categoryId) || {}).name || '') + ' ¥' + fmt(t.amount);
      openConfirm('确认删除这条记录？', '将删除：' + esc(label) + '<br>删除后无法恢复，账户余额与统计会同步变化。',
        '确认删除', function () {
          try { Store.deleteTransaction(edit.id); } catch (e) { actionError(e, '删除失败'); return; }
          closeSheet(); toast('已删除'); rerender();
        });
    });
  }

  /* ---------- 统计 ---------- */
  /* v1.3：期间筛选 = 粒度(日/周/月/年/自定义) + 锚点日期；自定义时另存 from/to */
  var statsState = { period: 'month', date: todayStr(), from: null, to: null };
  /* v1.3：首页「月度汇总」卡片显示哪个月，可左右翻 */
  var homeState = { ym: todayStr().slice(0, 7) };

  /* 按粒度前后翻一个周期（自定义不参与） */
  function shiftPeriod(period, dateStr, delta) {
    var d = new Date(dateStr + 'T00:00:00');
    if (period === 'day') d.setDate(d.getDate() + delta);
    else if (period === 'week') d.setDate(d.getDate() + 7 * delta);
    else if (period === 'year') { d.setDate(1); d.setMonth(0); d.setFullYear(d.getFullYear() + delta); }
    else { d.setDate(1); d.setMonth(d.getMonth() + delta); }
    return toStr(d);
  }
  /* 'YYYY-MM' 按月前后翻 */
  function shiftMonth(ym, delta) {
    var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + delta, 1);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1);
  }
  /* 期间导航条上的标题 */
  function periodLabel(period, rg, dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    if (period === 'day') return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    if (period === 'week') return rg.from.slice(5).replace('-', '/') + ' ~ ' + rg.to.slice(5).replace('-', '/');
    if (period === 'year') return d.getFullYear() + ' 年';
    if (period === 'custom') return '自定义范围';
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  }

  /* v1.3：月份选择器（首页汇总 / 统计页共用）。onPick 收到 'YYYY-MM' */
  function openMonthPicker(ym, onPick) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    function draw() {
      var cells = '';
      for (var i = 1; i <= 12; i++) {
        cells += '<button class="month-cell' + (i === m ? ' on' : '') + '" data-m="' + i + '">' + i + ' 月</button>';
      }
      openSheet(
        '<div class="card-title">跳转到<span class="more">' + y + ' 年</span></div>' +
        '<div class="period-nav">' +
          '<button class="pn-btn" id="mpPrev" aria-label="上一年">' + ic('fa-solid fa-chevron-left') + '</button>' +
          '<span class="pn-label pn-static">' + y + ' 年</span>' +
          '<button class="pn-btn" id="mpNext" aria-label="下一年">' + ic('fa-solid fa-chevron-right') + '</button>' +
        '</div>' +
        '<div class="month-grid">' + cells + '</div>' +
        '<button class="btn btn-ghost" id="mpCancel">取消</button>'
      );
      $('#mpPrev').addEventListener('click', function () { y--; draw(); });
      $('#mpNext').addEventListener('click', function () { y++; draw(); });
      $('#mpCancel').addEventListener('click', closeSheet);
      $$('#sheetBody .month-cell').forEach(function (b) {
        b.addEventListener('click', function () { onPick(y + '-' + p2(+b.getAttribute('data-m'))); });
      });
    }
    draw();
  }

  function periodRange(period, dateStr, custom) {
    if (period === 'custom') {
      var f0 = (custom && custom.from) || dateStr;
      var t0 = (custom && custom.to) || dateStr;
      return f0 <= t0 ? { from: f0, to: t0 } : { from: t0, to: f0 };
    }
    var d = new Date(dateStr + 'T00:00:00');
    if (period === 'day') return { from: dateStr, to: dateStr };
    if (period === 'week') {
      var dow = (d.getDay() + 6) % 7; // 周一=0
      var mon = new Date(d.getTime() - dow * 864e5);
      var sun = new Date(mon.getTime() + 6 * 864e5);
      return { from: toStr(mon), to: toStr(sun) };
    }
    if (period === 'month') {
      var y = d.getFullYear(), m = d.getMonth();
      var last = new Date(y, m + 1, 0).getDate();
      return { from: y + '-' + p2(m + 1) + '-01', to: y + '-' + p2(m + 1) + '-' + p2(last) };
    }
    return { from: d.getFullYear() + '-01-01', to: d.getFullYear() + '-12-31' };
  }

  function barData(period, dateStr, custom) {
    var txs = Store.getTransactions();
    var buckets = [];
    var i, d;
    function push(label, ds) {
      var inc = 0, exp = 0;
      txs.forEach(function (t) {
        if (t.date !== ds || t.kind === 'transfer') return;
        if (t.kind === 'income') inc += t.amount; else exp += t.amount;
      });
      buckets.push({ label: label, detailLabel: ds, income: Math.round(inc * 100) / 100, expense: Math.round(exp * 100) / 100 });
    }
    if (period === 'custom') {
      var rgc = periodRange('custom', dateStr, custom);
      var fc = new Date(rgc.from + 'T00:00:00'), tc = new Date(rgc.to + 'T00:00:00');
      var days = Math.round((tc.getTime() - fc.getTime()) / 864e5) + 1;
      if (days <= 62) {
        for (i = 0; i < days; i++) {
          d = new Date(fc.getTime() + i * 864e5);
          push((d.getMonth() + 1) + '/' + d.getDate(), toStr(d));
        }
      } else {
        /* 跨度太长就按月分桶，否则趋势图会变成几百根柱子 */
        Store.monthlySummaries(rgc.from, rgc.to).forEach(function (m) {
          buckets.push({ label: m.label, detailLabel: m.from + ' ～ ' + m.to, income: m.income, expense: m.expense });
        });
      }
    } else if (period === 'day') {
      var end = new Date(dateStr + 'T00:00:00');
      for (i = 6; i >= 0; i--) {
        d = new Date(end.getTime() - i * 864e5);
        push((d.getMonth() + 1) + '/' + d.getDate(), toStr(d));
      }
    } else if (period === 'week') {
      var rg = periodRange('week', dateStr);
      var names = ['一', '二', '三', '四', '五', '六', '日'];
      var mon = new Date(rg.from + 'T00:00:00');
      for (i = 0; i < 7; i++) {
        d = new Date(mon.getTime() + i * 864e5);
        push(names[i], toStr(d));
      }
    } else if (period === 'month') {
      var rg2 = periodRange('month', dateStr);
      var y = +rg2.from.slice(0, 4), m = +rg2.from.slice(5, 7);
      var last = +rg2.to.slice(8, 10);
      for (i = 1; i <= last; i++) push(String(i), y + '-' + p2(m) + '-' + p2(i));
    } else {
      var yy = +dateStr.slice(0, 4);
      for (i = 1; i <= 12; i++) {
        var from = yy + '-' + p2(i) + '-01';
        var to = yy + '-' + p2(i) + '-31';
        var inc2 = 0, exp2 = 0;
        txs.forEach(function (t) {
          if (t.date < from || t.date > to || t.kind === 'transfer') return;
          if (t.kind === 'income') inc2 += t.amount; else exp2 += t.amount;
        });
        buckets.push({ label: i + '月', detailLabel: from.slice(0, 7), income: Math.round(inc2 * 100) / 100, expense: Math.round(exp2 * 100) / 100 });
      }
    }
    return buckets;
  }

  function renderStats() {
    var periodNames = { day: '日', week: '周', month: '月', year: '年', custom: '自定义' };
    var rg = periodRange(statsState.period, statsState.date, statsState);
    var sum = Store.summary(rg.from, rg.to);
    var catData = Store.byCategory(rg.from, rg.to, 'expense');
    var bd = barData(statsState.period, statsState.date, statsState);

    var tabs = Object.keys(periodNames).map(function (p) {
      return '<button data-p="' + p + '" class="' + (statsState.period === p ? 'on' : '') + '">' + periodNames[p] + '</button>';
    }).join('');

    var legend = catData.slice(0, 8).map(function (c) {
      return '<div class="legend-item"><span class="legend-dot" style="background:' + c.color + '"></span>' +
        ic(faOf(c, FA_TAG)) + esc(c.name) + '<b>¥' + fmt(c.value) + '</b></div>';
    }).join('');

    /* v1.3：期间导航条（左右翻一期 + 点标题跳月）；「自定义」时换成两个日期输入 */
    var navHtml;
    if (statsState.period === 'custom') {
      navHtml = '<div class="custom-range">' +
        '<div><div class="field-label">开始日期</div>' +
          '<input type="date" class="input" id="stFrom" value="' + rg.from + '"></div>' +
        '<div><div class="field-label">结束日期</div>' +
          '<input type="date" class="input" id="stTo" value="' + rg.to + '"></div>' +
        '</div>';
    } else {
      navHtml = '<div class="period-nav pn-lg">' +
        '<button class="pn-btn" id="stPrev" aria-label="上一个周期">' + ic('fa-solid fa-chevron-left') + '</button>' +
        '<button class="pn-label" id="stPick">' + esc(periodLabel(statsState.period, rg, statsState.date)) + '</button>' +
        '<button class="pn-btn" id="stNext" aria-label="下一个周期">' + ic('fa-solid fa-chevron-right') + '</button>' +
        '</div>';
    }

    $('#page-stats').innerHTML =
      '<div class="stats-tabs">' + tabs + '</div>' +
      navHtml +
      '<div class="hero" style="background:linear-gradient(135deg,var(--hero-b),var(--hero-c))">' +
        '<div class="label">' + rg.from + ' ~ ' + rg.to + '</div>' +
        '<div class="hero-row" style="margin-top:10px">' +
          '<div class="hero-pill">收入<b>¥' + fmt(sum.income) + '</b></div>' +
          '<div class="hero-pill">支出<b>¥' + fmt(sum.expense) + '</b></div>' +
          '<div class="hero-pill">结余<b>¥' + fmt(Math.round((sum.income - sum.expense) * 100) / 100) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">支出构成</div>' +
        '<div class="chart-wrap">' + Charts.donut(catData, 190) + '</div>' +
        '<div class="legend">' + legend + '</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">收支趋势<span class="more">粉=支出 绿=收入</span></div>' +
        '<div class="bar-scroll">' + Charts.bars(bd) + '</div>' +
      '</div>';

    $$('#page-stats .chart-bar-group').forEach(function (g) {
      function showDetail() { toast(g.getAttribute('data-tip')); }
      g.addEventListener('click', showDetail);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(); } });
    });

    $$('#page-stats .stats-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-p');
        statsState.period = p;
        if (p === 'custom' && !statsState.from) {
          var now = new Date();
          statsState.from = toStr(new Date(now.getFullYear(), now.getMonth(), 1));
          statsState.to = todayStr();
        }
        renderStats();
      });
    });
    var pv = $('#stPrev'), nx = $('#stNext'), pk = $('#stPick');
    if (pv) pv.addEventListener('click', function () {
      statsState.date = shiftPeriod(statsState.period, statsState.date, -1); renderStats();
    });
    if (nx) nx.addEventListener('click', function () {
      statsState.date = shiftPeriod(statsState.period, statsState.date, 1); renderStats();
    });
    if (pk) pk.addEventListener('click', function () {
      openMonthPicker(statsState.date.slice(0, 7), function (ym) {
        statsState.date = ym + '-01';
        if (statsState.period === 'custom') statsState.period = 'month';
        closeSheet(); renderStats();
      });
    });
    var sf = $('#stFrom'), stt = $('#stTo');
    if (sf) sf.addEventListener('change', function () { statsState.from = sf.value || statsState.from; renderStats(); });
    if (stt) stt.addEventListener('change', function () { statsState.to = stt.value || statsState.to; renderStats(); });
  }

  /* ---------- 账户 ---------- */
  function renderAccounts() {
    var accs = Store.getActiveAccounts();
    var archived = Store.getAccounts().filter(function (a) { return a.archived; });
    var total = Store.totalAssets();
    var cards = accs.map(function (a) {
      return '<div class="acc-card" data-id="' + a.id + '">' +
        '<div class="acc-icon" style="color:' + (a.color || '#BAE1FF') + '">' + iconOf(a, FA_CARD) + '</div>' +
        '<div class="acc-main"><div class="acc-name">' + esc(a.name) + '</div>' +
        '<div class="acc-bal">¥ ' + fmt(Store.accountBalance(a.id)) + '</div></div>' +
        '<div class="drag-handle" title="拖拽排序">' + ic('fa-solid fa-grip-lines') + '</div>' +
      '</div>';
    }).join('');
    var archivedCards = archived.map(function (a) {
      return '<div class="acc-card archived" data-archived-id="' + esc(a.id) + '">' +
        '<div class="acc-icon" style="color:' + (a.color || '#B8B8C2') + '">' + iconOf(a, FA_CARD) + '</div>' +
        '<div class="acc-main"><div class="acc-name">' + esc(a.name) + ' <span class="status-badge">已归档</span></div>' +
        '<div class="acc-bal">¥ ' + fmt(Store.accountBalance(a.id)) + ' · 仍计入总资产</div></div>' +
        '<button class="mini-action" data-restore="' + esc(a.id) + '" aria-label="恢复账户 ' + esc(a.name) + '">恢复</button></div>';
    }).join('');

    $('#page-accounts').innerHTML =
      '<div class="hero"><div class="label">总资产 (元)</div><div class="total">¥ ' + fmt(total) + '</div>' +
        '<div class="hero-row">' +
          '<div class="hero-pill" id="btnTransfer" style="cursor:pointer">' + ic('fa-solid fa-arrow-right-arrow-left') + ' 账户互转</div>' +
          '<div class="hero-pill" id="btnAddAcc" style="cursor:pointer">' + ic('fa-solid fa-plus') + ' 添加账户</div>' +
        '</div>' +
      '</div>' +
      '<div id="accList">' + cards + '</div>' +
      (archived.length ? '<div class="section-kicker">已归档账户</div><div id="archivedList">' + archivedCards + '</div>' : '') +
      '<div class="empty-tip">按住右侧手柄拖拽调整顺序 · 点卡片可改名/校准余额</div>';

    $('#btnTransfer').addEventListener('click', function () { openRecordSheet('transfer'); });
    $('#btnAddAcc').addEventListener('click', openAddAccount);
    $$('#accList .acc-card').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.drag-handle')) return;
        openEditAccount(el.getAttribute('data-id'));
      });
    });
    makeSortable($('#accList'), function (ids) {
      try { Store.reorderAccounts(ids); } catch (e) { actionError(e); return; }
      toast('顺序已保存');
    });
    $$('#archivedList [data-restore]').forEach(function (b) {
      b.addEventListener('click', function () {
        try { Store.restoreAccount(b.getAttribute('data-restore')); }
        catch (e) { actionError(e, '恢复失败'); return; }
        toast('账户已恢复'); renderAccounts();
      });
    });
  }

  function openAddAccount() {
    var colors = ['#FFB3BA', '#BAE1FF', '#BAFFC9', '#FFFFBA'];
    var pickedIcon = ICON_CHOICES[0];
    openSheet(
      '<div class="card-title">添加账户</div>' +
      '<div class="field-label">名称</div><input class="input" id="newAccName" placeholder="如：招商信用卡">' +
      '<div class="field-label">图标（Font Awesome）</div><div class="icon-pick" id="iconPick">' + iconPickHtml(pickedIcon) + '</div>' +
      '<div class="field-label">初始余额</div><input class="input" id="newAccBal" type="number" step="0.01" placeholder="0.00">' +
      '<button class="btn btn-primary" id="addAccBtn">添加</button>'
    );
    bindIconPick('#sheetBody', function (cls) { pickedIcon = cls; });
    $('#addAccBtn').addEventListener('click', function () {
      var name = $('#newAccName').value.trim();
      if (!name) { toast('请输入名称'); return; }
      var acc, bal = parseFloat($('#newAccBal').value);
      if (isNaN(bal)) bal = 0;
      try {
        acc = Store.addAccount(name, pickedIcon, colors[Math.floor(Math.random() * 4)], bal);
      } catch (e) { actionError(e, '添加失败'); return; }
      closeSheet(); toast('已添加'); renderAccounts();
    });
  }

  function openEditAccount(id) {
    var a = Store.getAccount(id);
    if (!a) return;
    var bal = Store.accountBalance(id);
    openSheet(
      '<div class="card-title">' + iconOf(a, FA_CARD) + ' ' + esc(a.name) + '</div>' +
      '<div class="field-label">账户名称</div><input class="input" id="editAccName" value="' + esc(a.name) + '">' +
      '<div class="field-label">当前余额（校准为实际金额）</div><input class="input" id="editAccBal" type="number" step="0.01" value="' + bal + '">' +
      '<button class="btn btn-primary" id="saveAccBtn">保存</button>' +
      '<button class="btn btn-danger" id="delAccBtn">' + (Store.countAccountTx(id) ? '归档这个账户' : '删除这个账户') + '</button>'
    );
    $('#saveAccBtn').addEventListener('click', function () {
      var name = $('#editAccName').value.trim();
      var nb = parseFloat($('#editAccBal').value);
      try {
        if (isNaN(nb)) throw new Error('请输入有效余额');
        Store.saveAccount(id, name || a.name, nb);
      } catch (e) { actionError(e, '保存失败'); return; }
      closeSheet(); toast('已保存'); rerender();
    });
    $('#delAccBtn').addEventListener('click', function () { deleteAccountFlow(id); });
  }

  /* v1.4：有流水的账户只归档，确保历史引用与总资产不会凭空变化。 */
  function deleteAccountFlow(id) {
    var a = Store.getAccount(id);
    if (!a) return;
    var n = Store.countAccountTx(id);
    if (!n) {
      openConfirm('删除账户「' + a.name + '」？', '该账户下没有记录，删除后不影响余额与统计。',
        '确认删除', function () {
          try { Store.deleteAccount(id); } catch (e) { actionError(e, '删除失败'); return; }
          closeSheet(); toast('账户已删除'); rerender();
        });
      return;
    }
    openSheet(
      '<div class="card-title">归档账户「' + esc(a.name) + '」</div>' +
      '<div class="set-note">该账户有 <b>' + n + '</b> 条历史记录，为了保证账目一致性，将安全归档而不是删除。</div>' +
      '<div class="set-note-sub">' +
        '归档后不再出现在新记录的账户选择中；历史流水、账户名和余额都会保留。' +
      '</div>' +
      '<button class="btn btn-danger" id="delKeep">确认归档</button>' +
      '<button class="btn btn-ghost" id="delCancel">取消</button>'
    );
    $('#delKeep').addEventListener('click', function () {
      try { Store.archiveAccount(id); } catch (e) { actionError(e, '归档失败'); return; }
      closeSheet(); toast('账户已安全归档'); rerender();
    });
    $('#delCancel').addEventListener('click', function () { openEditAccount(id); });
  }

  /* ---------- 设置 ---------- */
  function renderSettings() {
    var dark = Store.settings().dark;
    var nick = Store.settings().nickname || 'Dora';
    var loadProblem = Store.getLoadError();
    var recoveryCard = loadProblem ? '<div class="card danger-card"><div class="card-title">存档需要处理</div>' +
      '<div class="set-note">' + esc(loadProblem.message) + '</div>' +
      '<button class="btn btn-ghost" id="exportRecovery">导出损坏的原始数据</button>' +
      '<button class="btn btn-danger" id="resetRecovery">确认放弃并重置</button></div>' : '';
    $('#page-settings').innerHTML =
      recoveryCard +
      /* v1.1 新增：昵称自定义 */
      '<div class="card"><div class="card-title">个人</div>' +
        '<div class="field-label" style="margin-top:0">' + ic('fa-solid fa-user') + ' 顶部昵称（显示在首页顶栏）</div>' +
        '<div style="display:flex;gap:8px">' +
          '<input class="input" id="nickInput" value="' + esc(nick) + '" placeholder="给自己起个名字" maxlength="20">' +
          '<button class="btn btn-primary" id="nickSave" style="width:92px;margin-top:0;padding:11px 0;font-size:14px">保存</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">外观</div>' +
        '<div class="set-row"><span>' + ic('fa-solid fa-moon') + ' 深色模式</span>' +
        '<label class="switch"><input type="checkbox" id="darkSwitch" aria-label="启用深色模式" ' + (dark ? 'checked' : '') + '><span class="track"></span></label></div>' +
      '</div>' +
      '<div class="card"><div class="card-title">分类管理</div>' +
        '<div class="set-row" id="btnCatManage" style="cursor:pointer"><span>' + ic('fa-solid fa-tags') + ' 编辑 / 拖拽排序分类</span><span>' + ic('fa-solid fa-chevron-right') + '</span></div>' +
      '</div>' +
      '<div class="card"><div class="card-title">数据</div>' +
        '<div class="set-row" id="btnExport" style="cursor:pointer"><span>' + ic('fa-solid fa-file-export') + ' 导出备份 (JSON)</span><span>' + ic('fa-solid fa-chevron-right') + '</span></div>' +
        '<div class="set-row" id="btnImport" style="cursor:pointer"><span>' + ic('fa-solid fa-file-import') + ' 导入备份</span><span>' + ic('fa-solid fa-chevron-right') + '</span></div>' +
        '<div class="set-row" id="btnClear" style="cursor:pointer"><span style="color:var(--expense)">' + ic('fa-solid fa-trash') + ' 清空全部数据</span><span>' + ic('fa-solid fa-chevron-right') + '</span></div>' +
      '</div>' +
      /* v1.3：这一栏不再放安装按钮（自建按钮会压掉浏览器的原生安装入口），只保留说明 */
      '<div class="card"><div class="card-title">安装为 App</div>' +
        '<div class="set-note">' +
        ic('fa-brands fa-android') + ' 安卓 Chrome：打开 https 网址 → 右上角菜单 →「安装应用」<br>' +
        ic('fa-brands fa-chrome') + ' 电脑 Chrome：地址栏右侧的安装图标，或菜单 →「安装记账本…」<br>' +
        ic('fa-brands fa-apple') + ' iPhone：Safari 打开 → 分享 →「添加到主屏幕」<br>' +
        ic('fa-solid fa-box-open') + ' 打包 APK：部署后到 pwabuilder.com 输入网址一键生成' +
        '</div>' +
        '<div class="set-note-sub">' +
        '注意：只有 https 网址（或本机 localhost）才会出现「安装应用」；' +
        '用局域网 http 地址打开只会得到带浏览器角标的快捷方式。' +
        '</div>' +
      '</div>' +
      '<div class="empty-tip">记账本 v' + Store.VERSION + ' · 大学生的记账小伙伴 · 数据保存在本机</div>';

    /* v1.1：昵称保存 */
    $('#nickSave').addEventListener('click', function () {
      var v = $('#nickInput').value.trim();
      if (!v) { toast('昵称不能为空'); return; }
      try { Store.setSetting('nickname', v); } catch (e) { actionError(e, '昵称保存失败'); return; }
      var el = $('#topbarNick');
      if (el) el.textContent = v;
      toast('昵称已保存');
    });
    $('#darkSwitch').addEventListener('change', function (e) {
      try { Store.setSetting('dark', e.target.checked); }
      catch (err) { e.target.checked = !e.target.checked; actionError(err, '主题保存失败'); return; }
      applyTheme();
    });
    $('#btnCatManage').addEventListener('click', openCategoryManage);
    $('#btnExport').addEventListener('click', function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'jizhangben-backup-' + todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('已导出');
    });
    $('#btnImport').addEventListener('click', function () {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.addEventListener('change', function () {
        var f = inp.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var preview;
          try { preview = Store.previewImport(rd.result); }
          catch (e) { actionError(e, '导入校验失败'); return; }
          var s = preview.summary;
          openSheet('<div class="card-title">确认导入备份</div>' +
            '<div class="import-summary"><div><b>' + s.accounts + '</b><span>账户</span></div>' +
            '<div><b>' + s.categories + '</b><span>分类</span></div><div><b>' + s.transactions + '</b><span>流水</span></div></div>' +
            '<div class="set-note-sub">日期范围：' + esc(s.from) + ' ～ ' + esc(s.to) + '<br>导入前会自动备份当前数据。</div>' +
            '<button class="btn btn-primary" id="importConfirm">确认导入并替换当前账本</button>' +
            '<button class="btn btn-ghost" id="importCancel">取消</button>');
          $('#importConfirm').addEventListener('click', function () {
            try { Store.commitImport(preview); } catch (err) { actionError(err, '导入失败'); return; }
            closeSheet(); toast('导入成功'); rerender();
          });
          $('#importCancel').addEventListener('click', closeSheet);
        };
        rd.readAsText(f);
      });
      inp.click();
    });
    $('#btnClear').addEventListener('click', function () {
      openSheet('<div class="card-title">确认清空？</div>' +
        '<div style="font-size:13px;color:var(--text-sub)">所有账户、分类、记录都会被删除，且不可恢复。建议先导出备份。</div>' +
        '<button class="btn btn-danger" id="clearYes">确认清空</button>' +
        '<button class="btn btn-ghost" id="clearNo">取消</button>');
      $('#clearYes').addEventListener('click', function () {
        try { Store.clearAll(); } catch (e) { actionError(e, '清空失败'); return; }
        closeSheet(); toast('已清空'); rerender();
      });
      $('#clearNo').addEventListener('click', closeSheet);
    });
    if (loadProblem) {
      $('#exportRecovery').addEventListener('click', function () {
        var blob = new Blob([Store.exportRecovery()], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'jizhangben-recovery-' + todayStr() + '.txt'; a.click(); URL.revokeObjectURL(a.href);
      });
      $('#resetRecovery').addEventListener('click', function () {
        openConfirm('放弃损坏存档？', '请先导出原始数据。确认后将创建一个新账本。', '确认重置', function () {
          try { Store.discardCorruptAndReset(); } catch (e) { actionError(e, '重置失败'); return; }
          closeSheet(); toast('已重置为新账本'); rerender();
        }, function () { closeSheet(); });
      });
    }
  }

  function openCategoryManage() {
    renderCatManage();
  }
  function renderCatManage() {
    var exp = Store.getCategories('expense');
    var inc = Store.getCategories('income');
    var newCatIcon = ICON_CHOICES[0];
    function rows(list) {
      return list.map(function (c) {
        /* v1.3：去掉行内的 × 删除按钮（和拖拽手柄挨太近容易误触），
           改为点整行进入编辑弹窗，删除放在弹窗里 */
        return '<div class="cat-manage-row" data-id="' + c.id + '">' +
          '<span class="cat-bubble" style="background-color:' + (c.color || '#F1EEC6') + ';color:' + (c.color || '#F1EEC6') + ';width:36px;height:36px;border-radius:11px">' + ic(faOf(c, FA_TAG)) + '</span>' +
          '<span>' + esc(c.name) + '</span>' +
          '<span class="drag-handle">' + ic('fa-solid fa-grip-lines') + '</span></div>';
      }).join('');
    }
    openSheet(
      '<div class="card-title">分类管理<span class="more">按住手柄拖拽排序</span></div>' +
      '<div class="field-label">支出分类</div><div id="catExp">' + rows(exp) + '</div>' +
      '<div class="field-label">收入分类</div><div id="catInc">' + rows(inc) + '</div>' +
      '<div class="field-label">新增分类</div>' +
      '<div style="display:flex;gap:8px">' +
        '<input class="input" id="newCatName" placeholder="名称">' +
        '<select class="select" id="newCatKind" style="width:96px"><option value="expense">支出</option><option value="income">收入</option></select>' +
      '</div>' +
      '<div class="field-label">图标（Font Awesome）</div><div class="icon-pick" id="iconPick">' + iconPickHtml(newCatIcon) + '</div>' +
      '<button class="btn btn-primary" id="addCatBtn">添加分类</button>' +
      '<button class="btn btn-ghost" id="catDone">完成</button>'
    );
    bindIconPick('#sheetBody', function (cls) { newCatIcon = cls; });
    makeSortable($('#catExp'), function (ids) { try { Store.reorderCategories(ids.concat(Store.getCategories('income').map(function (c) { return c.id; }))); } catch (e) { actionError(e); } });
    makeSortable($('#catInc'), function (ids) { try { Store.reorderCategories(Store.getCategories('expense').map(function (c) { return c.id; }).concat(ids)); } catch (e) { actionError(e); } });
    /* v1.3：点分类行 → 编辑弹窗（改名 / 换图标 / 删除）。拖拽手柄区域交给 makeSortable */
    $$('#sheetBody .cat-manage-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.drag-handle')) return;
        openEditCategory(row.getAttribute('data-id'));
      });
    });
    $('#addCatBtn').addEventListener('click', function () {
      var name = $('#newCatName').value.trim();
      if (!name) { toast('请输入名称'); return; }
      var colors = ['#FFB3BA', '#BAE1FF', '#BAFFC9', '#FFFFBA'];
      try { Store.addCategory(name, newCatIcon, colors[Math.floor(Math.random() * 4)], $('#newCatKind').value); }
      catch (e) { actionError(e, '添加分类失败'); return; }
      renderCatManage();
      toast('已添加');
    });
    $('#catDone').addEventListener('click', function () { closeSheet(); });
  }

  /* v1.3：分类编辑弹窗——改名 / 换图标 / 删除都收在这里，
     列表行上不再放删除按钮，彻底避免和拖拽手柄误触 */
  function openEditCategory(id) {
    var c = Store.getCategory(id);
    if (!c) return;
    var picked = faOf(c, FA_TAG);
    openSheet(
      '<div class="card-title">编辑分类</div>' +
      '<div class="field-label">名称</div>' +
      '<input class="input" id="editCatName" value="' + esc(c.name) + '">' +
      '<div class="field-label">图标（Font Awesome）</div>' +
      '<div class="icon-pick" id="iconPick">' + iconPickHtml(picked) + '</div>' +
      '<button class="btn btn-primary" id="saveCatBtn">保存</button>' +
      ((id === 'c-other' || id === 'c-inoth') ? '<div class="field-hint">默认“其他”分类用于承接历史记录，不能删除。</div>' : '<button class="btn btn-danger" id="delCatBtn">删除这个分类</button>') +
      '<button class="btn btn-ghost" id="catBack">返回分类管理</button>'
    );
    bindIconPick('#sheetBody', function (cls) { picked = cls; });
    $('#saveCatBtn').addEventListener('click', function () {
      var name = $('#editCatName').value.trim();
      if (!name) { toast('名称不能为空'); return; }
      try { Store.updateCategory(id, { name: name, icon: picked }); }
      catch (e) { actionError(e, '分类保存失败'); return; }
      renderCatManage(); toast('已保存');
    });
    var delCat = $('#delCatBtn');
    if (delCat) delCat.addEventListener('click', function () { confirmDeleteCategory(id); });
    $('#catBack').addEventListener('click', function () { renderCatManage(); });
  }

  function confirmDeleteCategory(id) {
    var c = Store.getCategory(id);
    if (!c) return;
    var n = Store.countCategoryTx(id);
    openConfirm('删除分类「' + c.name + '」？',
      n
        ? '该分类下已有 <b>' + n + '</b> 条记录。<b>记录不会丢</b>，但它们的分类会显示为「其他」，统计里也一并归到「其他」。'
        : '该分类下还没有记录，删除后不影响账目。',
      '确认删除',
      function () { try { Store.deleteCategory(id); } catch (e) { actionError(e, '删除失败'); return; } renderCatManage(); toast('分类已删除，历史记录已归入“其他”'); },
      function () { openEditCategory(id); }   /* 取消 → 回到编辑弹窗，不丢上下文 */
    );
  }

  /* ---------- 记账弹层 ---------- */
  var rec = null;
  function openRecordSheet(presetKind) {
    var accs = Store.getActiveAccounts();
    if (!accs.length) { toast('请先添加账户，或在账户页恢复已归档账户'); go('accounts'); return; }
    rec = {
      kind: presetKind || 'expense',
      accountId: accs.length ? accs[0].id : null,
      toAccountId: accs.length > 1 ? accs[1].id : null,
      categoryId: null,
      amountExpr: '',
      amount: 0,
      date: todayStr(),
      note: '',
      aaTotal: 0, aaPeople: 2
    };
    var cats = Store.getCategories('expense');
    rec.categoryId = cats.length ? cats[0].id : null;
    renderRecordSheet();
  }

  function renderRecordSheet() {
    var accs = Store.getActiveAccounts();
    var isTransfer = rec.kind === 'transfer';
    var isAA = rec.kind === 'aa';
    var kindForCat = rec.kind === 'income' ? 'income' : 'expense';
    var cats = Store.getCategories(kindForCat);
    if (!cats.filter(function (c) { return c.id === rec.categoryId; }).length) {
      rec.categoryId = cats.length ? cats[0].id : null;
    }

    var tabs = [
      { k: 'expense', label: '支出' }, { k: 'income', label: '收入' },
      { k: 'transfer', label: '转账' }, { k: 'aa', label: 'AA 分账' }
    ].map(function (t) {
      var cls = rec.kind === t.k ? 'on ' + (t.k === 'income' ? 'income' : 'expense') : '';
      return '<button class="' + cls + '" data-kind="' + t.k + '">' + t.label + '</button>';
    }).join('');

    var accChips = accs.map(function (a) {
      return '<button class="chip ' + (rec.accountId === a.id ? 'on' : '') + '" data-acc="' + a.id + '">' + iconOf(a, FA_CARD) + esc(a.name) + '</button>';
    }).join('');

    var html = '<div class="seg">' + tabs + '</div>';

    if (isTransfer) {
      var toChips = accs.map(function (a) {
        return '<button class="chip ' + (rec.toAccountId === a.id ? 'on' : '') + '" data-tacc="' + a.id + '">' + iconOf(a, FA_CARD) + esc(a.name) + '</button>';
      }).join('');
      html += '<div class="field-label">从哪个账户转出</div><div class="chip-row" id="fromAccountChips">' + accChips + '</div>' +
        '<div class="field-label">转入到哪个账户</div><div class="chip-row" id="toAccountChips">' + toChips + '</div>';
    } else {
      html += '<div class="field-label">账户</div><div class="chip-row">' + accChips + '</div>';
    }

    if (!isTransfer) {
      var grid = cats.map(function (c) {
        return '<div class="cat-cell ' + (rec.categoryId === c.id ? 'on' : '') + '" data-cat="' + c.id + '">' +
          '<div class="cat-bubble" style="background-color:' + (c.color || '#F1EEC6') + ';color:' + (c.color || '#F1EEC6') + '">' + ic(faOf(c, FA_TAG)) + '</div>' +
          '<span>' + esc(c.name) + '</span></div>';
      }).join('');
      html += '<div class="field-label">分类</div><div class="cat-grid">' + grid + '</div>';
    }

    if (isAA) {
      var per = rec.aaPeople > 0 ? Math.round(rec.aaTotal / rec.aaPeople * 100) / 100 : 0;
      html += '<div class="field-label">常用场景（点一下自动填好分类和备注）</div>' +
        '<div class="chip-row">' +
          '<button class="chip" id="aaSceneWater">' + ic('fa-solid fa-droplet') + '桶装水</button>' +
          '<button class="chip" id="aaSceneMeal">' + ic('fa-solid fa-utensils') + '聚餐</button>' +
        '</div>' +
        '<div class="field-label">总金额（点开输入，可计算）</div>' +
        '<div class="amount-display" id="aaTotalBox">' + (rec.aaTotal ? '¥ ' + fmt(rec.aaTotal) : '<span class="hint">点我输入总金额</span>') + '</div>' +
        '<div class="field-label">人数</div>' +
        '<input class="input" id="aaPeople" type="number" min="1" step="1" value="' + rec.aaPeople + '">' +
        '<div class="field-label">我应付 <b id="aaPer" style="color:var(--pink-deep);font-size:18px">¥ ' + fmt(per) + '</b>（只记我自己的份额）</div>';
    } else {
      html += '<div class="field-label">金额（点开可计算）</div>' +
        '<div class="amount-display" id="amountBox">' + (rec.amountExpr ? esc(rec.amountExpr) : '<span class="hint">点我输入金额</span>') + '</div>';
    }

    html += '<div class="field-label">日期</div><input class="input" id="recDate" type="date" value="' + rec.date + '">' +
      '<div class="field-label">备注（不限字数）</div>' +
      '<textarea class="input ta" id="recNote" rows="2" placeholder="选填">' + esc(rec.note) + '</textarea>' +
      '<button class="btn btn-primary" id="recSave">' + (isAA ? '记录我的份额' : '保存') + '</button>';

    openSheet(html);

    $$('#sheetBody [data-kind]').forEach(function (b) {
      b.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.kind = b.getAttribute('data-kind');
        renderRecordSheet();
      });
    });
    $$('#sheetBody [data-acc]').forEach(function (b) {
      b.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.accountId = b.getAttribute('data-acc');
        renderRecordSheet();
      });
    });
    $$('#sheetBody [data-tacc]').forEach(function (b) {
      b.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.toAccountId = b.getAttribute('data-tacc');
        renderRecordSheet();
      });
    });
    $$('#sheetBody [data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.categoryId = b.getAttribute('data-cat');
        renderRecordSheet();
      });
    });
    $('#recNote').addEventListener('input', function (e) { rec.note = e.target.value; });
    $('#recDate').addEventListener('change', function (e) { rec.date = e.target.value || todayStr(); });

    var amountBox = $('#amountBox');
    if (amountBox) amountBox.addEventListener('click', function () {
      openCalculator(rec.amountExpr, function (expr, val) {
        rec.amountExpr = expr; rec.amount = val;
        renderRecordSheet();
      }, function () { renderRecordSheet(); });
    });
    var aaTotalBox = $('#aaTotalBox');
    if (aaTotalBox) {
      var sceneWater = $('#aaSceneWater');
      if (sceneWater) sceneWater.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.categoryId = 'c-water'; rec.note = '桶装水';
        renderRecordSheet();
      });
      var sceneMeal = $('#aaSceneMeal');
      if (sceneMeal) sceneMeal.addEventListener('click', function () {
        rec.note = $('#recNote').value; rec.date = $('#recDate').value || rec.date;
        rec.categoryId = 'c-food'; rec.note = '聚餐';
        renderRecordSheet();
      });
      aaTotalBox.addEventListener('click', function () {
        openCalculator(rec.aaTotal ? String(rec.aaTotal) : '', function (expr, val) {
          rec.aaTotal = val;
          renderRecordSheet();
        }, function () { renderRecordSheet(); });
      });
      var aaP = $('#aaPeople');
      aaP.addEventListener('input', function () {
        rec.aaPeople = Math.max(1, parseInt(aaP.value, 10) || 1);
        var per = Math.round(rec.aaTotal / rec.aaPeople * 100) / 100;
        $('#aaPer').textContent = '¥ ' + fmt(per);
      });
    }

    $('#recSave').addEventListener('click', saveRecord);
  }

  function saveRecord() {
    rec.note = $('#recNote').value;
    rec.date = $('#recDate').value || todayStr();

    try {
    if (rec.kind === 'transfer') {
      if (!rec.accountId || !rec.toAccountId || rec.accountId === rec.toAccountId) { showFieldError($('#toAccountChips'), '转出和转入账户不能相同'); return; }
      if (!rec.amount || rec.amount <= 0) { showFieldError($('#amountBox'), '请输入金额'); return; }
      Store.addTransaction({ kind: 'transfer', accountId: rec.accountId, toAccountId: rec.toAccountId, amount: rec.amount, note: rec.note, date: rec.date });
      toast('转账完成');
    } else if (rec.kind === 'aa') {
      if (!rec.aaTotal || rec.aaTotal <= 0) { showFieldError($('#aaTotalBox'), '请输入总金额'); return; }
      var per = Math.round(rec.aaTotal / Math.max(1, rec.aaPeople) * 100) / 100;
      Store.addTransaction({
        kind: 'expense', accountId: rec.accountId, categoryId: rec.categoryId, amount: per,
        note: 'AA分账·' + rec.aaPeople + '人共¥' + fmt(rec.aaTotal) + (rec.note ? '·' + rec.note : ''),
        date: rec.date
      });
      toast('已记录我的份额 ¥' + fmt(per));
    } else {
      if (!rec.amount || rec.amount <= 0) { showFieldError($('#amountBox'), '请输入金额'); return; }
      if (!rec.categoryId) { showFieldError($('#sheetBody .cat-grid'), '请选择分类'); return; }
      Store.addTransaction({ kind: rec.kind, accountId: rec.accountId, categoryId: rec.categoryId, amount: rec.amount, note: rec.note, date: rec.date });
      toast(rec.kind === 'income' ? '收入已记' : '支出已记');
    }
    } catch (e) { actionError(e, '保存失败，已保留填写内容'); return; }
    closeSheet();
    rerender();
  }

  /* ---------- 计算器 ---------- */
  function calcEval(expr) {
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/');
    if (!expr) return NaN;
    var nums = expr.split(/[+\-*/]/);
    var ops = expr.replace(/[^+\-*/]/g, '').split('');
    if (nums.some(function (n) { return n === '' || isNaN(parseFloat(n)); })) return NaN;
    var values = nums.map(function (n) {
      var pct = n.slice(-1) === '%';
      var v = parseFloat(n.replace(/%$/, ''));
      return pct ? v / 100 : v;
    });
    var stack = [values[0]], opStack = [];
    for (var i = 0; i < ops.length; i++) {
      var v = values[i + 1];
      if (ops[i] === '*') stack.push(stack.pop() * v);
      else if (ops[i] === '/') stack.push(stack.pop() / v);
      else { stack.push(v); opStack.push(ops[i]); }
    }
    var res = stack[0];
    for (var j = 0; j < opStack.length; j++) {
      res = opStack[j] === '+' ? res + stack[j + 1] : res - stack[j + 1];
    }
    return res;
  }

  function openCalculator(initial, onDone, onBack) {
    var expr = initial || '';
    var keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '%', '+'];
    /* v1.3 修复：回到记账表单（不提交算式）。
       点上方空白、点「返回记账」都走这里 —— 原来 onBack 传进来了却从没被调用过，
       计算器里唯一的出口只有「完成」，点空白则会把整个记账流程关掉。*/
    function goBack() { if (onBack) onBack(); else closeSheet(); }
    function renderCalc() {
      var val = calcEval(expr);
      openSheet(
        '<div class="card-title">' + ic('fa-solid fa-calculator') + ' 计算器</div>' +
        '<div class="amount-display" style="cursor:default">' + (expr || '<span class="hint">0</span>') + '</div>' +
        '<div style="text-align:right;color:var(--text-sub);font-size:13px;min-height:20px;margin-top:4px">' +
          (expr && !isNaN(val) ? '= ' + fmt(Math.round(val * 100) / 100) : '') + '</div>' +
        '<div class="calc">' +
          keys.map(function (k) {
            return '<button data-k="' + k + '" class="' + ('÷×-+'.indexOf(k) >= 0 ? 'op' : '') + '">' + k + '</button>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
          '<button class="btn btn-ghost" id="calcBack" style="flex:1;margin-top:0">' + ic('fa-solid fa-delete-left') + '</button>' +
          '<button class="btn btn-ghost" id="calcClear" style="flex:1;margin-top:0">C</button>' +
          '<button class="btn btn-primary" id="calcOk" style="flex:2;margin-top:0">完成</button>' +
        '</div>' +
        '<button class="btn btn-ghost" id="calcRet" style="margin-top:8px">返回记账（不保存算式）</button>',
        goBack
      );
      $$('#sheetBody [data-k]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-k');
          var last = expr.slice(-1);
          if ('+-×÷'.indexOf(k) >= 0) {
            if (!expr) { if (k === '-') expr = '-'; }
            else if ('+-×÷'.indexOf(last) >= 0) expr = expr.slice(0, -1) + k;
            else expr += k;
          } else {
            expr += k;
          }
          renderCalc();
        });
      });
      $('#calcBack').addEventListener('click', function () { expr = expr.slice(0, -1); renderCalc(); });
      $('#calcClear').addEventListener('click', function () { expr = ''; renderCalc(); });
      $('#calcRet').addEventListener('click', goBack);
      $('#calcOk').addEventListener('click', function () {
        var v = calcEval(expr);
        if (isNaN(v)) { toast('算式不完整'); return; }
        v = Math.round(v * 100) / 100;
        if (v < 0) { toast('金额不能为负'); return; }
        onDone(String(v), v);
      });
    }
    renderCalc();
  }

  /* ---------- 拖拽排序（触屏+鼠标通用） ---------- */
  function makeSortable(container, onReorder) {
    if (!container) return;
    container.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest('.drag-handle');
      if (!handle) return;
      var item = handle.closest('[data-id]');
      if (!item) return;
      e.preventDefault();

      var items = $$('[data-id]', container);
      var startIdx = items.indexOf(item);
      var step = items.length > 1
        ? items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().top
        : item.offsetHeight;
      if (step <= 0) step = item.offsetHeight || 60;
      var startY = e.clientY;
      var curIdx = startIdx;

      item.classList.add('dragging');
      container.classList.add('sorting');
      item.style.position = 'relative';
      item.style.zIndex = '20';

      function onMove(ev) {
        var dy = ev.clientY - startY;
        item.style.transform = 'translateY(' + dy + 'px)';
        var newIdx = startIdx + Math.round(dy / step);
        newIdx = Math.max(0, Math.min(items.length - 1, newIdx));
        if (newIdx !== curIdx) {
          items.forEach(function (it, i) {
            if (it === item) return;
            var shift = 0;
            if (startIdx < newIdx && i > startIdx && i <= newIdx) shift = -step;
            if (newIdx < startIdx && i >= newIdx && i < startIdx) shift = step;
            it.style.transform = 'translateY(' + shift + 'px)';
          });
          curIdx = newIdx;
        }
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        var ids = items.map(function (it) { return it.getAttribute('data-id'); });
        ids.splice(startIdx, 1);
        ids.splice(curIdx, 0, item.getAttribute('data-id'));
        item.classList.remove('dragging');
        container.classList.remove('sorting');
        item.style.position = ''; item.style.zIndex = ''; item.style.transform = '';
        items.forEach(function (it) { it.style.transform = ''; });
        if (startIdx !== curIdx) onReorder(ids);
        renderAccountsIfVisible(ids);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  }
  function renderAccountsIfVisible() {
    if (!$('#page-accounts').classList.contains('hidden')) renderAccounts();
  }

  /* ---------- 刷新当前页 ---------- */
  function rerender() {
    if (!$('#page-home').classList.contains('hidden')) renderHome();
    if (!$('#page-bills').classList.contains('hidden')) renderBills();
    if (!$('#page-stats').classList.contains('hidden')) renderStats();
    if (!$('#page-accounts').classList.contains('hidden')) renderAccounts();
    if (!$('#page-settings').classList.contains('hidden')) renderSettings();
  }

  /* ---------- 启动 ---------- */
  applyTheme();
  renderHome();
  if (Store.getLoadError()) {
    setTimeout(function () {
      openSheet('<div class="card-title">本地存档需要处理</div>' +
        '<div class="set-note">' + esc(Store.getLoadError().message) + '</div>' +
        '<div class="set-note-sub">原始数据已保留，在你确认前不会被新数据覆盖。</div>' +
        '<button class="btn btn-primary" id="recoverySettings">前往设置处理</button>');
      $('#recoverySettings').addEventListener('click', function () { closeSheet(); go('settings'); });
    }, 50);
  }
})();
