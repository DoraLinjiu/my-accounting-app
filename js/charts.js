/* ===== 纯 SVG 图表：环形图 + 带金额刻度的柱状图 ===== */
var Charts = (function () {
  'use strict';
  function donut(data, size) {
    size = size || 180;
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (total <= 0) return '<div class="empty-tip">这个周期还没有记录</div>';
    var r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, offset = 0;
    var parts = data.map(function (d) {
      var len = d.value / total * C;
      var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + safeColor(d.color) +
        '" stroke-width="26" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-offset) +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"><title>' + esc(d.name) + ' ¥' + fmt(d.value) + '</title></circle>';
      offset += len; return seg;
    }).join('');
    return '<svg role="img" aria-label="支出构成环形图" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + parts +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="13" fill="var(--text-sub)">总支出</text>' +
      '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-size="17" font-weight="800" fill="var(--text)">¥' + fmt(total) + '</text></svg>';
  }
  function bars(data, opts) {
    opts = opts || {};
    var max = 0;
    data.forEach(function (d) { max = Math.max(max, d.income || 0, d.expense || 0); });
    if (max <= 0) return '<div class="empty-tip">这个周期还没有记录</div>';
    var padL = 52, padR = 12, padB = 30, padT = 42;
    /* 每组留足 82px，收入/支出数字分别向外排，避免手机上相互遮挡。 */
    var W = Math.max(360, padL + padR + data.length * 82), H = opts.height || 230;
    var plotH = H - padB - padT, plotW = W - padL - padR, slot = plotW / data.length, bw = Math.min(18, slot * 0.25);
    var html = '<svg class="trend-svg" role="img" aria-label="收支趋势图" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var tick = 0; tick <= 4; tick++) {
      var value = max * tick / 4, ty = H - padB - plotH * tick / 4;
      html += '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" class="chart-grid"/>' +
        '<text x="' + (padL - 7) + '" y="' + (ty + 4) + '" text-anchor="end" class="chart-axis">¥' + compact(value) + '</text>';
    }
    data.forEach(function (d, i) {
      var x = padL + i * slot + slot / 2, hi = (d.income || 0) / max * plotH, he = (d.expense || 0) / max * plotH, yb = H - padB;
      var detailLabel = d.detailLabel || d.label;
      var tip = detailLabel + '  收入 ¥' + fmt(d.income || 0) + '  支出 ¥' + fmt(d.expense || 0);
      html += '<g class="chart-bar-group" tabindex="0" role="button" aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '">';
      if (d.expense > 0) html += '<rect x="' + (x - bw - 2) + '" y="' + (yb - he) + '" width="' + bw + '" height="' + he + '" rx="5" class="bar-expense"><title>' + esc(detailLabel) + ' 支出 ¥' + fmt(d.expense) + '</title></rect>' +
        '<text x="' + (x - 2) + '" y="' + Math.max(13, yb - he - 6) + '" text-anchor="end" class="bar-value expense">¥' + compact(d.expense) + '</text>';
      if (d.income > 0) html += '<rect x="' + (x + 2) + '" y="' + (yb - hi) + '" width="' + bw + '" height="' + hi + '" rx="5" class="bar-income"><title>' + esc(detailLabel) + ' 收入 ¥' + fmt(d.income) + '</title></rect>' +
        '<text x="' + (x + 2) + '" y="' + Math.max(13, yb - hi - 6) + '" text-anchor="start" class="bar-value income">¥' + compact(d.income) + '</text>';
      if (data.length <= 16 || i % Math.ceil(data.length / 12) === 0) html += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" class="chart-axis x-label">' + esc(d.label) + '</text>';
      html += '</g>';
    });
    return html + '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" class="chart-baseline"/></svg>';
  }
  function compact(n) { n = Number(n || 0); if (Math.abs(n) >= 10000) return (n / 10000).toFixed(n % 10000 ? 1 : 0) + '万'; if (Math.abs(n) >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k'; return String(Math.round(n * 100) / 100); }
  function fmt(n) { return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function safeColor(s) { return /^#[0-9a-f]{6}$/i.test(String(s || '')) ? s : '#CCCCCC'; }
  return { donut: donut, bars: bars };
})();
