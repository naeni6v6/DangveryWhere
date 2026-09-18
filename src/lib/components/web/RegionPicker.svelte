<script lang="ts">
  import { MapPin, ChevronDown } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { groupedRegions, type RegionSummary } from '$lib/domain/region';

  let { regions, regionId }: { regions: RegionSummary[]; regionId: string } = $props();
  // '강원 전체'는 지역이 아니라 모아 보기라, 시도 묶음 위에 따로 둡니다.
  const nationwide = $derived(regions.find((region) => region.status === 'mixed'));
  // '강원' 아래 다섯 곳을 시도별로 묶어 보여 줍니다. 순서는 regionCatalog(북 → 남) 그대로예요.
  const provinces = $derived(groupedRegions(regions));
  let busy = $state(false);

  /**
   * 고른 지역은 서버가 읽어서 목록·지도를 다시 내려 줍니다.
   * 주소창에 남겨 두면 링크를 그대로 공유할 수 있고, 다음 방문에는 쿠키가 기억해요.
   */
  async function choose(next: string) {
    if (next === regionId) return;
    busy = true;
    const url = new URL(page.url);
    url.searchParams.set('region', next);
    // 이전 지역에서 고른 장소·분류는 지역이 바뀌면 의미가 없어 떼고 갑니다.
    url.searchParams.delete('place');
    await goto(url, { invalidateAll: true, noScroll: true });
    busy = false;
  }
</script>

<div class="region-picker" class:busy>
  <MapPin size={15} />
  <label class="sr-only" for="region-select">지역 선택</label>
  <select
    id="region-select"
    value={regionId}
    disabled={busy}
    onchange={(event) => choose(event.currentTarget.value)}
  >
    {#if nationwide}
      <option value={nationwide.id}>{nationwide.label} · {nationwide.placeCount}곳</option>
      <!-- 구분선. <hr> 은 아직 못 그리는 브라우저가 있어 고를 수 없는 항목으로 둡니다. -->
      <option disabled>──────────</option>
    {/if}
    {#each provinces as group (group.province)}
      <optgroup label={group.province}>
        {#each group.regions as region (region.id)}
          <option value={region.id}>{region.city} · {region.placeCount}곳</option>
        {/each}
      </optgroup>
    {/each}
  </select>
  <ChevronDown size={15} aria-hidden="true" />
</div>

<!--
  '준비 데이터' 뱃지는 지역 카드에서 뺐습니다. 다만 업체 확인 전이라는 사실 자체는 숨기지 않습니다.
  목록 아래 출처 줄('업체 확인 전'), 장소 상세의 '규정 확인일 미제공', 왼쪽 레일의 '데이터 안내'
  창이 같은 내용을 계속 알려 줍니다.
-->

<style>
  .region-picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--brand-soft);
    color: var(--brand);
    border: 1px solid #f0dcde;
    border-radius: 999px;
    padding: 7px 14px 7px 13px;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }
  .region-picker.busy {
    opacity: 0.6;
  }
  select {
    appearance: none;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0;
    cursor: pointer;
  }
  select:disabled {
    cursor: progress;
  }
</style>
