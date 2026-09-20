<script lang="ts">
  import { Heart, Map, MapPin, ArrowUpRight, Scale, TriangleAlert } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
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
        src={photo}
        alt={`${place.name} 사진`}
        loading="lazy"
        onerror={() => (failed = true)}
      />{:else}<span class="photo-empty"><ThemeIcon {theme} size={30} />사진 준비 중</span>{/if}
    <span class="favorite-kind"><ThemeIcon {theme} size={15} />{themeNames[theme]}</span>
  </button>
  <button class="favorite-main" onclick={onselect} aria-label={`${place.name} 동반 규정 보기`}>
    <strong>{place.name}</strong>
    <span class="favorite-address"
      ><MapPin size={14} />{placeArea(place).city} {shortAddress(place)}</span
    >
    <p>
      {theme === 'hospital'
        ? '진료 시간은 전화로 확인해 주세요.'
        : (policyLines(place.policy)[0] ?? '상세 규정이 부족해요. 방문 전 문의해 주세요.')}
    </p>
    {#if place.sourceWeight !== null || restricted}<span class="favorite-tags">
        {#if place.sourceWeight !== null}<span
            ><Scale size={14} />제한 체중 {place.sourceWeight}kg</span
          >{/if}
        {#if restricted}<span class="warn"
            ><TriangleAlert size={14} />{store.activeDogs.length > 1
              ? `${restricted.dog.name} ${restricted.label}`
              : restricted.label}</span
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
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 21px;
    background: #fff;
  }
  .favorite-photo {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    padding: 0;
    border: 0;
    background: var(--sand);
  }
  .favorite-photo img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .photo-empty {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 9px;
    font-size: 12px;
    color: var(--brown-warm);
  }
  .favorite-kind {
    position: absolute;
    left: 12px;
    bottom: 11px;
    display: flex;
    gap: 5px;
    align-items: center;
    background: #fffffff2;
    color: var(--brand-deep);
    border-radius: 22px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 3px 12px #30221918;
  }
  .favorite-main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    padding: 18px;
    border: 0;
    background: none;
    text-align: left;
    color: var(--ink);
  }
  .favorite-main > strong {
    font-size: 19px;
    letter-spacing: -0.6px;
    word-break: keep-all;
  }
  .favorite-address {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.65;
  }
  .favorite-address :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }
  .favorite-main p {
    margin: 0;
    border-radius: 12px;
    padding: 12px;
    background: var(--cream);
    font-size: 12px;
    line-height: 1.8;
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
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--brand-soft);
    color: var(--brand-deep);
  }
  .favorite-tags .warn {
    background: #fdebe4;
    color: #b0462c;
  }
  .favorite-actions {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 12px;
    border-top: 1px solid var(--line);
    background: #fffcf8;
  }
  .favorite-actions a {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 44px;
    font-size: 12px;
    text-decoration: none;
    color: var(--brown-warm);
  }
  .favorite-heart {
    position: absolute;
    top: 11px;
    right: 11px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: #fffffff2;
    color: var(--brand);
    box-shadow: 0 3px 12px #30221920;
  }
</style>
