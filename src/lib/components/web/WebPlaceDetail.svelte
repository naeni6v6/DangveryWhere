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
    Coffee,
    House,
    Trees,
    Sparkles
  } from '@lucide/svelte';
  import {
    categoryNames,
    policyLines,
    profileNotice,
    type Place,
    type DogProfile
  } from '$lib/domain/place';
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
  const icons = { food: Coffee, stay: House, outdoor: Trees, activity: Sparkles };
  const Icon = $derived(icons[place.category]);
  const lines = $derived(policyLines(place.policy));
  const notice = $derived(dog ? profileNotice(place, dog) : null);
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
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
  <div class="detail-cover">
    <div class="cover-top">
      <span>장소 살펴보기</span>
      <button class="icon-button cover-close" aria-label="장소 상세 닫기" onclick={onclose}
        ><X size={24} /></button
      >
    </div>
    <div class="cover-art" aria-hidden="true"><Icon size={38} strokeWidth={1.4} /></div>
    <span class="cover-eyebrow">{categoryNames[place.category]} · 강릉</span>
    <h2>{place.name}</h2>
    <p class="cover-address"><MapPin size={17} />{place.address}</p>
    <div class="cover-circle"></div>
  </div>

  <div class="detail-scroll">
    <div class="detail-body">
      <div class="policy-heading">
        <PawPrint size={22} />
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
        {#if !lines.length}<p class="policy-empty">
            상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.
          </p>{/if}
      </div>
      <div class="verification">
        <Info size={16} />
        <p>
          공공데이터에 등록된 안내예요.<br /><strong
            >최근 운영 규정은 방문 전에 확인해 주세요.</strong
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
          <span>정보 출처</span><strong>강원 반려동물 동반관광</strong><small
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
      onclick={onsave}><Heart size={22} fill={saved ? 'currentColor' : 'none'} /></button
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
    padding: 18px 26px 28px;
    background: linear-gradient(135deg, var(--crimson-deep) 0%, var(--crimson) 55%, #b5553f 100%);
    color: #fff;
  }
  .cover-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13.5px;
    letter-spacing: 0.4px;
    color: #ffffffc0;
    margin-bottom: 14px;
  }
  .cover-close {
    color: #fff;
  }
  .cover-close:hover {
    background: #ffffff26;
  }
  .cover-art {
    width: 66px;
    height: 66px;
    border-radius: 16px;
    background: #ffffff22;
    border: 1px solid #ffffff44;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
  }
  .cover-eyebrow {
    font-size: 14px;
    color: #ffe3cf;
  }
  .detail-cover h2 {
    font-size: 30px;
    line-height: 1.3;
    letter-spacing: -0.8px;
    margin: 6px 0 8px;
    position: relative;
    z-index: 1;
  }
  .cover-address {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: #ffffffd0;
    position: relative;
    z-index: 1;
  }
  .cover-address :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
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
    padding: 28px 30px;
  }
  .policy-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--crimson);
    margin-bottom: 14px;
  }
  .policy-heading h3 {
    font-size: 19px;
    margin: 0;
  }
  .policy-heading > span {
    font-size: 13px;
    margin-left: auto;
    color: var(--muted);
  }
  .profile-notice {
    background: var(--cream);
    border: 1px solid var(--line);
    padding: 13px 14px;
    border-radius: 10px;
    margin-bottom: 14px;
    font-size: 15px;
  }
  .profile-notice strong {
    color: var(--crimson);
    font-size: 15px;
  }
  .profile-notice p {
    margin: 6px 0 0;
    font-size: 14px;
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
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .policy-number {
    font-size: 13px;
    color: var(--crimson);
    padding-top: 4px;
    font-weight: 600;
  }
  .policy-row p,
  .policy-empty {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.85;
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
    font-size: 13.5px;
    line-height: 1.8;
  }
  .verification strong {
    font-weight: 500;
    color: var(--ink);
  }
  .about-place h3 {
    font-size: 18px;
    margin: 24px 0 6px;
  }
  .about-place p,
  .hours p {
    font-size: 15.5px;
    line-height: 1.9;
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
    font-size: 12.5px;
  }
  .source-link strong {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .detail-actions {
    border-top: 1px solid var(--line);
    padding: 16px 22px;
    display: flex;
    gap: 8px;
    background: #fff;
  }
  .detail-actions a {
    flex: 1;
    font-size: 15.5px;
    min-height: 52px;
  }
  .save-toggle {
    width: 52px;
    height: 52px;
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
    color: var(--crimson);
    border-color: #efd6d9;
    background: var(--crimson-soft);
  }
</style>
