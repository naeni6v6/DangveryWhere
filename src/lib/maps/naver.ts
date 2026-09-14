let pending: Promise<typeof naver.maps> | undefined;

export function loadNaverMaps(clientId: string): Promise<typeof naver.maps> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const host = window as unknown as {
      naver?: typeof naver;
      dangverywhereMapReady?: () => void;
      navermap_authFailure?: () => void;
    };
    const script = document.createElement('script');
    const previousFailure = host.navermap_authFailure;
    const timeout = window.setTimeout(() => fail('NAVER_MAP_TIMEOUT'), 15000);
    function cleanup() {
      clearTimeout(timeout);
      delete host.dangverywhereMapReady;
      host.navermap_authFailure = previousFailure;
    }
    function fail(reason: string) {
      cleanup();
      script.remove();
      pending = undefined;
      reject(new Error(reason));
    }
    host.dangverywhereMapReady = () => {
      // A cached SDK can invoke its callback before assigning window.naver.maps.
      // Wait until the current script has finished exporting the namespace.
      queueMicrotask(() => {
        if (!host.naver?.maps) return fail('NAVER_MAP_SDK_MISSING');
        cleanup();
        resolve(host.naver.maps);
      });
    };
    host.navermap_authFailure = () => fail('NAVER_MAP_AUTH_FAILED');
    script.async = true;
    script.onerror = () => fail('NAVER_MAP_SCRIPT_FAILED');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&callback=dangverywhereMapReady`;
    document.head.appendChild(script);
  });
  return pending;
}
