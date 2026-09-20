import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const raw = readFileSync(new URL('../../service-worker.ts', import.meta.url), 'utf8');
const source = transpileModule(
  raw.replace("import { build, files, version } from '$service-worker';", ''),
  {
    compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 }
  }
).outputText;

function setup() {
  const handlers: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async addAll(paths: string[]) {
          for (const path of paths) store.set(path, new Response(path));
        },
        async match(path: string) {
          return store.get(path)?.clone();
        },
        async put(path: string, response: Response) {
          store.set(path, response);
        },
        async keys() {
          return [...store.keys()];
        },
        async delete(path: string) {
          return store.delete(path);
        }
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    }
  };
  const fetch = vi.fn(async () => new Response('network'));
  const skipWaiting = vi.fn(async () => {});
  const claim = vi.fn(async () => {});
  runInNewContext(source, {
    build: ['/_app/immutable/app.js'],
    files: [
      '/offline.html',
      '/logo.png',
      '/manifest.webmanifest',
      '/icon-192.png',
      '/icon-512.png',
      '/video.mp4',
      '/dogs/test.webp',
      ...Array.from({ length: 90 }, (_, i) => `/places/${i}.webp`)
    ],
    version: 'test',
    URL,
    Response,
    fetch,
    caches,
    self: {
      location: { origin: 'https://app.test' },
      addEventListener: (name: string, handler: (event: any) => void) => (handlers[name] = handler),
      skipWaiting,
      clients: { claim }
    }
  });
  async function event(name: string, data: Record<string, unknown> = {}) {
    const promises: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers[name]({
      ...data,
      waitUntil: (promise: Promise<unknown>) => promises.push(promise),
      respondWith: (promise: Promise<Response>) => (response = promise)
    });
    const result = await response;
    await Promise.all(promises);
    return result;
  }
  const request = (
    path: string,
    options: { mode?: string; method?: string; range?: string } = {}
  ) =>
    event('fetch', {
      request: {
        url: new URL(path, 'https://app.test').href,
        method: options.method ?? 'GET',
        mode: options.mode ?? 'cors',
        headers: new Headers(options.range ? { range: options.range } : {})
      }
    });
  return { stores, event, request, fetch, skipWaiting, claim };
}

describe('mobile PWA worker', () => {
  it('installs the bundle and offline fallback without downloading every photo and video', async () => {
    const app = setup();
    await app.event('install');
    const cached = app.stores.get('dangverywhere-static-test')!;
    expect(cached.has('/offline.html')).toBe(true);
    expect(cached.has('/_app/immutable/app.js')).toBe(true);
    expect([...cached.keys()].some((path) => /places|dogs|\.mp4/.test(path))).toBe(false);
  });

  it('never intercepts account APIs, OAuth, writes or external map traffic', async () => {
    const app = setup();
    for (const path of [
      '/api/profile',
      '/api/favorites',
      '/auth/kakao/callback',
      'https://maps.example/script.js'
    ]) {
      expect(await app.request(path, { mode: 'navigate' })).toBeUndefined();
    }
    expect(await app.request('/logo.png', { method: 'PUT' })).toBeUndefined();
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it('uses the offline page for navigation without caching account HTML', async () => {
    const app = setup();
    await app.event('install');
    expect(await (await app.request('/dog', { mode: 'navigate' }))!.text()).toBe('network');
    expect(app.stores.get('dangverywhere-static-test')!.has('/dog')).toBe(false);
    app.fetch.mockRejectedValueOnce(new TypeError('offline'));
    expect(await (await app.request('/explore', { mode: 'navigate' }))!.text()).toBe(
      '/offline.html'
    );
  });

  it('serves immutable assets offline and does not break cached static images during refresh failure', async () => {
    const app = setup();
    await app.event('install');
    app.fetch.mockRejectedValue(new TypeError('offline'));
    expect(await (await app.request('/_app/immutable/app.js'))!.text()).toBe(
      '/_app/immutable/app.js'
    );
    expect(await (await app.request('/logo.png'))!.text()).toBe('/logo.png');
  });

  it('passes range requests and large videos through untouched', async () => {
    const app = setup();
    expect(await app.request('/logo.png', { range: 'bytes=0-128' })).toBeUndefined();
    expect(await app.request('/video.mp4')).toBeUndefined();
  });

  it('bounds runtime photos without evicting the offline fallback', async () => {
    const app = setup();
    await app.event('install');
    for (let i = 0; i < 85; i++) await app.request(`/places/${i}.webp`);
    expect(app.stores.get('dangverywhere-static-test-media')!.size).toBe(80);
    expect(app.stores.get('dangverywhere-static-test')!.has('/offline.html')).toBe(true);
  });

  it('activates an update only on request and cleans only its own old caches', async () => {
    const app = setup();
    await app.event('install');
    expect(app.skipWaiting).not.toHaveBeenCalled();
    app.stores.set('another-app', new Map());
    app.stores.set('dangverywhere-static-old', new Map());
    app.stores.set('dangverywhere-static-test-media', new Map());
    await app.event('message', { data: { type: 'SKIP_WAITING' } });
    expect(app.skipWaiting).toHaveBeenCalledOnce();
    await app.event('activate');
    expect(app.stores.has('another-app')).toBe(true);
    expect(app.stores.has('dangverywhere-static-old')).toBe(false);
    expect(app.stores.has('dangverywhere-static-test-media')).toBe(true);
    expect(app.claim).toHaveBeenCalledOnce();
  });
});
