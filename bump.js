#!/usr/bin/env node
/* 版本号统一升级工具
 * 用法: node bump.js 1.2  或  node bump.js 1.2.0
 * 会同步修改：store.js 的 VERSION、manifest 的 version、sw.js 的缓存名、
 *            index.html 全部 ?v= 引用、README 标题，改完逐项复核。
 */
var fs = require('fs');
var path = require('path');

var nv = String(process.argv[2] || '').trim().replace(/^v/, '');
if (!/^\d+\.\d+(?:\.\d+)?$/.test(nv)) {
  console.log('用法: node bump.js 1.2   (须为 x.y 或 x.y.z 格式)');
  process.exit(1);
}

/* 版本号允许 x.y 与 x.y.z 两种写法（v1.1 与 v1.1.3 都能匹配） */
var VER = '(\\d+\\.\\d+(?:\\.\\d+)?)';
var root = __dirname;
var targets = [
  { file: 'js/store.js', re: new RegExp("var VERSION = '" + VER + "'", 'g'), label: 'Store.VERSION（设置页底部显示的版本）' },
  { file: 'manifest.webmanifest', re: new RegExp('"version":\\s*"' + VER + '"', 'g'), label: 'manifest version' },
  { file: 'sw.js', re: new RegExp("var CACHE = 'jizhangben-v" + VER + "'", 'g'), label: 'Service Worker 缓存名' },
  { file: 'index.html', re: new RegExp('\\?v=' + VER, 'g'), label: '静态资源 ?v= 引用' },
  { file: 'README.md', re: new RegExp('# 记账本（PWA 版）v' + VER, 'g'), label: 'README 标题' }
];

console.log('升级版本号 -> ' + nv + '\n');

targets.forEach(function (t) {
  var p = path.join(root, t.file);
  var s = fs.readFileSync(p, 'utf8');
  var n = 0;
  var out = s.replace(t.re, function (m, g1) {
    n++;
    return m.replace(g1, nv);
  });
  if (n > 0 && out !== s) {
    fs.writeFileSync(p, out, 'utf8');
    console.log('  [改] ' + t.file + '  (' + n + ' 处)  ← ' + t.label);
  } else if (n > 0) {
    console.log('  [同] ' + t.file + '  (' + n + ' 处)  已经是 ' + nv);
  } else {
    console.log('  [无匹配!] ' + t.file + '  ← 请检查该文件结构是否变了');
  }
});

console.log('\n=== 复核：各文件当前版本号 ===');
var bad = 0;
targets.forEach(function (t) {
  var s = fs.readFileSync(path.join(root, t.file), 'utf8');
  var vals = [];
  var m;
  t.re.lastIndex = 0;
  while ((m = t.re.exec(s)) !== null) vals.push(m[1]);
  var ok = vals.length > 0 && vals.every(function (v) { return v === nv; });
  if (!ok) bad++;
  console.log('  ' + (ok ? '√' : '×') + ' ' + t.file + ': ' + (vals.join(', ') || '未找到'));
});
console.log('\n' + (bad === 0 ? '全部一致，共 ' + targets.length + ' 个文件。' : '有 ' + bad + ' 个文件不一致，请手工检查！'));
