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

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(name).then((cache) => cache.addAll(assets)));
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
