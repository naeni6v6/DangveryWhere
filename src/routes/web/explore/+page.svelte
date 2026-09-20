<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';
  import {
    Map,
    Search,
    ArrowUpRight,
    SlidersHorizontal,
    RotateCcw,
    X,
    PawPrint
  } from '@lucide/svelte';
  import MapView from '$lib/components/MapView.svelte';
  import WebPlaceCard from '$lib/components/web/WebPlaceCard.svelte';
  import { directLinkFirst } from '$lib/domain/placeLink';
  import { canonicalPlaceId } from '$lib/domain/placeIdentity';
  import { hasPhoto, photoFirst } from '$lib/domain/placePhoto';
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
  let filters: HTMLDialogElement;
  let offline = $state(false);
  let listElement: HTMLDivElement;
  let detailElement = $state<HTMLElement>();

  // 원본 API 는 식음료를 한 묶음으로 주지만, 카페와 식당은 찾는 목적이 달라 나눠 놨습니다.
  // 문화시설(박물관·미술관)은 문화정보원 자료에만, 쇼핑은 관광공사 자료에만 있어
  // 해당 자료가 닿은 지역에서만 탭을 띄웁니다.
  //
  // 줄을 나눠 적어 둔 그대로 화면에서도 줄이 바뀝니다. 끼니 → 나들이 → 그 밖의 시설 순서로
  // 묶어 둔 것이라, 창 너비에 따라 묶음이 흐트러지지 않게 줄 단위로 그립니다.
  const themeRows: Theme[][] = [
    ['restaurant', 'cafe'],
    ['outdoor', 'activity', 'stay'],
    ['culture', 'shopping', 'hospital']
  ];
  const rows = $derived(
    themeRows
      .map((row) =>
        row.filter(
          (theme) =>
            !['culture', 'shopping', 'hospital'].includes(theme) ||
            data.places.some((place) => place.category === theme)
        )
      )
      // 그 지역에 문화시설도 동물병원도 없으면 빈 줄이 남지 않게 통째로 뺍니다.
      .filter((row) => row.length)
  );
  // 사진이 있는 장소를 맨 위로, 그다음 업소 페이지 링크가 있는 장소.
  // 사진 없는 곳도 목록에는 남습니다(동반 규정은 사진과 상관없이 필요한 정보라서요).
  const filtered = $derived(photoFirst(directLinkFirst(store.filter(data.places))));
  // 사진 있는 곳이 어디서 끝나는지. 그 자리에 칸막이를 한 줄 넣습니다.
  const withPhoto = $derived(filtered.filter(hasPhoto).length);
  const region = $derived(
    data.regions.find((item) => item.id === data.regionId) ?? data.regions[0]
  );
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
  // 검색·필터·지역을 바꿔 목록에서 빠진 장소는 상세 패널에서도 닫습니다.
  $effect(() => {
    const ids = new Set(filtered.map((place) => place.id));
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
    const requestedPlace = data.places.find(
      (place) => place.id === canonicalPlaceId(params.get('place') ?? '')
    );
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
  <title>매장 찾기 — 댕브리웨어</title>
</svelte:head>
<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && !showFilters) {
      selected = null;
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
        onclick={() => {
          showFilters = true;
          filters.showModal();
        }}
        aria-expanded={showFilters}
        aria-haspopup="dialog"
        ><SlidersHorizontal size={18} />동반 조건 필터{#if store.filterCount}<span
            >{store.filterCount}</span
          >{/if}</button
      >
      {#if store.hasFilters}<button class="text-button" onclick={() => store.resetFilters()}
          ><RotateCcw size={15} />초기화</button
        >{/if}
    </div>
    {#if store.filterCount}<div class="filter-summary" aria-label="적용 중인 조건">
        {#if store.weightInfoOnly}<button
            onclick={() => (store.weightInfoOnly = false)}
            aria-label="체중 정보 필터 해제">체중 정보 있음<X size={12} /></button
          >{/if}
        {#if store.dogFilterActive}<button
            onclick={() => {
              store.hideKnownMismatch = false;
              store.mode = 'all';
            }}
            aria-label="강아지 제한 제외 필터 해제">강아지 제한 제외<X size={12} /></button
          >{/if}
      </div>{/if}
  </div>

  <div class="list-heading">
    <h2>
      {#if store.category === 'hospital'}
        가까운 동물병원
      {:else if store.dogFilterActive}
        {store.dogNames}{josa(store.dogNames, '와/과')} 함께 갈 곳
      {:else}
        함께 갈 곳
      {/if}
      <span class="count">{filtered.length}</span>
    </h2>
    <p>
      {#if store.category === 'hospital'}
        진료 시간은 전화로 확인해 주세요
      {:else if store.dogFilterActive}
        {store.dogNames}의 체중·체급 조건 적용 중
      {:else}
        방문 전 동반 규정을 확인해 보세요
      {/if}
    </p>
  </div>

  <div class="list-scroll" bind:this={listElement}>
    {#each filtered as place, index (place.id)}
      <!-- 사진 있는 곳과 없는 곳 사이 칸막이. 목록이 갑자기 허전해 보이지 않게 이유를 적어 둡니다. -->
      {#if index === withPhoto && withPhoto > 0}<div class="list-divider">
          <span>사진 준비 중인 곳 {filtered.length - withPhoto}</span>
        </div>{/if}
      <WebPlaceCard
        {place}
        selected={selected?.id === place.id}
        saved={store.isSaved(place.id)}
        onselect={() => (selected = place)}
        onsave={() => store.toggleSave(place)}
      />
    {/each}
    {#if !filtered.length}<div class="empty-state">
        <Search size={36} strokeWidth={1} />
        <h3>조건에 맞는 장소가 없어요</h3>
        <p>검색어나 필터를 바꿔보세요.</p>
        <button class="secondary-button" onclick={() => store.resetFilters()}>전체 장소 보기</button
        >
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

<dialog
  bind:this={filters}
  class="filter-dialog"
  aria-labelledby="web-filter-title"
  onclose={() => (showFilters = false)}
>
  <header>
    <h2 id="web-filter-title">동반 조건 필터</h2>
    <button class="close-filter" onclick={() => filters.close()} aria-label="필터 닫기"
      ><X size={22} /></button
    >
  </header>
  <div class="filter-options">
    {#if store.dogs.length}<fieldset>
        <legend>함께 갈 강아지 <small>최대 2마리</small></legend>
        <div class="filter-dogs">
          {#each store.dogs as dog (dog.id)}<button
              class:active={store.isActive(dog.id)}
              aria-pressed={store.isActive(dog.id)}
              onclick={() => store.toggleDog(dog.id)}
              ><PawPrint size={16} />{dog.name}<small>{dog.weight}kg</small></button
            >{/each}
        </div>
      </fieldset>{:else}<p class="filter-hint"><a href="/web/dog">우리 강아지 등록하기</a></p>{/if}
    <label
      ><span
        ><strong>제한 체중이 기재된 장소만</strong><small
          >원본에 체중 정보가 있는 장소를 골라요</small
        ></span
      ><input type="checkbox" bind:checked={store.weightInfoOnly} /></label
    >
    <label
      ><span
        ><strong>우리 강아지의 제한 장소 제외</strong><small
          >{store.dogs.length
            ? '선택한 아이의 체중·체급 조건으로 비교해요'
            : '강아지를 먼저 등록해 주세요'}</small
        ></span
      ><input
        type="checkbox"
        checked={store.dogFilterActive}
        disabled={!store.dogs.length}
        onchange={(event) => {
          store.hideKnownMismatch = event.currentTarget.checked;
          store.mode = event.currentTarget.checked ? 'dog' : 'all';
        }}
      /></label
    >
    <p class="filter-note">
      필터 결과도 방문 가능을 보장하지 않아요. 허용 구역과 준비물을 함께 확인해 주세요.
    </p>
  </div>
  <footer class="filter-actions">
    <button class="secondary-button" onclick={() => store.resetFilters()}>초기화</button><button
      class="primary-button"
      onclick={() => filters.close()}>{filtered.length}곳 보기</button
    >
  </footer>
</dialog>

<main class="web-map" class:has-detail={selected !== null} aria-label="반려견 동반 장소 지도">
  <h1 class="sr-only">댕브리웨어 웹 · 반려견 동반 지도</h1>
  <MapView
    places={filtered}
    selectedId={selected?.id ?? null}
    selectionOverlay={detailElement}
    onselect={(place) => (selected = place)}
    caption={mapCaption}
    padding={{ top: 40, right: 40, bottom: 40, left: 40 }}
    regionId={data.regionId}
  />
  {#if offline}<div class="web-offline" role="status">
      오프라인 · 최신 규정을 확인할 수 없어요.
    </div>{/if}
  {#if selected}<WebPlaceDetail
      bind:panel={detailElement}
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
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--line);
  }
  /* 줄은 themeRows 가 정하고, 한 줄이 너무 좁아지면 그 안에서만 다시 접힙니다. */
  .category-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    min-height: 44px;
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
    padding: 20px 24px;
    overflow: auto;
    display: grid;
    gap: 20px;
  }
  .filter-options label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 15px;
    line-height: 1.6;
  }
  .filter-options label small {
    display: block;
    color: var(--muted);
    font-size: 13px;
  }
  .filter-options input {
    accent-color: var(--brand);
    width: 22px;
    height: 22px;
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
  .filter-dialog {
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    margin: auto;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 22px;
    color: var(--brown);
    background: white;
    box-shadow: 0 16px 60px #35221f33;
  }
  .filter-dialog[open] {
    display: flex;
    flex-direction: column;
  }
  .filter-dialog::backdrop {
    background: #2f222655;
  }
  .filter-dialog header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 14px 24px;
    border-bottom: 1px solid var(--line);
  }
  .filter-dialog h2 {
    margin: 0;
    font-size: 21px;
  }
  .close-filter {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: var(--cream);
  }
  .filter-options fieldset {
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;
  }
  .filter-options legend {
    margin-bottom: 12px;
    font-weight: 600;
  }
  .filter-options legend small {
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
    gap: 6px;
    min-height: 44px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: white;
  }
  .filter-dogs button.active {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--brand);
  }
  .filter-note {
    background: var(--cream);
    padding: 14px;
    border-radius: 12px;
  }
  .filter-actions {
    display: flex;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--line);
  }
  .filter-actions .primary-button {
    flex: 1;
  }
  .filter-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .filter-summary button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 4px 10px;
    color: var(--brand);
    background: var(--brand-soft);
    font-size: 12px;
  }
  .list-heading {
    padding: 14px 24px 10px;
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
  /* 사진 있는 곳 / 준비 중인 곳 사이 칸막이 */
  .list-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 14px 10px 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .list-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--line);
  }
  .sidebar-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
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
