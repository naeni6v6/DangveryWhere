<script lang="ts">
  import {
    Heart,
    MapPin,
    Map,
    ArrowRight,
    ArrowUpRight,
    Scale,
    TriangleAlert,
    LogIn
  } from '@lucide/svelte';
  import WebPlaceDetail from '$lib/components/web/WebPlaceDetail.svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import {
    placeArea,
    placeTheme,
    policyLines,
    shortAddress,
    themeNames,
    type Place,
    type ThemeFilter,
  } from '$lib/domain/place';
  import { placeLink } from '$lib/domain/placeLink';
  import { josa } from '$lib/domain/korean';
  import { getWebStore } from '$lib/web/store.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  let selected = $state<Place | null>(null);
  let category = $state<ThemeFilter>('all');

  // 찜한 곳은 지금 보고 있는 지역 밖일 수도 있어, 서버가 지역을 가리지 않고 찾아 준 목록을 씁니다.
  const byId = $derived(
    new globalThis.Map([...data.places, ...data.favoritePlaces].map((place) => [place.id, place]))
  );
  // 최근에 찜한 순서대로 보여줍니다.
  const saved = $derived(
    store.savedIds.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place))
  );
  const shown = $derived(
    category === 'all' ? saved : saved.filter((place) => placeTheme(place) === category)
  );
  // 찜한 곳이 하나도 없는 분류는 탭에서 빼, 빈 탭이 줄줄이 늘어서지 않게 합니다.
  const tabs = $derived(
    ([
      'all',
      'cafe',
      'restaurant',
      'stay',
      'outdoor',
      'activity',
      'culture',
      'shopping',
      'hospital'
    ] as ThemeFilter[])
      .map((id) => ({
        id,
        label: themeNames[id],
        count: id === 'all' ? saved.length : saved.filter((place) => placeTheme(place) === id).length
      }))
      .filter((tab) => tab.id === 'all' || tab.count > 0)
  );
  // 둘을 함께 보고 있으면 한 마리라도 걸리는 곳을 셉니다.
  const restrictedCount = $derived(
    store.dog ? saved.filter((place) => store.restrictedFor(place)).length : 0
  );
  // 시도만 떼고 시군구는 남겨 둡니다. 여러 지역이 섞이면 어디인지 보여야 하니까요.
  const cityAddress = (place: Place) =>
    [placeArea(place).city, shortAddress(place)].filter(Boolean).join(' ');

  // 마지막 한 곳의 찜을 풀면 그 탭이 사라지므로, 빈 화면에 갇히지 않게 전체로 돌려놓습니다.
  $effect(() => {
    if (!tabs.some((tab) => tab.id === category)) category = 'all';
  });
</script>

<svelte:head>
  <title>찜한 장소 — 댕브리웨어</title>
</svelte:head>
<svelte:window onkeydown={(event) => event.key === 'Escape' && (selected = null)} />

<div class="page-scroll">
  <div class="page">
    <header class="page-head">
      <div>
        <span class="page-eyebrow"><Heart size={16} fill="currentColor" />MY FAVORITES</span>
        <h1>
          {#if store.dog}{store.dogNames}{josa(store.dogNames, '와/과')} 가고 싶은 곳{:else}찜한
            장소{/if}
        </h1>
        <p>모아둔 곳을 떠나기 전에 다시 확인하세요. 동반 규정은 언제든 바뀔 수 있어요.</p>
      </div>
    </header>

    {#if !store.loggedIn}
      <section class="login-card">
        <span class="login-icon"><Heart size={38} strokeWidth={1.5} /></span>
        <div>
          <h2>로그인하면 가고 싶은 곳을 모아둘 수 있어요</h2>
          <p>
            카카오 계정으로 로그인하고 장소의 하트를 눌러 보세요. 찜한 장소와 우리 강아지 정보가
            다음 방문에도 그대로 남아요.
          </p>
        </div>
        <div class="login-actions">
          <button class="primary-button" onclick={() => store.requestLogin()}
            ><LogIn size={18} />로그인하기</button
          >
          <a class="secondary-button" href="/web/explore">먼저 둘러보기</a>
        </div>
      </section>
    {:else}
      <section class="summary">
        <div class="summary-item">
          <strong>{saved.length}</strong><span>찜한 장소</span>
        </div>
        <div class="summary-item">
          <strong>{saved.filter((place) => place.sourceWeight !== null).length}</strong><span
            >체중 제한 기재</span
          >
        </div>
        <div class="summary-item" class:warn={restrictedCount > 0}>
          {#if store.dog}<strong>{restrictedCount}</strong><span
              >{store.dogNames} 조건 제한 안내</span
            >{:else}<a href="/web/dog">우리 강아지를 등록하면<br />제한 안내를 볼 수 있어요</a
            >{/if}
        </div>
      </section>

      <div class="tabs" role="tablist" aria-label="장소 유형">
        {#each tabs as tab (tab.id)}<button
            role="tab"
            aria-selected={category === tab.id}
            class:active={category === tab.id}
            onclick={() => (category = tab.id)}>{tab.label}<span>{tab.count}</span></button
          >{/each}
      </div>

      {#if shown.length}
        <div class="fav-grid">
          {#each shown as place (place.id)}
            {@const theme = placeTheme(place)}
            {@const restricted = store.restrictedFor(place)}
            <article class="fav-card" class:chosen={selected?.id === place.id}>
              <button class="fav-main" onclick={() => (selected = place)}>
                <div class="fav-top">
                  <span class="fav-icon"><ThemeIcon {theme} size={25} strokeWidth={1.4} /></span>
                  <div>
                    <small>{themeNames[theme]}</small>
                    <strong>{place.name}</strong>
                  </div>
                </div>
                <span class="fav-address"><MapPin size={14} />{cityAddress(place)}</span>
                <p class="fav-policy">
                  {policyLines(place.policy)[0] ?? '상세 규정이 부족해요. 방문 전 문의해 주세요.'}
                </p>
                <div class="fav-tags">
                  {#if place.sourceWeight !== null}<span class="tag"
                      ><Scale size={14} />제한 체중 {place.sourceWeight}kg</span
                    >{/if}
                  <!-- 둘을 함께 보고 있으면 누가 걸리는지까지 적어 줍니다. -->
                  {#if restricted}<span class="tag warn"
                      ><TriangleAlert size={14} />{store.activeDogs.length > 1
                        ? `${restricted.dog.name} ${restricted.label}`
                        : restricted.label}</span
                    >{/if}
                </div>
              </button>
              <div class="fav-actions">
                <a href={`/web/explore?place=${place.id}`}><Map size={16} />지도에서 보기</a>
                <a href={placeLink(place).url} target="_blank" rel="noreferrer"
                  >상세 정보 확인<ArrowUpRight size={15} /></a
                >
                <button
                  class="fav-heart"
                  aria-label={`${place.name} 찜 해제`}
                  onclick={() => store.toggleSave(place)}
                  ><Heart size={19} fill="currentColor" /></button
                >
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <Heart size={40} strokeWidth={1} />
          <h3>{saved.length ? '이 유형에 찜한 장소가 없어요' : '아직 찜한 장소가 없어요'}</h3>
          <p>지도에서 마음에 드는 장소의 하트를 눌러보세요.</p>
          <a class="secondary-button" href="/web/explore">장소 찾으러 가기<ArrowRight size={17} /></a>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if selected}<WebPlaceDetail
    place={selected}
    dogs={store.activeDogs}
    saved={store.isSaved(selected.id)}
    onclose={() => (selected = null)}
    onsave={() => selected && store.toggleSave(selected)}
  />{/if}

<style>
  .page-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .page {
    width: min(1320px, calc(100% - 72px));
    margin: 0 auto;
    padding: 44px 0 70px;
  }
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 32px;
  }
  .page-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--brand);
  }
  .page-head h1 {
    font-size: 38px;
    letter-spacing: -1.5px;
    margin: 10px 0 8px;
  }
  .page-head p {
    font-size: 17px;
    color: var(--muted);
    margin: 0;
  }

  .login-card {
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 40px 44px;
    border-radius: 26px;
    background: #fff;
    border: 1px solid var(--line);
  }
  .login-icon {
    display: grid;
    place-items: center;
    width: 90px;
    height: 90px;
    flex-shrink: 0;
    border-radius: 28px;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .login-card h2 {
    font-size: 25px;
    letter-spacing: -0.8px;
    margin: 0 0 10px;
  }
  .login-card p {
    font-size: 16px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0;
    word-break: keep-all;
  }
  .login-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    min-width: 200px;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-bottom: 30px;
  }
  .summary-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-height: 116px;
    padding: 24px 28px;
    border-radius: 20px;
    background: #fff;
    border: 1px solid var(--line);
  }
  .summary-item strong {
    font-size: 36px;
    letter-spacing: -1px;
    color: var(--brand);
  }
  .summary-item span {
    font-size: 15px;
    color: var(--muted);
  }
  .summary-item.warn {
    background: #fdf0ec;
    border-color: #f0d3cc;
  }
  .summary-item a {
    font-size: 15.5px;
    line-height: 1.6;
    color: var(--brand);
    font-weight: 600;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 24px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 20px;
    border-radius: 24px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--brown-warm);
    font-size: 15.5px;
  }
  .tabs button span {
    font-size: 13px;
    color: var(--muted);
  }
  .tabs button.active {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
    font-weight: 600;
  }
  .tabs button.active span {
    color: #ffffffcc;
  }

  .fav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 20px;
  }
  .fav-card {
    display: flex;
    flex-direction: column;
    border-radius: 22px;
    background: #fff;
    border: 1px solid var(--line);
    overflow: hidden;
    transition: box-shadow 0.18s;
  }
  .fav-card:hover {
    box-shadow: 0 14px 36px #4a34281a;
  }
  .fav-card.chosen {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px #b5704e33;
  }
  .fav-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 26px 26px 20px;
    border: 0;
    background: none;
    text-align: left;
  }
  .fav-top {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .fav-top > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .fav-top small {
    font-size: 13.5px;
    color: var(--muted);
  }
  .fav-top strong {
    font-size: 20px;
    letter-spacing: -0.6px;
    color: var(--ink);
  }
  /* 가게 찾기 목록과 같은 미니멀 라인형으로 맞춥니다. */
  .fav-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--sand);
    color: var(--ink);
  }
  .fav-card:hover .fav-icon,
  .fav-card.chosen .fav-icon {
    background: var(--brand-soft);
    color: var(--brand-deep);
  }
  .fav-address {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: var(--muted);
  }
  .fav-policy {
    margin: 0;
    padding: 13px 15px;
    border-radius: 12px;
    background: var(--cream);
    font-size: 14.5px;
    line-height: 1.7;
    color: var(--ink);
    word-break: keep-all;
  }
  .fav-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .tag.warn {
    background: #fdebe4;
    color: #b0462c;
    font-weight: 600;
  }
  .fav-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px 12px 20px;
    border-top: 1px solid var(--line);
    background: #fffcf8;
  }
  .fav-actions a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 14.5px;
    color: var(--brown-warm);
    text-decoration: none;
  }
  .fav-actions a:hover {
    background: var(--sand);
  }
  .fav-heart {
    margin-left: auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .fav-heart:hover {
    background: #f1d2d6;
  }
  .empty-state {
    padding: 70px 20px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 24px;
  }
  @media (max-width: 1100px) {
    .login-card {
      flex-direction: column;
      align-items: flex-start;
    }
    .summary {
      grid-template-columns: 1fr;
    }
  }
</style>
