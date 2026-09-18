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
    menuGroups,
    placeArea,
    policyLines,
    profileNotice,
    type Place,
    type DogProfile
  } from '$lib/domain/place';
  import { providerInfo, providerOfUrl } from '$lib/domain/region';
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
  const menu = $derived(menuGroups(place.menu ?? ''));
  // 제공처 이름은 원문 주소에서 되짚습니다. 지역마다 출처가 달라 문구에 박아 둘 수 없어요.
  const sourceName = $derived(
    providerInfo[providerOfUrl(place.sourceUrl) ?? 'gangwon-pettravel'].name
  );
  const notice = $derived(dog ? profileNotice(place, dog) : null);
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
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
    <div class="detail-cover">
      <PawPrint size={64} strokeWidth={0.9} /><span>GOOD PLACES, TOGETHER.</span>
      <div class="cover-circle"></div>
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
      <p class="detail-address"><MapPin size={14} />{place.address}</p>
      <div class="policy-heading">
        <PawPrint size={18} />
        <h3>함께 가기 전에</h3>
        <span>동반 규정</span>
      </div>
      {#if notice}<div class="profile-notice" class:restricted={notice.kind === 'restricted'}>
          <strong>{dog?.name} · {notice.label}</strong>
          <p>{notice.detail}</p>
        </div>{/if}
      <div class="policy-list">
        {#each lines as line, i}<div class="policy-row">
            <span class="policy-number">{String(i + 1).padStart(2, '0')}</span>
            <p>{line}</p>
          </div>{/each}
        {#if !lines.length}<p>상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.</p>{/if}
      </div>
      <div class="verification">
        <Info size={16} />
        <p>
          공공데이터에 등록된 안내예요.<br /><strong
            >최근 운영 규정은 방문 전에 확인해 주세요.</strong
          >
        </p>
      </div>
      {#if place.description}<div class="about-place">
          <h3>이런 곳이에요</h3>
          <p>{place.description}</p>
        </div>{/if}
      {#if isFood}<div class="menu-block">
          <h3>대표 메뉴</h3>
          {#each menu.groups as group, i (i)}
            {#if group.title}<strong class="menu-group">{group.title}</strong>{/if}
            <ul class="menu-items">
              {#each group.items as item (item)}<li>{item}</li>{/each}
            </ul>
          {/each}
          {#each menu.notes as note (note)}<p class="menu-note">{note}</p>{/each}
          <!-- 원본에 메뉴 칸이 없는 가게도 있습니다. 없는 걸 지어내지 않습니다. -->
          {#if !menu.groups.length && !menu.notes.length}<p class="menu-note">
              원본에 메뉴가 적혀 있지 않아요. 가게에 직접 물어봐 주세요.
            </p>{/if}
          {#if menu.groups.length}<p class="menu-note">
              메뉴와 가격은 바뀔 수 있어요. 방문 전에 확인해 주세요.
            </p>{/if}
        </div>{/if}
      {#if place.hours}<div class="hours">
          <Clock3 size={15} />
          <p>{place.hours}</p>
        </div>{/if}
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
    {#if phone}<a class="secondary-button" href={`tel:${phone}`}><Phone size={17} />전화 문의</a
      >{/if}
    <a
      class="primary-button"
      href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`}
      target="_blank"
      rel="noreferrer">길찾기<ArrowUpRight size={17} /></a
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
  .detail-address {
    display: flex;
    align-items: start;
    gap: 7px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.7;
    margin: 10px 0 27px;
  }
  .detail-address :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .policy-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--brown);
    margin-bottom: 15px;
  }
  .policy-heading h3 {
    font-size: 15px;
    margin: 0;
  }
  .policy-heading > span {
    font-size: 9px;
    margin-left: auto;
    color: var(--muted);
  }
  .policy-list {
    border-top: 1px solid var(--line);
  }
  .policy-row {
    display: flex;
    gap: 11px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .policy-number {
    font-size: 10px;
    color: #ae957f;
    padding-top: 4px;
  }
  .policy-row p {
    margin: 0;
    font-size: 12px;
    line-height: 1.85;
    word-break: keep-all;
  }
  .verification {
    display: flex;
    gap: 9px;
    color: var(--muted);
    background: #f8f6f2;
    padding: 13px;
    border-radius: 9px;
    margin: 18px 0;
  }
  .verification :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .verification p {
    margin: 0;
    font-size: 10px;
    line-height: 1.8;
  }
  .verification strong {
    font-weight: 500;
  }
  .about-place h3,
  .menu-block h3 {
    font-size: 14px;
    margin-top: 26px;
  }
  .menu-group {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--muted);
    margin: 12px 0 5px;
  }
  .menu-items {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .menu-items li {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11.5px;
    line-height: 1.4;
    word-break: keep-all;
  }
  .menu-note {
    margin: 9px 0 0;
    font-size: 11.5px;
    line-height: 1.8;
    color: var(--muted);
    word-break: keep-all;
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
  .profile-notice {
    background: var(--cream);
    padding: 13px;
    border-radius: 8px;
    margin-bottom: 15px;
    font-size: 12px;
  }
  .profile-notice strong {
    color: var(--brown);
    font-size: 11px;
  }
  .profile-notice p {
    margin: 6px 0 0;
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
  }
  .profile-notice.restricted {
    background: #fcf0e8;
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
