<script lang="ts">
  import { page } from '$app/state';
  import { goto, pushState, replaceState } from '$app/navigation';
  import {
    Search,
    X,
    SlidersHorizontal,
    MapPin,
    PawPrint,
    ChevronUp,
    ChevronDown,
    Info,
    ArrowLeft
  } from '@lucide/svelte';
  import MapView from '$lib/mobile/MapView.svelte';
  import CategoryStrip from '$lib/components/mobile/CategoryStrip.svelte';
  import MobilePlaceCard from '$lib/components/mobile/MobilePlaceCard.svelte';
  import PlaceSheet from '$lib/components/mobile/PlaceSheet.svelte';
  import ResultsSheet from '$lib/components/mobile/ResultsSheet.svelte';
  import ReadableText from '$lib/components/mobile/ReadableText.svelte';
  import type { SheetLevel } from '$lib/mobile/layout';
  import { getWebStore } from '$lib/web/store.svelte';
  import { placeTheme, type ThemeFilter, type Place } from '$lib/domain/place';
  import { photoFirst } from '$lib/domain/placePhoto';
  import { directLinkFirst } from '$lib/domain/placeLink';
  import { canonicalPlaceId } from '$lib/domain/placeIdentity';
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
  const selected = $derived(
    data.places.find((place) => place.id === canonicalPlaceId(selectedId ?? '')) ?? null
  );
  let sheetLevel = $state<SheetLevel>(0);
  let detailLevel = $state<SheetLevel>(1);
  let canvasHeight = $state(0);
  let overviewHeight = $state(0);
  const expanded = $derived(sheetLevel === 2);
  const resultsKey = $derived(filtered.map((place) => place.id).join(','));
  let changingRegion = $state(false);
  let openedHere = false;
  let filters: HTMLDialogElement;
  let sources: HTMLDialogElement;
  let dogPicker = $state<HTMLDetailsElement>();
  let mapView = $state<MapView>();
  // Keep the hidden list at its original size so opening details never clamps its scroll offset.
  $effect.pre(() => {
    if (!selected && canvasHeight) overviewHeight = canvasHeight;
  });
  $effect(() => {
    const theme = page.state.mobileCategory ?? page.url.searchParams.get('category');
    if (theme && allThemes.includes(theme as ThemeFilter)) store.category = theme as ThemeFilter;
  });

  function pick(place: Place) {
    if (selected?.id === place.id) return;
    mapView?.rememberView();
    if (dogPicker) dogPicker.open = false;
    detailLevel = 1;
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
    sheetLevel = 0;
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
  function closeDogPicker(event: PointerEvent) {
    if (dogPicker?.open && event.target instanceof Node && !dogPicker.contains(event.target))
      dogPicker.open = false;
  }
</script>

<svelte:head><title>매장 찾기 — 댕브리웨어</title></svelte:head>
<svelte:document
  onpointerdown={closeDogPicker}
  onkeydown={(event) => {
    if (event.key === 'Escape' && dogPicker?.open) dogPicker.open = false;
  }}
/>
<div class="mobile-explore">
  <section class="explore-toolbar" aria-label="장소 검색과 필터" hidden={!!selected}>
    <div class="explore-location">
      <label
        ><MapPin size={16} /><span class="sr-only">매장 찾기 지역</span><select
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
        sheetLevel = 2;
      }}
    >
      <Search size={19} /><input
        aria-label="장소 검색"
        placeholder="장소 이름이나 동네를 검색해요"
        bind:value={store.query}
        oninput={() => (sheetLevel = 2)}
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
    <CategoryStrip
      items={themes.map((id) => ({ id }))}
      value={store.category}
      onchange={chooseTheme}
    />
    <div class="explore-dogs">
      {#if store.dogs.length}
        <details class="dog-picker" bind:this={dogPicker}>
          <summary class:active={store.dogFilterActive}
            ><PawPrint size={14} /><span
              >{store.dogFilterActive ? `${store.dogNames} 맞춤 적용` : '함께 갈 강아지'}</span
            ><ChevronDown size={13} /></summary
          >
          <div class="dog-picker-panel">
            <strong>함께 갈 강아지 <small>최대 2마리</small></strong>
            {#each store.dogs as dog (dog.id)}
              <label class="dog-choice">
                <input
                  type="checkbox"
                  checked={store.isActive(dog.id)}
                  disabled={store.isActive(dog.id) && store.activeDogs.length === 1}
                  onchange={() => {
                    store.toggleDog(dog.id);
                    store.mode = 'dog';
                    store.hideKnownMismatch = true;
                  }}
                />
                <span>{dog.name}<small>{dog.breed} · {dog.weight}kg</small></span>
              </label>
            {/each}
            <label class="dog-match"
              ><input
                type="checkbox"
                checked={store.mode === 'dog' && store.hideKnownMismatch}
                onchange={(event) => {
                  store.hideKnownMismatch = event.currentTarget.checked;
                  store.mode = event.currentTarget.checked ? 'dog' : 'all';
                }}
              />조건 제한 장소 제외</label
            >
            <a href="/dog">우리 강아지 관리</a>
          </div>
        </details>
      {:else}<a class="register-inline" href="/dog"
          ><PawPrint size={14} />우리 강아지 등록<ChevronDown size={13} /></a
        >{/if}
      <span aria-live="polite"
        >{store.weightInfoOnly ? '체중 정보 있음 · ' : ''}{changingRegion
          ? '지역을 불러오는 중…'
          : `${filtered.length.toLocaleString()}곳`}</span
      >
    </div>
  </section>
  <div class="explore-canvas" bind:clientHeight={canvasHeight}>
    <div class="explore-map" aria-hidden={expanded && !selected} inert={expanded && !selected}>
      <MapView
        bind:this={mapView}
        places={filtered}
        selectedId={selected?.id ?? null}
        focusPlace={selected}
        onselect={pick}
        regionId={data.regionId}
        appLayout
        padding={{ top: 24, right: 20, bottom: 190, left: 20 }}
        caption={store.category === 'hospital'
          ? '동물병원 위치 · 전화 후 방문하세요'
          : '반려견 동반 정보가 있는 장소'}
      />
    </div>
    <div
      class="results-layer"
      class:suspended={!!selected}
      aria-hidden={!!selected}
      inert={!!selected}
      style:height={selected && overviewHeight ? `${overviewHeight}px` : '100%'}
    >
      <ResultsSheet bind:level={sheetLevel} count={filtered.length} resetKey={resultsKey}>
        {#if filtered.length}{#each filtered as place (place.id)}<MobilePlaceCard
              {place}
              onselect={() => pick(place)}
            />{/each}
          <p class="results-end">{filtered.length.toLocaleString()}곳을 모두 확인했어요.</p>
        {:else}<div class="mobile-empty">
            <Search size={28} />
            <h2>조건에 맞는 장소가 없어요</h2>
            <p>검색어나 필터를 바꿔보세요.</p>
            <button class="secondary-button" onclick={reset}>전체 장소 보기</button>
          </div>{/if}
      </ResultsSheet>
    </div>
    {#if selected}
      <button class="detail-back" aria-label="매장 목록으로 돌아가기" onclick={closePlace}>
        <ArrowLeft size={22} />
      </button>
      {#key selected.id}
        <ResultsSheet bind:level={detailLevel} count={0} resetKey={selected.id} detail>
          <PlaceSheet place={selected} onclose={closePlace} inline />
        </ResultsSheet>
      {/key}
    {/if}
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
  <h2 id="mobile-filter-title">동반 조건 필터</h2>
  <p>방문 전 동반 규정을 확인해 보세요.</p>
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
    ><span
      ><strong>제한 체중이 기재된 장소만</strong><small>원본의 체중 정보를 기준으로 골라요</small
      ></span
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
    <ReadableText
      text="필터 결과도 방문 가능을 보장하지 않아요. 허용 구역과 준비물을 함께 확인해 주세요."
    />
  </p>
  <div class="filter-actions">
    <button class="secondary-button" onclick={reset}>초기화</button><button
      class="primary-button"
      onclick={() => {
        filters.close();
        sheetLevel = 2;
      }}>{filtered.length}곳 보기</button
    >
  </div>
</dialog>
<dialog bind:this={sources} class="mobile-dialog" aria-labelledby="mobile-source-title">
  <button class="mobile-close" onclick={() => sources.close()} aria-label="데이터 안내 닫기"
    ><X size={23} /></button
  >
  <h2 id="mobile-source-title">어떤 정보를 보여주나요?</h2>
  <p class="mobile-page-lead">
    <ReadableText
      text={`${region.label}의 공공데이터를 모았어요. 원문을 옮긴 정보로, 시설의 현재 운영 여부와 규정을 방문 전에 확인해 주세요.`}
    />
  </p>
  {#each region.sources as source}<p>
      <a href={providerInfo[source].url} target="_blank" rel="noreferrer"
        >{providerInfo[source].name}</a
      >
    </p>{/each}
</dialog>

<style>
  .mobile-explore {
    height: calc(100dvh - var(--mobile-header-height) - var(--mobile-tab-height));
    min-height: 0;
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
  .explore-dogs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .dog-picker summary,
  .register-inline {
    display: flex;
    gap: 5px;
    align-items: center;
    border: 0;
    background: none;
    padding: 8px 0;
    color: var(--muted);
    font-size: 11px;
    min-height: 36px;
    cursor: pointer;
    text-decoration: none;
    list-style: none;
  }
  .dog-picker summary.active {
    color: var(--brand-deep);
    font-weight: 700;
  }
  .dog-picker {
    position: relative;
    max-width: calc(100% - 65px);
  }
  .dog-picker summary::-webkit-details-marker {
    display: none;
  }
  .dog-picker summary > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dog-picker summary :global(svg) {
    flex-shrink: 0;
  }
  .dog-picker-panel {
    position: absolute;
    top: calc(100% + 3px);
    left: 0;
    width: min(300px, calc(100vw - 40px));
    padding: 17px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 10px 28px #49342120;
    z-index: 20;
  }
  .dog-picker-panel > strong {
    display: block;
    font-size: 13px;
    margin-bottom: 9px;
  }
  .dog-picker-panel small {
    font-size: 10px;
    font-weight: 400;
    color: var(--muted);
  }
  .dog-choice {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    font-size: 13px;
  }
  .dog-choice small {
    display: block;
    margin-top: 4px;
  }
  .dog-picker-panel input {
    accent-color: var(--brand);
    width: 19px;
    height: 19px;
    flex-shrink: 0;
  }
  .dog-match {
    display: flex;
    gap: 8px;
    align-items: center;
    border-top: 1px solid var(--line);
    padding-top: 13px;
    margin-top: 7px;
    font-size: 12px;
  }
  .dog-picker-panel > a {
    display: inline-block;
    color: var(--brand);
    font-size: 11px;
    padding: 13px 0 0;
  }
  .explore-dogs > span {
    font-size: 11px;
    color: var(--muted);
  }
  .explore-canvas {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  .explore-map {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .results-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .results-layer.suspended {
    visibility: hidden;
  }
  .detail-back {
    position: absolute;
    top: calc(12px + env(safe-area-inset-top));
    left: 16px;
    z-index: 20;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: #fff;
    color: var(--ink);
    box-shadow: 0 3px 12px #4934211a;
  }
  .results-end {
    margin: 20px 0 4px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
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
