/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
const worker = self as unknown as ServiceWorkerGlobalScope;
const name = `dangverywhere-static-${version}`;
const assets = [...build, ...files];
const assetPaths = new Set(assets);
/**
 * 빌드 산출물은 파일 이름에 내용 해시가 붙어 있어, 이름이 같으면 내용도 같습니다.
 * static/ 파일(로고·영상 등)은 이름이 그대로라서 같은 이름으로 내용만 바뀔 수 있어요.
 * 그래서 이쪽은 캐시를 먼저 보여 주되 뒤에서 새로 받아 두고, 다음 방문에 새 파일이 나오게 합니다.
 */
const immutablePaths = new Set(build);
/**
 * 설치할 때 미리 받아 두는 목록. 장소 사진(/places/)은 1,200장이 넘고 60MB 가까워서 뺍니다.
 * 설치 한 번에 그만큼을 내려받게 하면 데이터도 데이터지만, addAll 은 한 장만 실패해도
 * 통째로 엎어져서 설치 자체가 안 됩니다(= 오프라인 화면까지 같이 날아가요).
 * 대신 아래 fetch 에서 한 번 본 사진만 캐시에 남겨 둡니다.
 */
const precachePaths = assets.filter((path) => !path.startsWith('/places/'));

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(name).then((cache) => cache.addAll(precachePaths)));
});
worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('dangverywhere-static-') && key !== name)
            .map((key) => caches.delete(key))
        )
      )
  );
});
worker.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
  // Only build/static files are cached. Never cache policies, HTML with account
  // state, authenticated endpoints, third-party maps or OAuth responses.
  if (assetPaths.has(url.pathname)) {
    event.respondWith(
      caches.open(name).then(async (cache) => {
        const cached = await cache.match(url.pathname);
        if (cached && immutablePaths.has(url.pathname)) return cached;
        const fresh = fetch(request).then((response) => {
          // 206(Range) 응답은 영상의 일부라 캐시에 넣으면 안 됩니다.
          if (response.status === 200 && !request.headers.has('range'))
            cache.put(url.pathname, response.clone()).catch(() => {});
          return response;
        });
        if (!cached) return fresh;
        // 캐시본을 바로 보여 주고, 새 파일 받아 두는 일은 뒤에서 이어 갑니다.
        event.waitUntil(fresh.catch(() => {}));
        return cached;
      })
    );
  } else if (request.mode === 'navigate' && !url.pathname.startsWith('/auth')) {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.open(name))
          .match('/offline.html')
          .then((response) => response ?? new Response('오프라인이에요.', { status: 503 }))
      )
    );
  }
});
