<script lang="ts">
  import { Heart, MapPin, PawPrint, ChevronRight } from '@lucide/svelte';
  import { placeTheme, themeNames, shortAddress, placeArea, type Place } from '$lib/domain/place';
  import { placePhotos } from '$lib/domain/placePhoto';
  import { getWebStore } from '$lib/web/store.svelte';
  let { place, onselect }: { place: Place; onselect: () => void } = $props();
  const store = getWebStore();
  const photo = $derived(placePhotos(place.id)[0]);
  let failed = $state(false);
  $effect(() => {
    place.id;
    failed = false;
  });
  const restriction = $derived(store.restrictedFor(place));
</script>

<article class="mobile-place-card">
  <button class="place-open" onclick={onselect} aria-label={`${place.name} 상세 보기`}>
    <div class="place-photo">
      {#if photo && !failed}<img
          src={photo}
          alt=""
          loading="lazy"
          onerror={() => (failed = true)}
        />{:else}<PawPrint size={30} strokeWidth={1.3} />{/if}
    </div>
    <div class="place-copy">
      <small>{themeNames[placeTheme(place)]} · {placeArea(place).city}</small>
      <h3>{place.name}</h3>
      <p><MapPin size={12} />{shortAddress(place)}</p>
      <span class:restricted={!!restriction} class="policy-chip"
        >{placeTheme(place) === 'hospital'
          ? '전화 후 방문'
          : restriction
            ? `${restriction.dog.name} · 조건 확인`
            : place.sourceWeight
              ? `${place.sourceWeight}kg ${place.sourceWeightBound === 'under' ? '미만' : '이하'} 안내`
              : '동반 규정 확인'}<ChevronRight size={12} /></span
      >
    </div>
  </button>
  <button
    class="place-heart"
    class:saved={store.isSaved(place.id)}
    aria-label={`${place.name} ${store.isSaved(place.id) ? '찜 해제' : '찜하기'}`}
    aria-pressed={store.isSaved(place.id)}
    onclick={() => store.toggleSave(place)}
    ><Heart size={21} fill={store.isSaved(place.id) ? 'currentColor' : 'none'} /></button
  >
</article>

<style>
  .mobile-place-card {
    position: relative;
    padding: 17px 0;
    border-bottom: 1px solid var(--line);
  }
  .place-open {
    display: flex;
    gap: 13px;
    align-items: center;
    text-align: left;
    border: 0;
    background: none;
    padding: 0;
    width: 100%;
  }
  .place-photo {
    width: 108px;
    height: 72px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--sand);
    color: var(--brown-warm);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .place-photo img {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    object-fit: contain;
    background: var(--sand);
  }
  .place-copy {
    min-width: 0;
    flex: 1;
    padding-right: 28px;
  }
  small {
    font-size: 11px;
    color: var(--brand-deep);
  }
  h3 {
    font-size: 16px;
    line-height: 1.45;
    margin: 5px 0;
    letter-spacing: -0.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  p {
    font-size: 11px;
    color: var(--muted);
    margin: 0 0 9px;
    display: flex;
    gap: 3px;
    align-items: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .policy-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 4px 7px;
    border-radius: 6px;
    background: var(--cream);
    font-size: 10px;
    color: var(--brown-warm);
  }
  .policy-chip.restricted {
    background: #fff0e9;
    color: #a54e30;
  }
  .place-heart {
    position: absolute;
    right: -8px;
    top: 26px;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    background: none;
    color: #baa99c;
  }
  .place-heart.saved {
    color: var(--brand);
  }
</style>
