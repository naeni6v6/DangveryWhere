<script lang="ts">
  import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from '@lucide/svelte';
  let { photos, name }: { photos: string[]; name: string } = $props();
  let index = $state(0);
  let zoomed = $state(false);
  let viewer = $state<HTMLDialogElement>();
  let imageArea = $state<HTMLDivElement>();

  function move(direction: number) {
    index = (index + direction + photos.length) % photos.length;
    zoomed = false;
    imageArea?.scrollTo(0, 0);
  }
  function open() {
    zoomed = false;
    viewer?.showModal();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
</script>

{#if photos.length}
  <section class="photo-gallery" aria-label={`${name} 사진`}>
    <div class="photo-stage">
      <button class="photo-open" onclick={open} aria-label={`${name} 사진 ${index + 1} 크게 보기`}>
        <img src={photos[index]} alt={`${name} 사진 ${index + 1}`} />
        <span class="photo-expand"><Expand size={15} />크게 보기</span>
      </button>
      {#if photos.length > 1}
        <button class="photo-arrow previous" onclick={() => move(-1)} aria-label="이전 사진"
          ><ChevronLeft size={22} /></button
        >
        <button class="photo-arrow next" onclick={() => move(1)} aria-label="다음 사진"
          ><ChevronRight size={22} /></button
        >
      {/if}
    </div>
    <div class="photo-navigation">
      <span>사진을 누르면 크게 볼 수 있어요</span>
      <strong aria-live="polite">{index + 1} / {photos.length}</strong>
    </div>
  </section>
  <dialog
    class="photo-viewer"
    bind:this={viewer}
    aria-label={`${name} 사진 크게 보기`}
    onkeydown={keyboard}
    onclose={() => (zoomed = false)}
  >
    <header>
      <span>{name}</span>
      <button
        aria-label={zoomed ? '사진 축소' : '사진 확대'}
        aria-pressed={zoomed}
        onclick={() => (zoomed = !zoomed)}
        >{#if zoomed}<ZoomOut size={23} />{:else}<ZoomIn size={23} />{/if}</button
      >
      <button aria-label="확대 사진 닫기" onclick={() => viewer?.close()}><X size={25} /></button>
    </header>
    <div class="viewer-image" bind:this={imageArea}>
      <button
        class:zoomed
        onclick={() => (zoomed = !zoomed)}
        aria-label={zoomed ? '원래 크기로 보기' : '사진 두 배로 확대'}
      >
        <img src={photos[index]} alt={`${name} 사진 ${index + 1}`} />
      </button>
    </div>
    <footer>
      <button onclick={() => move(-1)} disabled={photos.length < 2} aria-label="이전 확대 사진"
        ><ChevronLeft size={24} /></button
      >
      <span aria-live="polite">{index + 1} / {photos.length}</span>
      <button onclick={() => move(1)} disabled={photos.length < 2} aria-label="다음 확대 사진"
        ><ChevronRight size={24} /></button
      >
    </footer>
  </dialog>
{/if}

<style>
  .photo-stage {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    background: var(--sand);
  }
  .photo-open {
    display: block;
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 2;
    padding: 0;
    border: 0;
    background: none;
    cursor: zoom-in;
  }
  .photo-open img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .photo-expand {
    position: absolute;
    right: 9px;
    bottom: 9px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 8px;
    padding: 6px 8px;
    background: #fffefdef;
    color: var(--brown-deep);
    font-size: 10px;
  }
  .photo-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 40px;
    height: 44px;
    border: 1px solid #eee0d3aa;
    border-radius: 14px;
    background: #fffefdef;
    color: var(--brown-deep);
    box-shadow: 0 2px 10px #30221918;
  }
  .previous {
    left: 7px;
  }
  .next {
    right: 7px;
  }
  .photo-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 0 3px;
    font-size: 10px;
    color: var(--muted);
  }
  .photo-navigation strong {
    color: var(--brown-warm);
    font-size: 11px;
  }
  .photo-viewer {
    position: fixed;
    inset: 0;
    width: min(100%, 960px);
    height: 100dvh;
    max-width: 100%;
    max-height: 100dvh;
    margin: auto;
    padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
    border: 0;
    background: #201d1a;
    color: #fff;
    overflow: hidden;
  }
  .photo-viewer[open] {
    display: flex;
    flex-direction: column;
  }
  .photo-viewer::backdrop {
    background: #151310ee;
  }
  .photo-viewer header {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
  }
  .photo-viewer header span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 8px;
    font-size: 14px;
  }
  .photo-viewer header button,
  .photo-viewer footer button {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    background: none;
    color: #fff;
    flex-shrink: 0;
  }
  .photo-viewer button:disabled {
    opacity: 0.25;
  }
  .viewer-image {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .viewer-image button {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: none;
    padding: 0;
    cursor: zoom-in;
  }
  .viewer-image button.zoomed {
    width: 200%;
    height: 200%;
    cursor: zoom-out;
  }
  .viewer-image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    max-width: none;
  }
  .photo-viewer footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 34px;
    padding: 8px;
    flex-shrink: 0;
    font-size: 13px;
  }
</style>
