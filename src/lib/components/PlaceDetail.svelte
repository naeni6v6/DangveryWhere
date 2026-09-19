<script lang="ts">
  import { onMount } from 'svelte';
  import { sheetDrag } from '$lib/actions/sheetDrag';
  import {
    X,
    Heart,
    ArrowUpRight,
    Phone,
    MapPin,
    Clock3,
    PawPrint,
    Info,
    ExternalLink,
    ChevronRight
  } from '@lucide/svelte';
  import {
    categoryNames,
    placeMenu,
    placeArea,
    policyLines,
    profileNotice,
    type Place,
    type DogProfile
  } from '$lib/domain/place';
  import { placeLink } from '$lib/domain/placeLink';
  import { photoCredit, providerInfo, providerOfUrl } from '$lib/domain/region';
  // 장소 사진 (scripts/fetch-place-images.mjs 로 생성, 강원 반려동물 동반관광 API 사진)
  import placeImages from '$lib/data/placeImages.json';
  import { menuBoardOf } from '$lib/data/menuBoards';
  import MenuBoard from './MenuBoard.svelte';
  let {
    place,
    dog,
    saved = false,
    onclose,
    onsave,
    appLayout = false
  }: {
    place: Place;
    dog: DogProfile | null;
    saved?: boolean;
    onclose: () => void;
    onsave: () => void;
    appLayout?: boolean;
  } = $props();
  const lines = $derived(policyLines(place.policy));
  // 메뉴는 카페·음식점에만. 원본의 같은 칸이 숙소에는 객실 요금으로 들어와요.
  const isFood = $derived(place.category === 'food');
  // 사진·설명이 있는 메뉴판을 옮겨 둔 가게는 그쪽을, 없으면 공공데이터 문구를 씁니다.
  const menu = $derived(placeMenu(place.menu ?? '', menuBoardOf(place.id)));
  // 제공처 이름은 원문 주소에서 되짚습니다. 지역마다 출처가 달라 문구에 박아 둘 수 없어요.
  const sourceName = $derived(
    providerInfo[providerOfUrl(place.sourceUrl) ?? 'gangwon-pettravel'].name
  );
  const notice = $derived(dog ? profileNotice(place, dog) : null);
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
  const link = $derived(placeLink(place));
  // 장소마다 최대 5장. 첫 장은 표지로 쓰고 나머지는 아래 사진 줄에 이어 붙입니다.
  const photos = $derived((placeImages as Record<string, string[]>)[place.id] ?? []);
  // 앱 시트(appLayout)는 표지를 감추고 있어서, 첫 장까지 사진 줄에 함께 싣습니다.
  const morePhotos = $derived(appLayout ? photos : photos.slice(1));
  // 사진을 못 불러오면 기존 발바닥 커버로 돌아가요
  let photoFailed = $state(false);
  $effect(() => {
    place.id;
    photoFailed = false;
  });
  const coverPhoto = $derived(photoFailed ? null : (photos[0] ?? null));
  // 공공누리 출처표시. 관광공사 사진이 한 장이라도 섞여 있으면 밝힙니다.
  const credit = $derived(photoCredit(photos));
  let panel: HTMLElement;
  let isMobile = $state(false);
  let detailExpanded = $state(false);
  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => (isMobile = media.matches);
    update();
    media.addEventListener('change', update);
    Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.getClientRects().length > 0)
      ?.focus({ preventScroll: true });
    return () => {
      media.removeEventListener('change', update);
      if (previous?.isConnected) previous.focus();
    };
  });
  function keepMobileFocus(event: KeyboardEvent) {
    if (!isMobile || appLayout || event.key !== 'Tab' || document.querySelector('dialog[open]'))
      return;
    const controls = Array.from(
      panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || !panel.contains(document.activeElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !panel.contains(document.activeElement))
    ) {
      event.preventDefault();
      first?.focus();
    }
  }
</script>

<svelte:window onkeydown={keepMobileFocus} />
<div
  bind:this={panel}
  class="detail-panel"
  class:app-detail={appLayout}
  class:expanded={detailExpanded}
  role="dialog"
  tabindex="-1"
  aria-modal={isMobile && !appLayout}
  aria-label={`${place.name} 상세 정보`}
>
  {#if appLayout}<button
      class="detail-drag"
      aria-label={detailExpanded ? '상세 정보 접기' : '상세 정보 펼치기'}
      aria-expanded={detailExpanded}
      use:sheetDrag={{ onSnap: (expanded) => (detailExpanded = expanded) }}
      onclick={() => (detailExpanded = !detailExpanded)}><span></span></button
    >{/if}
  <div class="detail-top">
    <span>장소 살펴보기</span><button
      class="icon-button"
      aria-label="장소 상세 닫기"
      onclick={onclose}><X size={20} /></button
    >
  </div>
  <div class="detail-scroll">
    <div class="detail-cover" class:has-photo={!!coverPhoto}>
      {#if coverPhoto}
        {#key coverPhoto}
          <img
            class="cover-photo"
            src={coverPhoto}
            alt={`${place.name} 사진`}
            decoding="async"
            onerror={() => (photoFailed = true)}
          />
        {/key}
      {:else}
        <PawPrint size={64} strokeWidth={0.9} /><span>GOOD PLACES, TOGETHER.</span>
        <div class="cover-circle"></div>
      {/if}
    </div>
    <div class="detail-body">
      <span class="eyebrow">{categoryNames[place.category]} · {placeArea(place).city}</span>
      <div class="detail-title">
        <h2>{place.name}</h2>
        <button
          class="icon-button"
          aria-label={`${place.name} ${saved ? '찜 해제' : '찜하기'}`}
          aria-pressed={saved}
          onclick={onsave}><Heart size={21} fill={saved ? 'currentColor' : 'none'} /></button
        >
      </div>
      <div class="detail-meta">
        <p class="detail-address"><MapPin size={14} />{place.address}</p>
        {#if phone}<a class="detail-phone" href={`tel:${phone}`}><Phone size={14} />{place.phone}</a
          >{/if}
      </div>
      <!-- 가게를 먼저 보여 주고(사진 → 소개 → 메뉴), 동반 규정은 그 아래에 둡니다. -->
      {#if morePhotos.length}<div class="photo-strip">
          {#each morePhotos as photo (photo)}
            <img src={photo} alt={`${place.name} 사진`} loading="lazy" decoding="async" />
          {/each}
        </div>{/if}
      {#if photos.length && credit}<p class="photo-credit">{credit}</p>{/if}
      {#if place.description}<div class="about-place">
          <h3>이런 곳이에요</h3>
          <p>{place.description}</p>
        </div>{/if}
      {#if isFood}<div class="menu-block">
          <h3>대표 메뉴</h3>
          <MenuBoard
            compact
            groups={menu.groups}
            notes={menu.notes}
            source={menu.source}
            emptyText="원본에 메뉴가 적혀 있지 않아요. 가게에 직접 물어봐 주세요."
          />
        </div>{/if}
      {#if place.hours}<div class="hours">
          <Clock3 size={15} />
          <p>{place.hours}</p>
        </div>{/if}
      <section class="policy-section">
        <div class="policy-heading">
          <PawPrint size={16} />
          <h3>함께 가기 전에</h3>
          <span>동반 규정</span>
        </div>
        {#if notice}<div class="profile-notice" class:restricted={notice.kind === 'restricted'}>
            <p class="notice-verdict"><strong>{dog?.name}</strong>{notice.label}</p>
            <p class="notice-detail">{notice.detail}</p>
          </div>{/if}
        <ul class="policy-list">
          {#each lines as line (line)}<li>{line}</li>{/each}
        </ul>
        {#if !lines.length}<p class="policy-empty">
            상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.
          </p>{/if}
        <p class="verification">
          <Info size={13} />
          <span>공공데이터에 등록된 안내예요. 최근 운영 규정은 방문 전에 확인해 주세요.</span>
        </p>
      </section>
      <a class="source-link" href={place.sourceUrl} target="_blank" rel="noreferrer"
        ><div>
          <span>정보 출처</span><strong>{sourceName}</strong><small
            >데이터 수집 {place.importedAt} · 규정 확인일 미제공</small
          >
        </div>
        <ExternalLink size={15} /></a
      >
    </div>
  </div>
  <div class="detail-actions">
    <a class="primary-button" href={link.url} target="_blank" rel="noreferrer"
      >상세 정보 확인<ArrowUpRight size={17} /></a
    >
  </div>
</div>

<style>
  .detail-panel {
    position: absolute;
    z-index: 15;
    right: 20px;
    top: 20px;
    bottom: 20px;
    width: 370px;
    background: white;
    box-shadow: 0 12px 70px #40311d26;
    border: 1px solid var(--line);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .detail-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px 10px 22px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
    color: var(--muted);
  }
  .detail-scroll {
    overflow: auto;
    flex: 1;
    overscroll-behavior: contain;
  }
  .detail-cover {
    height: 142px;
    background: #eae3d9;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    color: #a28b73;
    position: relative;
    overflow: hidden;
  }
  .detail-cover > span {
    font-size: 8px;
    letter-spacing: 2px;
  }
  .detail-cover.has-photo {
    display: block;
  }
  .cover-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /*
   * 표지에 못 실은 나머지 사진. 좌우로 밀어 보는 줄이라 detail-body 의 좌우 여백을
   * 음수 마진으로 지우고, 안쪽 패딩으로 되돌려 사진이 화면 끝까지 흘러가게 합니다.
   */
  .photo-credit {
    margin: -14px 0 20px;
    font-size: 11px;
    color: var(--muted);
  }
  .photo-strip {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 0 -25px 20px;
    padding: 0 25px 2px;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }
  .photo-strip::-webkit-scrollbar {
    display: none;
  }
  .photo-strip img {
    flex: none;
    width: 124px;
    height: 88px;
    object-fit: cover;
    border-radius: 9px;
    background: var(--cream);
    scroll-snap-align: start;
  }
  .cover-circle {
    position: absolute;
    right: -35px;
    top: -60px;
    width: 190px;
    height: 190px;
    border: 1px solid #fff9;
    border-radius: 50%;
  }
  .detail-body {
    padding: 25px;
  }
  .eyebrow {
    font-size: 11px;
    color: var(--brown);
  }
  .detail-title {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .detail-title h2 {
    font-size: 24px;
    line-height: 1.35;
    letter-spacing: -1px;
    margin: 0;
  }
  .detail-title button {
    flex-shrink: 0;
  }
  .detail-meta {
    margin: 10px 0 27px;
    display: grid;
    gap: 4px;
  }
  .detail-address {
    display: flex;
    align-items: start;
    gap: 7px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.7;
    margin: 0;
  }
  .detail-phone {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--muted);
    text-decoration: none;
    justify-self: start;
  }
  .detail-address :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .policy-section {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .policy-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--brown);
    margin-bottom: 11px;
  }
  .policy-heading h3 {
    font-size: 14px;
    margin: 0;
    color: var(--ink);
  }
  .policy-heading > span {
    font-size: 9.5px;
    margin-left: auto;
    color: var(--muted);
  }
  .policy-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* 규정 한 줄마다 앞에 점을 찍어 어디서 끊기는지 눈으로 잡히게 합니다. */
  .policy-list li {
    position: relative;
    padding: 8px 0 8px 14px;
    font-size: 12px;
    line-height: 1.8;
    word-break: keep-all;
  }
  .policy-list li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 16px;
    width: 4.5px;
    height: 4.5px;
    border-radius: 2px;
    background: #d8cec2;
  }
  .policy-empty {
    margin: 0;
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    word-break: keep-all;
  }
  .verification {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 13px 0 0;
    font-size: 10.5px;
    line-height: 1.75;
    color: var(--muted);
    word-break: keep-all;
  }
  .verification :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .about-place h3,
  .menu-block h3 {
    font-size: 14px;
    margin-top: 0;
  }
  .menu-block h3 {
    margin-top: 24px;
  }
  .about-place p,
  .hours p {
    font-size: 12px;
    line-height: 1.9;
    color: var(--muted);
    word-break: keep-all;
  }
  .hours {
    display: flex;
    align-items: start;
    gap: 8px;
    margin-top: 20px;
    color: var(--muted);
  }
  .hours :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }
  .hours p {
    margin: 0;
  }
  .source-link {
    margin-top: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: var(--muted);
    border-top: 1px solid var(--line);
    padding-top: 17px;
  }
  .source-link div {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .source-link span {
    font-size: 9px;
  }
  .source-link strong {
    font-size: 11px;
    font-weight: 500;
    color: var(--ink);
  }
  .source-link small {
    font-size: 9px;
  }
  .detail-actions {
    border-top: 1px solid var(--line);
    padding: 15px 20px;
    display: flex;
    gap: 9px;
  }
  .detail-actions a {
    flex: 1;
    font-size: 12px;
    min-height: 43px;
  }
  /*
   * 우리 아이 기준 안내. 칠한 카드 대신 왼쪽 세로줄 하나로 표시합니다.
   * 줄 색만으로 '확인 필요'와 '제한 있음'을 가릅니다.
   */
  .profile-notice {
    padding: 1px 0 1px 11px;
    margin-bottom: 13px;
    border-left: 2px solid var(--line);
  }
  .profile-notice.restricted {
    border-left-color: #c2694c;
  }
  .notice-verdict {
    margin: 0;
    font-size: 11px;
    color: var(--brown);
  }
  .profile-notice.restricted .notice-verdict {
    color: #b0573a;
  }
  .notice-verdict strong {
    color: var(--ink);
    font-size: 12px;
    margin-right: 7px;
  }
  .notice-detail {
    margin: 3px 0 0;
    font-size: 11px;
    line-height: 1.7;
    color: var(--muted);
    word-break: keep-all;
  }
  .detail-panel {
    position: fixed;
    inset: 70px 0 0;
    width: 100%;
    border-radius: 22px 22px 0 0;
    z-index: 50;
  }
  .detail-cover {
    height: 120px;
  }
  .detail-actions {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
  .detail-body {
    padding: 24px;
  }
  .detail-title h2 {
    font-size: 25px;
  }

  .app-detail .detail-cover {
    display: none;
  }
  .app-detail .detail-body {
    padding: 20px;
  }
  .app-detail .detail-title h2 {
    font-size: 22px;
  }
  .detail-panel.app-detail {
    position: absolute;
    inset: auto 0 var(--app-nav-height, 64px);
    width: 100%;
    height: min(62%, 590px);
    border-radius: 23px 23px 0 0;
    z-index: 25;
    transition: height 0.25s ease;
  }
  .detail-panel.app-detail.expanded {
    height: calc(100% - var(--app-nav-height, 64px) - 70px);
  }
  .detail-drag {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 100%;
    height: 23px;
    border: 0;
    background: transparent;
    cursor: ns-resize;
    touch-action: none;
  }
  .detail-drag span {
    width: 34px;
    height: 4px;
    border-radius: 3px;
    background: #d7cfc7;
  }
  .app-detail .detail-top {
    padding-top: 0;
  }
  .app-detail .detail-actions {
    padding-bottom: 14px;
  }
</style>
