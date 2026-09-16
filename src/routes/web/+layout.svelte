<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    PawPrint,
    Map,
    Heart,
    House,
    Info,
    LogIn,
    LogOut,
    Search,
    X,
    Smartphone,
    MapPin,
    ArrowRight,
    ArrowUpRight
  } from '@lucide/svelte';
  import { WebStore, setWebStore } from '$lib/web/store.svelte';
  import type { LayoutData } from './$types';
  import './web.css';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const store = setWebStore(untrack(() => new WebStore(data)));
  let loginDialog: HTMLDialogElement;
  let infoDialog: HTMLDialogElement;
  store.requestLogin = () => loginDialog?.showModal();

  const path = $derived(page.url.pathname.replace(/\/+$/, '') || '/');
  const isLanding = $derived(path === '/web');
  const nav = [
    { href: '/web/explore', label: '지도 탐색', icon: Map },
    { href: '/web/favorites', label: '찜한 장소', icon: Heart },
    { href: '/web/dog', label: '우리 강아지', icon: PawPrint }
  ];

  function selectMode(next: 'all' | 'dog') {
    if (next === 'dog' && !store.dog) goto('/web/dog');
    else store.mode = next;
  }
  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    if (path !== '/web/explore') goto('/web/explore');
  }
  function accountAction() {
    if (store.loggedIn) store.logout();
    else loginDialog.showModal();
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
          ><PawPrint size={30} fill="currentColor" strokeWidth={1} /></a
        >
        <a class="rail-link" class:active={path === '/web'} href="/web"
          ><House size={26} /><span>메인</span></a
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
          <span class="city-badge"><MapPin size={15} />강원 · 강릉</span>
          <form class="header-search" role="search" onsubmit={submitSearch}>
            <Search size={21} /><input
              aria-label="장소 검색"
              placeholder="강릉에서 어디로 갈까요? 장소명이나 동네를 검색해 보세요"
              bind:value={store.query}
            />{#if store.query}<button
                type="button"
                class="icon-button"
                aria-label="검색어 지우기"
                onclick={() => (store.query = '')}><X size={18} /></button
              >{/if}
          </form>
          <div class="header-right">
            <div class="mode-switch" aria-label="탐색 기준">
              <button
                class:active={store.mode === 'all'}
                aria-pressed={store.mode === 'all'}
                onclick={() => selectMode('all')}>전체</button
              ><button
                class:active={store.mode === 'dog'}
                aria-pressed={store.mode === 'dog'}
                onclick={() => selectMode('dog')}
                ><PawPrint size={15} />{store.dog ? store.dog.name + '와 함께' : '우리 강아지'}</button
              >
            </div>
            <a class="dog-chip" href="/web/dog"
              ><PawPrint size={15} />{store.dog
                ? `${store.dog.name} · ${store.dog.weight}kg`
                : '강아지 등록'}</a
            >
            <a class="mobile-link" href="/" title="모바일 앱 화면으로 보기"
              ><Smartphone size={17} /><span>모바일 버전</span></a
            >
            <a class="home-button" href="/web" aria-label="메인 화면으로" title="메인 화면"
              ><House size={22} /></a
            >
          </div>
        </header>

        <div class="web-content">
          {@render children()}
        </div>
      </div>
    </div>
  {/if}

  <dialog bind:this={loginDialog} class="app-dialog" aria-labelledby="web-login-title">
    <button
      class="dialog-close icon-button"
      aria-label="로그인 안내 닫기"
      onclick={() => loginDialog.close()}><X size={22} /></button
    >
    <div class="dialog-icon"><PawPrint size={32} strokeWidth={1.3} /></div>
    <span class="dialog-eyebrow">YOUR NEXT WALK STARTS HERE</span>
    <h2 id="web-login-title">우리의 다음 외출을 저장해요</h2>
    <p class="dialog-description">
      마음에 든 장소를 찜하고,<br />우리 강아지 정보를 간편하게 꺼내보세요.
    </p>
    <div class="login-benefits">
      <span><Heart size={19} />가고 싶은 장소 모아두기</span><span
        ><PawPrint size={19} />반려견 프로필 저장하기</span
      >
    </div>
    {#if data.authEnabled}<a
        class="kakao-button"
        href={`/auth/kakao?return=${encodeURIComponent(path)}`}>카카오로 계속하기</a
      >{:else}<button class="kakao-button" disabled>카카오 로그인 · 준비 중</button>{/if}
    <p class="form-footnote">지금은 로그인 없이 모든 장소와 규정을 볼 수 있어요.</p>
    <button class="text-button" onclick={() => loginDialog.close()}
      >먼저 둘러볼게요<ArrowRight size={16} /></button
    >
  </dialog>

  <dialog bind:this={infoDialog} class="app-dialog" aria-labelledby="web-info-title">
    <button
      class="dialog-close icon-button"
      aria-label="데이터 안내 닫기"
      onclick={() => infoDialog.close()}><X size={22} /></button
    >
    <div class="dialog-icon"><Info size={29} /></div>
    <h2 id="web-info-title">어떤 정보를 보여주나요?</h2>
    <p class="dialog-description">
      강원 반려동물 동반관광 공공데이터에서<br />강릉의 동반 장소 {data.places.length}건을
      가져왔어요.
    </p>
    <div class="info-copy">
      <p>
        수집일은 2026년 9월 10일이에요. 개별 규정의 최근 확인일은 제공되지 않아, 방문 전 시설에
        다시 확인하는 것이 좋아요.
      </p>
      <p>
        ‘우리 강아지’에서 체중을 비교할 수 있지만, 제한 체중만으로 입장을 보장하지 않아요. 준비물과
        허용 구역도 함께 살펴보세요.
      </p>
    </div>
    <a
      href="https://www.pettravel.kr/petapi/data/total"
      target="_blank"
      rel="noreferrer"
      class="secondary-button">공식 데이터 보기<ArrowUpRight size={17} /></a
    >
  </dialog>

  {#if store.toast}<div class="toast" role="status"><PawPrint size={18} />{store.toast}</div>{/if}
</div>

<style>
  /* ---------- 앱 틀 ---------- */
  .web-app {
    display: flex;
    width: 100%;
    height: 100dvh;
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
    background: linear-gradient(180deg, var(--crimson-deep) 0%, #5c2028 60%, var(--brown-deep) 100%);
    color: #f6e6dc;
    overflow-y: auto;
  }
  .rail-brand {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border-radius: 18px;
    background: #ffffff1f;
    color: #fff;
    margin-bottom: 16px;
    transform: rotate(-6deg);
    flex-shrink: 0;
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
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.3px;
    text-decoration: none;
    text-align: center;
    line-height: 1.25;
    transition: background 0.15s;
    flex-shrink: 0;
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
    color: var(--crimson);
  }
  .header-brand span {
    font-size: 12.5px;
    color: var(--muted);
    margin-top: 3px;
  }
  .city-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--brown-warm);
    background: var(--sand);
    border-radius: 22px;
    padding: 9px 14px;
    white-space: nowrap;
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
    color: var(--crimson);
  }
  .header-search:focus-within {
    background: #fff;
    border-color: var(--crimson);
    box-shadow: 0 0 0 4px #9e2b3b1a;
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
  .mode-switch {
    display: flex;
    padding: 4px;
    background: var(--sand);
    border-radius: 24px;
  }
  .mode-switch button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    font-size: 14.5px;
    border: 0;
    background: none;
    color: var(--muted);
    padding: 6px 18px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .mode-switch button.active {
    background: var(--crimson);
    color: #fff;
    font-weight: 600;
  }
  .dog-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 0 18px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    color: var(--crimson);
    font-size: 14.5px;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
  }
  .dog-chip:hover {
    background: var(--crimson-soft);
    border-color: #efd6d9;
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
  .home-button {
    display: grid;
    place-items: center;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--crimson);
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 4px 14px #9e2b3b33;
  }
  .home-button:hover {
    background: var(--crimson-deep);
  }

  /* ---------- 좁은 PC 화면 ---------- */
  @media (max-width: 1400px) {
    .mobile-link span,
    .header-brand span {
      display: none;
    }
  }
  @media (max-width: 1180px) {
    .city-badge,
    .dog-chip {
      display: none;
    }
  }
</style>
