// 회송리스트 서비스워커 — 오프라인에서도 앱 화면 자체는 열리게 해줌.
//
// 지켜야 할 것 두 가지 (다른 프로젝트에서 실제로 겪은 버그들):
// 1) POST 등 GET이 아닌 요청은 절대 가로채지 않음 — 안 그러면 상품바코드
//    인식이 쓰는 api.anthropic.com POST 호출이 여기 걸려서 원인 모를
//    "Failed to fetch" 에러만 뜸.
// 2) 캐시 우선(cache-first)이 아니라 네트워크 우선(network-first) —
//    cache-first로 하면 index.html을 새로 고쳐서 올려도 이미 방문한
//    사람 폰에는 예전 버전이 캐시에 박혀서 계속 그것만 보임.

var CACHE_NAME = 'hoesong-list-v1';
var CORE_ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(CORE_ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // GET이 아니면(Vision API 호출 등) 서비스워커가 아예 손대지 않음.
  if (req.method !== 'GET') return;

  // 다른 도메인 요청(구글 폰트, api.anthropic.com 등)도 그대로 통과시킴 —
  // 여기서 캐싱하려다 opaque response 문제가 생기지 않게.
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
