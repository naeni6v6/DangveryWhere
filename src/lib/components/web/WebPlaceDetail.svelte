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
    ExternalLink
  } from '@lucide/svelte';
  import {
    placeArea,
    placeTheme,
    themeNames,
    policyLines,
    profileNotice,
    type Place,
    type DogProfile
  } from '$lib/domain/place';
  import { providerInfo, providerOfUrl } from '$lib/domain/region';
  // 장소 대표 사진 (scripts/fetch-place-images.mjs 로 생성, 강원 반려동물 동반관광 API 사진)
  import placeImages from '$lib/data/placeImages.json';
  import ThemeIcon from './ThemeIcon.svelte';
  let {
    place,
    dog,
    saved = false,
    onclose,
    onsave
  }: {
    place: Place;
    dog: DogProfile | null;
    saved?: boolean;
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
  const notice = $derived(dog ? profileNotice(place, dog) : null);
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
  const photoSrc = $derived((placeImages as Record<string, string>)[place.id] ?? null);
  // 사진을 못 불러오면 기존 갈색 커버로 돌아가요
  let photoFailed = $state(false);
  $effect(() => {
    place.id;
    photoFailed = false;
  });
  const hasPhoto = $derived(!!photoSrc && !photoFailed);
  let panel: HTMLElement;
  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
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
    {/if}
    <div class="cover-top">
      <span>장소 살펴보기</span>
      <button class="icon-button cover-close" aria-label="장소 상세 닫기" onclick={onclose}
        ><X size={22} /></button
      >
    </div>
    {#if !hasPhoto}<div class="cover-art" aria-hidden="true">
        <ThemeIcon {theme} size={32} strokeWidth={1.4} />
      </div>{/if}
    <div class="cover-text">
      <span class="cover-eyebrow">{themeNames[theme]}{area ? " · " + area : ""}</span>
      <h2>{place.name}</h2>
      <p class="cover-address"><MapPin size={15} />{place.address}</p>
    </div>
    {#if !hasPhoto}<div class="cover-circle"></div>{/if}
  </div>

  <div class="detail-scroll">
    <div class="detail-body">
      <div class="policy-heading">
        <PawPrint size={19} />
        <h3>{isHospital ? '진료 전에' : '함께 가기 전에'}</h3>
        <span>{isHospital ? '병원 정보' : '동반 규정'}</span>
      </div>
      {#if notice && !isHospital}<div
          class="profile-notice"
          class:restricted={notice.kind === 'restricted'}
        >
          <strong>{dog?.name} · {notice.label}</strong>
          <p>{notice.detail}</p>
        </div>{/if}
      <div class="policy-list">
        {#each lines as line, i}<div class="policy-row">
            <span class="policy-number">{String(i + 1).padStart(2, '0')}</span>
            <p>{line}</p>
          </div>{/each}
        <!-- 원본이 동물병원에는 진료시간·진료과목을 주지 않습니다. 없는 걸 있는 척하지 않습니다. -->
        {#if !lines.length}<p class="policy-empty">
            {isHospital
              ? '진료 시간과 진료 과목은 원본 데이터에 없어요. 방문 전 전화로 확인해 주세요.'
              : '상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.'}
          </p>{/if}
      </div>
      <div class="verification">
        <Info size={16} />
        <p>
          공공데이터에 등록된 안내예요.<br /><strong
            >{isHospital
              ? '진료 시간과 응급 여부는 전화로 확인해 주세요.'
              : '최근 운영 규정은 방문 전에 확인해 주세요.'}</strong
          >
        </p>
      </div>
      {#if place.description}<section class="about-place">
          <h3>이런 곳이에요</h3>
          <p>{place.description}</p>
        </section>{/if}
      {#if place.hours}<div class="hours">
          <Clock3 size={15} />
          <p>{place.hours}</p>
        </div>{/if}
      <a class="source-link" href={place.sourceUrl} target="_blank" rel="noreferrer"
        ><div>
          <span>{hasPhoto ? '정보·사진 출처' : '정보 출처'}</span><strong>{sourceName}</strong><small
            >데이터 수집 {place.importedAt} · 규정 확인일 미제공</small
          >
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
    {#if phone}<a class="secondary-button" href={`tel:${phone}`}><Phone size={16} />전화 문의</a
      >{/if}
    <a
      class="primary-button"
      href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`}
      target="_blank"
      rel="noreferrer">길찾기<ArrowUpRight size={16} /></a
    >
  </div>
</div>

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
    padding: 14px 22px 22px;
    background: linear-gradient(135deg, var(--brand-deep) 0%, var(--brand) 55%, #b5553f 100%);
    color: #fff;
  }
  /* 실제 가게 사진 커버 */
  .detail-cover.has-photo {
    display: flex;
    flex-direction: column;
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
  .cover-top {
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
  .cover-art {
    width: 54px;
    height: 54px;
    border-radius: 14px;
    background: #ffffff22;
    border: 1px solid #ffffff44;
    display: grid;
    place-items: center;
    margin-bottom: 12px;
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
  .policy-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--brand);
    margin-bottom: 14px;
  }
  .policy-heading h3 {
    font-size: 16.5px;
    margin: 0;
  }
  .policy-heading > span {
    font-size: 12px;
    margin-left: auto;
    color: var(--muted);
  }
  .profile-notice {
    background: var(--cream);
    border: 1px solid var(--line);
    padding: 13px 14px;
    border-radius: 10px;
    margin-bottom: 14px;
    font-size: 13.5px;
  }
  .profile-notice strong {
    color: var(--brand);
    font-size: 13.5px;
  }
  .profile-notice p {
    margin: 5px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }
  .profile-notice.restricted {
    background: #fdf0ec;
    border-color: #f0d3cc;
  }
  .policy-list {
    border-top: 1px solid var(--line);
  }
  .policy-row {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .policy-number {
    font-size: 12px;
    color: var(--brand);
    padding-top: 3px;
    font-weight: 600;
  }
  .policy-row p,
  .policy-empty {
    margin: 0;
    font-size: 14px;
    line-height: 1.75;
    word-break: keep-all;
  }
  .policy-empty {
    padding: 12px 0;
    color: var(--muted);
  }
  .verification {
    display: flex;
    gap: 9px;
    color: var(--muted);
    background: var(--cream);
    padding: 13px;
    border-radius: 10px;
    margin: 18px 0;
  }
  .verification :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .verification p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .verification strong {
    font-weight: 500;
    color: var(--ink);
  }
  .about-place h3 {
    font-size: 15.5px;
    margin: 20px 0 6px;
  }
  .about-place p,
  .hours p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--muted);
    word-break: keep-all;
    margin: 0;
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
