/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
const worker = self as unknown as ServiceWorkerGlobalScope;
const name = `dangverywhere-static-${version}`;
const assets = [...build, ...files];
const assetPaths = new Set(assets);

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
  // Only immutable build/static files are cached. Never cache policies, HTML with
  // account state, authenticated endpoints, third-party maps or OAuth responses.
  if (assetPaths.has(url.pathname)) {
    event.respondWith(
      caches.open(name).then(async (cache) => (await cache.match(url.pathname)) ?? fetch(request))
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
