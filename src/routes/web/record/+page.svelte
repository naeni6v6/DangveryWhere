<script lang="ts">
  import { MapPinned, Map, RotateCcw, Check } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import {
    koreaRegions,
    koreaCaptions,
    KOREA_VIEWBOX,
    type KoreaRegion
  } from '$lib/domain/koreaRegions';

  const store = getWebStore();

  /**
   * 전국 16개 시도 지도.
   * 경계 데이터는 swcho/korea-maps(MIT, 통계청 SGIS) 를 단순화한 것으로
   * $lib/domain/koreaRegions.ts 에 있어요. (생성: assets/korea-maps/build_regions.py)
   * 기존 8도 기록(gyeonggi, gangwon …)과 id 가 같아서 예전에 칠한 기록도 그대로 이어져요.
   */
  type Province = KoreaRegion;
  const provinces = koreaRegions;
  const validIds = new Set(provinces.map((p) => p.id));

  const STORAGE_KEY = 'dangverywhere-visited-provinces';

  let visited = $state<string[]>([]);
  let hovered = $state<string | null>(null);
  let loaded = $state(false);

  // 지금은 이 브라우저에만 저장합니다. 계정에 저장하려면 서버 테이블이 필요해요.
  $effect(() => {
    if (loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      visited = Array.isArray(saved) ? saved.filter((id) => validIds.has(id)) : [];
    } catch {
      visited = [];
    }
    loaded = true;
  });

  function persist(next: string[]) {
    visited = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      store.notify('기록을 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');
    }
  }

  function toggle(province: Province) {
    const isOn = visited.includes(province.id);
    persist(isOn ? visited.filter((id) => id !== province.id) : [...visited, province.id]);
    store.notify(
      isOn ? `${province.name}을(를) 기록에서 지웠어요.` : `${province.name}을(를) 다녀온 곳으로 기록했어요.`
    );
  }

  function resetAll() {
    persist([]);
    store.notify('지도 기록을 모두 지웠어요.');
  }

  const filled = $derived(visited.length);
  const percent = $derived(Math.round((filled / provinces.length) * 100));
  const hoveredName = $derived(provinces.find((p) => p.id === hovered)?.name ?? null);
</script>

<svelte:head>
  <title>지도 기록 — 댕브리웨어</title>
</svelte:head>

<div class="page-scroll">
  <div class="page">
    <header class="page-head">
      <span class="page-eyebrow"><MapPinned size={16} />OUR MAP DIARY</span>
      <h1>지도 기록</h1>
      <p>강아지와 다녀온 지역을 눌러서 칠해 보세요. 전국이 얼마나 채워졌는지 한눈에 보여드려요.</p>
    </header>

    <div class="record-layout">
      <!-- 왼쪽: 전국 지도 -->
      <section class="map-card">
        <div class="map-top">
          <strong>전국 16개 시도</strong>
          <span>{hoveredName ? `${hoveredName} — 눌러서 표시` : '지역을 눌러 기록해요'}</span>
        </div>

        <svg class="korea" viewBox={KOREA_VIEWBOX} role="img" aria-label="전국 16개 시도 방문 기록 지도">
          {#each provinces as province (province.id)}
            {@const on = visited.includes(province.id)}
            <g
              class="province"
              class:on
              class:metro={province.metro}
              role="button"
              tabindex="0"
              aria-pressed={on}
              aria-label={`${province.name} ${on ? '다녀옴' : '아직'}`}
              onclick={() => toggle(province)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggle(province);
                }
              }}
              onmouseenter={() => (hovered = province.id)}
              onmouseleave={() => (hovered = null)}
              onfocus={() => (hovered = province.id)}
              onblur={() => (hovered = null)}
            >
              <path d={province.d} />
              <text x={province.labelX} y={province.labelY}>{province.name}</text>
            </g>
          {/each}
          {#each koreaCaptions as caption (caption.text)}
            <text class="caption" x={caption.x} y={caption.y}>{caption.text}</text>
          {/each}
        </svg>
      </section>

      <!-- 오른쪽: 진행 상황 + 지역 목록 -->
      <div class="side">
        <section class="progress-card">
          <span class="progress-label">채운 지역</span>
          <strong class="progress-count">{filled}<small> / {provinces.length}</small></strong>
          <div class="progress-bar"><span style={`width:${percent}%`}></span></div>
          <p class="progress-note">
            {#if filled === 0}
              아직 칠한 지역이 없어요. 다녀온 곳부터 눌러 보세요.
            {:else if filled === provinces.length}
              전국을 모두 채웠어요! 대단해요 🐾
            {:else}
              전국의 {percent}% 를 함께 다녀왔어요.
            {/if}
          </p>
        </section>

        <section class="list-card">
          <div class="list-head">
            <h2>지역 목록</h2>
            {#if filled}
              <button class="reset" onclick={resetAll}><RotateCcw size={15} />모두 지우기</button>
            {/if}
          </div>
          <ul>
            {#each provinces as province (province.id)}
              {@const on = visited.includes(province.id)}
              <li>
                <button
                  class="region"
                  class:on
                  aria-pressed={on}
                  onclick={() => toggle(province)}
                  onmouseenter={() => (hovered = province.id)}
                  onmouseleave={() => (hovered = null)}
                >
                  <span class="dot">{#if on}<Check size={13} strokeWidth={3.2} />{/if}</span>
                  {province.name}
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <p class="storage-note">
          지금은 이 브라우저에만 저장돼요. 다른 기기에서도 보이게 하려면 계정 저장이 필요해요.
        </p>

        <a class="secondary-button" href="/web/explore"><Map size={18} />갈 곳 찾으러 가기</a>
      </div>
    </div>
  </div>
</div>

<style>
  .page-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .page {
    width: min(1320px, calc(100% - 72px));
    margin: 0 auto;
    padding: 44px 0 70px;
  }
  .page-head {
    margin-bottom: 30px;
  }
  .page-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2.2px;
    color: var(--brand);
  }
  .page-head h1 {
    margin: 12px 0 0;
    font-size: 38px;
    letter-spacing: -1.5px;
  }
  .page-head p {
    margin: 12px 0 0;
    font-size: 16px;
    color: var(--muted);
  }

  .record-layout {
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(300px, 380px);
    gap: 26px;
    align-items: start;
  }

  /* ---------- 지도 ---------- */
  .map-card {
    padding: 22px 24px 28px;
    border: 1px solid var(--line);
    border-radius: 26px;
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    box-shadow: 0 16px 40px #4a342814;
  }
  .map-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .map-top strong {
    font-size: 17px;
    letter-spacing: -0.5px;
  }
  .map-top span {
    font-size: 13.5px;
    color: var(--muted);
  }
  .korea {
    display: block;
    width: 100%;
    max-width: 470px;
    margin: 4px auto 0;
    height: auto;
    overflow: visible;
  }

  .province path {
    fill: #fff;
    stroke: #d9c2ad;
    stroke-width: 1.1px;
    stroke-linejoin: round;
    /* 화면 크기와 상관없이 경계선 두께를 일정하게 */
    vector-effect: non-scaling-stroke;
    transition:
      fill 0.2s ease,
      stroke 0.2s ease;
  }
  .province.metro path {
    fill: var(--ivory);
  }
  .province text,
  .caption {
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
    /* 경계선 위에 글자가 걸려도 읽히도록 글자 둘레에 바탕색 테두리 */
    paint-order: stroke;
    stroke: #fff;
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .province text {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.4px;
    fill: var(--brown-warm);
    transition:
      fill 0.2s ease,
      stroke 0.2s ease;
  }
  .province.metro text {
    font-size: 12.5px;
    font-weight: 600;
    stroke: var(--ivory);
  }
  .caption {
    font-size: 11px;
    fill: var(--muted);
    stroke: var(--brand-tint);
  }
  .province {
    cursor: pointer;
    outline: none;
  }
  .province:hover path,
  .province:focus-visible path {
    fill: var(--brand-soft);
    stroke: var(--brand);
  }
  .province:hover text,
  .province:focus-visible text {
    stroke: var(--brand-soft);
  }
  .province:focus-visible path {
    stroke-width: 2.4px;
  }
  /* 다녀온 지역 */
  .province.on path {
    fill: var(--brand);
    stroke: var(--brand-deep);
  }
  .province.on text {
    fill: #fff;
    stroke: var(--brand);
  }
  .province.on:hover path {
    fill: var(--brand-deep);
  }
  .province.on:hover text {
    stroke: var(--brand-deep);
  }

  /* ---------- 오른쪽 ---------- */
  .side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
  }
  .progress-card {
    padding: 26px 26px 28px;
    border-radius: 24px;
    background: linear-gradient(140deg, var(--brand) 0%, var(--brand-deep) 100%);
    color: #fff;
    box-shadow: 0 14px 34px #b5704e3d;
  }
  .progress-label {
    font-size: 13.5px;
    color: #ffe6d6;
  }
  .progress-count {
    display: block;
    margin-top: 4px;
    font-size: 40px;
    letter-spacing: -1.6px;
    line-height: 1.1;
  }
  .progress-count small {
    font-size: 19px;
    color: #ffffffb8;
  }
  .progress-bar {
    height: 8px;
    margin-top: 16px;
    border-radius: 999px;
    background: #ffffff38;
    overflow: hidden;
  }
  .progress-bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #fff;
    transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  .progress-note {
    margin: 14px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: #ffffffe0;
  }

  .list-card {
    padding: 22px 24px 24px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
  }
  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .list-head h2 {
    margin: 0;
    font-size: 17px;
    letter-spacing: -0.5px;
  }
  .reset {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: none;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
  }
  .reset:hover {
    background: var(--sand);
    color: var(--brown-warm);
  }
  .list-card ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .region {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 15px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--ivory);
    color: var(--brown-warm);
    font-size: 14.5px;
    cursor: pointer;
    transition:
      background 0.16s,
      color 0.16s,
      border-color 0.16s;
  }
  .region:hover {
    border-color: var(--brand);
    color: var(--brand);
  }
  .region.on {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
    font-weight: 600;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff4d;
    border: 1px solid #00000014;
  }
  .region.on .dot {
    background: #fff;
    color: var(--brand);
    border-color: transparent;
  }

  .storage-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }

  @media (max-width: 1080px) {
    .record-layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 760px) {
    .page {
      width: calc(100% - 32px);
    }
  }
</style>
