<script lang="ts">
  import {
    MapPinned,
    Map,
    RotateCcw,
    Check,
    ChevronLeft,
    PawPrint,
    CalendarHeart,
    X
  } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import {
    koreaRegions,
    koreaCaptions,
    KOREA_VIEWBOX,
    type KoreaRegion
  } from '$lib/domain/koreaRegions';
  import { koreaDistricts, districtCount } from '$lib/domain/koreaDistricts';
  import { josa } from '$lib/domain/korean';
  import {
    groupVisitsByYear,
    parseVisits,
    prettyDate,
    todayKey,
    type Visit
  } from '$lib/domain/visitLog';

  const store = getWebStore();

  /**
   * 전국 17개 시도 지도 + 시군구 세부 기록.
   * 경계와 시군구 목록 모두 swcho/korea-maps(MIT, 통계청 SGIS) 에서 가져왔어요.
   * ($lib/domain/koreaRegions.ts · $lib/domain/koreaDistricts.ts)
   */
  type Province = KoreaRegion;
  const provinces = koreaRegions;
  const validIds = new Set(provinces.map((p) => p.id));
  const validCodes = new Set(Object.values(koreaDistricts).flat().map((d) => d.code));

  // 예전에는 시도 단위로만 기록했어요. 그때 칠한 기록을 잃지 않으려고 키를 따로 둡니다.
  const PROVINCE_KEY = 'dangverywhere-visited-provinces';
  const DISTRICT_KEY = 'dangverywhere-visited-districts';

  let visits = $state<Visit[]>([]);
  /** 예전 시도 단위 기록 중 아직 세부 지역을 안 고른 것 */
  let coarseProvinces = $state<string[]>([]);
  let selectedId = $state<string | null>(null);
  let hovered = $state<string | null>(null);
  let loaded = $state(false);

  const today = () => todayKey();
  const dogName = $derived(store.dog?.name ?? '');

  // 지금은 이 브라우저에만 저장합니다. 계정에 저장하려면 서버 테이블이 필요해요.
  $effect(() => {
    if (loaded) return;
    visits = readVisits();
    coarseProvinces = readCoarse();
    loaded = true;
  });

  function readVisits(): Visit[] {
    try {
      return parseVisits(JSON.parse(localStorage.getItem(DISTRICT_KEY) ?? '[]'), (code) =>
        validCodes.has(code)
      );
    } catch {
      return [];
    }
  }

  function readCoarse(): string[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PROVINCE_KEY) ?? '[]');
      return Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string' && validIds.has(v)) : [];
    } catch {
      return [];
    }
  }

  function persist(nextVisits: Visit[], coarse: string[]) {
    visits = nextVisits;
    coarseProvinces = coarse;
    try {
      localStorage.setItem(DISTRICT_KEY, JSON.stringify(nextVisits));
      localStorage.setItem(PROVINCE_KEY, JSON.stringify(coarse));
    } catch {
      store.notify('기록을 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');
    }
  }

  const districtsOf = (id: string) => koreaDistricts[id] ?? [];
  const visitedCodes = $derived(new Set(visits.map((visit) => visit.code)));
  const visitedIn = (id: string) =>
    districtsOf(id).filter((district) => visitedCodes.has(district.code)).length;
  /** 지도에 칠할지 여부 — 세부 기록이 하나라도 있거나, 예전 시도 단위 기록이 남아 있으면 칠합니다. */
  const isOn = (id: string) => visitedIn(id) > 0 || coarseProvinces.includes(id);

  function select(province: Province) {
    selectedId = selectedId === province.id ? null : province.id;
  }

  function toggleDistrict(province: Province, code: string) {
    const on = visitedCodes.has(code);
    persist(
      on
        ? visits.filter((visit) => visit.code !== code)
        : [...visits, { code, date: today(), dog: dogName }],
      // 세부 지역을 고르는 순간 예전의 '시도 전체' 표시는 역할이 끝나요.
      on ? coarseProvinces : coarseProvinces.filter((id) => id !== province.id)
    );
  }

  function toggleWholeProvince(province: Province) {
    const codes = districtsOf(province.id).map((d) => d.code);
    const allOn = codes.length > 0 && codes.every((code) => visitedCodes.has(code));
    const day = today();
    persist(
      allOn
        ? visits.filter((visit) => !codes.includes(visit.code))
        : [
            ...visits,
            ...codes
              .filter((code) => !visitedCodes.has(code))
              .map((code) => ({ code, date: day, dog: dogName }))
          ],
      coarseProvinces.filter((id) => id !== province.id)
    );
    store.notify(
      allOn ? `${province.name} 기록을 모두 지웠어요.` : `${province.name} 전체를 다녀온 곳으로 표시했어요.`
    );
  }

  function setDate(code: string, date: string) {
    persist(
      visits.map((visit) => (visit.code === code ? { ...visit, date } : visit)),
      coarseProvinces
    );
  }

  function removeVisit(code: string) {
    persist(
      visits.filter((visit) => visit.code !== code),
      coarseProvinces
    );
  }

  function resetAll() {
    persist([], []);
    store.notify('지도 기록을 모두 지웠어요.');
  }

  const selected = $derived(provinces.find((p) => p.id === selectedId) ?? null);
  const selectedDistricts = $derived(selected ? districtsOf(selected.id) : []);
  const filledProvinces = $derived(provinces.filter((p) => isOn(p.id)).length);
  const filled = $derived(visits.length);
  const percent = $derived(Math.round((filled / districtCount) * 100));
  const hoveredName = $derived(provinces.find((p) => p.id === hovered)?.name ?? null);
  const dateOf = (code: string) => visits.find((visit) => visit.code === code)?.date ?? '';

  /** 코드 → 시도·시군구 이름 (타임라인 문장을 만들 때 씁니다) */
  const placeNames = new globalThis.Map<string, { province: string; district: string }>();
  for (const province of provinces)
    for (const district of districtsOf(province.id))
      placeNames.set(district.code, { province: province.name, district: district.name });

  /**
   * 타임라인 — 최근에 다녀온 것부터. 연도별로 묶어서 일기처럼 읽히게 합니다.
   * 날짜를 모르는 예전 기록은 맨 아래 따로 모아 두고 날짜를 채우도록 안내해요.
   */
  const timeline = $derived(groupVisitsByYear(visits));
  const undated = $derived(visits.filter((visit) => !visit.date));
</script>

<svelte:head>
  <title>지도 기록 — 댕브리웨어</title>
</svelte:head>

<div class="page-scroll">
  <div class="page">
    <header class="page-head">
      <span class="page-eyebrow"><MapPinned size={16} />OUR MAP DIARY</span>
      <h1>
        {#if dogName}{dogName}{josa(dogName, '와/과')}의 지도 기록{:else}지도
          기록{/if}
      </h1>
      <p>
        {dogName || '강아지'}{josa(dogName || '강아지', '와/과')} 다녀온 곳을 기록해 보세요. 시도를
        누르면 옆에 시군구가 펼쳐져서, 어느 동네까지 가 봤는지 하나씩 체크할 수 있어요.
      </p>
    </header>

    <div class="record-layout">
      <!-- 왼쪽: 전국 지도 -->
      <section class="map-card">
        <div class="map-top">
          <strong>전국 {provinces.length}개 시도</strong>
          <span>{hoveredName ? `${hoveredName} — 눌러서 열기` : '시도를 눌러 시군구를 골라요'}</span>
        </div>

        <svg
          class="korea"
          viewBox={KOREA_VIEWBOX}
          role="img"
          aria-label={`전국 ${provinces.length}개 시도 방문 기록 지도`}
        >
          {#each provinces as province (province.id)}
            {@const on = isOn(province.id)}
            <g
              class="province"
              class:on
              class:metro={province.metro}
              class:picked={selectedId === province.id}
              role="button"
              tabindex="0"
              aria-pressed={selectedId === province.id}
              aria-label={`${province.name} ${on ? '다녀옴' : '아직'} — 시군구 고르기`}
              onclick={() => select(province)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(province);
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

      <!-- 가운데: 고른 시도의 시군구 -->
      <section class="district-card" aria-live="polite">
        {#if selected}
          {@const districts = selectedDistricts}
          {@const done = visitedIn(selected.id)}
          {@const allOn = districts.length > 0 && done === districts.length}
          <div class="district-head">
            <button class="district-back" onclick={() => (selectedId = null)} aria-label="시군구 닫기">
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2>{selected.name}</h2>
              <span>{done} / {districts.length} 곳</span>
            </div>
          </div>

          {#if coarseProvinces.includes(selected.id)}
            <p class="district-legacy">
              예전에 시도 단위로 기록한 곳이에요. 다녀온 시군구를 고르면 이 표시는 사라져요.
            </p>
          {/if}

          <button class="district-all" onclick={() => toggleWholeProvince(selected)}>
            {allOn ? '전체 해제' : '전체 선택'}
          </button>

          <ul class="district-list">
            {#each districts as district (district.code)}
              {@const on = visitedCodes.has(district.code)}
              {@const day = dateOf(district.code)}
              <li>
                <button
                  class="district"
                  class:on
                  aria-pressed={on}
                  title={on && day ? `${day} 방문` : undefined}
                  onclick={() => toggleDistrict(selected, district.code)}
                >
                  <span class="dot">{#if on}<Check size={12} strokeWidth={3.2} />{/if}</span>
                  {district.name}
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="district-empty">
            <MapPinned size={30} />
            <strong>시도를 골라 주세요</strong>
            <p>지도나 아래 목록에서 시도를 누르면, 그 안의 시군구가 여기에 펼쳐져요.</p>
          </div>
        {/if}
      </section>

      <!-- 오른쪽: 진행 상황 + 지역 목록 -->
      <div class="side">
        <section class="progress-card">
          <span class="progress-label">다녀온 시군구</span>
          <strong class="progress-count">{filled}<small> / {districtCount}</small></strong>
          <div class="progress-bar"><span style={`width:${percent}%`}></span></div>
          <p class="progress-note">
            {#if filled === 0 && filledProvinces === 0}
              아직 기록이 없어요. 다녀온 시도부터 눌러 보세요.
            {:else if filled === districtCount}
              전국 시군구를 모두 채웠어요! 대단해요 🐾
            {:else}
              시도 {filledProvinces} / {provinces.length} 곳 · 전국의 {percent}% 를 함께 다녀왔어요.
            {/if}
          </p>
        </section>

        <section class="list-card">
          <div class="list-head">
            <h2>시도 목록</h2>
            {#if filled || coarseProvinces.length}
              <button class="reset" onclick={resetAll}><RotateCcw size={15} />모두 지우기</button>
            {/if}
          </div>
          <ul>
            {#each provinces as province (province.id)}
              {@const on = isOn(province.id)}
              {@const done = visitedIn(province.id)}
              <li>
                <button
                  class="region"
                  class:on
                  class:picked={selectedId === province.id}
                  aria-pressed={selectedId === province.id}
                  onclick={() => select(province)}
                  onmouseenter={() => (hovered = province.id)}
                  onmouseleave={() => (hovered = null)}
                >
                  <span class="dot">{#if on}<Check size={13} strokeWidth={3.2} />{/if}</span>
                  {province.name}
                  {#if done}<em>{done}</em>{/if}
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

    <!-- 우리 아이와 함께한 기록 -->
    <section class="diary">
      <div class="diary-head">
        <div>
          <span class="page-eyebrow"><PawPrint size={15} />OUR STORY</span>
          <h2>
            {#if dogName}{dogName}{josa(dogName, '와/과')} 함께한
              기록{:else}우리 아이와 함께한 기록{/if}
          </h2>
        </div>
        {#if filled}<span class="diary-count">{filled}개의 발자국</span>{/if}
      </div>

      {#if !filled}
        <div class="diary-empty">
          <CalendarHeart size={34} strokeWidth={1.3} />
          <strong>아직 첫 발자국 전이에요</strong>
          <p>
            위 지도에서 다녀온 시군구를 체크하면, 그날 날짜와 함께 여기에 차곡차곡 쌓여요.
            {#if !dogName}<br /><a href="/web/dog">우리 강아지</a>를 등록하면 아이 이름으로 기록돼요.{/if}
          </p>
        </div>
      {:else}
        {#each timeline as group (group.year)}
          <div class="diary-year"><strong>{group.year}</strong><span>{group.rows.length}곳</span></div>
          <ol class="diary-list">
            {#each group.rows as visit (visit.code)}
              {@const where = placeNames.get(visit.code)}
              <li class="diary-row">
                <span class="diary-dot"><PawPrint size={13} /></span>
                <div class="diary-body">
                  <span class="diary-date">{prettyDate(visit.date)}</span>
                  <p>
                    <strong>{visit.dog || dogName || '우리 아이'}</strong>와 함께
                    <strong>{where?.province} {where?.district}</strong>에 다녀왔어요
                  </p>
                </div>
                <div class="diary-tools">
                  <label>
                    <span class="sr-only">{where?.district} 다녀온 날짜</span>
                    <input
                      type="date"
                      value={visit.date}
                      max={today()}
                      onchange={(event) => setDate(visit.code, event.currentTarget.value)}
                    />
                  </label>
                  <button
                    class="diary-remove"
                    aria-label={`${where?.district} 기록 지우기`}
                    onclick={() => removeVisit(visit.code)}><X size={15} /></button
                  >
                </div>
              </li>
            {/each}
          </ol>
        {/each}

        {#if undated.length}
          <div class="diary-year muted">
            <strong>날짜를 모르는 기록</strong><span>{undated.length}곳</span>
          </div>
          <p class="diary-undated-note">
            시군구를 나누기 전에 칠해 둔 기록이에요. 날짜를 넣으면 위 타임라인으로 올라가요.
          </p>
          <ol class="diary-list">
            {#each undated as visit (visit.code)}
              {@const where = placeNames.get(visit.code)}
              <li class="diary-row">
                <span class="diary-dot pale"><PawPrint size={13} /></span>
                <div class="diary-body">
                  <p><strong>{where?.province} {where?.district}</strong>에 다녀왔어요</p>
                </div>
                <div class="diary-tools">
                  <label>
                    <span class="sr-only">{where?.district} 다녀온 날짜</span>
                    <input
                      type="date"
                      value=""
                      max={today()}
                      onchange={(event) => setDate(visit.code, event.currentTarget.value)}
                    />
                  </label>
                  <button
                    class="diary-remove"
                    aria-label={`${where?.district} 기록 지우기`}
                    onclick={() => removeVisit(visit.code)}><X size={15} /></button
                  >
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      {/if}
    </section>
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

  /* 지도 · 시군구 · 진행상황 세 칸. 좁아지면 아래 미디어 쿼리에서 단계적으로 접어요. */
  .record-layout {
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(250px, 310px) minmax(260px, 330px);
    gap: 22px;
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

  /* 지금 열어 둔 시도는 지도에서도 테두리로 표시해요 */
  .province.picked path {
    stroke: var(--brand-deep);
    stroke-width: 2.6px;
  }

  /* ---------- 가운데: 시군구 ---------- */
  .district-card {
    padding: 20px 20px 22px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    min-height: 320px;
  }
  .district-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .district-head h2 {
    margin: 0;
    font-size: 19px;
    letter-spacing: -0.6px;
  }
  .district-head span {
    font-size: 13.5px;
    color: var(--muted);
  }
  .district-back {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: none;
    color: var(--brown-warm);
    cursor: pointer;
  }
  .district-back:hover {
    background: var(--sand);
  }
  .district-legacy {
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--brand-tint);
    color: var(--brown-warm);
    font-size: 13px;
    line-height: 1.55;
  }
  .district-all {
    width: 100%;
    margin-bottom: 12px;
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--ivory);
    color: var(--brown-warm);
    font-size: 13.5px;
    cursor: pointer;
  }
  .district-all:hover {
    border-color: var(--brand);
    color: var(--brand);
  }
  .district-list {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;
    /* 경기(42곳)처럼 긴 목록에서도 칸이 세로로 끝없이 늘어나지 않게 */
    max-height: 420px;
    overflow: auto;
  }
  .district {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--ivory);
    color: var(--brown-warm);
    font-size: 13.5px;
    cursor: pointer;
    transition:
      background 0.16s,
      color 0.16s,
      border-color 0.16s;
  }
  .district:hover {
    border-color: var(--brand);
    color: var(--brand);
  }
  .district.on {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
    font-weight: 600;
  }
  .district .dot {
    width: 16px;
    height: 16px;
  }
  .district.on .dot {
    background: #fff;
    color: var(--brand);
    border-color: transparent;
  }
  .district-empty {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 56px 16px;
    text-align: center;
    color: var(--muted);
  }
  .district-empty strong {
    font-size: 16px;
    color: var(--ink);
  }
  .district-empty p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
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
  /* 지금 시군구를 열어 둔 시도 */
  .region.picked {
    border-color: var(--brand);
    box-shadow: 0 0 0 2px #b5704e2e;
  }
  .region em {
    font-style: normal;
    font-size: 12px;
    opacity: 0.75;
  }

  /* ---------- 우리 아이와 함께한 기록 ---------- */
  .diary {
    margin-top: 34px;
    padding: 28px 30px 32px;
    border: 1px solid var(--line);
    border-radius: 26px;
    background: #fff;
  }
  .diary-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .diary-head h2 {
    margin: 10px 0 0;
    font-size: 26px;
    letter-spacing: -1px;
  }
  .diary-count {
    flex-shrink: 0;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--brand-tint);
    color: var(--brand);
    font-size: 13.5px;
    font-weight: 600;
  }
  .diary-year {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 26px 0 12px;
  }
  .diary-year:first-of-type {
    margin-top: 0;
  }
  .diary-year strong {
    font-size: 19px;
    letter-spacing: -0.5px;
    color: var(--brand);
  }
  .diary-year span {
    font-size: 13px;
    color: var(--muted);
  }
  .diary-year.muted strong {
    font-size: 15px;
    color: var(--muted);
  }
  .diary-undated-note {
    margin: -4px 0 12px;
    font-size: 13px;
    color: var(--muted);
  }
  .diary-list {
    margin: 0;
    padding: 0 0 0 9px;
    list-style: none;
    /* 발자국을 잇는 세로선 */
    border-left: 2px dashed var(--line);
  }
  .diary-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 11px 0 11px 20px;
    position: relative;
  }
  .diary-dot {
    position: absolute;
    left: -12px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
    flex-shrink: 0;
  }
  .diary-dot.pale {
    background: var(--sand);
    color: var(--muted);
  }
  .diary-body {
    flex: 1;
    min-width: 0;
  }
  .diary-date {
    display: block;
    font-size: 12.5px;
    color: var(--muted);
  }
  .diary-body p {
    margin: 2px 0 0;
    font-size: 15.5px;
    line-height: 1.55;
    color: var(--ink);
    word-break: keep-all;
  }
  .diary-body strong {
    font-weight: 700;
    color: var(--brand-deep);
  }
  .diary-tools {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .diary-tools input {
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--ivory);
    color: var(--brown-warm);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .diary-tools input:hover {
    border-color: var(--brand);
  }
  .diary-remove {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 9px;
    background: none;
    color: #bcaa9e;
    cursor: pointer;
  }
  .diary-remove:hover {
    background: var(--sand);
    color: var(--brand);
  }
  .diary-empty {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 48px 20px 54px;
    text-align: center;
    color: var(--muted);
  }
  .diary-empty strong {
    font-size: 17px;
    color: var(--ink);
  }
  .diary-empty p {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
  }

  .storage-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }

  /* 세 칸이 안 들어가면 지도 아래로 시군구·진행상황을 나란히 내립니다. */
  @media (max-width: 1240px) {
    .record-layout {
      grid-template-columns: 1fr 1fr;
    }
    .map-card {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 1080px) {
    .record-layout {
      grid-template-columns: 1fr;
    }
    .map-card {
      grid-column: auto;
    }
  }
  @media (max-width: 760px) {
    .page {
      width: calc(100% - 32px);
    }
  }
</style>
