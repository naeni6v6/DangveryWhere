<script lang="ts">
  import ReadableText from '$lib/components/mobile/ReadableText.svelte';
  import { Heart, Map as MapIcon, LogIn, RefreshCw } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import FavoritePlaceCard from '$lib/components/mobile/FavoritePlaceCard.svelte';
  import CategoryStrip from '$lib/components/mobile/CategoryStrip.svelte';
  import PlaceSheet from '$lib/components/mobile/PlaceSheet.svelte';
  import { placeTheme, type ThemeFilter, type Place } from '$lib/domain/place';
  import { josa } from '$lib/domain/korean';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  let fetched = $state<Place[]>([]);
  let failed = $state(false);
  let loading = $state(false);
  let category = $state<ThemeFilter>('all');
  let selected = $state<Place | null>(null);
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
  const restrictedCount = $derived(
    store.dog ? saved.filter((place) => store.restrictedFor(place)).length : 0
  );
  const tabs = $derived(
    themes.map((id) => ({
      id,
      count: id === 'all' ? saved.length : saved.filter((place) => placeTheme(place) === id).length
    }))
  );
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
</script>

<svelte:head><title>찜한 장소 — 댕브리웨어</title></svelte:head>
<div class="mobile-page favorites-page">
  <span class="favorites-eyebrow"><Heart size={14} fill="currentColor" />MY FAVORITES</span>
  <h1>
    {store.dog ? `${store.dogNames}${josa(store.dogNames, '와/과')} 가고 싶은 곳` : '찜한 장소'}
  </h1>
  <p class="mobile-page-lead">
    모아둔 곳을 떠나기 전에 다시 확인하세요.<br />동반 규정은 언제든 바뀔 수 있어요.
  </p>
  {#if store.savedIds.length}
    <section class="favorites-summary" aria-label="찜한 장소 요약">
      <div><strong>{store.savedIds.length}</strong><span>찜한 장소</span></div>
      <div>
        <strong>{saved.filter((place) => place.sourceWeight !== null).length}</strong><span
          >체중 제한 기재</span
        >
      </div>
      <div class:warn={restrictedCount > 0}>
        {#if store.dog}<strong>{restrictedCount}</strong><span>{store.dogNames} 조건 제한 안내</span
          >{:else}<a href="/dog">우리 강아지를 등록하면<br />제한 안내를 볼 수 있어요</a>{/if}
      </div>
    </section>
    <CategoryStrip
      items={tabs}
      value={category}
      onchange={(value) => (category = value)}
      label="찜한 장소 유형"
    />
    {#if loading}<p role="status" class="mobile-page-lead">
        다른 지역의 찜한 장소도 불러오고 있어요…
      </p>{/if}
    {#if failed}<div class="favorites-error" role="status">
        <p>일부 장소 정보를 불러오지 못했어요.</p>
        <button onclick={() => loadMissing([...missingIds])}
          ><RefreshCw size={15} />다시 시도</button
        >
      </div>{/if}
    <div class="favorites-cards">
      {#each shown as place (place.id)}<FavoritePlaceCard
          {place}
          onselect={() => (selected = place)}
        />{/each}
    </div>
    {#if !loading && !failed && !shown.length}<div class="mobile-empty">
        <Heart size={30} />
        <p>저장된 장소 정보를 찾지 못했어요.<br />새로운 장소를 둘러볼까요?</p>
        <a class="primary-button" href="/explore"><MapIcon size={16} />매장 찾으러 가기</a>
      </div>{/if}
  {:else}<div class="favorites-empty">
      <span class="empty-icon"><Heart size={38} strokeWidth={1.5} /></span>
      <h2>아직 찜한 장소가 없어요</h2>
      <p>
        <ReadableText
          text={`지도에서 마음에 드는 곳의 하트를 눌러 보세요. 로그인하지 않아도 이 브라우저에 그대로 남아요.${!store.loggedIn ? ' 로그인하면 다른 기기에서도 같은 목록을 볼 수 있습니다.' : ''}`}
        />
      </p>
      <a class="primary-button" href="/explore"><MapIcon size={18} />매장 찾으러 가기</a>
      {#if !store.loggedIn}<button class="secondary-button" onclick={() => store.requestLogin()}
          ><LogIn size={18} />로그인하기</button
        >{/if}
    </div>{/if}
</div>
{#if selected}{#key selected.id}<PlaceSheet
      place={selected}
      onclose={() => (selected = null)}
    />{/key}{/if}

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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 23px 0 10px;
  }
  .favorites-summary > div {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 7px;
    min-height: 100px;
    padding: 13px 10px 13px 16px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #fff;
  }
  .favorites-summary strong {
    color: var(--brand);
    font-size: 27px;
  }
  .favorites-summary span {
    color: var(--muted);
    font-size: 10px;
    word-break: keep-all;
    line-height: 1.6;
  }
  .favorites-summary .warn {
    background: #fdf0ec;
    border-color: #f0d3cc;
  }
  .favorites-summary a {
    font-size: 10px;
    color: var(--brand-deep);
    line-height: 1.7;
  }
  .favorites-cards {
    display: grid;
    gap: 18px;
    margin-top: 14px;
  }
  .favorites-empty {
    margin-top: 25px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 25px 20px;
    border: 1px solid var(--line);
    border-radius: 23px;
    background: #fff;
    gap: 10px;
  }
  .empty-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 23px;
    background: var(--brand-soft);
    color: var(--brand);
    margin-bottom: 8px;
  }
  .favorites-empty h2 {
    font-size: 20px;
    letter-spacing: -0.7px;
    margin: 0;
  }
  .favorites-empty p {
    font-size: 13px;
    line-height: 1.85;
    word-break: keep-all;
    color: var(--muted);
    margin: 0 0 10px;
  }
  .favorites-page h1 {
    word-break: keep-all;
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
