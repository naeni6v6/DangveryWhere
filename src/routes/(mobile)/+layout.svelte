<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import {
    Home,
    Map,
    Heart,
    Stamp,
    PawPrint,
    LogIn,
    CircleCheck,
    WifiOff,
    Sparkles
  } from '@lucide/svelte';
  import { WebStore, setWebStore } from '$lib/web/store.svelte';
  import { canonicalPlaceId } from '$lib/domain/placeIdentity';
  import MobileLoginDialog from '$lib/components/mobile/MobileLoginDialog.svelte';
  import InstallApp from '$lib/components/mobile/InstallApp.svelte';
  import AppTutorial from '$lib/components/mobile/AppTutorial.svelte';
  import ReadableText from '$lib/components/mobile/ReadableText.svelte';
  import type { LayoutData } from './$types';
  import './mobile.css';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const store = setWebStore(untrack(() => new WebStore(data)));
  let loginDialog: MobileLoginDialog;
  let offline = $state(false);
  const path = $derived(page.url.pathname.replace(/\/+$/, '') || '/');
  const isTutorial = $derived(path.startsWith('/start'));
  const isMap = $derived(path === '/explore');
  const selectedPlaceId = $derived(
    page.state.mobilePlaceId !== undefined
      ? page.state.mobilePlaceId
      : page.url.searchParams.get('place')
  );
  const isPlaceDetail = $derived(
    isMap && data.places.some((place) => place.id === canonicalPlaceId(selectedPlaceId ?? ''))
  );
  const nav = [
    { href: '/mobile', label: '홈', icon: Home },
    { href: '/dog', label: '우리 강아지', icon: PawPrint },
    { href: '/explore', label: '매장 찾기', icon: Map },
    { href: '/record', label: '댕스탬프', icon: Stamp },
    { href: '/favorites', label: '찜', icon: Heart }
  ];
  store.requestLogin = () => loginDialog?.open();
  onMount(() => {
    const update = () => (offline = !navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (data.accountUnavailable)
      store.notify('계정 정보를 불러오지 못했어요. 잠시 후 다시 연결해 주세요.');
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  });
</script>

<svelte:head>
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="댕브리웨어" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

<div
  class="mobile-root"
  class:mobile-map={isMap}
  class:mobile-onboarding={isTutorial}
  class:mobile-place-detail={isPlaceDetail}
>
  <a class="mobile-skip" href="#mobile-main">본문으로 건너뛰기</a>
  {#if !isTutorial && !isPlaceDetail}
    <header class="mobile-header" class:with-tutorial={path === '/mobile'}>
      <a class="mobile-brand" href="/mobile" aria-label="댕브리웨어 홈">
        <img
          class="mobile-wordmark"
          src="/wordmark.png"
          alt="댕브리웨어"
          width="393"
          height="138"
        />
        <small>DangveryWhere · <span>반려견 동반 지도</span></small>
      </a>
      <div class="mobile-account-area" class:signed-in={store.loggedIn}>
        {#if path === '/mobile'}
          <a
            class="mobile-tutorial-link"
            href="/start?replay"
            aria-label="튜토리얼 보기"
            title="튜토리얼 보기"
          >
            <Sparkles size={17} aria-hidden="true" /><span>튜토리얼</span>
          </a>
        {/if}
        {#if store.loggedIn}
          <span
            class="mobile-login-status"
            role="status"
            aria-label={`${store.nickname}님 로그인됨`}
            title={`${store.nickname}님`}
          >
            <CircleCheck size={15} aria-hidden="true" /><span class="mobile-account-nickname"
              >{store.nickname}님</span
            >
          </span>
          <button class="mobile-account-logout" onclick={() => store.logout()}>로그아웃</button>
        {:else}
          <button class="mobile-account" onclick={() => store.requestLogin()}>
            <LogIn size={18} aria-hidden="true" /><span>로그인</span>
          </button>
        {/if}
      </div>
    </header>
  {/if}
  {#if offline}<div class="mobile-offline" role="status">
      <WifiOff size={16} />오프라인이에요. 최신 지도와 장소 정보는 연결 후 확인해 주세요.
    </div>{/if}
  <main id="mobile-main" class="mobile-main" tabindex="-1">
    {@render children()}
  </main>
  {#if !isTutorial}
    <nav class="mobile-tabs" aria-label="모바일 주 메뉴">
      {#each nav as item (item.href)}
        <a
          href={item.href}
          class:active={path === item.href}
          aria-current={path === item.href ? 'page' : undefined}
        >
          <span class="tab-icon"
            ><item.icon size={22} strokeWidth={path === item.href ? 2.3 : 1.7} /></span
          >
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  {/if}
  <MobileLoginDialog
    bind:this={loginDialog}
    authEnabled={data.authEnabled}
    kakaoEnabled={data.kakaoEnabled}
    returnPath={page.url.pathname + page.url.search}
  />
  <InstallApp />
  <AppTutorial enabled={!isTutorial && !isPlaceDetail} />
  {#if store.toast}<div class="mobile-toast" role="status">
      <PawPrint size={17} /><span><ReadableText text={store.toast} /></span>
    </div>{/if}
</div>
