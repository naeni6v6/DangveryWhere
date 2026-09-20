<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Share, PlusSquare, X, RefreshCw } from '@lucide/svelte';
  import { page } from '$app/state';
  import { dev } from '$app/environment';

  type InstallPrompt = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  let promptEvent = $state<InstallPrompt | null>(null);
  let installed = $state(true);
  let ios = $state(false);
  let dismissed = $state(false);
  let installing = $state(false);
  let instructions: HTMLDialogElement;
  let waitingWorker = $state<ServiceWorker | null>(null);
  let updating = false;

  onMount(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () =>
      (installed =
        displayMode.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    updateInstalled();
    ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    try {
      dismissed = sessionStorage.getItem('dangverywhere-install-dismissed') === '1';
    } catch {
      /* Optional preference. */
    }
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      promptEvent = event as InstallPrompt;
    };
    const didInstall = () => {
      installed = true;
      promptEvent = null;
    };
    const controllerChanged = () => {
      if (updating) window.location.reload();
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    displayMode.addEventListener('change', updateInstalled);
    let disposed = false;
    let cleanupRegistration = () => {};
    if ('serviceWorker' in navigator && !dev) {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (!registration || disposed) return;
          if (registration.waiting && navigator.serviceWorker.controller)
            waitingWorker = registration.waiting;
          let installingWorker: ServiceWorker | null = null;
          const changed = () => {
            if (installingWorker?.state === 'installed' && navigator.serviceWorker.controller)
              waitingWorker = registration.waiting;
          };
          const found = () => {
            installingWorker?.removeEventListener('statechange', changed);
            installingWorker = registration.installing;
            installingWorker?.addEventListener('statechange', changed);
          };
          registration.addEventListener('updatefound', found);
          found();
          cleanupRegistration = () => {
            registration.removeEventListener('updatefound', found);
            installingWorker?.removeEventListener('statechange', changed);
          };
        })
        .catch(() => {});
    }
    return () => {
      disposed = true;
      cleanupRegistration();
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
      displayMode.removeEventListener('change', updateInstalled);
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
    };
  });
  async function install() {
    if (!promptEvent) {
      instructions.showModal();
      return;
    }
    installing = true;
    const event = promptEvent;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } catch {
      instructions.showModal();
    } finally {
      promptEvent = null;
      installing = false;
    }
  }
  function dismiss() {
    dismissed = true;
    try {
      sessionStorage.setItem('dangverywhere-install-dismissed', '1');
    } catch {
      /* Optional preference. */
    }
  }
  function update() {
    updating = true;
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }
</script>

{#if waitingWorker}
  <aside class="install-banner update-banner">
    <RefreshCw size={22} /><span
      ><strong>새 버전이 준비됐어요</strong><small>작성 중인 내용을 저장한 뒤 열어 주세요.</small
      ></span
    ><button onclick={update}>새로 열기</button>
  </aside>
{:else if !installed && !dismissed && page.url.pathname === '/'}
  <aside class="install-banner">
    <img src="/icon-192.png" alt="" width="40" height="40" />
    <span
      ><strong>우리의 여행, 앱으로 간편하게</strong><small>홈 화면에 두고 바로 만나요.</small></span
    >
    <button onclick={install} disabled={installing} aria-label="댕브리웨어 앱 설치"
      ><Download size={16} />설치</button
    >
    <button class="dismiss" onclick={dismiss} aria-label="설치 안내 닫기"><X size={15} /></button>
  </aside>
{/if}
<dialog
  bind:this={instructions}
  class="mobile-dialog install-instructions"
  aria-labelledby="install-title"
  onclick={(event) => {
    if (event.target === instructions) instructions.close();
  }}
>
  <button class="mobile-close" onclick={() => instructions.close()} aria-label="설치 방법 닫기"
    ><X size={22} /></button
  >
  <img src="/icon-192.png" alt="" width="64" height="64" />
  <h2 id="install-title">홈 화면에서 만나요</h2>
  {#if ios}
    <p>Safari에서 아래 순서로 설치할 수 있어요.</p>
    <ol>
      <li><Share size={19} />브라우저의 공유 버튼 누르기</li>
      <li><PlusSquare size={19} />‘홈 화면에 추가’ 선택하기</li>
      <li>‘웹 앱으로 열기’가 보이면 켜고 추가하기</li>
    </ol>
  {:else}
    <p>Chrome 또는 Edge의 메뉴에서<br />‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.</p>
    {#if dev}<p class="install-note">
        현재는 개발 화면이에요. 정식 설치와 오프라인 기능은 배포된 앱에서 제공해요.
      </p>{/if}
  {/if}
  <button class="primary-button" onclick={() => instructions.close()}>알겠어요</button>
</dialog>

<style>
  .install-banner {
    position: fixed;
    bottom: calc(76px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    width: min(calc(100% - 24px), 456px);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 26px 13px 13px;
    background: #fff;
    border: 1px solid #eee0d3;
    border-radius: 18px;
    box-shadow: 0 5px 24px #4a34281c;
    z-index: 45;
  }
  .install-banner img {
    border-radius: 12px;
  }
  .install-banner > span {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 12px;
    color: var(--ink);
  }
  small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--muted);
  }
  .install-banner button {
    border: 0;
    background: var(--brand-soft);
    color: var(--brand-deep);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    font-size: 12px;
    font-weight: 700;
  }
  .install-banner .dismiss {
    position: absolute;
    top: -9px;
    right: -4px;
    border: 1px solid var(--line);
    background: white;
    min-height: 30px;
    width: 30px;
    padding: 7px;
    border-radius: 50%;
  }
  .install-instructions {
    text-align: center;
  }
  h2 {
    margin: 16px 0 10px;
  }
  p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--muted);
  }
  ol {
    text-align: left;
    padding-left: 25px;
    font-size: 14px;
    line-height: 1.7;
  }
  li {
    margin: 15px 0;
  }
  li :global(svg) {
    vertical-align: middle;
    margin-right: 6px;
  }
  .install-note {
    background: var(--cream);
    padding: 12px;
    border-radius: 12px;
    font-size: 12px;
  }
</style>
