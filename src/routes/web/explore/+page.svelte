<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';
  import { Map, Search, ArrowUpRight, SlidersHorizontal, RotateCcw } from '@lucide/svelte';
  import MapView from '$lib/components/MapView.svelte';
  import WebPlaceCard from '$lib/components/web/WebPlaceCard.svelte';
  import WebPlaceDetail from '$lib/components/web/WebPlaceDetail.svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import { themeNames, type Theme, type ThemeFilter, type Place } from '$lib/domain/place';
  import { providerInfo } from '$lib/domain/region';
  import { josa } from '$lib/domain/korean';
  import { getWebStore } from '$lib/web/store.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  let selected = $state<Place | null>(null);
  let showFilters = $state(false);
  let offline = $state(false);
  let listElement: HTMLDivElement;

  // 원본 API 는 식음료를 한 묶음으로 주지만, 카페와 식당은 찾는 목적이 달라 나눠 놨습니다.
  // 문화시설(박물관·미술관)은 문화정보원 자료에만 있어, 그 지역에서만 탭을 띄웁니다.
  //
  // 줄을 나눠 적어 둔 그대로 화면에서도 줄이 바뀝니다. 끼니 → 나들이 → 그 밖의 시설 순서로
  // 묶어 둔 것이라, 창 너비에 따라 묶음이 흐트러지지 않게 줄 단위로 그립니다.
  const themeRows: Theme[][] = [
    ['restaurant', 'cafe'],
    ['outdoor', 'activity', 'stay'],
    ['culture', 'hospital']
  ];
  const rows = $derived(
    themeRows
      .map((row) =>
        row.filter(
          (theme) =>
            !['culture', 'hospital'].includes(theme) ||
            data.places.some((place) => place.category === theme)
        )
      )
      // 그 지역에 문화시설도 동물병원도 없으면 빈 줄이 남지 않게 통째로 뺍니다.
      .filter((row) => row.length)
  );
  const filtered = $derived(store.filter(data.places));
  const region = $derived(data.regions.find((item) => item.id === data.regionId) ?? data.regions[0]);
  const area = $derived(region.label);
  const sources = $derived(region.sources.map((id) => providerInfo[id]));
  const areaText = (suffix: string) => (area ? `${area} ${suffix}` : suffix);
  // 동물병원은 동반 장소가 아니라서, 지도에 섞여 있으면 문구를 그에 맞게 바꿉니다.
  const hospitalsShown = $derived(filtered.filter((place) => place.category === 'hospital').length);
  const mapCaption = $derived(
    hospitalsShown === 0
      ? '반려견 동반 정보가 있는 장소'
      : hospitalsShown === filtered.length
        ? areaText('동물병원')
        : '동반 장소와 동물병원'
  );
  // 지역을 바꾸면 이전 지역에서 고른 장소가 상세 패널에 남아 있지 않게 합니다.
  $effect(() => {
    const ids = new Set(data.places.map((place) => place.id));
    untrack(() => {
      if (selected && !ids.has(selected.id)) selected = null;
    });
  });

  // 분류마다 받아 온 날짜가 달라, 지금 보고 있는 목록의 가장 최근 수집일을 보여 줍니다.
  const collectedAt = $derived(
    (filtered.length ? filtered : data.places)
      .map((place) => place.importedAt)
      .sort()
      .at(-1)
      ?.replaceAll('-', '.') ?? ''
  );

  // Keep the list in sync when a marker on the map is picked.
  $effect(() => {
    if (!selected || !listElement) return;
    listElement
      .querySelector(`[data-id="${selected.id}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  onMount(() => {
    // 메인·찜한 장소 페이지에서 ?category= / ?place= 로 넘어올 수 있습니다.
    const params = page.url.searchParams;
    const requestedCategory = params.get('category');
    if (requestedCategory && requestedCategory in themeNames)
      store.category = requestedCategory as ThemeFilter;
    const requestedPlace = data.places.find((place) => place.id === params.get('place'));
    if (requestedPlace) {
      store.resetFilters();
      selected = requestedPlace;
    }
    const status = () => (offline = !navigator.onLine);
    status();
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    return () => {
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  });
</script>

<svelte:head>
  <title>가게 찾기 — 댕브리웨어</title>
</svelte:head>
<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') {
      selected = null;
      showFilters = false;
    }
  }}
/>

<aside class="web-sidebar" aria-label="장소 목록과 필터">
  <div class="sidebar-top">
    <div class="category-row" aria-label="장소 유형">
      {#each rows as row, index (index)}
        <div class="category-line">
          {#if index === 0}<button
              class:active={store.category === 'all'}
              aria-pressed={store.category === 'all'}
              onclick={() => {
                store.category = 'all';
                selected = null;
              }}><Map size={17} />전체</button
            >{/if}
          {#each row as theme (theme)}<button
              class:active={store.category === theme}
              aria-pressed={store.category === theme}
              onclick={() => {
                store.category = theme;
                selected = null;
              }}><ThemeIcon {theme} size={17} strokeWidth={1.7} />{themeNames[theme]}</button
            >{/each}
        </div>
      {/each}
    </div>
    <div class="filter-row">
      <button
        class="filter-toggle"
        class:active={showFilters || store.filterCount > 0}
        onclick={() => (showFilters = !showFilters)}
        aria-expanded={showFilters}
        ><SlidersHorizontal size={18} />동반 조건 필터{#if store.filterCount}<span
            >{store.filterCount}</span
          >{/if}</button
      >
      {#if store.hasFilters}<button class="text-button" onclick={() => store.resetFilters()}
          ><RotateCcw size={15} />초기화</button
        >{/if}
    </div>
    {#if showFilters}<div class="filter-options">
        <label
          ><input type="checkbox" bind:checked={store.weightInfoOnly} />제한 체중이 기재된 장소만</label
        >
        {#if store.mode === 'dog' && store.dog}<label
            ><input type="checkbox" bind:checked={store.hideKnownMismatch} />원본의 체중·체급 제한에
            {store.activeDogs.length > 1 ? '둘 중 하나라도 맞지 않는' : '맞지 않는'} 곳 제외</label
          >{:else}<p class="filter-hint">
            <a href="/web/dog">우리 강아지</a>를 등록하면 체중·체급 조건에 맞지 않는 곳을 뺄 수 있어요.
          </p>{/if}
        <p>필터 결과도 방문 가능을 보장하지 않아요. 허용 구역과 준비물을 함께 확인해 주세요.</p>
      </div>{/if}
  </div>

  <div class="list-heading">
    <h2>
      {#if store.category === 'hospital'}
        가까운 동물병원
      {:else if store.dog}
        {store.dogNames}{josa(store.dogNames, '와/과')} 함께 갈 곳
      {:else}
        함께 갈 곳
      {/if}
      <span class="count">{filtered.length}</span>
    </h2>
    <p>
      {#if store.category === 'hospital'}
        진료 시간은 전화로 확인해 주세요
      {:else if store.mode === 'dog' && store.dog}
        {store.dogNames}의 체중·체급 조건 적용 중
      {:else}
        방문 전 동반 규정을 확인해 보세요
      {/if}
    </p>
  </div>

  <div class="list-scroll" bind:this={listElement}>
    {#each filtered as place (place.id)}<WebPlaceCard
        {place}
        selected={selected?.id === place.id}
        saved={store.isSaved(place.id)}
        onselect={() => (selected = place)}
        onsave={() => store.toggleSave(place)}
      />{/each}
    {#if !filtered.length}<div class="empty-state">
        <Search size={36} strokeWidth={1} />
        <h3>조건에 맞는 장소가 없어요</h3>
        <p>검색어나 필터를 바꿔보세요.</p>
        <button class="secondary-button" onclick={() => store.resetFilters()}>전체 장소 보기</button>
      </div>{/if}
  </div>

  <div class="sidebar-footer">
    <span
      >{sources.map((source) => source.shortName).join(' · ')} · 수집 {collectedAt}{#if region.status !== 'active'}
        · 업체 확인 전{/if}</span
    >
    <a href={sources[0].url} target="_blank" rel="noreferrer"
      >공식 데이터<ArrowUpRight size={14} /></a
    >
  </div>
</aside>

<main class="web-map" class:has-detail={selected !== null} aria-label="반려견 동반 장소 지도">
  <h1 class="sr-only">댕브리웨어 웹 · 반려견 동반 지도</h1>
  <MapView
    places={filtered}
    selectedId={selected?.id ?? null}
    onselect={(place) => (selected = place)}
    caption={mapCaption}
    padding={{ top: 40, right: 40, bottom: 40, left: 40 }}
    regionId={data.regionId}
  />
  {#if offline}<div class="web-offline" role="status">
      오프라인 · 최신 규정을 확인할 수 없어요.
    </div>{/if}
  {#if selected}<WebPlaceDetail
      place={selected}
      dogs={store.activeDogs}
      saved={store.isSaved(selected.id)}
      onclose={() => (selected = null)}
      onsave={() => selected && store.toggleSave(selected)}
    />{/if}
</main>

<style>
  .web-sidebar {
    width: var(--sidebar-w);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-right: 1px solid var(--line);
    min-height: 0;
  }
  .sidebar-top {
    padding: 22px 22px 16px;
    border-bottom: 1px solid var(--line);
  }
  /* 줄은 themeRows 가 정하고, 한 줄이 너무 좁아지면 그 안에서만 다시 접힙니다. */
  .category-row {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .category-line {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }
  .category-row button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--line);
    background: #fff;
    border-radius: 24px;
    padding: 10px 17px;
    font-size: 15px;
    color: var(--brown-warm);
    white-space: nowrap;
    min-height: 46px;
  }
  .category-row button:hover {
    background: var(--cream);
  }
  .category-row button.active {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
    font-weight: 600;
  }
  .filter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 14px;
  }
  .filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    background: var(--cream);
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 15px;
    color: var(--brown-warm);
    min-height: 46px;
  }
  .filter-toggle.active {
    background: var(--brand-soft);
    border-color: #efd6d9;
    color: var(--brand);
  }
  .filter-toggle > span {
    background: var(--brand);
    color: #fff;
    border-radius: 50%;
    font-size: 12px;
    min-width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
  }
  .filter-options {
    margin-top: 14px;
    padding: 18px 20px;
    background: var(--cream);
    border: 1px solid var(--line);
    border-radius: 14px;
    display: grid;
    gap: 12px;
  }
  .filter-options label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 15px;
    line-height: 1.6;
  }
  .filter-options input {
    accent-color: var(--brand);
    width: 18px;
    height: 18px;
    margin-top: 3px;
    flex-shrink: 0;
  }
  .filter-options p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--muted);
  }
  .filter-hint a {
    color: var(--brand);
    font-weight: 600;
  }
  .list-heading {
    padding: 20px 24px 12px;
  }
  .list-heading h2 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.7px;
    margin: 0;
  }
  /* 개수만 — 제목 안의 다른 글자까지 물들지 않게 클래스로 좁힙니다. */
  .list-heading h2 .count {
    color: var(--brand);
    margin-left: 4px;
  }
  .list-heading p {
    font-size: 14px;
    color: var(--muted);
    margin: 6px 0 0;
  }
  .list-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sidebar-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--muted);
    background: var(--cream);
  }
  .sidebar-footer a {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--brand);
    text-decoration: none;
    white-space: nowrap;
  }

  .web-map {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    isolation: isolate;
  }
  .web-offline {
    position: absolute;
    left: 50%;
    top: 24px;
    transform: translateX(-50%);
    z-index: 22;
    background: #f7e4d2;
    color: var(--brown-warm);
    font-size: 15px;
    padding: 13px 20px;
    border-radius: 14px;
    box-shadow: 0 4px 16px #4a34280f;
  }
  @media (max-width: 1280px) {
    .web-sidebar {
      width: 400px;
    }
  }
</style>
