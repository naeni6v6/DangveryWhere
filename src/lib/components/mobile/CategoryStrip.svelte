<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronLeft, ChevronRight, Map } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import { themeNames, type ThemeFilter } from '$lib/domain/place';

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
  let atStart = $state(true);
  let atEnd = $state(false);

  function measure() {
    if (!track) return;
    atStart = track.scrollLeft <= 2;
    atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function scroll(direction: number) {
    track.scrollBy({
      left: direction * Math.max(140, track.clientWidth * 0.75),
      behavior: 'smooth'
    });
  }
  onMount(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    measure();
    return () => observer.disconnect();
  });
  $effect(() => {
    const selected = value;
    items;
    void tick().then(() => {
      const button = track?.querySelector<HTMLButtonElement>(`[data-category="${selected}"]`);
      if (button && track) {
        const left = button.offsetLeft;
        if (
          left < track.scrollLeft ||
          left + button.offsetWidth > track.scrollLeft + track.clientWidth
        )
          track.scrollTo({ left: left - (track.clientWidth - button.offsetWidth) / 2 });
      }
      measure();
    });
  });
</script>

<div class="category-strip" aria-label={label}>
  <button
    class="category-arrow"
    aria-label="이전 카테고리"
    disabled={atStart}
    onclick={() => scroll(-1)}><ChevronLeft size={18} /></button
  >
  <div class="category-track" bind:this={track} onscroll={measure}>
    {#each items as item (item.id)}
      <button
        class="category-chip"
        data-category={item.id}
        class:active={value === item.id}
        aria-pressed={value === item.id}
        onclick={() => onchange(item.id)}
      >
        {#if item.id === 'all'}<Map size={15} />{:else}<ThemeIcon theme={item.id} size={16} />{/if}
        {themeNames[item.id]}{#if item.count !== undefined}<span>{item.count}</span>{/if}
      </button>
    {/each}
  </div>
  <button
    class="category-arrow"
    aria-label="다음 카테고리"
    disabled={atEnd}
    onclick={() => scroll(1)}><ChevronRight size={18} /></button
  >
</div>

<style>
  .category-strip {
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
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    padding: 3px;
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
  .category-chip span {
    font-size: 10px;
    opacity: 0.8;
  }
</style>
