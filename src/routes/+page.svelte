<script lang="ts">
  import { onMount } from 'svelte';
  import { sheetDrag } from '$lib/actions/sheetDrag';
  import { invalidateAll } from '$app/navigation';
  import {
    PawPrint,
    Map,
    Heart,
    UserRound,
    Search,
    ChevronDown,
    ArrowUpRight,
    SlidersHorizontal,
    Coffee,
    House,
    Trees,
    Sparkles,
    X,
    ArrowRight,
    Plus,
    List,
    Info,
    LogIn
  } from '@lucide/svelte';
  import PlaceCard from '$lib/components/PlaceCard.svelte';
  import PlaceDetail from '$lib/components/PlaceDetail.svelte';
  import MapView from '$lib/components/MapView.svelte';
  import DogDialog from '$lib/components/DogDialog.svelte';
  import {
    searchPlaces,
    profileNotice,
    type Category,
    type DogProfile,
    type Place
  } from '$lib/domain/place';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let query = $state('');
  let category = $state<Category>('all');
  let selected = $state<Place | null>(null);
  let dog = $state<DogProfile | null>(null);
  let mode = $state<'all' | 'dog'>('all');
  let dogDialog = $state(false);
  let sheetExpanded = $state(false);
  let showFilters = $state(false);
  let weightInfoOnly = $state(false);
  let hideKnownMismatch = $state(false);
  let loginDialog: HTMLDialogElement;
  let infoDialog: HTMLDialogElement;
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout>;
  let savedIds = $state<string[]>([]);
  let favoritesOnly = $state(false);
  let saving = $state(false);
  let offline = $state(false);
  const categories = [
    { id: 'all', label: '전체', icon: Map },
    { id: 'food', label: '카페·음식점', icon: Coffee },
    { id: 'stay', label: '숙소', icon: House },
    { id: 'outdoor', label: '관광·산책', icon: Trees },
    { id: 'activity', label: '체험', icon: Sparkles }
  ];
  const filtered = $derived(
    searchPlaces(data.places, query, category).filter((place) => {
      if (favoritesOnly && !savedIds.includes(place.id)) return false;
      if (weightInfoOnly && place.sourceWeight === null) return false;
      if (
        mode === 'dog' &&
        dog &&
        hideKnownMismatch &&
        profileNotice(place, dog).kind === 'restricted'
      )
        return false;
      return true;
    })
  );
  const filterCount = $derived(
    Number(weightInfoOnly) + Number(hideKnownMismatch && mode === 'dog')
  );
  function login() {
    loginDialog.showModal();
  }
  function notify(text: string) {
    toast = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 4500);
  }
  function pick(place: Place) {
    selected = place;
  }
  async function write(url: string, value: unknown) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }
  async function applyDog(profile: DogProfile) {
    dog = profile;
    mode = 'dog';
    hideKnownMismatch = true;
    dogDialog = false;
    if (data.user) {
      try {
        await write('/api/profile', profile);
        notify(`${profile.name}의 프로필을 저장했어요.`);
      } catch (error) {
        notify(error instanceof Error ? error.message : '프로필을 저장하지 못했어요.');
      }
    } else notify(`${profile.name}의 정보를 이번 탐색에 적용했어요.`);
  }
  async function savePlace(place: Place) {
    if (!data.user) {
      login();
      return;
    }
    if (saving) return;
    saving = true;
    const saved = !savedIds.includes(place.id);
    try {
      await write('/api/favorites', { placeId: place.id, saved });
      savedIds = saved ? [...savedIds, place.id] : savedIds.filter((id) => id !== place.id);
      notify(saved ? '찜한 장소에 저장했어요.' : '찜한 장소에서 지웠어요.');
    } catch (error) {
      notify(error instanceof Error ? error.message : '저장하지 못했어요.');
    } finally {
      saving = false;
    }
  }
  function showFavorites() {
    if (!data.user) {
      login();
      return;
    }
    resetFilters();
    favoritesOnly = true;
    selected = null;
    sheetExpanded = true;
  }
  async function accountAction() {
    if (!data.user) {
      login();
      return;
    }
    try {
      const response = await fetch('/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      await invalidateAll();
      savedIds = [];
      dog = null;
      mode = 'all';
      favoritesOnly = false;
      notify('로그아웃했어요.');
    } catch {
      notify('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');
    }
  }
  function selectMode(next: 'all' | 'dog') {
    if (next === 'dog' && !dog) dogDialog = true;
    else mode = next;
  }
  function resetFilters() {
    query = '';
    category = 'all';
    weightInfoOnly = false;
    hideKnownMismatch = false;
    favoritesOnly = false;
  }
  onMount(() => {
    savedIds = [...data.favorites];
    dog = data.profile;
    if (data.accountUnavailable)
      notify('계정 정보를 불러오지 못했어요. 장소 탐색은 계속 이용할 수 있어요.');
    const status = () => (offline = !navigator.onLine);
    status();
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    return () => {
      clearTimeout(toastTimer);
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  });
</script>

<svelte:head
  ><title>댕브리웨어 — 강아지와 함께, 강릉</title><meta
    name="description"
    content="강릉에서 강아지와 함께 갈 수 있는 카페, 숙소, 관광지. 체중 제한부터 실내외 동반 규정까지, 떠나기 전에 확인하세요."
  /></svelte:head
>
<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') {
      selected = null;
      showFilters = false;
    }
  }}
/>

<div class="map-app">
  <main class="map-workspace" aria-label="강릉 반려견 동반 장소 탐색">
    <h1 class="sr-only">댕브리웨어 · 강릉 반려견 동반 지도</h1>
    <div class="map-stage">
      <MapView places={filtered} selectedId={selected?.id ?? null} onselect={pick} appLayout />
    </div>

    <section class="app-toolbar" aria-label="장소 검색과 필터">
      <div class="app-topline">
        <a class="compact-brand" href="/" aria-label="댕브리웨어 홈"
          ><PawPrint size={20} fill="currentColor" strokeWidth={1} /><strong>댕브리웨어</strong></a
        >
        <span class="city-label">강릉</span>
        <button
          class="toolbar-account icon-button"
          onclick={accountAction}
          aria-label={data.user ? '로그아웃' : '로그인'}><UserRound size={21} /></button
        >
      </div>
      <div class="app-search-row">
        <div class="app-search">
          <Search size={20} /><input
            aria-label="장소 검색"
            placeholder="강릉에서 어디로 갈까요?"
            bind:value={query}
            oninput={(event) => {
              selected = null;
              if (event.currentTarget.value) sheetExpanded = true;
            }}
          />{#if query}<button
              class="icon-button"
              aria-label="검색어 지우기"
              onclick={() => (query = '')}><X size={17} /></button
            >{/if}
        </div>
        <button
          class="app-filter"
          class:active={showFilters || filterCount > 0}
          onclick={() => (showFilters = !showFilters)}
          aria-label="상세 필터"
          aria-expanded={showFilters}
          ><SlidersHorizontal size={20} />{#if filterCount}<span>{filterCount}</span>{/if}</button
        >
      </div>
      <div class="app-categories" aria-label="장소 유형">
        {#each categories as item}<button
            class:active={category === item.id}
            aria-pressed={category === item.id}
            onclick={() => {
              category = item.id as Category;
              selected = null;
            }}><item.icon size={16} />{item.label}</button
          >{/each}
      </div>
      <div class="app-dog-row">
        <div class="app-mode-switch" aria-label="탐색 기준">
          <button
            class:active={mode === 'all'}
            aria-pressed={mode === 'all'}
            onclick={() => selectMode('all')}>전체</button
          ><button
            class:active={mode === 'dog'}
            aria-pressed={mode === 'dog'}
            onclick={() => selectMode('dog')}
            ><PawPrint size={13} />{dog ? dog.name + '와 함께' : '우리 강아지'}</button
          >
        </div>
        <button class="profile-chip" onclick={() => (dogDialog = true)}
          >{#if dog}{dog.weight}kg · 수정{:else}<Plus size={13} />강아지 등록{/if}</button
        >
      </div>
      {#if showFilters}<div class="app-filter-options">
          <div>
            <strong>동반 조건</strong><button
              class="icon-button"
              aria-label="필터 닫기"
              onclick={() => (showFilters = false)}><X size={17} /></button
            >
          </div>
          <label
            ><input type="checkbox" bind:checked={weightInfoOnly} />제한 체중이 기재된 장소</label
          >
          {#if mode === 'dog' && dog}<label
              ><input type="checkbox" bind:checked={hideKnownMismatch} />원본의 체중·체급 제한에
              맞지 않는 곳 제외</label
            >{/if}
          <p>
            필터 결과도 방문 가능을 보장하지 않아요.<br />허용 구역과 준비물을 함께 확인해 주세요.
          </p>
          <button
            class="text-button"
            onclick={() => {
              weightInfoOnly = false;
              hideKnownMismatch = false;
            }}>필터 초기화</button
          >
        </div>{/if}
    </section>

    {#if offline}<div class="app-offline" role="status">
        오프라인 · 최신 규정을 확인할 수 없어요.
      </div>{/if}

    <aside
      class="place-sheet"
      class:expanded={sheetExpanded}
      class:covered={selected !== null}
      aria-label="장소 목록"
    >
      <button
        class="sheet-handle"
        aria-label={sheetExpanded ? '장소 목록 접기' : '장소 목록 펼치기'}
        aria-expanded={sheetExpanded}
        use:sheetDrag={{ onSnap: (expanded) => (sheetExpanded = expanded) }}
        onclick={() => (sheetExpanded = !sheetExpanded)}><span></span></button
      >
      <div class="sheet-heading">
        <div>
          <h2>{favoritesOnly ? '찜한 장소' : '함께 갈 곳'} <span>{filtered.length}</span></h2>
          <p>
            {mode === 'dog' && dog
              ? dog.name + '의 체중·체급 조건 적용 중'
              : '강릉 · 동반 규정을 확인해 보세요'}
          </p>
        </div>
        <button
          class="sheet-expand icon-button"
          onclick={() => (sheetExpanded = !sheetExpanded)}
          aria-label={sheetExpanded ? '지도 넓게 보기' : '목록 크게 보기'}
          >{#if sheetExpanded}<ChevronDown size={21} />{:else}<List size={20} />{/if}</button
        >
        <button
          class="sheet-info icon-button"
          onclick={() => infoDialog.showModal()}
          aria-label="데이터 안내"><Info size={18} /></button
        >
      </div>
      <div class="sheet-results">
        {#each filtered as place (place.id)}<PlaceCard
            {place}
            selected={selected?.id === place.id}
            saved={savedIds.includes(place.id)}
            onselect={() => pick(place)}
            onsave={() => savePlace(place)}
          />{/each}
        {#if !filtered.length}<div class="empty-state">
            <Search size={30} strokeWidth={1} />
            <h3>{favoritesOnly ? '아직 찜한 장소가 없어요' : '조건에 맞는 장소가 없어요'}</h3>
            <p>
              {favoritesOnly
                ? '마음에 드는 장소의 하트를 눌러보세요.'
                : '검색어나 필터를 바꿔보세요.'}
            </p>
            <button class="secondary-button" onclick={resetFilters}>전체 장소 보기</button>
          </div>{/if}
        <div class="sheet-footer">
          <span>강원 반려동물 동반관광 데이터</span><button onclick={() => infoDialog.showModal()}
            >출처·확인일<ArrowUpRight size={12} /></button
          >
        </div>
      </div>
    </aside>

    {#if selected}<PlaceDetail
        place={selected}
        {dog}
        saved={savedIds.includes(selected.id)}
        onclose={() => (selected = null)}
        onsave={() => selected && savePlace(selected)}
        appLayout
      />{/if}
  </main>

  <nav class="app-bottom-nav" aria-label="모바일 메뉴">
    <button
      class:active={!favoritesOnly}
      onclick={() => {
        selected = null;
        favoritesOnly = false;
        sheetExpanded = false;
      }}><Map size={23} /><span>탐색</span></button
    >
    <button class:active={favoritesOnly} onclick={showFavorites}
      ><Heart size={23} /><span>찜한 장소</span></button
    >
    <button onclick={() => (dogDialog = true)}
      ><PawPrint size={23} /><span>우리 강아지</span></button
    >
  </nav>
</div>

{#if dogDialog}<DogDialog {dog} onclose={() => (dogDialog = false)} onapply={applyDog} />{/if}
<dialog bind:this={loginDialog} class="app-dialog login-dialog" aria-labelledby="login-title">
  <button
    class="dialog-close icon-button"
    aria-label="로그인 안내 닫기"
    onclick={() => loginDialog.close()}><X size={21} /></button
  >
  <div class="dialog-icon"><PawPrint size={30} strokeWidth={1.3} /></div>
  <span class="dialog-eyebrow">YOUR NEXT WALK STARTS HERE</span>
  <h2 id="login-title">우리의 다음 외출을 저장해요</h2>
  <p class="dialog-description">
    마음에 든 장소를 찜하고,<br />우리 강아지 정보를 간편하게 꺼내보세요.
  </p>
  <div class="login-benefits">
    <span><Heart size={17} />가고 싶은 장소 모아두기</span><span
      ><PawPrint size={17} />반려견 프로필 저장하기</span
    >
  </div>
  {#if data.authEnabled}<a class="kakao-button" href="/auth/kakao">카카오로 계속하기</a
    >{:else}<button class="kakao-button" disabled>카카오 로그인 · 준비 중</button>{/if}
  <p class="form-footnote">지금은 로그인 없이 모든 장소와 규정을 볼 수 있어요.</p>
  <button class="text-button" onclick={() => loginDialog.close()}
    >먼저 둘러볼게요<ArrowRight size={14} /></button
  >
</dialog>
<dialog bind:this={infoDialog} class="app-dialog" aria-labelledby="info-title">
  <button
    class="dialog-close icon-button"
    aria-label="데이터 안내 닫기"
    onclick={() => infoDialog.close()}><X size={21} /></button
  >
  <div class="dialog-icon"><Info size={27} /></div>
  <h2 id="info-title">어떤 정보를 보여주나요?</h2>
  <p class="dialog-description">
    강원 반려동물 동반관광 공공데이터에서<br />강릉의 동반 장소 81건을 가져왔어요.
  </p>
  <div class="info-copy">
    <p>
      수집일은 2026년 9월 10일이에요. 개별 규정의 최근 확인일은 제공되지 않아, 방문 전 시설에 다시
      확인하는 것이 좋아요.
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
    class="secondary-button">공식 데이터 보기<ArrowUpRight size={16} /></a
  >
</dialog>
{#if toast}<div class="toast" role="status"><PawPrint size={16} />{toast}</div>{/if}
