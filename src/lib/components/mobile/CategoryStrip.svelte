<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronLeft, ChevronRight, Map } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import { themeNames, type ThemeFilter } from '$lib/domain/place';
  import { packChipPages } from '$lib/mobile/layout';

  let {
    items,
    value,
    onchange,
    label = '장소 유형'
  }: {
    items: { id: ThemeFilter; count?: number }[];
    value: ThemeFilter;
    onchange: (value: ThemeFilter) => void;
    label?: string;
  } = $props();
  let track: HTMLDivElement;
  let measureRow: HTMLDivElement;
  let pages = $state<number[][]>([]);
  let pageIndex = $state(0);
  const visiblePages = $derived(
    pages.length
      ? pages
          .map((indices) => indices.filter((index) => index < items.length))
          .filter((indices) => indices.length)
      : items.map((_, index) => [index])
  );

  function measure() {
    if (!track || !measureRow) return;
    const widths = Array.from(measureRow.children, (chip) => chip.getBoundingClientRect().width);
    pages = packChipPages(widths, track.clientWidth);
    void tick().then(showSelected);
  }
  function showSelected() {
    const selectedIndex = items.findIndex((item) => item.id === value);
    const selectedPage = pages.findIndex((indices) => indices.includes(selectedIndex));
    pageIndex = Math.max(0, selectedPage);
    track?.scrollTo({ left: pageIndex * track.clientWidth, behavior: 'instant' });
  }
  function updatePage() {
    pageIndex = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  }
  function scroll(direction: -1 | 1) {
    const next = Math.max(0, Math.min(visiblePages.length - 1, pageIndex + direction));
    track.scrollTo({
      left: next * track.clientWidth,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }
  onMount(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(measureRow);
    measure();
    return () => observer.disconnect();
  });
  $effect(() => {
    items;
    void tick().then(measure);
  });
  $effect(() => {
    value;
    void tick().then(showSelected);
  });
</script>

{#snippet chipContent(item: { id: ThemeFilter; count?: number })}
  {#if item.id === 'all'}<Map size={15} />{:else}<ThemeIcon theme={item.id} size={16} />{/if}
  <span class="category-name">{themeNames[item.id]}</span>
  {#if item.count !== undefined}<span class="category-count">{item.count}</span>{/if}
{/snippet}

<div class="category-strip" aria-label={label}>
  <button
    class="category-arrow"
    aria-label="이전 카테고리"
    disabled={pageIndex === 0}
    onclick={() => scroll(-1)}><ChevronLeft size={18} /></button
  >
  <div class="category-track" bind:this={track} onscroll={updatePage}>
    {#each visiblePages as indices}
      <div class="category-page">
        {#each indices as index (items[index].id)}
          {@const item = items[index]}
          <button
            class="category-chip"
            data-category={item.id}
            class:active={value === item.id}
            aria-pressed={value === item.id}
            onclick={() => onchange(item.id)}
          >
            {@render chipContent(item)}
          </button>
        {/each}
      </div>
    {/each}
  </div>
  <button
    class="category-arrow"
    aria-label="다음 카테고리"
    disabled={pageIndex >= visiblePages.length - 1}
    onclick={() => scroll(1)}><ChevronRight size={18} /></button
  >
  <div class="category-measure-window" aria-hidden="true" inert>
    <div class="category-measure" bind:this={measureRow}>
      {#each items as item (item.id)}
        <span class="category-chip">{@render chipContent(item)}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .category-strip {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 9px 0 6px;
  }
  .category-track {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    touch-action: pan-x;
    border-radius: 22px;
  }
  .category-track::-webkit-scrollbar {
    display: none;
  }
  .category-page {
    display: flex;
    align-items: center;
    flex: 0 0 100%;
    min-width: 0;
    gap: 6px;
    padding: 3px 0;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
  .category-measure-window {
    position: absolute;
    inset: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
  .category-measure {
    display: flex;
    gap: 6px;
    width: max-content;
    max-width: none;
  }
  .category-arrow {
    display: grid;
    place-items: center;
    flex: 0 0 30px;
    width: 30px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--brown-warm);
    background: #fff;
  }
  .category-arrow:disabled {
    opacity: 0.3;
  }
  .category-chip {
    display: inline-flex;
    flex-shrink: 0;
    max-width: 100%;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    min-height: 40px;
    padding: 9px 12px;
    font-size: 12px;
    border: 1px solid var(--line);
    background: #fff;
    border-radius: 22px;
    color: var(--brown-warm);
  }
  .category-chip.active {
    color: #fff;
    background: var(--brand);
    border-color: var(--brand);
  }
  .category-chip :global(svg) {
    flex-shrink: 0;
  }
  .category-chip:focus-visible {
    outline-offset: -3px;
  }
  .category-count {
    font-size: 10px;
    opacity: 0.8;
  }
</style>
