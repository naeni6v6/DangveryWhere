<script lang="ts">
  import { tick } from 'svelte';
  import { ChevronDown, Check, PencilLine, Dog, X } from '@lucide/svelte';
  import { breeds, breedByLabel, breedThumb } from '$lib/domain/breeds';

  /**
   * 견종 선택 칸.
   * 누르면 캐릭터 썸네일 목록이 열리고, '기타'를 고르면 직접 입력할 수 있어요.
   * 값은 한글 견종 이름(문자열)이라 기존 프로필 저장 구조를 그대로 씁니다.
   */
  let {
    value = $bindable(''),
    labelId
  }: { value?: string; labelId?: string } = $props();

  let open = $state(false);
  // 목록에 없는 값이 이미 들어 있으면(예: '말티푸') 직접 입력 모드로 시작합니다.
  let custom = $state(!!value.trim() && !breedByLabel(value));
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let list = $state<HTMLDivElement>();
  let customInput = $state<HTMLInputElement>();

  const selected = $derived(custom ? undefined : breedByLabel(value));

  async function toggle() {
    open = !open;
    if (open) {
      await tick();
      const current = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      (current ?? list?.querySelector<HTMLButtonElement>('button'))?.focus();
    }
  }

  function close(focusTrigger = true) {
    open = false;
    if (focusTrigger) trigger?.focus({ preventScroll: true });
  }

  function pick(label: string) {
    custom = false;
    value = label;
    close();
  }

  function clear() {
    custom = false;
    value = '';
    close();
  }

  async function pickCustom() {
    if (!custom) value = '';
    custom = true;
    close(false);
    await tick();
    customInput?.focus();
  }

  function onListKeydown(event: KeyboardEvent) {
    const items = [...(list?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const columns = list ? getComputedStyle(list).gridTemplateColumns.split(' ').length : 4;
    const move: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key in move) {
      event.preventDefault();
      const next = Math.min(items.length - 1, Math.max(0, (index < 0 ? 0 : index) + move[event.key]));
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

<div class="breed-picker" bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="picker-trigger"
    class:open
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-labelledby={labelId}
    onclick={toggle}
  >
    {#if selected}
      <img class="trigger-thumb" src={breedThumb(selected)} alt="" />
      <span class="trigger-text">{selected.label}</span>
    {:else if custom}
      <span class="trigger-icon"><PencilLine size={17} /></span>
      <span class="trigger-text">기타 · 직접 입력</span>
    {:else}
      <span class="trigger-icon"><Dog size={18} /></span>
      <span class="trigger-text placeholder">견종을 골라 주세요</span>
    {/if}
    <ChevronDown class="trigger-chevron" size={19} />
  </button>

  {#if custom}
    <div class="custom-row">
      <input
        bind:this={customInput}
        bind:value
        placeholder="예: 말티푸, 믹스"
        maxlength="40"
        autocomplete="off"
        aria-label="견종 직접 입력"
      />
      <button type="button" class="custom-clear" aria-label="직접 입력 취소" onclick={clear}
        ><X size={16} /></button
      >
    </div>
  {/if}

  {#if open}
    <div
      class="picker-panel"
      role="listbox"
      tabindex="-1"
      aria-label="견종 목록"
      bind:this={list}
      onkeydown={onListKeydown}
    >
      {#each breeds as breed (breed.key)}
        <button
          type="button"
          role="option"
          class="breed-option"
          aria-selected={selected?.key === breed.key}
          onclick={() => pick(breed.label)}
        >
          <span class="option-thumb"><img src={breedThumb(breed)} alt="" loading="lazy" /></span>
          <span class="option-name">{breed.label}</span>
          {#if selected?.key === breed.key}<span class="option-check"><Check size={13} strokeWidth={3} /></span>{/if}
        </button>
      {/each}
      <button type="button" role="option" class="breed-option etc" aria-selected={custom} onclick={pickCustom}>
        <span class="option-thumb"><PencilLine size={24} /></span>
        <span class="option-name">기타<br />직접 입력</span>
      </button>
      <button type="button" role="option" class="breed-option etc" aria-selected={false} onclick={clear}>
        <span class="option-thumb"><Dog size={26} /></span>
        <span class="option-name">믹스<br />잘 모름</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .breed-picker {
    position: relative;
  }
  .picker-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 54px;
    padding: 0 14px 0 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--cream);
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .picker-trigger:hover,
  .picker-trigger.open,
  .picker-trigger:focus-visible {
    border-color: var(--brand);
    background: #fff;
    outline: none;
  }
  .trigger-thumb,
  .trigger-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }
  .trigger-thumb {
    object-fit: cover;
    background: #fff;
    border: 1px solid var(--line);
  }
  .trigger-icon {
    display: grid;
    place-items: center;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .trigger-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .trigger-text.placeholder {
    color: var(--muted);
  }
  .picker-trigger :global(.trigger-chevron) {
    flex-shrink: 0;
    color: var(--muted);
    transition: transform 0.2s;
  }
  .picker-trigger.open :global(.trigger-chevron) {
    transform: rotate(180deg);
    color: var(--brand);
  }

  .custom-row {
    position: relative;
    margin-top: 8px;
  }
  .custom-row input {
    width: 100%;
    height: 48px;
    padding: 0 44px 0 14px;
    border: 1px solid var(--brand);
    border-radius: 12px;
    background: #fff;
    font-size: 15px;
    outline: none;
  }
  .custom-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .custom-clear:hover {
    background: var(--sand);
  }

  .picker-panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    right: 0;
    width: max(100%, 440px);
    max-width: calc(100vw / var(--ui-zoom, 1) - 32px);
    max-height: 392px;
    overflow: auto;
    overscroll-behavior: contain;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 12px;
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
  .breed-option {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 4px 10px;
    border: 1px solid transparent;
    border-radius: 14px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .breed-option:hover,
  .breed-option:focus-visible {
    background: var(--cream);
    border-color: var(--line);
    outline: none;
  }
  .breed-option:focus-visible {
    border-color: var(--brand);
  }
  .breed-option[aria-selected='true'] {
    background: var(--brand-soft);
    border-color: var(--brand);
  }
  .option-thumb {
    display: grid;
    place-items: center;
    width: 100%;
    max-width: 76px;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    color: var(--brand);
  }
  .option-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: multiply;
  }
  .etc .option-thumb {
    background: var(--brand-tint);
  }
  .option-name {
    font-size: 12.5px;
    line-height: 1.3;
    text-align: center;
    word-break: keep-all;
  }
  .option-check {
    position: absolute;
    top: 5px;
    right: 5px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
  }
  @media (max-width: 560px) {
    .picker-panel {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .picker-panel {
      animation: none;
    }
  }
</style>
