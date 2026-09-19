<script lang="ts">
  import type { Theme } from '$lib/domain/place';
  import { themeIconPaths } from '$lib/components/themeIconPaths';

  let { theme, size = 28, strokeWidth = 1.5 }: { theme: Theme; size?: number; strokeWidth?: number } =
    $props();

  /**
   * 테마 아이콘을 직접 그렸습니다. 범용 아이콘 세트를 그대로 쓰면 어느 서비스에나 있는
   * 모양이 되어 버려서, 강릉·반려견이라는 결에 맞춰 손으로 잡았습니다.
   * 선 자료는 지도 마커와 함께 쓰느라 themeIconPaths.ts 에 있습니다.
   */
  const paths = themeIconPaths;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each paths[theme] as d (d)}<path {d} />{/each}
</svg>
