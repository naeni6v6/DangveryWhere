<script lang="ts">
  import { tick } from 'svelte';
  import { MapPin, ChevronDown, Check, LayoutGrid } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { groupedRegions, type RegionSummary } from '$lib/domain/region';

  let { regions, regionId }: { regions: RegionSummary[]; regionId: string } = $props();
  // '강원 전체'는 지역이 아니라 모아 보기라, 시도 묶음 위에 따로 둡니다.
  const nationwide = $derived(regions.find((region) => region.status === 'mixed'));
  // '강원' 아래 다섯 곳을 시도별로 묶어 보여 줍니다. 순서는 regionCatalog(북 → 남) 그대로예요.
  const provinces = $derived(groupedRegions(regions));
  const current = $derived(regions.find((region) => region.id === regionId) ?? regions[0]);

  /**
   * 예전에는 브라우저 기본 <select> 를 알약 안에 넣어 썼는데, 열리는 목록이 브라우저마다 달라
   * 헤더의 다른 요소들과 어울리지 않았어요. 견종 선택(BreedPicker)과 같은 방식의 목록으로 바꿔
   * 지역 이름과 장소 수를 한 줄에 나란히 읽히게 합니다.
   */
  let open = $state(false);
  let busy = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let list = $state<HTMLDivElement>();

  async function toggle() {
    open = !open;
    if (open) {
      await tick();
      const picked = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      (picked ?? list?.querySelector<HTMLButtonElement>('button'))?.focus();
    }
  }

  function close(focusTrigger = true) {
    open = false;
    if (focusTrigger) trigger?.focus({ preventScroll: true });
  }

  /**
   * 고른 지역은 서버가 읽어서 목록·지도를 다시 내려 줍니다.
   * 주소창에 남겨 두면 링크를 그대로 공유할 수 있고, 다음 방문에는 쿠키가 기억해요.
   */
  async function choose(next: string) {
    close();
    if (next === regionId) return;
    busy = true;
    const url = new URL(page.url);
    url.searchParams.set('region', next);
    // 이전 지역에서 고른 장소·분류는 지역이 바뀌면 의미가 없어 떼고 갑니다.
    url.searchParams.delete('place');
    await goto(url, { invalidateAll: true, noScroll: true });
    busy = false;
  }

  function onListKeydown(event: KeyboardEvent) {
    const items = [...(list?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.min(items.length - 1, Math.max(0, (index < 0 ? -step : index) + step));
      items[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  }

  function onWindowPointer(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) close(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div class="region-picker" class:busy bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="region-trigger"
    class:open
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={`지역 선택 · 지금은 ${current.label}`}
    disabled={busy}
    onclick={toggle}
  >
    <MapPin class="trigger-pin" size={17} />
    <strong>{current.city}</strong>
    <span class="trigger-count">{current.placeCount}곳</span>
    <ChevronDown class="trigger-chevron" size={16} />
  </button>

  {#if open}
    <div
      class="region-panel"
      role="listbox"
      tabindex="-1"
      aria-label="지역 목록"
      bind:this={list}
      onkeydown={onListKeydown}
    >
      {#if nationwide}
        <button
          type="button"
          role="option"
          class="region-option all"
          aria-selected={regionId === nationwide.id}
          onclick={() => choose(nationwide.id)}
        >
          <span class="option-icon"><LayoutGrid size={16} /></span>
          <span class="option-name">{nationwide.label}</span>
          <span class="option-count">{nationwide.placeCount}곳</span>
          {#if regionId === nationwide.id}<span class="option-check"
              ><Check size={12} strokeWidth={3} /></span
            >{/if}
        </button>
      {/if}
      {#each provinces as group (group.province)}
        <div class="region-group" role="group" aria-label={group.province}>
          <span class="group-label">{group.province} 시군구</span>
          {#each group.regions as region (region.id)}
            <button
              type="button"
              role="option"
              class="region-option"
              aria-selected={regionId === region.id}
              onclick={() => choose(region.id)}
            >
              <span class="option-name">{region.city}</span>
              <span class="option-count">{region.placeCount}곳</span>
              {#if regionId === region.id}<span class="option-check"
                  ><Check size={12} strokeWidth={3} /></span
                >{/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!--
  '준비 데이터' 뱃지는 지역 목록에서 뺐습니다. 다만 업체 확인 전이라는 사실 자체는 숨기지 않습니다.
  목록 아래 출처 줄('업체 확인 전'), 장소 상세의 '규정 확인일 미제공', 왼쪽 레일의 '데이터 안내'
  창이 같은 내용을 계속 알려 줍니다.
-->

<style>
  .region-picker {
    position: relative;
    flex-shrink: 0;
  }
  .region-picker.busy {
    opacity: 0.6;
  }
  /* 접힌 상태는 헤더 글자와 같은 결로 담백하게 — 핀 · 지역 이름 · 곳수 · 화살표 한 줄.
     테두리 상자 없이 두고, 올리거나 열었을 때만 바탕이 살짝 드러납니다. */
  .region-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 10px 0 12px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .region-trigger:hover {
    background: var(--cream);
  }
  .region-trigger.open,
  .region-trigger:focus-visible {
    background: #fff;
    border-color: var(--brand);
    outline: none;
  }
  .region-trigger:disabled {
    cursor: progress;
  }
  .region-trigger :global(.trigger-pin) {
    flex-shrink: 0;
    color: var(--brand);
  }
  .region-trigger strong {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.4px;
  }
  .trigger-count {
    padding-left: 8px;
    border-left: 1px solid var(--line);
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    color: var(--muted);
  }
  .region-trigger :global(.trigger-chevron) {
    flex-shrink: 0;
    color: var(--muted);
    transition: transform 0.2s;
  }
  .region-trigger.open :global(.trigger-chevron) {
    transform: rotate(180deg);
    color: var(--brand);
  }

  .region-panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    left: 0;
    width: 300px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 18px 44px #4a342829;
    animation: panel-in 0.16s ease-out;
  }
  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }
  .region-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 46px;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .region-option:hover,
  .region-option:focus-visible {
    background: var(--cream);
    outline: none;
  }
  .region-option:focus-visible {
    box-shadow: inset 0 0 0 1px var(--brand);
  }
  .region-option[aria-selected='true'] {
    background: var(--brand-soft);
    color: var(--brand);
  }
  .region-option[aria-selected='true'] .option-name {
    font-weight: 700;
  }
  /* '강원 전체'는 다섯 곳을 합친 보기라, 아이콘을 붙이고 아래 시군구와 줄로 나눕니다. */
  .region-option.all {
    min-height: 50px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .option-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 9px;
    background: var(--brand-tint);
    color: var(--brand);
  }
  .region-option[aria-selected='true'] .option-icon {
    background: var(--brand);
    color: #fff;
  }
  .option-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .option-count {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .region-option[aria-selected='true'] .option-count {
    color: var(--brand);
  }
  .option-check {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
  }
  .region-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }
  .group-label {
    padding: 4px 12px 6px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) {
    .region-panel {
      animation: none;
    }
  }
</style>
