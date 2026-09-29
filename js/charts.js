/* ===== 纯 SVG 图表：环形图 + 柱状图（零依赖、离线可用） ===== */
var Charts = (function () {

  /* 环形图 data: [{name, value, color}] */
  function donut(data, size) {
    size = size || 180;
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (total <= 0) {
      return '<div class="empty-tip">这个周期还没有记录</div>';
    }
    var r = size / 2 - 14;
    var cx = size / 2, cy = size / 2;
    var C = 2 * Math.PI * r;
    var offset = 0;
    var parts = data.map(function (d) {
      var frac = d.value / total;
      var len = frac * C;
      var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color +
        '" stroke-width="26" stroke-dasharray="' + len + ' ' + (C - len) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"><title>' +
        esc(d.name) + ' ¥' + fmt(d.value) + '</title></circle>';
      offset += len;
      return seg;
    }).join('');
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      parts +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="13" fill="var(--text-sub)">总支出</text>' +
      '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-size="17" font-weight="800" fill="var(--text)">¥' + fmt(total) + '</text>' +
      '</svg>';
  }

  /* 柱状图 data: [{label, income, expense}] */
  function bars(data, opts) {
    opts = opts || {};
    var W = Math.max(320, data.length * 34);
    var H = opts.height || 170;
    var padB = 26, padT = 14;
    var max = 0;
    data.forEach(function (d) {
      max = Math.max(max, d.income || 0, d.expense || 0);
    });
    if (max <= 0) return '<div class="empty-tip">这个周期还没有记录</div>';
    var n = data.length;
    var slot = W / n;
    var bw = Math.min(11, slot * 0.3);
    var html = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    data.forEach(function (d, i) {
      var x = i * slot + slot / 2;
      var hi = (d.income || 0) / max * (H - padB - padT);
      var he = (d.expense || 0) / max * (H - padB - padT);
      var yb = H - padB;
      if (d.expense > 0) {
        html += '<rect x="' + (x - bw - 1.5) + '" y="' + (yb - he) + '" width="' + bw + '" height="' + he +
          '" rx="4" fill="#FFB3BA"><title>' + esc(d.label) + ' 支出 ¥' + fmt(d.expense) + '</title></rect>';
      }
      if (d.income > 0) {
        html += '<rect x="' + (x + 1.5) + '" y="' + (yb - hi) + '" width="' + bw + '" height="' + hi +
          '" rx="4" fill="#BAFFC9"><title>' + esc(d.label) + ' 收入 ¥' + fmt(d.income) + '</title></rect>';
      }
      if (n <= 16 || i % Math.ceil(n / 12) === 0) {
        html += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text-sub)">' + esc(d.label) + '</text>';
      }
    });
    html += '<line x1="0" y1="' + (H - padB) + '" x2="' + W + '" y2="' + (H - padB) + '" stroke="var(--line)" stroke-width="1"/></svg>';
    return html;
  }

  function fmt(n) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { donut: donut, bars: bars };
})();
