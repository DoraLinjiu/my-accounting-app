/* 缓存名带版本号：改版本号时这里一起变，老用户的旧缓存才会被清掉。
   （sw.js 内容不变时浏览器不会重新安装 SW，老用户就会一直拿到旧的 CSS/JS）
   v1.3 细节调整：应用版本号仍是 v1.3，这里用 -r3 后缀强制刷新一次缓存。*/
var CACHE = 'jizhangben-v1.3-r3';
/* Font Awesome CDN 资源：单独预缓存，失败不影响 App 本体离线可用 */
var FA_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2'
];
var ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/store.js',
  './js/charts.js',
  './js/app.js',
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
      return c.addAll(ASSETS).catch(function () {});
    }).then(function () {
      return Promise.all(FA_ASSETS.map(function (u) {
        return fetch(u, { mode: 'cors' }).then(function (resp) {
          if (!resp || !resp.ok) return null;
          return caches.open(CACHE).then(function (c) { return c.put(u, resp); });
        }).catch(function () { return null; });
      }));
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
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () {
        /* 离线兜底：只给页面导航返回首页；CSS/字体等子资源别错返回 HTML */
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
