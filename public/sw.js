const CACHE_NAME = 'emotion-diary-v3';
const urlsToCache = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.png'];

// 安装 Service Worker
self.addEventListener('install', event => {
  // 立即激活新的 Service Worker
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  const sameOrigin = url.origin === self.location.origin;

  // 跳过非 http(s) 协议（如 chrome-extension），避免不受支持的缓存写入报错
  if (!isHttp) {
    return;
  }

  const safeCachePut = (request, response) => {
    try {
      const typeOk = response && (response.type === 'basic' || response.type === 'cors');
      if (request.method === 'GET' && sameOrigin && typeOk && response.ok) {
        const clone = response.clone();
        caches
          .open(CACHE_NAME)
          .then(cache => cache.put(request, clone))
          .catch(() => {});
      }
    } catch (e) {
      // 忽略缓存写入异常，确保不影响正常响应
    }
  };

  // HTML 文档采用网络优先，避免旧版 index.html 被缓存导致引用不存在的哈希资源
  if (req.mode === 'navigate' || req.destination === 'document' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(response => {
          safeCachePut(req, response);
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // JS/CSS 也采用网络优先，避免哈希变更后加载到旧缓存
  if (req.destination === 'script' || req.destination === 'style') {
    event.respondWith(
      fetch(req)
        .then(response => {
          safeCachePut(req, response);
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 图标文件网络优先，失败再回退缓存
  if (url.pathname.includes('icon-') || url.pathname.includes('favicon')) {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response.ok) {
            safeCachePut(req, response);
            return response;
          }
          return caches.match(req);
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 其他资源缓存优先
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});

// 更新 Service Worker
self.addEventListener('activate', event => {
  // 立即控制所有客户端
  event.waitUntil(
    Promise.all([
      // 清理旧缓存
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 立即控制所有客户端
      self.clients.claim()
    ])
  );
});
