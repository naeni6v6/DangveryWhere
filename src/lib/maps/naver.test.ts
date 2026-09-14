import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let host: {
  setTimeout: typeof setTimeout;
  naver?: { maps: object };
  dangverywhereMapReady?: () => void;
  navermap_authFailure?: () => void;
};

beforeEach(() => {
  vi.resetModules();
  host = { setTimeout };
  vi.stubGlobal('window', host);
  vi.stubGlobal('document', {
    createElement: () => ({ remove: vi.fn() }),
    head: { appendChild: vi.fn() }
  });
});
afterEach(() => vi.unstubAllGlobals());

it('waits for the SDK export when the cached script invokes its callback first', async () => {
  const { loadNaverMaps } = await import('./naver');
  const result = loadNaverMaps('test-client');
  host.dangverywhereMapReady!();
  const sdk = {};
  host.naver = { maps: sdk };
  await expect(result).resolves.toBe(sdk);
});

it('reports authentication failure and permits a subsequent retry', async () => {
  const { loadNaverMaps } = await import('./naver');
  const first = loadNaverMaps('test-client');
  const rejected = expect(first).rejects.toThrow('NAVER_MAP_AUTH_FAILED');
  host.navermap_authFailure!();
  await rejected;
  const second = loadNaverMaps('test-client');
  const sdk = {};
  host.naver = { maps: sdk };
  host.dangverywhereMapReady!();
  await expect(second).resolves.toBe(sdk);
});
