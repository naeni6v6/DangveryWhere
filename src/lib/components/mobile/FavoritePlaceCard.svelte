<script lang="ts">
  import { Heart, Map, MapPin, ArrowUpRight, Scale, TriangleAlert } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import ReadableText from './ReadableText.svelte';
  import {
    placeArea,
    shortAddress,
    placeTheme,
    themeNames,
    policyLines,
    type Place
  } from '$lib/domain/place';
  import { placePhotos } from '$lib/domain/placePhoto';
  import { placeLink } from '$lib/domain/placeLink';
  import { getWebStore } from '$lib/web/store.svelte';
  let { place, onselect }: { place: Place; onselect: () => void } = $props();
  const store = getWebStore();
  const theme = $derived(placeTheme(place));
  const photo = $derived(placePhotos(place.id)[0]);
  const restricted = $derived(store.restrictedFor(place));
  let failed = $state(false);
</script>

<article class="favorite-card">
  <button class="favorite-photo" onclick={onselect} aria-label={`${place.name} 상세 보기`}>
    {#if photo && !failed}<img
        class="mobile-photo"
        src={photo}
        alt={`${place.name} 사진`}
        loading="lazy"
        onerror={() => (failed = true)}
      />{:else}<span class="photo-empty"><ThemeIcon {theme} size={30} />사진 준비 중</span>{/if}
  </button>
  <button class="favorite-main" onclick={onselect} aria-label={`${place.name} 동반 규정 보기`}>
    <span class="favorite-kind">{themeNames[theme]}</span>
    <strong>{place.name}</strong>
    <span class="favorite-address"
      ><MapPin size={13} /><span>{placeArea(place).city} {shortAddress(place)}</span></span
    >
    <p>
      <ReadableText
        text={theme === 'hospital'
          ? '진료 시간은 전화로 확인해 주세요.'
          : (policyLines(place.policy)[0] ?? '상세 규정이 부족해요. 방문 전 문의해 주세요.')}
      />
    </p>
    {#if place.sourceWeight !== null || restricted}<span class="favorite-tags">
        {#if place.sourceWeight !== null}<span
            ><Scale size={13} /><span
              >{place.sourceWeight}kg {place.sourceWeightBound === 'under' ? '미만' : '이하'} 안내</span
            ></span
          >{/if}
        {#if restricted}<span class="warn"
            ><TriangleAlert size={13} /><span
              >{store.activeDogs.length > 1
                ? `${restricted.dog.name} ${restricted.label}`
                : restricted.label}</span
            ></span
          >{/if}
      </span>{/if}
  </button>
  <div class="favorite-actions">
    <a href={`/explore?region=all&place=${encodeURIComponent(place.id)}`}
      ><Map size={16} />지도에서 보기</a
    >
    <a href={placeLink(place).url} target="_blank" rel="noreferrer"
      >상세 정보 확인<ArrowUpRight size={15} /></a
    >
  </div>
  <button
    class="favorite-heart"
    aria-label={`${place.name} 찜 해제`}
    onclick={() => store.toggleSave(place)}><Heart size={20} fill="currentColor" /></button
  >
</article>

<style>
  .favorite-card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(68px, 1fr) minmax(0, 3fr);
    gap: 12px;
    padding: 14px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
  }
  .favorite-photo {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    align-self: start;
    margin-top: 3px;
    border-radius: 11px;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: var(--sand);
  }
  .favorite-photo img {
    position: absolute;
    inset: 0;
  }
  .photo-empty {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 5px;
    font-size: 9px;
    color: var(--brown-warm);
  }
  .favorite-kind {
    display: block;
    color: var(--brand-deep);
    padding-right: 26px;
    font-size: 10px;
    line-height: 1.35;
    font-weight: 700;
  }
  .favorite-main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    gap: 4px;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    color: var(--ink);
  }
  .favorite-main > strong {
    font-size: 16px;
    line-height: 1.5;
    letter-spacing: -0.4px;
    padding-right: 18px;
    word-break: keep-all;
  }
  .favorite-address {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.65;
  }
  .favorite-address :global(svg),
  .favorite-tags :global(svg),
  .favorite-actions :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }
  .favorite-main p {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
    word-break: keep-all;
  }
  .favorite-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .favorite-tags > span {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    font-size: 10px;
    line-height: 1.5;
    padding: 5px 7px;
    border-radius: 8px;
    background: var(--brand-soft);
    color: var(--brand-deep);
  }
  .favorite-tags .warn {
    background: #fdebe4;
    color: #b0462c;
  }
  .favorite-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding: 3px 0 0;
    border-top: 1px solid var(--line);
  }
  .favorite-actions a {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 44px;
    font-size: 11px;
    text-decoration: none;
    color: var(--brown-warm);
  }
  .favorite-heart {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--brand);
  }
</style>
