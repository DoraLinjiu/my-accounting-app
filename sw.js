/* 缓存名与应用版本同步，新 SW 激活后会清理所有旧版缓存。 */
var CACHE = 'jizhangben-v1.5.3-r3';
var ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/store.js',
  './js/charts.js',
  './js/app.js',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 核心资源必须全部成功；任意一项失败都不安装残缺的 SW。 */
      return c.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request).then(function (resp) {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { return c.put(e.request, copy); }).catch(function () {});
        }
        return resp;
      }).catch(function () {
        /* 离线兜底：只给页面导航返回首页；CSS/字体等子资源别错返回 HTML */
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
