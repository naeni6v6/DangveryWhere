<script lang="ts">
  import type { Snippet } from 'svelte';
  import { List, Map, ChevronUp, ChevronDown } from '@lucide/svelte';
  import {
    sheetHeights,
    detailSheetHeights,
    snapSheetLevel,
    type SheetLevel
  } from '$lib/mobile/layout';

  let {
    level = $bindable<SheetLevel>(0),
    count,
    resetKey,
    detail = false,
    children
  }: {
    level?: SheetLevel;
    count: number;
    resetKey: string;
    detail?: boolean;
    children: Snippet;
  } = $props();
  const id = $props.id();
  const labels = $derived(detail ? ['지도 넓게', '기본', '상세 넓게'] : ['낮게', '중간', '전체']);
  let viewportHeight = $state(0);
  let available = $state(0);
  let scrollArea = $state<HTMLDivElement>();
  let dragHeight = $state<number | null>(null);
  const stops = $derived(
    detail ? detailSheetHeights(available, viewportHeight || available) : sheetHeights(available)
  );
  const height = $derived(dragHeight ?? stops[level]);
  let suppressClick = false;
  let drag:
    | {
        id: number;
        startY: number;
        startHeight: number;
        lastY: number;
        lastAt: number;
        velocity: number;
        moved: boolean;
      }
    | undefined;

  $effect(() => {
    resetKey;
    if (scrollArea) scrollArea.scrollTop = 0;
  });

  function begin(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
      moved: false
    };
    (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    drag.moved ||= Math.abs(delta) > 6;
    if (!drag.moved) return;
    dragHeight = Math.max(stops[0], Math.min(stops[2], drag.startHeight + delta));
    const elapsed = event.timeStamp - drag.lastAt;
    if (elapsed > 0) drag.velocity = (drag.lastY - event.clientY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastAt = event.timeStamp;
  }
  function end(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) {
      const velocity = event.timeStamp - drag.lastAt < 100 ? drag.velocity : 0;
      level = snapSheetLevel(dragHeight ?? height, stops, velocity);
      suppressClick = true;
    }
    drag = undefined;
    dragHeight = null;
  }
  function cancel() {
    if (!drag) return;
    suppressClick = drag.moved;
    drag = undefined;
    dragHeight = null;
  }
  function toggle() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    level = ((level + 1) % 3) as SheetLevel;
  }
  function keydown(event: KeyboardEvent) {
    let next: number;
    if (event.key === 'ArrowUp') next = Math.min(2, level + 1);
    else if (event.key === 'ArrowDown') next = Math.max(0, level - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else return;
    event.preventDefault();
    level = next as SheetLevel;
  }
</script>

<svelte:window bind:innerHeight={viewportHeight} />
<div class="sheet-container" bind:clientHeight={available}>
  <section
    class="results-sheet"
    class:dragging={dragHeight !== null}
    class:full={level === 2 && dragHeight === null}
    style:height={available ? `${height}px` : '36%'}
    aria-label={detail ? '매장 상세' : '장소 목록'}
  >
    <button
      class="results-handle"
      type="button"
      aria-label={detail
        ? `매장 상세 높이 조절 · ${labels[level]}`
        : `장소 목록 높이 조절 · ${labels[level]} · ${count.toLocaleString()}곳`}
      aria-expanded={level > 0}
      aria-controls={`${id}-results`}
      onpointerdown={begin}
      onpointermove={move}
      onpointerup={end}
      onpointercancel={cancel}
      onlostpointercapture={cancel}
      onclick={toggle}
      onkeydown={keydown}
    >
      <span class="grip" aria-hidden="true"></span>
      <span class="results-heading">
        <span class="sheet-title">
          {#if detail}매장 상세
          {:else}
            {#if level === 2}<Map size={17} />지도 보기{:else}<List size={17} />목록 보기{/if}
            <b>{count.toLocaleString()}</b>
          {/if}
        </span>
        <span class="sheet-position">
          {level + 1}/3
          {#if level === 2}<ChevronDown size={19} />{:else}<ChevronUp size={19} />{/if}
        </span>
      </span>
    </button>
    {#if detail}
      <div class="detail-body" id={`${id}-results`}>{@render children()}</div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scroll region needs keyboard focus so every result can be reached.) -->
      <div
        class="results-scroll"
        id={`${id}-results`}
        bind:this={scrollArea}
        role="region"
        aria-label="장소 검색 결과"
        tabindex="0"
      >
        {@render children()}
      </div>
    {/if}
  </section>
</div>

<style>
  .sheet-container {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }
  .results-sheet {
    position: absolute;
    inset: auto 0 0;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    min-height: 0;
    overflow: hidden;
    border-radius: 23px 23px 0 0;
    background: #fff;
    box-shadow: 0 -5px 22px #49342114;
    transition:
      height 220ms ease,
      border-radius 220ms ease;
  }
  .results-sheet.dragging {
    transition: none;
  }
  .results-sheet.full {
    border-radius: 14px 14px 0 0;
  }
  .results-handle {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    gap: 10px;
    min-height: 62px;
    padding: 9px 20px 12px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }
  .results-handle:active {
    cursor: grabbing;
  }
  .grip {
    width: 36px;
    height: 4px;
    border-radius: 4px;
    background: #d8c9bc;
  }
  .results-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 10px;
  }
  .sheet-title,
  .sheet-position {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .sheet-title b,
  .sheet-position {
    font-size: 11px;
    color: var(--brand);
  }
  .results-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    touch-action: pan-y;
    scrollbar-width: thin;
    padding: 0 20px 16px;
  }
  .detail-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .results-scroll:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .results-sheet {
      transition: none;
    }
  }
</style>
