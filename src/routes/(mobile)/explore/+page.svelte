<script lang="ts">
  import { page } from '$app/state';
  import { goto, pushState, replaceState } from '$app/navigation';
  import {
    Search,
    X,
    SlidersHorizontal,
    MapPin,
    List,
    Map,
    PawPrint,
    ChevronUp,
    ChevronDown,
    Info
  } from '@lucide/svelte';
  import MapView from '$lib/mobile/MapView.svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import MobilePlaceCard from '$lib/components/mobile/MobilePlaceCard.svelte';
  import PlaceSheet from '$lib/components/mobile/PlaceSheet.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import { themeNames, placeTheme, type ThemeFilter, type Place } from '$lib/domain/place';
  import { photoFirst } from '$lib/domain/placePhoto';
  import { directLinkFirst } from '$lib/domain/placeLink';
  import { providerInfo } from '$lib/domain/region';
  import type { PageData } from './$types';
  import '$lib/mobile/navigation';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  const allThemes: ThemeFilter[] = [
    'all',
    'cafe',
    'restaurant',
    'stay',
    'outdoor',
    'activity',
    'culture',
    'shopping',
    'hospital'
  ];
  const themes = $derived(
    allThemes.filter(
      (theme) =>
        theme === 'all' ||
        theme === store.category ||
        data.places.some((place) => placeTheme(place) === theme)
    )
  );
  const region = $derived(data.regions.find((item) => item.id === data.regionId)!);
  const filtered = $derived(photoFirst(directLinkFirst(store.filter(data.places))));
  const selectedId = $derived(
    page.state.mobilePlaceId !== undefined
      ? page.state.mobilePlaceId
      : page.url.searchParams.get('place')
  );
  const selected = $derived(data.places.find((place) => place.id === selectedId) ?? null);
  let expanded = $state(false);
  let limit = $state(20);
  let changingRegion = $state(false);
  let openedHere = false;
  let filters: HTMLDialogElement;
  let sources: HTMLDialogElement;
  $effect(() => {
    const theme = page.state.mobileCategory ?? page.url.searchParams.get('category');
    if (theme && allThemes.includes(theme as ThemeFilter)) store.category = theme as ThemeFilter;
  });
  $effect(() => {
    store.query;
    store.category;
    data.regionId;
    limit = 20;
  });

  function pick(place: Place) {
    const url = new URL(window.location.href);
    url.searchParams.set('place', place.id);
    pushState(url, { ...page.state, mobilePlaceId: place.id });
    openedHere = true;
  }
  function closePlace() {
    if (openedHere) {
      openedHere = false;
      history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('place');
      replaceState(url, { ...page.state, mobilePlaceId: null });
    }
  }
  function chooseTheme(theme: ThemeFilter) {
    store.category = theme;
    const url = new URL(window.location.href);
    url.searchParams.set('category', theme);
    url.searchParams.delete('place');
    replaceState(url, { ...page.state, mobilePlaceId: null, mobileCategory: theme });
  }
  async function changeRegion(event: Event) {
    changingRegion = true;
    const url = new URL(window.location.href);
    url.searchParams.set('region', (event.currentTarget as HTMLSelectElement).value);
    url.searchParams.delete('place');
    try {
      await goto(url, { noScroll: true, keepFocus: true });
    } finally {
      changingRegion = false;
    }
  }
  function reset() {
    store.resetFilters();
    chooseTheme('all');
  }
</script>

<svelte:head><title>{region.label} 장소 탐색 — 댕브리웨어</title></svelte:head>
<div class="mobile-explore">
  <section class="explore-toolbar" aria-label="장소 검색과 필터">
    <div class="explore-location">
      <label
        ><MapPin size={16} /><span class="sr-only">탐색 지역</span><select
          value={data.regionId}
          onchange={changeRegion}
          disabled={changingRegion}
          >{#each data.regions as item}<option value={item.id}>{item.label}</option>{/each}</select
        ></label
      ><button onclick={() => sources.showModal()} aria-label="장소 데이터 안내"
        ><Info size={17} /></button
      >
    </div>
    <form
      class="explore-search"
      role="search"
      onsubmit={(event) => {
        event.preventDefault();
        expanded = true;
      }}
    >
      <Search size={19} /><input
        aria-label="장소 검색"
        placeholder="장소 이름이나 동네를 검색해요"
        bind:value={store.query}
        oninput={() => (expanded = true)}
      />{#if store.query}<button
          type="button"
          aria-label="검색어 지우기"
          onclick={() => (store.query = '')}><X size={17} /></button
        >{/if}<button
        type="button"
        class:active={store.filterCount > 0}
        onclick={() => filters.showModal()}
        aria-label={`상세 필터${store.filterCount ? ` ${store.filterCount}개 적용` : ''}`}
        ><SlidersHorizontal size={21} />{#if store.filterCount}<b>{store.filterCount}</b
          >{/if}</button
      >
    </form>
    <div class="explore-themes" aria-label="장소 유형">
      {#each themes as theme}<button
          class:active={store.category === theme}
          aria-pressed={store.category === theme}
          onclick={() => chooseTheme(theme)}
          >{#if theme === 'all'}<Map size={15} />{:else}<ThemeIcon
              {theme}
              size={16}
            />{/if}{themeNames[theme]}</button
        >{/each}
    </div>
    <div class="explore-dogs">
      <button
        class:active={store.mode === 'dog'}
        onclick={() => {
          if (!store.dogs.length) goto('/dog');
          else {
            store.mode = store.mode === 'dog' ? 'all' : 'dog';
            store.hideKnownMismatch = store.mode === 'dog';
          }
        }}
        aria-pressed={store.mode === 'dog'}
        ><PawPrint size={14} />{store.dog
          ? `${store.dogNames} 기준`
          : '우리 강아지 등록'}<ChevronDown size={13} /></button
      ><span
        >{changingRegion ? '지역을 불러오는 중…' : `${filtered.length.toLocaleString()}곳`}</span
      >
    </div>
  </section>
  <div class="explore-canvas" class:expanded>
    <div class="explore-map" aria-hidden={expanded} inert={expanded}>
      <MapView
        places={filtered}
        selectedId={selected?.id ?? null}
        onselect={pick}
        regionId={data.regionId}
        appLayout
        padding={{ top: 24, right: 20, bottom: 190, left: 20 }}
        caption={store.category === 'hospital'
          ? '동물병원 위치 · 전화 후 방문하세요'
          : '반려견 동반 정보가 있는 장소'}
      />
    </div>
    <section class="explore-results" aria-label="장소 목록">
      <button
        class="results-toggle"
        onclick={() => (expanded = !expanded)}
        aria-expanded={expanded}
      >
        <span
          >{#if expanded}<Map size={17} />지도 보기{:else}<List size={17} />목록 보기{/if}<b
            >{filtered.length.toLocaleString()}</b
          ></span
        >{#if expanded}<ChevronDown size={19} />{:else}<ChevronUp size={19} />{/if}
      </button>
      <div class="results-scroll">
        {#if filtered.length}{#each filtered.slice(0, expanded ? limit : 2) as place (place.id)}<MobilePlaceCard
              {place}
              onselect={() => pick(place)}
            />{/each}{#if expanded && filtered.length > limit}<button
              class="more-places"
              onclick={() => (limit += 20)}
              >장소 더 보기 ({Math.min(limit, filtered.length)}/{filtered.length})<ChevronDown
                size={16}
              /></button
            >{/if}
        {:else}<div class="mobile-empty">
            <Search size={28} />
            <h2>조건에 맞는 장소가 없어요</h2>
            <p>검색어나 지역, 필터를 바꿔보세요.</p>
            <button class="secondary-button" onclick={reset}>검색·필터 초기화</button>
          </div>{/if}
      </div>
    </section>
  </div>
</div>

<dialog
  bind:this={filters}
  class="mobile-dialog filter-dialog"
  aria-labelledby="mobile-filter-title"
>
  <button class="mobile-close" onclick={() => filters.close()} aria-label="필터 닫기"
    ><X size={23} /></button
  >
  <h2 id="mobile-filter-title">우리에게 맞는 장소</h2>
  <p>알려진 동반 규정을 기준으로 골라요.</p>
  {#if store.dogs.length}<fieldset>
      <legend>함께 갈 강아지 <small>최대 2마리</small></legend>
      <div class="filter-dogs">
        {#each store.dogs as dog}<button
            class:active={store.isActive(dog.id)}
            aria-pressed={store.isActive(dog.id)}
            onclick={() => store.toggleDog(dog.id)}
            ><PawPrint size={16} />{dog.name}<small>{dog.weight}kg</small></button
          >{/each}
      </div>
    </fieldset>{:else}<a class="register-link" href="/dog"
      >우리 강아지 등록하기<ChevronUp size={14} /></a
    >{/if}
  <label class="filter-option"
    ><span><strong>체중 정보가 있는 곳</strong><small>원본에 제한 체중이 기재된 장소만</small></span
    ><input type="checkbox" bind:checked={store.weightInfoOnly} /></label
  >
  <label class="filter-option"
    ><span
      ><strong>우리 강아지의 제한 장소 제외</strong><small
        >{store.dogs.length
          ? '선택한 아이의 체중·체급 조건으로 비교'
          : '강아지를 먼저 등록해 주세요'}</small
      ></span
    ><input
      type="checkbox"
      checked={store.mode === 'dog' && store.hideKnownMismatch}
      disabled={!store.dogs.length}
      onchange={(event) => {
        store.hideKnownMismatch = event.currentTarget.checked;
        store.mode = event.currentTarget.checked ? 'dog' : 'all';
      }}
    /></label
  >
  <p class="filter-note">
    정보가 없는 곳은 입장 가능을 뜻하지 않아요. 방문 전 상세 규정을 확인해 주세요.
  </p>
  <div class="filter-actions">
    <button class="secondary-button" onclick={reset}>초기화</button><button
      class="primary-button"
      onclick={() => filters.close()}>{filtered.length}곳 보기</button
    >
  </div>
</dialog>
<dialog bind:this={sources} class="mobile-dialog" aria-labelledby="mobile-source-title">
  <button class="mobile-close" onclick={() => sources.close()} aria-label="데이터 안내 닫기"
    ><X size={23} /></button
  >
  <h2 id="mobile-source-title">장소 정보 안내</h2>
  <p class="mobile-page-lead">
    {region.label}의 공공데이터를 모았어요. 원문을 옮긴 정보로, 시설의 현재 운영 여부와 규정을 방문
    전에 확인해 주세요.
  </p>
  {#each region.sources as source}<p>
      <a href={providerInfo[source].url} target="_blank" rel="noreferrer"
        >{providerInfo[source].name}</a
      >
    </p>{/each}
</dialog>
{#if selected}{#key selected.id}<PlaceSheet place={selected} onclose={closePlace} />{/key}{/if}

<style>
  .mobile-explore {
    height: calc(100dvh - var(--mobile-header-height) - var(--mobile-tab-height));
    min-height: 460px;
    display: flex;
    flex-direction: column;
  }
  .explore-toolbar {
    flex-shrink: 0;
    padding: 0 16px 10px;
    background: #fffdf9;
    z-index: 15;
  }
  .explore-location {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 35px;
    margin-bottom: 5px;
  }
  .explore-location label {
    display: flex;
    gap: 4px;
    align-items: center;
    color: var(--brown-warm);
  }
  .explore-location select {
    max-width: 200px;
    border: 0;
    background: none;
    font-weight: 700;
    padding: 6px;
    font-size: 14px;
  }
  .explore-location button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 35px;
    background: none;
    border: 0;
    color: var(--muted);
  }
  .explore-search {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 13px;
    padding-left: 12px;
    background: white;
    height: 48px;
  }
  .explore-search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: none;
    font-size: 13px;
  }
  .explore-search button {
    position: relative;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--brown-warm);
    flex-shrink: 0;
  }
  .explore-search button.active {
    color: var(--brand);
  }
  .explore-search b {
    position: absolute;
    right: 4px;
    top: 1px;
    color: white;
    background: var(--brand);
    border-radius: 50%;
    font-size: 9px;
    padding: 1px 4px;
  }
  .explore-themes {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 12px 0 7px;
  }
  .explore-themes button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    padding: 9px 12px;
    font-size: 12px;
    border: 1px solid var(--line);
    background: white;
    border-radius: 22px;
    min-height: 38px;
  }
  .explore-themes button.active {
    color: white;
    background: var(--brand);
    border-color: var(--brand);
  }
  .explore-dogs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .explore-dogs button {
    display: flex;
    gap: 5px;
    align-items: center;
    border: 0;
    background: none;
    padding: 7px 0;
    color: var(--muted);
    font-size: 11px;
    max-width: 80%;
  }
  .explore-dogs button.active {
    color: var(--brand-deep);
    font-weight: 700;
  }
  .explore-dogs > span {
    font-size: 11px;
    color: var(--muted);
  }
  .explore-canvas {
    flex: 1;
    position: relative;
    min-height: 230px;
  }
  .explore-map {
    position: absolute;
    inset: 0;
  }
  .expanded .explore-map {
    visibility: hidden;
  }
  .explore-results {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 182px;
    border-radius: 23px 23px 0 0;
    background: white;
    box-shadow: 0 -5px 22px #4934210e;
    z-index: 10;
    display: flex;
    flex-direction: column;
  }
  .expanded .explore-results {
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
  .results-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 45px;
    flex-shrink: 0;
    padding: 0 20px;
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: inherit;
    background: white;
    font-size: 13px;
    font-weight: 600;
  }
  .results-toggle span {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .results-toggle b {
    font-size: 11px;
    color: var(--brand);
  }
  .results-scroll {
    flex: 1;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 20px 12px;
  }
  .more-places {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    background: var(--cream);
    border: 1px solid var(--line);
    border-radius: 12px;
    font-size: 13px;
    margin: 15px 0;
  }
  .filter-dialog h2 {
    font-size: 23px;
  }
  .filter-dialog > p {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.8;
  }
  fieldset {
    border: 0;
    padding: 15px 0;
    margin: 12px 0;
  }
  legend {
    font-size: 14px;
    font-weight: 600;
  }
  legend small {
    font-size: 11px;
    font-weight: 400;
    color: var(--muted);
  }
  .filter-dogs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-dogs button {
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--line);
    padding: 12px;
    border-radius: 12px;
    background: white;
    font-size: 13px;
  }
  .filter-dogs button.active {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--brand-deep);
  }
  .filter-dogs small {
    font-size: 11px;
  }
  .filter-option {
    display: flex;
    gap: 15px;
    justify-content: space-between;
    align-items: center;
    padding: 18px 0;
    border-top: 1px solid var(--line);
  }
  .filter-option strong {
    display: block;
    font-size: 13px;
  }
  .filter-option small {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-top: 8px;
  }
  .filter-option input {
    accent-color: var(--brand);
    width: 22px;
    height: 22px;
  }
  .filter-note {
    font-size: 11px !important;
    background: var(--cream);
    padding: 13px;
    border-radius: 12px;
  }
  .filter-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  .filter-actions .primary-button {
    flex: 1;
  }
  .register-link {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: var(--brand);
    padding: 15px 0;
    font-size: 13px;
  }
</style>
