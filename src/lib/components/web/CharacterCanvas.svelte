<script lang="ts">
  import { untrack } from 'svelte';
  import type { CharacterLayout, CharacterParams, FurColorKey } from '$lib/domain/character';
  import { CharacterRenderer } from '$lib/character/renderer';

  /**
   * 캐릭터 미리보기 캔버스.
   * AI 가 만든 그림(src)을 한 번 읽어 두고, params 가 바뀔 때마다 브라우저에서 다시 그립니다.
   * 부모는 exportImage() 로 저장용 그림을 받아 갑니다.
   */
  let {
    src,
    layout = null,
    originalColor,
    earAnchor = 'center',
    params,
    size = 448,
    alt = '내 강아지 캐릭터',
    onready,
    onerror
  }: {
    src: string;
    layout?: CharacterLayout | null;
    originalColor: FurColorKey;
    earAnchor?: 'top' | 'bottom' | 'center';
    params: CharacterParams;
    size?: number;
    alt?: string;
    onready?: (renderer: CharacterRenderer) => void;
    onerror?: (error: unknown) => void;
  } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let renderer = $state<CharacterRenderer | null>(null);
  let loading = $state(true);
  let frame = 0;

  // 그림이 바뀌면 다시 읽습니다. 그 사이 슬라이더 값은 그대로 두고요.
  $effect(() => {
    const source = src;
    const opts = { layout, originalColor, earAnchor };
    let cancelled = false;
    loading = true;
    renderer = null;
    CharacterRenderer.load(source, opts)
      .then((loaded) => {
        if (cancelled) return;
        renderer = loaded;
        loading = false;
        onready?.(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        loading = false;
        onerror?.(error);
      });
    return () => {
      cancelled = true;
    };
  });

  // 값이 바뀌면 다음 프레임에 한 번만 그립니다 (슬라이더를 끌 때 몰아서 처리).
  $effect(() => {
    const current = renderer;
    const target = canvas;
    const snapshot = { ...params };
    const px = size;
    if (!current || !target) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => untrack(() => current.render(target, snapshot, px)));
    return () => cancelAnimationFrame(frame);
  });

  /** 저장용 최종 그림 (투명 WebP data URL). 아직 준비 전이면 null. */
  export function exportImage(exportSize = 640): string | null {
    return renderer ? renderer.export(params, exportSize) : null;
  }
  export function isReady() {
    return Boolean(renderer);
  }
</script>

<div class="character-canvas" class:loading style:--character-scale={params.scale}>
  <canvas bind:this={canvas} width={size} height={size} aria-label={alt}></canvas>
  {#if loading}
    <span class="canvas-wait" aria-hidden="true"></span>
  {/if}
</div>

<style>
  .character-canvas {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
  }
  canvas {
    width: 100%;
    height: 100%;
    /* 전체 크기 슬라이더는 발끝을 기준으로 CSS 로만 키웁니다 */
    transform: scale(var(--character-scale, 1));
    transform-origin: 50% 88%;
    transition: transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
    user-select: none;
  }
  .loading canvas {
    opacity: 0;
  }
  .canvas-wait {
    position: absolute;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 4px solid var(--brand-soft, #f6e7dc);
    border-top-color: var(--brand, #b5704e);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
