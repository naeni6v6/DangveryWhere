<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    PawPrint,
    Map,
    MapPinned,
    Heart,
    Info,
    LogIn,
    LogOut,
    Search,
    X,
    Smartphone,
    ArrowUpRight
  } from '@lucide/svelte';
  import { providerInfo } from '$lib/domain/region';
  import { WebStore, setWebStore } from '$lib/web/store.svelte';
  import RegionPicker from '$lib/components/web/RegionPicker.svelte';
  import WebLoginDialog from '$lib/components/web/WebLoginDialog.svelte';
  import type { LayoutData } from './$types';
  import './web.css';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const store = setWebStore(untrack(() => new WebStore(data)));
  let loginDialog: WebLoginDialog;
  let infoDialog: HTMLDialogElement;
  store.requestLogin = () => loginDialog?.open();

  const hospitalCount = $derived(
    data.places.filter((place) => place.category === 'hospital').length
  );
  const companionCount = $derived(data.places.length - hospitalCount);
  // 다루는 지역과 출처는 지금 고른 지역에서 끌어옵니다. 지역을 바꾸면 안내 문구도 따라와요.
  const region = $derived(data.regions.find((item) => item.id === data.regionId) ?? data.regions[0]);
  const area = $derived(region.label);
  const sources = $derived(region.sources.map((id) => providerInfo[id]));
  const collectedAt = $derived(
    data.places
      .map((place) => place.importedAt)
      .sort()
      .at(-1)
      ?.replaceAll('-', '.') ?? ''
  );
  const path = $derived(page.url.pathname.replace(/\/+$/, '') || '/');
  const isLanding = $derived(path === '/web');
  const nav = [
    { href: '/web/dog', label: '우리 강아지', icon: PawPrint },
    { href: '/web/explore', label: '가게 찾기', icon: Map },
    { href: '/web/record', label: '지도 기록', icon: MapPinned },
    { href: '/web/favorites', label: '찜한 장소', icon: Heart }
  ];

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    if (path !== '/web/explore') goto('/web/explore');
  }
  function accountAction() {
    if (store.loggedIn) store.logout();
    else loginDialog.open();
  }
  $effect(() => {
    if (data.accountUnavailable)
      untrack(() => store.notify('계정 정보를 불러오지 못했어요. 장소 탐색은 계속 이용할 수 있어요.'));
  });
</script>

<div class="web-root">
  {#if isLanding}
    {@render children()}
  {:else}
    <div class="web-app">
      <!-- 왼쪽 세로 메뉴 -->
      <nav class="web-rail" aria-label="주 메뉴">
        <a class="rail-brand" href="/web" aria-label="댕브리웨어 메인" title="메인 화면"
          ><img src="/logo.png" alt="" width="58" height="58" /></a
        >
        {#each nav as item (item.href)}<a
            class="rail-link"
            class:active={path.startsWith(item.href)}
            aria-current={path.startsWith(item.href) ? 'page' : undefined}
            href={item.href}><item.icon size={26} /><span>{item.label}</span></a
          >{/each}
        <div class="rail-spacer"></div>
        <button class="rail-link" onclick={() => infoDialog.showModal()}
          ><Info size={25} /><span>데이터 안내</span></button
        >
        <button class="rail-link" class:signed-in={store.loggedIn} onclick={accountAction}
          >{#if store.loggedIn}<LogOut size={25} /><span>로그아웃</span>{:else}<LogIn
              size={25}
            /><span>로그인</span>{/if}</button
        >
      </nav>

      <div class="web-main">
        <!-- 상단 헤더 -->
        <header class="web-header">
          <a class="header-brand" href="/web">
            <strong>댕브리웨어</strong>
            <span>DangveryWhere · 반려견 동반 지도</span>
          </a>
          <RegionPicker regions={data.regions} regionId={data.regionId} />
          <form class="header-search" role="search" onsubmit={submitSearch}>
            <Search size={21} /><input
              aria-label="장소 검색"
              placeholder="어디로 갈까요? 장소명이나 동네를 검색해 보세요"
              bind:value={store.query}
            />{#if store.query}<button
                type="button"
                class="icon-button"
                aria-label="검색어 지우기"
                onclick={() => (store.query = '')}><X size={18} /></button
              >{/if}
          </form>
          <div class="header-right">
            <a class="mobile-link" href="/" title="모바일 앱 화면으로 보기"
              ><Smartphone size={17} /><span>모바일 버전</span></a
            >
            <button class="login-cta" class:signed-in={store.loggedIn} onclick={accountAction}
              >{#if store.loggedIn}<LogOut size={17} />로그아웃{:else}<LogIn size={17} />로그인하기{/if}</button
            >
          </div>
        </header>

        <div class="web-content">
          {@render children()}
        </div>
      </div>
    </div>
  {/if}

  <WebLoginDialog
    bind:this={loginDialog}
    kakaoEnabled={data.authEnabled}
    returnPath={path}
    onpending={(provider) => store.notify(`${provider} 로그인은 준비 중이에요. 곧 연결할게요!`)}
  />

  <dialog bind:this={infoDialog} class="app-dialog" aria-labelledby="web-info-title">
    <button
      class="dialog-close icon-button"
      aria-label="데이터 안내 닫기"
      onclick={() => infoDialog.close()}><X size={22} /></button
    >
    <div class="dialog-icon"><Info size={29} /></div>
    <h2 id="web-info-title">어떤 정보를 보여주나요?</h2>
    <p class="dialog-description">
      {sources.map((source) => source.shortName).join(' · ')} 공공데이터에서<br />{area} 동반 장소
      {companionCount}건{#if hospitalCount}과 동물병원 {hospitalCount}곳{/if}을 가져왔어요.
    </p>
    <div class="info-copy">
      <p>
        {collectedAt} 에 받아 온 자료예요. 개별 규정의 최근 확인일은 제공되지 않아, 방문 전 시설에
        다시 확인하는 것이 좋아요.
      </p>
      {#if region.status !== 'active'}
        <p>
          {region.status === 'mixed' ? '강릉을 뺀 여덟 지역은' : area + '는'} 아직
          <strong>준비 데이터</strong>예요. 공공데이터 원문을 그대로 옮겨 둔 것이라 업체에 다시
          확인하지 않았고, 출처가 둘인 곳은 양쪽 문장을 모두 보여줍니다.
        </p>
      {/if}
      <p>
        ‘우리 강아지’에서 체중을 비교할 수 있지만, 제한 체중만으로 입장을 보장하지 않아요. 준비물과
        허용 구역도 함께 살펴보세요.
      </p>
    </div>
    <div class="info-sources">
      {#each sources as source (source.url)}
        <a href={source.url} target="_blank" rel="noreferrer" class="secondary-button"
          >{source.name}<ArrowUpRight size={17} /></a
        >
      {/each}
    </div>
  </dialog>

  {#if store.toast}<div class="toast" role="status"><PawPrint size={18} />{store.toast}</div>{/if}
</div>

<style>
  /* ---------- 앱 틀 ---------- */
  .web-app {
    display: flex;
    width: 100%;
    /* UI 배율(--ui-zoom)만큼 확대되므로 화면 높이는 배율로 나눠 줍니다. */
    height: calc(100dvh / var(--ui-zoom, 1));
    min-height: 640px;
    background: var(--cream);
    overflow: hidden;
  }
  .web-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .web-content {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* ---------- 왼쪽 세로 메뉴 ---------- */
  .web-rail {
    width: var(--rail-w);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 18px 10px 20px;
    /* 예전에는 밝은 브라운 → 진한 갈색까지 명도 차이가 커서 띠가 눈에 보였어요.
       같은 색 안에서 아주 조금만 어두워지게 두면 면이 평평하게 읽힙니다. */
    background: linear-gradient(180deg, #9d6144 0%, #8e5439 100%);
    color: #f6e6dc;
    overflow-y: auto;
    /* 옆 화면 위로 얕게 드리우는 그림자. 진한 한 겹 대신 옅은 세 겹을 포개
       경계는 또렷하고 번짐은 부드럽게 — 색이 아니라 깊이로 구분되게 했습니다. */
    position: relative;
    z-index: 2;
    box-shadow:
      1px 0 0 #4a34280f,
      4px 0 12px #4a342812,
      16px 0 36px #4a34280f;
  }
  .rail-brand {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    margin-bottom: 16px;
    transform: rotate(-6deg);
    flex-shrink: 0;
    transition: transform 0.2s;
  }
  .rail-brand:hover {
    transform: rotate(-6deg) scale(1.05);
  }
  .rail-brand img {
    width: 100%;
    height: 100%;
    /* 로고(assets/logo.png)가 브라운 레일 위에서도 또렷하게 보이도록 */
    filter: drop-shadow(0 0 1.5px #ffffffb3) drop-shadow(0 6px 12px #2a18104d);
  }
  .rail-link {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 15px 4px 13px;
    border: 0;
    border-radius: 16px;
    background: none;
    color: #efd6cf;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: -0.5px;
    text-decoration: none;
    text-align: center;
    line-height: 1.25;
    transition: background 0.15s;
    flex-shrink: 0;
    /* '우리 강아지 등록' 처럼 긴 메뉴명도 한 줄로 */
    white-space: nowrap;
  }
  .rail-link:hover {
    background: #ffffff17;
    color: #fff;
  }
  .rail-link.active {
    background: #ffffff26;
    color: #fff;
    font-weight: 700;
    box-shadow: inset 3px 0 0 var(--gold);
  }
  .rail-link.signed-in {
    color: #ffd9c2;
  }
  .rail-spacer {
    flex: 1;
    min-height: 12px;
  }

  /* ---------- 상단 헤더 ---------- */
  .web-header {
    height: var(--header-h);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 26px 0 28px;
    background: #fff;
    border-bottom: 1px solid var(--line);
  }
  .header-brand {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    white-space: nowrap;
    text-decoration: none;
  }
  .header-brand strong {
    font-size: 24px;
    letter-spacing: -1px;
    color: var(--brand);
  }
  .header-brand span {
    font-size: 12.5px;
    color: var(--muted);
    margin-top: 3px;
  }
  .info-sources {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
  .header-search {
    flex: 1;
    min-width: 220px;
    max-width: 680px;
    height: 54px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--cream);
    color: var(--brand);
  }
  .header-search:focus-within {
    background: #fff;
    border-color: var(--brand);
    box-shadow: 0 0 0 4px #b5704e26;
  }
  .header-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: none;
    outline: none;
    font-size: 16px;
    color: var(--ink);
  }
  .header-search input::placeholder {
    color: #b0a196;
  }
  .header-search .icon-button {
    width: 32px;
    height: 32px;
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mobile-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
    text-decoration: none;
    padding: 10px 12px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .mobile-link:hover {
    background: var(--sand);
    color: var(--brown-warm);
  }
  /* 헤더 맨 오른쪽 로그인 버튼 */
  .login-cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 48px;
    padding: 0 22px;
    border: 0;
    border-radius: 24px;
    background: var(--brand);
    color: #fff;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: 0 4px 14px #b5704e3d;
    transition: background 0.15s;
  }
  .login-cta:hover {
    background: var(--brand-deep);
  }
  .login-cta.signed-in {
    background: #fff;
    color: var(--brand);
    border: 1px solid var(--line);
    box-shadow: none;
  }
  .login-cta.signed-in:hover {
    background: var(--brand-soft);
  }

  /* ---------- 좁은 PC 화면 ---------- */
  @media (max-width: 1400px) {
    .mobile-link span,
    .header-brand span {
      display: none;
    }
  }
  @media (max-width: 1180px) {
    .web-header :global(.region-picker) {
      display: none;
    }
  }
</style>
