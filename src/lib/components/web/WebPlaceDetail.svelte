<script lang="ts">
  import { onMount } from 'svelte';
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
    ZoomIn,
    ChevronLeft,
    ChevronRight
  } from '@lucide/svelte';
  import {
    placeMenu,
    placeArea,
    placeTheme,
    themeNames,
    policyLines,
    profileNotice,
    type Place,
    type DogProfile
  } from '$lib/domain/place';
  import { placeLink, placeLinkLabel } from '$lib/domain/placeLink';
  import { photoCredit, providerInfo, providerOfUrl } from '$lib/domain/region';
  // 장소 대표 사진 (scripts/fetch-place-images.mjs 로 생성, 강원 반려동물 동반관광 API 사진)
  import placeImages from '$lib/data/placeImages.json';
  import { menuBoardOf } from '$lib/data/menuBoards';
  import MenuBoard from '../MenuBoard.svelte';
  import ThemeIcon from './ThemeIcon.svelte';
  let {
    place,
    dogs = [],
    saved = false,
    panel = $bindable<HTMLElement>(),
    onclose,
    onsave
  }: {
    place: Place;
    /** 기준으로 고른 아이들. 둘을 함께 보고 있으면 안내도 두 줄이 됩니다. */
    dogs?: DogProfile[];
    saved?: boolean;
    panel?: HTMLElement;
    onclose: () => void;
    onsave: () => void;
  } = $props();
  const theme = $derived(placeTheme(place));
  // 동물병원은 '동반 장소'가 아니라 응급·진료용이라 안내 문구를 따로 씁니다.
  const isHospital = $derived(place.category === 'hospital');
  // 지역명은 이 장소의 주소에서 그대로 가져옵니다.
  const area = $derived(placeArea(place).city);
  const lines = $derived(policyLines(place.policy));
  // 제공처 이름은 원문 주소에서 되짚습니다. 지역마다 출처가 달라 문구에 박아 둘 수 없어요.
  const sourceName = $derived(
    providerInfo[providerOfUrl(place.sourceUrl) ?? 'gangwon-pettravel'].name
  );
  const notices = $derived(dogs.map((dog) => ({ name: dog.name, ...profileNotice(place, dog) })));
  // 메뉴는 식당·카페에만 보여 줍니다. 원본의 같은 칸이 숙소에는 객실 요금으로 들어와요.
  const isFood = $derived(place.category === 'food');
  // 사진·설명이 있는 메뉴판을 옮겨 둔 가게는 그쪽을, 없으면 공공데이터 문구를 씁니다.
  const menu = $derived(placeMenu(place.menu ?? '', menuBoardOf(place.id)));
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
  // '상세 정보 확인'이 여는 곳. 업소 홈페이지가 살아 있으면 그곳, 아니면 네이버 지도 검색.
  const link = $derived(placeLink(place));
  // 장소마다 최대 5장. 첫 장은 표지로 쓰고 나머지는 아래 사진 줄에 이어 붙입니다.
  const photos = $derived((placeImages as Record<string, string[]>)[place.id] ?? []);
  const photoSrc = $derived(photos[0] ?? null);
  // 공공누리 출처표시. 관광공사 사진이 한 장이라도 섞여 있으면 밝힙니다.
  const credit = $derived(photoCredit(photos));
  const morePhotos = $derived(photos.slice(1));
  // 사진을 못 불러오면 기존 갈색 커버로 돌아가요
  let photoFailed = $state(false);
  $effect(() => {
    place.id;
    photoFailed = false;
  });
  const hasPhoto = $derived(!!photoSrc && !photoFailed);

  /**
   * 사진 크게 보기.
   * 목록의 사진은 작게 잘려 있어서 간판·메뉴판 글씨가 안 읽혀요. 눌러서 원본 크기로 펼쳐 봅니다.
   * 열려 있는 사진의 번호를 담고, 닫혀 있으면 null 입니다.
   */
  let zoomed = $state<number | null>(null);
  const zoomStep = (move: number) => {
    if (zoomed === null) return;
    zoomed = (zoomed + move + photos.length) % photos.length;
  };
  // 다른 장소로 넘어가면 크게 보던 사진은 닫습니다.
  $effect(() => {
    place.id;
    zoomed = null;
  });
  let zoomLayer = $state<HTMLElement>();
  // 열릴 때 초점을 안으로 들여야 방향키·Esc 가 먹고, Esc 가 장소 상세까지 같이 닫지 않아요.
  $effect(() => {
    if (zoomed !== null) zoomLayer?.focus({ preventScroll: true });
  });

  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  });
</script>

<div
  bind:this={panel}
  class="web-detail"
  role="dialog"
  tabindex="-1"
  aria-label={`${place.name} 상세 정보`}
>
  <div class="detail-cover" class:has-photo={hasPhoto}>
    {#if hasPhoto && photoSrc}
      {#key photoSrc}
        <img
          class="cover-photo"
          src={photoSrc}
          alt={`${place.name} 사진`}
          decoding="async"
          onerror={() => (photoFailed = true)}
        />
      {/key}
      <span class="cover-shade" aria-hidden="true"></span>
      <!-- 사진을 눌러 크게 볼 수 있다는 걸 돋보기 표로 알려 줍니다 -->
      <button class="zoom-cover" type="button" onclick={() => (zoomed = 0)}>
        <span class="zoom-badge"
          ><ZoomIn size={16} />크게 보기{#if photos.length > 1}
            <em>{photos.length}장</em>{/if}</span
        >
      </button>
    {/if}
    <div class="cover-top">
      <span>장소 살펴보기</span>
      <button class="icon-button cover-close" aria-label="장소 상세 닫기" onclick={onclose}
        ><X size={22} /></button
      >
    </div>
    <!-- 사진을 아직 못 구한 가게. 바탕만 띄워 두면 무엇이 빠진 건지 알 수 없어서,
         사진이 들어올 자리라는 걸 한가운데에 적어 둡니다. -->
    {#if !hasPhoto}<div class="cover-empty">
        <ThemeIcon {theme} size={30} strokeWidth={1.4} />
        <strong>사진 준비중</strong>
        <span>{themeNames[theme]} 사진을 모으고 있어요</span>
      </div>{/if}
    <div class="cover-text">
      <span class="cover-eyebrow">{themeNames[theme]}{area ? ' · ' + area : ''}</span>
      <h2>{place.name}</h2>
      <p class="cover-address"><MapPin size={15} />{place.address}</p>
      {#if phone}<a class="cover-phone" href={`tel:${phone}`}><Phone size={15} />{place.phone}</a
        >{/if}
    </div>
    {#if !hasPhoto}<div class="cover-circle"></div>{/if}
  </div>

  <div class="detail-scroll">
    <div class="detail-body">
      <!-- 가게를 먼저 보여 주고(사진 → 소개 → 메뉴), 동반 규정은 그 아래에 둡니다. -->
      {#if hasPhoto && morePhotos.length}<div class="photo-strip">
          {#each morePhotos as photo, index (photo)}
            <button
              class="photo-thumb"
              type="button"
              aria-label={`${place.name} 사진 ${index + 2} 크게 보기`}
              onclick={() => (zoomed = index + 1)}
            >
              <img src={photo} alt={`${place.name} 사진`} loading="lazy" decoding="async" />
              <span class="zoom-mark" aria-hidden="true"><ZoomIn size={15} /></span>
            </button>
          {/each}
        </div>{/if}
      {#if hasPhoto && credit}<p class="photo-credit">{credit}</p>{/if}
      {#if place.description}<section class="about-place">
          <h3>이런 곳이에요</h3>
          <p>{place.description}</p>
        </section>{/if}
      {#if isFood}<section class="menu-card">
          <div class="menu-head">
            <ThemeIcon {theme} size={18} strokeWidth={1.6} />
            <h3>대표 메뉴</h3>
            {#if menu.groups.length}<span>{menu.source ? menu.source.name : '원본 등록 기준'}</span
              >{/if}
          </div>
          <MenuBoard
            groups={menu.groups}
            notes={menu.notes}
            source={menu.source}
            emptyText="원본에 메뉴가 적혀 있지 않아요. 가게에 직접 물어봐 주세요."
          />
        </section>{/if}
      {#if place.hours}<div class="hours">
          <Clock3 size={15} />
          <p>{place.hours}</p>
        </div>{/if}
      <section class="policy-section">
        <div class="policy-heading">
          <PawPrint size={17} />
          <h3>{isHospital ? '진료 전에' : '함께 가기 전에'}</h3>
          <span>{isHospital ? '병원 정보' : '동반 규정'}</span>
        </div>
        {#if !isHospital}{#each notices as notice, index (index)}<div
              class="profile-notice"
              class:restricted={notice.kind === 'restricted'}
            >
              <p class="notice-verdict">
                <strong>{notice.name}</strong>{notice.label}
              </p>
              <p class="notice-detail">{notice.detail}</p>
            </div>{/each}{/if}
        <ul class="policy-list">
          {#each lines as line (line)}<li>{line}</li>{/each}
        </ul>
        <!-- 원본이 동물병원에는 진료시간·진료과목을 주지 않습니다. 없는 걸 있는 척하지 않습니다. -->
        {#if !lines.length}<p class="policy-empty">
            {isHospital
              ? '진료 시간과 진료 과목은 원본 데이터에 없어요. 방문 전 전화로 확인해 주세요.'
              : '상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.'}
          </p>{/if}
        <p class="verification">
          <Info size={14} />
          <span
            >공공데이터에 등록된 안내예요. {isHospital
              ? '진료 시간과 응급 여부는 전화로 확인해 주세요.'
              : '최근 운영 규정은 방문 전에 확인해 주세요.'}</span
          >
        </p>
      </section>
      <a class="source-link" href={place.sourceUrl} target="_blank" rel="noreferrer"
        ><div>
          <span>{hasPhoto && !credit ? '정보·사진 출처' : '정보 출처'}</span><strong
            >{sourceName}</strong
          ><small>데이터 수집 {place.importedAt} · 규정 확인일 미제공</small>
        </div>
        <ExternalLink size={15} /></a
      >
    </div>
  </div>

  <div class="detail-actions">
    <button
      class="save-toggle"
      class:saved
      aria-label={`${place.name} ${saved ? '찜 해제' : '찜하기'}`}
      aria-pressed={saved}
      onclick={onsave}><Heart size={20} fill={saved ? 'currentColor' : 'none'} /></button
    >
    <a class="primary-button" href={link.url} target="_blank" rel="noreferrer"
      >{placeLinkLabel(link)}<ArrowUpRight size={16} /></a
    >
  </div>
</div>

<!--
  사진 크게 보기.
  키 입력은 여기서 받아 멈춰 세웁니다. 그냥 두면 Esc 한 번에 장소 상세까지 같이 닫혀요.
-->
{#if zoomed !== null}
  <div
    class="zoom-layer"
    bind:this={zoomLayer}
    role="dialog"
    aria-modal="true"
    aria-label={`${place.name} 사진 크게 보기`}
    tabindex="-1"
    onkeydown={(event) => {
      if (event.key === 'Escape') zoomed = null;
      else if (event.key === 'ArrowLeft') zoomStep(-1);
      else if (event.key === 'ArrowRight') zoomStep(1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    }}
  >
    <!-- 사진 바깥을 누르면 닫힙니다 -->
    <button
      class="zoom-backdrop"
      type="button"
      aria-label="크게 보기 닫기"
      onclick={() => (zoomed = null)}
    ></button>
    <img class="zoom-photo" src={photos[zoomed]} alt={`${place.name} 사진 ${zoomed + 1}`} />
    <button
      class="zoom-close"
      type="button"
      aria-label="크게 보기 닫기"
      onclick={() => (zoomed = null)}><X size={22} /></button
    >
    {#if photos.length > 1}
      <button
        class="zoom-nav prev"
        type="button"
        aria-label="이전 사진"
        onclick={() => zoomStep(-1)}><ChevronLeft size={26} /></button
      >
      <button class="zoom-nav next" type="button" aria-label="다음 사진" onclick={() => zoomStep(1)}
        ><ChevronRight size={26} /></button
      >
      <p class="zoom-count">{zoomed + 1} / {photos.length}</p>
    {/if}
  </div>
{/if}

<style>
  .web-detail {
    position: absolute;
    z-index: 15;
    right: 24px;
    top: 24px;
    bottom: 24px;
    width: var(--detail-w, 490px);
    max-width: calc(100% - 48px);
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: 0 18px 60px #5a1f2a26;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .detail-cover {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 260px;
    padding: 14px 22px 22px;
    background: linear-gradient(135deg, var(--brand-deep) 0%, var(--brand) 55%, #b5553f 100%);
    color: #fff;
  }
  /* 실제 가게 사진 커버 */
  .detail-cover.has-photo {
    min-height: 240px;
    background: var(--brown-deep);
  }
  .cover-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: photo-in 0.35s ease-out;
  }
  @keyframes photo-in {
    from {
      opacity: 0;
    }
  }
  /* 사진 위 글자가 읽히도록 위·아래를 어둡게 */
  .cover-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #1e120c73 0%, #1e120c00 32%, #1e120c1f 52%, #1e120cc7 100%);
  }
  .cover-top,
  .cover-text {
    position: relative;
    z-index: 1;
  }
  .has-photo .cover-text {
    margin-top: auto;
    padding-top: 40px;
    text-shadow: 0 1px 10px #0000004d;
  }
  /* 사진을 덮은 '크게 보기' 단추 위로 올려, 닫기 단추가 계속 눌리게 합니다. */
  .cover-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12.5px;
    letter-spacing: 0.4px;
    color: #ffffffc0;
    margin-bottom: 12px;
  }
  .has-photo .cover-top {
    color: #fffffff0;
    margin-bottom: 0;
  }
  .cover-close {
    color: #fff;
  }
  .cover-close:hover {
    background: #ffffff26;
  }
  .has-photo .cover-close {
    background: #00000038;
    backdrop-filter: blur(4px);
  }
  .has-photo .cover-close:hover {
    background: #00000059;
  }
  /* 사진이 들어올 자리 */
  .cover-empty {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 120px;
    margin: 14px 0 16px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px dashed #ffffff59;
    border-radius: 16px;
    background: #ffffff14;
    color: #fff;
  }
  .cover-empty strong {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .cover-empty span {
    font-size: 12.5px;
    color: #ffffffbd;
  }
  .cover-eyebrow {
    font-size: 12.5px;
    color: #ffe3cf;
  }
  .has-photo .cover-eyebrow {
    color: #ffffffd9;
  }
  .detail-cover h2 {
    font-size: 24px;
    line-height: 1.3;
    letter-spacing: -0.7px;
    margin: 4px 0 6px;
  }
  .cover-address {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin: 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: #ffffffd9;
  }
  .cover-address :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .cover-phone {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    font-size: 13.5px;
    color: #ffffffd9;
    text-decoration: none;
  }
  .cover-phone :global(svg) {
    flex-shrink: 0;
  }
  .cover-circle {
    position: absolute;
    right: -50px;
    top: -70px;
    width: 220px;
    height: 220px;
    border: 1px solid #ffffff55;
    border-radius: 50%;
  }
  .detail-scroll {
    overflow: auto;
    flex: 1;
    overscroll-behavior: contain;
  }
  .detail-body {
    padding: 22px 24px 26px;
  }
  .policy-section {
    margin-top: 26px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  .policy-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--brown);
    margin-bottom: 12px;
  }
  .policy-heading h3 {
    font-size: 15.5px;
    margin: 0;
    color: var(--ink);
  }
  .policy-heading > span {
    font-size: 11.5px;
    margin-left: auto;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  /*
   * 우리 아이 기준 안내. 칠한 카드 대신 왼쪽 세로줄 하나로 표시합니다.
   * 줄 색만으로 '확인 필요'와 '제한 있음'을 가릅니다.
   */
  .profile-notice {
    padding: 2px 0 2px 13px;
    margin-bottom: 14px;
    border-left: 2px solid var(--line);
  }
  .profile-notice.restricted {
    border-left-color: #c2694c;
  }
  .notice-verdict {
    margin: 0;
    font-size: 13px;
    color: var(--brown);
  }
  .profile-notice.restricted .notice-verdict {
    color: #b0573a;
  }
  .notice-verdict strong {
    color: var(--ink);
    font-size: 13.5px;
    margin-right: 8px;
  }
  .notice-detail {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--muted);
    word-break: keep-all;
  }
  .policy-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* 규정 한 줄마다 앞에 점을 찍어 어디서 끊기는지 눈으로 잡히게 합니다. */
  .policy-list li {
    position: relative;
    padding: 10px 0 10px 16px;
    font-size: 13.5px;
    line-height: 1.75;
    word-break: keep-all;
  }
  .policy-list li::before {
    content: '';
    position: absolute;
    left: 3px;
    top: 19px;
    width: 5px;
    height: 5px;
    border-radius: 2px;
    background: #d8cec2;
  }
  .policy-empty {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.75;
    color: var(--muted);
    word-break: keep-all;
  }
  .verification {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--muted);
    word-break: keep-all;
  }
  .verification :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
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
    gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 0 -24px 22px;
    padding: 0 24px 2px;
    scroll-snap-type: x proximity;
    /* 오른쪽 사진이 잘려 보이는 것만으로 '더 있다'가 읽혀서 스크롤바는 숨깁니다. */
    scrollbar-width: none;
  }
  .photo-strip::-webkit-scrollbar {
    display: none;
  }
  /* 사진 한 장 = 누를 수 있는 단추. 돋보기 표로 크게 볼 수 있다는 걸 알립니다. */
  .photo-thumb {
    position: relative;
    flex: none;
    padding: 0;
    border: 0;
    border-radius: 10px;
    overflow: hidden;
    background: none;
    cursor: zoom-in;
    scroll-snap-align: start;
  }
  .photo-strip img {
    display: block;
    width: 148px;
    height: 104px;
    object-fit: cover;
    background: var(--cream);
    transition: transform 0.25s ease;
  }
  .photo-thumb:hover img,
  .photo-thumb:focus-visible img {
    transform: scale(1.06);
  }
  .zoom-mark {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: #1f140eb8;
    color: #fff;
  }
  .photo-thumb:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* 표지 사진 전체를 누를 수 있게 덮되, 위에 얹힌 닫기 단추·글자보다는 아래에 둡니다. */
  .zoom-cover {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: zoom-in;
  }
  .zoom-badge {
    position: absolute;
    right: 14px;
    bottom: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: #1f140ecc;
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
    transition: background 0.16s;
  }
  .zoom-badge em {
    font-style: normal;
    opacity: 0.75;
  }
  .zoom-cover:hover .zoom-badge,
  .zoom-cover:focus-visible .zoom-badge {
    background: var(--brand-deep);
  }
  .zoom-cover:focus-visible {
    outline: 2px solid #fff;
    outline-offset: -4px;
  }

  /* ---------- 사진 크게 보기 ---------- */
  .zoom-layer {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: clamp(16px, 4vw, 56px);
  }
  .zoom-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: #1c120bdb;
    cursor: zoom-out;
    animation: zoom-fade 0.18s ease-out;
  }
  .zoom-photo {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    border-radius: 14px;
    object-fit: contain;
    box-shadow: 0 30px 70px -30px #000000a6;
    animation: zoom-in 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  @keyframes zoom-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes zoom-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
  }
  .zoom-close,
  .zoom-nav {
    position: absolute;
    display: grid;
    place-items: center;
    border: 1px solid #ffffff3d;
    border-radius: 50%;
    background: #241811d9;
    color: #fff;
    cursor: pointer;
    transition:
      background 0.16s,
      transform 0.16s;
  }
  .zoom-close {
    top: clamp(14px, 3vw, 28px);
    right: clamp(14px, 3vw, 28px);
    width: 46px;
    height: 46px;
  }
  .zoom-nav {
    top: 50%;
    width: 52px;
    height: 52px;
    margin-top: -26px;
  }
  .zoom-nav.prev {
    left: clamp(10px, 2.5vw, 26px);
  }
  .zoom-nav.next {
    right: clamp(10px, 2.5vw, 26px);
  }
  .zoom-close:hover,
  .zoom-nav:hover,
  .zoom-close:focus-visible,
  .zoom-nav:focus-visible {
    background: var(--brand);
    transform: scale(1.06);
    outline: none;
  }
  .zoom-count {
    position: absolute;
    left: 50%;
    bottom: clamp(14px, 3vw, 26px);
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 14px;
    border-radius: 999px;
    background: #241811d9;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    .zoom-backdrop,
    .zoom-photo {
      animation: none;
    }
    .photo-thumb img {
      transition: none;
    }
  }
  .about-place h3 {
    font-size: 15.5px;
    margin: 0 0 6px;
  }
  .about-place p,
  .hours p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--muted);
    word-break: keep-all;
    margin: 0;
  }
  .menu-card {
    margin-top: 20px;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px 16px 15px;
    background: var(--cream);
  }
  .menu-head {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--brand);
    margin-bottom: 10px;
  }
  .menu-head h3 {
    font-size: 15.5px;
    margin: 0;
  }
  .menu-head > span {
    font-size: 11.5px;
    margin-left: auto;
    color: var(--muted);
  }
  .hours {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 18px;
    color: var(--muted);
  }
  .hours :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }
  .source-link {
    margin-top: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: var(--muted);
    border-top: 1px solid var(--line);
    padding-top: 16px;
  }
  .source-link div {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .source-link span,
  .source-link small {
    font-size: 12px;
  }
  .source-link strong {
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .detail-actions {
    border-top: 1px solid var(--line);
    padding: 14px 20px;
    display: flex;
    gap: 8px;
    background: #fff;
  }
  .detail-actions a {
    flex: 1;
    font-size: 14.5px;
    min-height: 48px;
  }
  .save-toggle {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: #fff;
    color: #b9a89d;
    display: grid;
    place-items: center;
  }
  .save-toggle:hover,
  .save-toggle.saved {
    color: var(--brand);
    border-color: #efd6d9;
    background: var(--brand-soft);
  }
</style>
