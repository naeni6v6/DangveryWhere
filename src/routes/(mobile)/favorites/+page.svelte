<script lang="ts">
  import { goto } from '$app/navigation';
  import { Heart, ArrowRight, RefreshCw } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import MobilePlaceCard from '$lib/components/mobile/MobilePlaceCard.svelte';
  import { placeTheme, themeNames, type ThemeFilter, type Place } from '$lib/domain/place';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  let fetched = $state<Place[]>([]);
  let failed = $state(false);
  let loading = $state(false);
  let category = $state<ThemeFilter>('all');
  let requestedKey = '';
  const byId = $derived(
    new Map([...data.places, ...data.favoritePlaces, ...fetched].map((place) => [place.id, place]))
  );
  const saved = $derived(
    store.savedIds.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place))
  );
  const themes = $derived(['all', ...new Set(saved.map(placeTheme))] as ThemeFilter[]);
  const shown = $derived(
    category === 'all' ? saved : saved.filter((place) => placeTheme(place) === category)
  );
  const missingIds = $derived(store.savedIds.filter((id) => !byId.has(id)));
  async function loadMissing(ids: string[]) {
    if (!ids.length) return;
    loading = true;
    failed = false;
    try {
      const rows: Place[] = [];
      for (let start = 0; start < ids.length; start += 50) {
        const response = await fetch(
          `/api/places?ids=${ids
            .slice(start, start + 50)
            .map(encodeURIComponent)
            .join(',')}`
        );
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { places: Place[] };
        rows.push(...body.places);
      }
      fetched = [...fetched, ...rows];
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }
  $effect(() => {
    const key = missingIds.join(',');
    if (!key || key === requestedKey) return;
    requestedKey = key;
    void loadMissing([...missingIds]);
  });
  $effect(() => {
    if (!themes.includes(category)) category = 'all';
  });
  function openPlace(place: Place) {
    goto(`/explore?region=all&place=${encodeURIComponent(place.id)}`);
  }
</script>

<svelte:head><title>찜한 장소 — 댕브리웨어</title></svelte:head>
<div class="mobile-page favorites-page">
  <span class="favorites-eyebrow"><Heart size={14} />MY FAVORITES</span>
  <h1>다음에는 여기, 함께.</h1>
  <p class="mobile-page-lead">
    마음에 든 장소를 모아뒀어요.<br />떠나기 전에 동반 규정을 다시 확인해 주세요.
  </p>
  <div class="favorites-summary">
    <strong>찜한 장소 <b>{store.savedIds.length}</b></strong><span
      >{store.loggedIn ? '계정에 저장돼요' : '이 브라우저에 저장돼요'}</span
    >
  </div>
  {#if store.savedIds.length}
    <div class="favorites-themes" aria-label="찜한 장소 유형">
      {#each themes as theme}<button
          class:active={category === theme}
          aria-pressed={category === theme}
          onclick={() => (category = theme)}>{themeNames[theme]}</button
        >{/each}
    </div>
    {#if loading}<p role="status" class="mobile-page-lead">
        다른 지역의 찜한 장소도 불러오고 있어요…
      </p>{/if}
    {#if failed}<div class="favorites-error" role="status">
        <p>일부 장소 정보를 불러오지 못했어요.</p>
        <button onclick={() => loadMissing([...missingIds])}
          ><RefreshCw size={15} />다시 시도</button
        >
      </div>{/if}
    {#each shown as place (place.id)}<MobilePlaceCard
        {place}
        onselect={() => openPlace(place)}
      />{/each}
    {#if !loading && !failed && !shown.length}<div class="mobile-empty">
        <Heart size={30} />
        <p>저장된 장소 정보를 찾지 못했어요.<br />새로운 장소를 둘러볼까요?</p>
        <a class="primary-button" href="/explore">장소 찾아보기<ArrowRight size={16} /></a>
      </div>{/if}
  {:else}<div class="mobile-empty">
      <Heart size={38} strokeWidth={1.3} />
      <h2>함께 가고 싶은 곳을 찜해요</h2>
      <p>장소 옆 하트를 누르면<br />여기에 차곡차곡 모여요.</p>
      <a class="primary-button" href="/explore">장소 찾아보기<ArrowRight size={17} /></a>
    </div>{/if}
</div>

<style>
  .favorites-eyebrow {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--brand);
    font-size: 9px;
    letter-spacing: 1.5px;
    margin-bottom: 12px;
  }
  .favorites-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 19px 0 17px;
    border-bottom: 1px solid var(--line);
    margin-top: 10px;
  }
  .favorites-summary strong {
    font-size: 14px;
  }
  .favorites-summary b {
    color: var(--brand);
    margin-left: 5px;
  }
  .favorites-summary > span {
    color: var(--muted);
    font-size: 10px;
  }
  .favorites-themes {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    padding: 15px 0 4px;
  }
  .favorites-themes button {
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 10px 14px;
    font-size: 12px;
    background: white;
    white-space: nowrap;
    min-height: 40px;
  }
  .favorites-themes button.active {
    background: var(--brand);
    color: white;
    border-color: var(--brand);
  }
  .favorites-error {
    background: var(--cream);
    border-radius: 13px;
    padding: 12px;
    font-size: 12px;
  }
  .favorites-error button {
    border: 0;
    background: none;
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--brand-deep);
    min-height: 40px;
  }
</style>
