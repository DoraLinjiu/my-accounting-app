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
  function ic(cls) { return '<i class="' + cls + '"></i>'; }
  function faOf(obj, fallback) {
    return Store.faIcon(obj && obj.icon ? obj.icon : '', fallback || FA_TAG);
  }
  function iconOf(obj, fallback) { return ic(faOf(obj, fallback || FA_TAG)); }

  /* 新增账户 / 分类时可选用的图标 */
  var ICON_CHOICES = [
    'fa-solid fa-utensils', 'fa-solid fa-cart-shopping', 'fa-solid fa-car', 'fa-solid fa-gamepad',
    'fa-solid fa-house', 'fa-solid fa-droplet', 'fa-solid fa-mug-hot', 'fa-solid fa-bus',
    'fa-solid fa-shirt', 'fa-solid fa-film', 'fa-solid fa-book', 'fa-solid fa-dumbbell',
    'fa-solid fa-plane', 'fa-solid fa-phone', 'fa-solid fa-wifi', 'fa-solid fa-gift',
    'fa-solid fa-heart', 'fa-solid fa-star', 'fa-solid fa-bolt', 'fa-solid fa-tag',
    'fa-solid fa-credit-card', 'fa-solid fa-wallet', 'fa-solid fa-piggy-bank', 'fa-solid fa-building-columns',
    'fa-solid fa-money-bill-wave', 'fa-solid fa-chart-line', 'fa-solid fa-envelope-open-text', 'fa-solid fa-briefcase',
    'fa-brands fa-weixin', 'fa-brands fa-alipay', 'fa-solid fa-seedling', 'fa-solid fa-paw'
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

  /* ---------- 主题 ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', Store.settings().dark ? 'dark' : 'light');
  }

  /* ---------- 弹层 ---------- */
  var sheetOpen = false;
  function openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.remove('hidden');
    $('#sheetMask').classList.remove('hidden');
    sheetOpen = true;
  }
  function closeSheet() {
    $('#sheet').classList.add('hidden');
    $('#sheetMask').classList.add('hidden');
    sheetOpen = false;
  }
  $('#sheetMask').addEventListener('click', closeSheet);

  /* ---------- 路由 ---------- */
  var pages = { home: renderHome, stats: renderStats, accounts: renderAccounts, settings: renderSettings };
  function go(page) {
    ['home', 'stats', 'accounts', 'settings'].forEach(function (p) {
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
    var ym = today.slice(0, 7);
    /* v1.1：顶栏显示自定义昵称（默认 Dora） */
    var nickEl = $('#topbarNick');
    if (nickEl) nickEl.textContent = Store.settings().nickname || 'Dora';

    var sumToday = Store.summary(today, today);
    var sumMonth = Store.summary(ym + '-01', ym + '-31');
    var monthLeft = Math.round((sumMonth.income - sumMonth.expense) * 100) / 100;
    var total = Store.totalAssets();

    var txs = Store.getTransactions().slice(0, 60);
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
          '<div class="hero-pill">账户数<b>' + Store.getAccounts().length + ' 个</b></div>' +
        '</div>' +
      '</div>' +
      /* v1.1 新增：本月汇总卡片 */
      '<div class="card">' +
        '<div class="card-title">本月汇总<span class="more">' + ym.replace('-', ' 年 ') + ' 月</span></div>' +
        '<div class="month-sum">' +
          '<div class="ms-item"><span class="ms-label">总支出</span><b class="ms-exp"><span class="cur">¥</span>' + fmt(sumMonth.expense) + '</b></div>' +
          '<div class="ms-item"><span class="ms-label">总收入</span><b class="ms-inc"><span class="cur">¥</span>' + fmt(sumMonth.income) + '</b></div>' +
          '<div class="ms-item"><span class="ms-label">结余</span><b><span class="cur">¥</span>' + fmt(monthLeft) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">最近记录<span class="more">点条目可编辑 / 删除</span></div>' + listHtml + '</div>';

    $$('#page-home .tx-item').forEach(function (el) {
      el.addEventListener('click', function () { openTxEdit(el.getAttribute('data-id')); });
    });
  }

  function txRow(t) {
    var icon, name, sub, amt, cls;
    if (t.kind === 'transfer') {
      var fa = Store.getAccount(t.accountId), ta = Store.getAccount(t.toAccountId);
      icon = ic('fa-solid fa-arrow-right-arrow-left');
      name = '转账';
      sub = (fa ? fa.name : '?') + ' → ' + (ta ? ta.name : '?');
      amt = '¥' + fmt(t.amount); cls = '';
    } else {
      var c = Store.getCategory(t.categoryId);
      var a = Store.getAccount(t.accountId);
      icon = ic(faOf(c, FA_TAG));
      name = c ? c.name : '其他';
      sub = (a ? a.name : '') + (t.note ? ' · ' + t.note : '');
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
  function openConfirm(title, msg, okText, onOk) {
    openSheet(
      '<div class="card-title">' + esc(title) + '</div>' +
      '<div style="font-size:13px;color:var(--text-sub);line-height:1.9">' + msg + '</div>' +
      '<button class="btn btn-danger" id="cfmYes">' + esc(okText || '确认') + '</button>' +
      '<button class="btn btn-ghost" id="cfmNo">取消</button>'
    );
    $('#cfmYes').addEventListener('click', function () { onOk(); });
    $('#cfmNo').addEventListener('click', closeSheet);
  }

  /* ---------- v1.1 记录编辑面板 ---------- */
  var edit = null;

  function openTxEdit(id) {
    var t = Store.getTransactions().filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    edit = { id: id, kind: t.kind, categoryId: t.categoryId || null, note: t.note || '' };
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

    var accText = isTransfer
      ? (((Store.getAccount(t.accountId) || {}).name || '?') + ' → ' + ((Store.getAccount(t.toAccountId) || {}).name || '?'))
      : ((Store.getAccount(t.accountId) || {}).name || '');

    openSheet(
      '<div class="card-title">编辑记录</div>' +
      '<div class="edit-amount-wrap">' +
        '<div class="edit-amount-label">金额（只读，不可修改）</div>' +
        '<div class="edit-amount ' + (isTransfer ? '' : (t.kind === 'income' ? 'income' : 'expense')) + '">' +
          (isTransfer ? '¥' : (t.kind === 'income' ? '+¥' : '-¥')) + fmt(t.amount) +
        '</div>' +
      '</div>' +
      kindHtml + catHtml +
      '<div class="field-label">账户</div><div class="read-val">' + esc(accText) + '</div>' +
      '<div class="field-label">日期</div><div class="read-val">' + t.date + '</div>' +
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
        edit.note = $('#editNote').value;
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

    $('#editSave').addEventListener('click', function () {
      edit.note = $('#editNote').value;
      var patch = { note: edit.note };
      if (!isTransfer) { patch.kind = edit.kind; patch.categoryId = edit.categoryId; }
      Store.updateTransaction(edit.id, patch);
      closeSheet(); toast('已保存修改'); rerender();
    });

    $('#editDel').addEventListener('click', function () {
      var label = isTransfer ? '转账 ¥' + fmt(t.amount) : ((Store.getCategory(t.categoryId) || {}).name || '') + ' ¥' + fmt(t.amount);
      openConfirm('确认删除这条记录？', '将删除：' + esc(label) + '<br>删除后无法恢复，账户余额与统计会同步变化。',
        '确认删除', function () {
          Store.deleteTransaction(edit.id);
          closeSheet(); toast('已删除'); rerender();
        });
    });
  }

  /* ---------- 统计 ---------- */
  var statsState = { period: 'month', date: todayStr() };

  function periodRange(period, dateStr) {
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

  function barData(period, dateStr) {
    var txs = Store.getTransactions();
    var buckets = [];
    var i, d;
    function push(label, ds) {
      var inc = 0, exp = 0;
      txs.forEach(function (t) {
        if (t.date !== ds || t.kind === 'transfer') return;
        if (t.kind === 'income') inc += t.amount; else exp += t.amount;
      });
      buckets.push({ label: label, income: Math.round(inc * 100) / 100, expense: Math.round(exp * 100) / 100 });
    }
    if (period === 'day') {
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
        buckets.push({ label: i + '月', income: Math.round(inc2 * 100) / 100, expense: Math.round(exp2 * 100) / 100 });
      }
    }
    return buckets;
  }

  function renderStats() {
    var periodNames = { day: '日', week: '周', month: '月', year: '年' };
    var rg = periodRange(statsState.period, statsState.date);
    var sum = Store.summary(rg.from, rg.to);
    var catData = Store.byCategory(rg.from, rg.to, 'expense');
    var bd = barData(statsState.period, statsState.date);

    var tabs = Object.keys(periodNames).map(function (p) {
      return '<button data-p="' + p + '" class="' + (statsState.period === p ? 'on' : '') + '">' + periodNames[p] + '</button>';
    }).join('');

    var legend = catData.slice(0, 8).map(function (c) {
      return '<div class="legend-item"><span class="legend-dot" style="background:' + c.color + '"></span>' +
        ic(faOf(c, FA_TAG)) + esc(c.name) + '<b>¥' + fmt(c.value) + '</b></div>';
    }).join('');

    var dateCtl = statsState.period === 'day'
      ? '<input type="date" class="input" id="statsDate" value="' + statsState.date + '" style="margin-bottom:14px">'
      : '';

    $('#page-stats').innerHTML =
      '<div class="stats-tabs">' + tabs + '</div>' +
      dateCtl +
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

    $$('#page-stats .stats-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        statsState.period = b.getAttribute('data-p');
        renderStats();
      });
    });
    var sd = $('#statsDate');
    if (sd) sd.addEventListener('change', function () {
      statsState.date = sd.value || todayStr();
      renderStats();
    });
  }

  /* ---------- 账户 ---------- */
  function renderAccounts() {
    var accs = Store.getAccounts();
    var total = Store.totalAssets();
    var cards = accs.map(function (a) {
      return '<div class="acc-card" data-id="' + a.id + '">' +
        '<div class="acc-icon" style="color:' + (a.color || '#BAE1FF') + '">' + iconOf(a, FA_CARD) + '</div>' +
        '<div class="acc-main"><div class="acc-name">' + esc(a.name) + '</div>' +
        '<div class="acc-bal">¥ ' + fmt(Store.accountBalance(a.id)) + '</div></div>' +
        '<div class="drag-handle" title="拖拽排序">' + ic('fa-solid fa-grip-lines') + '</div>' +
      '</div>';
    }).join('');

    $('#page-accounts').innerHTML =
      '<div class="hero"><div class="label">总资产 (元)</div><div class="total">¥ ' + fmt(total) + '</div>' +
        '<div class="hero-row">' +
          '<div class="hero-pill" id="btnTransfer" style="cursor:pointer">' + ic('fa-solid fa-arrow-right-arrow-left') + ' 账户互转</div>' +
          '<div class="hero-pill" id="btnAddAcc" style="cursor:pointer">' + ic('fa-solid fa-plus') + ' 添加账户</div>' +
        '</div>' +
      '</div>' +
      '<div id="accList">' + cards + '</div>' +
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
      Store.reorderAccounts(ids);
      toast('顺序已保存');
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
      var acc = Store.addAccount(name, pickedIcon, colors[Math.floor(Math.random() * 4)]);
      var bal = parseFloat($('#newAccBal').value);
      if (!isNaN(bal) && bal !== 0) Store.setAccountBalance(acc.id, bal);
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
      '<button class="btn btn-primary" id="saveAccBtn">保存</button>'
    );
    $('#saveAccBtn').addEventListener('click', function () {
      var name = $('#editAccName').value.trim();
      if (name) Store.updateAccount(id, { name: name });
      var nb = parseFloat($('#editAccBal').value);
      if (!isNaN(nb)) Store.setAccountBalance(id, nb);
      closeSheet(); toast('已保存'); rerender();
    });
  }

  /* ---------- 设置 ---------- */
  function renderSettings() {
    var dark = Store.settings().dark;
    var nick = Store.settings().nickname || 'Dora';
    $('#page-settings').innerHTML =
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
        '<label class="switch"><input type="checkbox" id="darkSwitch" ' + (dark ? 'checked' : '') + '><span class="track"></span></label></div>' +
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
      Store.setSetting('nickname', v);
      var el = $('#topbarNick');
      if (el) el.textContent = v;
      toast('昵称已保存');
    });
    $('#darkSwitch').addEventListener('change', function (e) {
      Store.setSetting('dark', e.target.checked);
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
          try { Store.importJSON(rd.result); toast('导入成功'); rerender(); }
          catch (e) { toast('导入失败：文件格式不对'); }
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
        Store.clearAll(); closeSheet(); toast('已清空'); rerender();
      });
      $('#clearNo').addEventListener('click', closeSheet);
    });
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
        return '<div class="cat-manage-row" data-id="' + c.id + '">' +
          '<span class="cat-bubble" style="background-color:' + (c.color || '#F1EEC6') + ';color:' + (c.color || '#F1EEC6') + ';width:36px;height:36px;border-radius:11px">' + ic(faOf(c, FA_TAG)) + '</span>' +
          '<span>' + esc(c.name) + '</span>' +
          '<button class="tx-del" data-del="' + c.id + '">' + ic('fa-solid fa-xmark') + '</button>' +
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
    makeSortable($('#catExp'), function (ids) { Store.reorderCategories(ids.concat(Store.getCategories('income').map(function (c) { return c.id; }))); });
    makeSortable($('#catInc'), function (ids) { Store.reorderCategories(Store.getCategories('expense').map(function (c) { return c.id; }).concat(ids)); });
    $$('#sheetBody [data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        Store.deleteCategory(b.getAttribute('data-del'));
        renderCatManage();
      });
    });
    $('#addCatBtn').addEventListener('click', function () {
      var name = $('#newCatName').value.trim();
      if (!name) { toast('请输入名称'); return; }
      var colors = ['#FFB3BA', '#BAE1FF', '#BAFFC9', '#FFFFBA'];
      Store.addCategory(name, newCatIcon, colors[Math.floor(Math.random() * 4)], $('#newCatKind').value);
      renderCatManage();
      toast('已添加');
    });
    $('#catDone').addEventListener('click', function () { closeSheet(); });
  }

  /* ---------- 记账弹层 ---------- */
  var rec = null;
  function openRecordSheet(presetKind) {
    var accs = Store.getAccounts();
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
    var accs = Store.getAccounts();
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
      html += '<div class="field-label">从哪个账户转出</div><div class="chip-row">' + accChips + '</div>' +
        '<div class="field-label">转入到哪个账户</div><div class="chip-row">' + toChips + '</div>';
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

    if (rec.kind === 'transfer') {
      if (!rec.accountId || !rec.toAccountId || rec.accountId === rec.toAccountId) { toast('转出和转入账户不能相同'); return; }
      if (!rec.amount || rec.amount <= 0) { toast('请输入金额'); return; }
      Store.addTransaction({ kind: 'transfer', accountId: rec.accountId, toAccountId: rec.toAccountId, amount: rec.amount, note: rec.note, date: rec.date });
      toast('转账完成');
    } else if (rec.kind === 'aa') {
      if (!rec.aaTotal || rec.aaTotal <= 0) { toast('请输入总金额'); return; }
      var per = Math.round(rec.aaTotal / Math.max(1, rec.aaPeople) * 100) / 100;
      Store.addTransaction({
        kind: 'expense', accountId: rec.accountId, categoryId: rec.categoryId, amount: per,
        note: 'AA分账·' + rec.aaPeople + '人共¥' + fmt(rec.aaTotal) + (rec.note ? '·' + rec.note : ''),
        date: rec.date
      });
      toast('已记录我的份额 ¥' + fmt(per));
    } else {
      if (!rec.amount || rec.amount <= 0) { toast('请输入金额'); return; }
      if (!rec.categoryId) { toast('请选择分类'); return; }
      Store.addTransaction({ kind: rec.kind, accountId: rec.accountId, categoryId: rec.categoryId, amount: rec.amount, note: rec.note, date: rec.date });
      toast(rec.kind === 'income' ? '收入已记' : '支出已记');
    }
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
        '</div>'
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
    if (!$('#page-stats').classList.contains('hidden')) renderStats();
    if (!$('#page-accounts').classList.contains('hidden')) renderAccounts();
    if (!$('#page-settings').classList.contains('hidden')) renderSettings();
  }

  /* ---------- 启动 ---------- */
  applyTheme();
  renderHome();
})();
