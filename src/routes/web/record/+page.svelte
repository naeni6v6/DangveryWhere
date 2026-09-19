<script lang="ts">
  import { Stamp, Map, RotateCcw, ChevronLeft, PawPrint, X, Check } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import { GANGWON_VIEWBOX, gangwonDistricts, type GangwonDistrict } from '$lib/domain/gangwonMap';
  import { koreaRegions } from '$lib/domain/koreaRegions';
  import { koreaDistricts } from '$lib/domain/koreaDistricts';
  import { regionCatalog } from '$lib/domain/region';
  import { josa } from '$lib/domain/korean';
  import { parseVisits, prettyDate, stampDate, todayKey, type Visit } from '$lib/domain/visitLog';

  const store = getWebStore();

  /**
   * 댕스탬프 — 강원 18개 시군구를 한 곳씩 다녀올 때마다 스탬프를 찍어 모으는 스탬프 투어.
   * 경계도 시군구 목록도 swcho/korea-maps(MIT, 통계청 SGIS) 에서 가져왔어요.
   * ($lib/domain/gangwonMap.ts · $lib/domain/koreaDistricts.ts)
   *
   * 스탬프는 시군구마다 하나뿐이라, 한 번 찍으면 다시 찍을 수 없고 날짜만 고칠 수 있어요.
   * 잘못 찍은 것은 고른 시군구 카드에서 뺄 수 있습니다.
   *
   * 강원 밖에 찍어 둔 예전 기록은 지우지 않고 그대로 둡니다 — 나중에 지역을 넓히면 다시 살아나야 하고,
   * 화면이 좁아졌다고 남의 기록을 버릴 이유는 없으니까요. 대신 이 화면의 숫자에서는 빼고 셉니다.
   */
  const districts = gangwonDistricts;
  const gangwonCodes = new Set(districts.map((district) => district.code));
  // 저장된 기록을 거를 때만은 전국 코드로 봅니다. 강원 밖 기록을 읽다가 버리지 않으려고요.
  const validCodes = new Set(Object.values(koreaDistricts).flat().map((d) => d.code));
  const validIds = new Set(koreaRegions.map((province) => province.id));

  // 예전에는 시도 단위로만 기록했어요. 그때 칠한 기록을 잃지 않으려고 키를 따로 둡니다.
  // (저장 키는 지도 기록 시절 그대로라, 그때 찍어 둔 기록이 스탬프로 그대로 이어집니다.)
  const PROVINCE_KEY = 'dangverywhere-visited-provinces';
  const DISTRICT_KEY = 'dangverywhere-visited-districts';

  let visits = $state<Visit[]>([]);
  /** 예전 시도 단위 기록 중 아직 세부 지역을 안 고른 것 */
  let coarseProvinces = $state<string[]>([]);
  let selectedCode = $state<string | null>(null);
  let hovered = $state<string | null>(null);
  let loaded = $state(false);
  /** 방금 찍은 스탬프. 쿵 하고 찍히는 애니메이션을 그 도장에만 줍니다. */
  let justStamped = $state<string | null>(null);

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
      store.notify('스탬프를 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');
    }
  }

  const stampedCodes = $derived(new Set(visits.map((visit) => visit.code)));
  const isStamped = (code: string) => stampedCodes.has(code);
  const hasLegacyProvince = $derived(coarseProvinces.includes('gangwon'));

  function select(district: GangwonDistrict) {
    selectedCode = selectedCode === district.code ? null : district.code;
  }

  /** 스탬프는 시군구마다 하나. 이미 찍힌 곳은 그대로 둡니다. */
  function stamp(district: GangwonDistrict) {
    if (stampedCodes.has(district.code)) return;
    persist(
      [...visits, { code: district.code, date: today(), dog: dogName }],
      // 시군구를 하나라도 찍는 순간 예전의 '강원 전체' 표시는 역할이 끝나요.
      coarseProvinces.filter((id) => id !== 'gangwon')
    );
    justStamped = district.code;
    const count = visits.filter((visit) => gangwonCodes.has(visit.code)).length;
    store.notify(
      count === districts.length
        ? `강원 ${districts.length}개 스탬프를 모두 모았어요! 🐾`
        : `${district.name} 스탬프를 찍었어요. (${count}/${districts.length})`
    );
  }

  function setDate(code: string, date: string) {
    persist(
      visits.map((visit) => (visit.code === code ? { ...visit, date } : visit)),
      coarseProvinces
    );
  }

  /** 잘못 찍은 스탬프를 뺍니다. */
  function unstamp(code: string) {
    persist(
      visits.filter((visit) => visit.code !== code),
      coarseProvinces
    );
    if (justStamped === code) justStamped = null;
  }

  /** 이 화면이 보여 준 것만 지웁니다. 화면 밖(강원 밖) 기록까지 말없이 지우지 않아요. */
  function resetAll() {
    if (!confirm(`강원 스탬프 ${filled}개를 모두 지울까요? 되돌릴 수 없어요.`)) return;
    persist(
      visits.filter((visit) => !gangwonCodes.has(visit.code)),
      coarseProvinces.filter((id) => id !== 'gangwon')
    );
    justStamped = null;
    store.notify('강원 스탬프를 모두 지웠어요.');
  }

  const selected = $derived(districts.find((district) => district.code === selectedCode) ?? null);
  /** 이 화면이 세는 것은 강원 안의 스탬프입니다. */
  const filled = $derived(visits.filter((visit) => gangwonCodes.has(visit.code)).length);
  const complete = $derived(filled === districts.length);
  const percent = $derived(Math.round((filled / districts.length) * 100));
  const hoveredName = $derived(districts.find((d) => d.code === hovered)?.name ?? null);
  /** 강원 밖에 남아 있는 예전 기록. 지우지 않았다는 것만 알려 줍니다. */
  const outside = $derived(visits.filter((visit) => !gangwonCodes.has(visit.code)).length);
  const visitOf = (code: string) => visits.find((visit) => visit.code === code) ?? null;
  /** 그 시군구의 장소 데이터를 갖고 있으면 탐색으로 건너뛸 수 있게 해 줍니다. */
  const regionOf = (name: string) =>
    regionCatalog.find((region) => region.status !== 'mixed' && region.city === name) ?? null;
  /**
   * SVG 에는 z-index 가 없어서 나중에 그린 도형이 위로 옵니다.
   * 고른 시군구의 굵은 테두리가 이웃 도형에 잘리지 않도록 그것만 맨 뒤로 보냅니다.
   * (마우스만 올린 경우는 건드리지 않아요. 커서 밑에서 노드가 움직이면 깜빡여 보여서요.)
   */
  const mapOrder = $derived(
    [...districts].sort(
      (a, b) => Number(a.code === selectedCode) - Number(b.code === selectedCode)
    )
  );
</script>

<svelte:head>
  <title>댕스탬프 — 댕브리웨어</title>
</svelte:head>

<div class="page-scroll">
  <div class="page">
    <header class="page-head">
      <span class="page-eyebrow"><Stamp size={16} />DANG STAMP TOUR</span>
      <h1>
        {#if dogName}{dogName}{josa(dogName, '와/과')} 모으는 댕스탬프{:else}댕스탬프{/if}
      </h1>
      <p>
        강원 {districts.length}개 시군구를 다녀올 때마다 스탬프를 하나씩 찍어요. 지도에서 다녀온
        시군구를 누르고 스탬프를 찍으면, 아래 스탬프 기록에 차곡차곡 모여요.
      </p>
    </header>

    <div class="stamp-layout">
      <!-- 왼쪽: 강원 지도 -->
      <section class="map-card">
        <div class="map-top">
          <strong>강원 {districts.length}개 시군구</strong>
          <span
            >{hoveredName
              ? isStamped(hovered ?? '')
                ? `${hoveredName} — 스탬프 완료`
                : `${hoveredName} — 눌러서 스탬프 찍기`
              : '다녀온 시군구를 눌러 스탬프를 찍어요'}</span
          >
        </div>

        <svg
          class="gangwon"
          viewBox={GANGWON_VIEWBOX}
          role="img"
          aria-label={`강원 ${districts.length}개 시군구 스탬프 지도`}
        >
          <!--
            도형을 먼저 다 그리고, 도장과 이름은 그 위에 한 겹 더 올립니다.
            SVG 에는 z-index 가 없어 나중에 그린 것이 위로 오는데, 한 묶음으로 그리면
            이웃 시군구의 도형이 앞서 그린 이름을 덮어 버려요(속초·동해처럼 작은 곳이 그랬습니다).
          -->
          {#each mapOrder as district (district.code)}
            {@const on = isStamped(district.code)}
            <g
              class="area"
              class:on
              class:picked={selectedCode === district.code}
              role="button"
              tabindex="0"
              aria-pressed={selectedCode === district.code}
              aria-label={`${district.name} ${on ? '스탬프 완료' : '스탬프 전'}`}
              onclick={() => select(district)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(district);
                }
              }}
              onmouseenter={() => (hovered = district.code)}
              onmouseleave={() => (hovered = null)}
              onfocus={() => (hovered = district.code)}
              onblur={() => (hovered = null)}
            >
              <path class="area-shape" d={district.d} />
            </g>
          {/each}
          {#each districts as district (district.code)}
            {@const on = isStamped(district.code)}
            <g
              class="marker"
              class:on
              class:hot={hovered === district.code || selectedCode === district.code}
              aria-hidden="true"
            >
              <!-- pinX·pinY 는 도형 안쪽에서 가장 여유로운 자리. 찍힌 곳은 도장, 아닌 곳은 빈 핀. -->
              <g transform={`translate(${district.pinX} ${district.pinY})`}>
                {#if on}
                  <g class="seal-mark">
                    <circle class="seal-ring" cx="0" cy="-7" r="13.5" />
                    <circle class="seal-inner" cx="0" cy="-7" r="9.5" />
                    <path class="seal-check" d="M-4.6,-6.6 L-1.4,-3.4 L4.8,-10.2" />
                  </g>
                {:else}
                  <path
                    class="pin-body"
                    d="M0,0 C-3.8,-6.5 -9.6,-11.3 -9.6,-16.3 A9.6,9.6 0 1 1 9.6,-16.3 C9.6,-11.3 3.8,-6.5 0,0 Z"
                  />
                  <circle class="pin-hole" cx="0" cy="-16.3" r="3.6" />
                {/if}
              </g>
              <text x={district.pinX} y={district.pinY + 15}>{district.name}</text>
            </g>
          {/each}
        </svg>
      </section>

      <!-- 오른쪽: 진행 상황 + 고른 시군구 -->
      <aside class="side">
        <section class="progress-card" class:complete>
          <span class="progress-label">{complete ? '스탬프 투어 완주' : '모은 스탬프'}</span>
          <strong class="progress-count">{filled}<small> / {districts.length}</small></strong>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={filled}
            aria-valuemin="0"
            aria-valuemax={districts.length}
          >
            <span style={`width:${percent}%`}></span>
          </div>
          <p class="progress-note">
            {#if filled === 0}
              첫 스탬프를 기다리고 있어요. 다녀온 시군구부터 찍어 보세요.
            {:else if complete}
              강원 {districts.length}개 시군구 스탬프를 모두 모았어요! 대단해요 🐾
            {:else}
              {districts.length - filled}개만 더 모으면 강원 스탬프 투어 완주예요.
            {/if}
          </p>
        </section>

        <section class="district-card" aria-live="polite">
          {#if selected}
            {@const visit = visitOf(selected.code)}
            {@const region = regionOf(selected.name)}
            <div class="district-head">
              <button
                class="district-back"
                onclick={() => (selectedCode = null)}
                aria-label="시군구 닫기"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <h2>강원 {selected.name}</h2>
                <span
                  >{visit
                    ? visit.date
                      ? `${prettyDate(visit.date)} 스탬프`
                      : '스탬프 완료'
                    : '아직 스탬프가 없어요'}</span
                >
              </div>
            </div>

            {#if visit}
              <!-- 찍힌 스탬프. 스탬프 기록의 도장과 같은 모양을 크게 보여 줍니다. -->
              <div class="district-seal">
                <div class="seal" class:fresh={justStamped === selected.code}>
                  <PawPrint size={18} strokeWidth={2.2} />
                  <strong>{selected.name}</strong>
                  <small>{visit.date ? stampDate(visit.date) : '강원'}</small>
                </div>
              </div>
              <label class="district-date">
                <span>다녀온 날</span>
                <input
                  type="date"
                  value={visit.date}
                  max={today()}
                  onchange={(event) => setDate(selected.code, event.currentTarget.value)}
                />
              </label>
            {:else}
              <button class="stamp-button" onclick={() => stamp(selected)}>
                <Stamp size={20} />{selected.name} 스탬프 찍기
              </button>
            {/if}

            <!-- 장소 데이터를 갖고 있는 시군구에서만 탐색으로 건너뜁니다. 없는 링크를 만들지 않아요. -->
            {#if region}
              <a class="district-explore" href={`/web/explore?region=${region.id}`}>
                <Map size={16} />{selected.name}에서 갈 곳 보기
              </a>
            {:else}
              <p class="district-note">
                이 시군구의 장소 데이터는 아직 준비 중이에요. 스탬프는 지금도 찍을 수 있어요.
              </p>
            {/if}

            {#if visit}
              <button class="district-undo" onclick={() => unstamp(selected.code)}>
                <X size={14} />잘못 찍었어요, 스탬프 빼기
              </button>
            {/if}
          {:else}
            <div class="district-empty">
              <Stamp size={30} strokeWidth={1.4} />
              <strong>시군구를 골라 주세요</strong>
              <p>지도나 아래 스탬프 기록에서 시군구를 누르면, 여기서 스탬프를 찍을 수 있어요.</p>
            </div>
          {/if}
        </section>

        {#if hasLegacyProvince}
          <p class="legacy-note">
            예전에 '강원'을 통째로 기록해 둔 게 남아 있어요. 다녀온 시군구에 스탬프를 찍으면 이 표시는
            사라져요.
          </p>
        {/if}
        <p class="storage-note">
          지금은 이 브라우저에만 저장돼요. 다른 기기에서도 보이게 하려면 계정 저장이 필요해요.
          {#if outside}<br />강원 밖에 찍어 둔 예전 기록 {outside}곳은 지우지 않고 그대로 두었어요.{/if}
        </p>
      </aside>
    </div>

    <!-- 스탬프 기록: 18칸 스탬프북 -->
    <section class="stamp-book">
      <div class="book-head">
        <div>
          <span class="page-eyebrow"><PawPrint size={15} />STAMP BOOK</span>
          <h2>
            {#if dogName}{dogName}의 스탬프 기록{:else}스탬프 기록{/if}
          </h2>
        </div>
        <div class="book-tools">
          <span class="book-count"><strong>{filled}</strong> / {districts.length}</span>
          {#if filled}
            <button class="reset" onclick={resetAll}><RotateCcw size={14} />모두 지우기</button>
          {/if}
        </div>
      </div>

      <ol class="slots" aria-label="강원 시군구 스탬프 기록">
        {#each districts as district (district.code)}
          {@const visit = visitOf(district.code)}
          <li>
            <button
              class="slot"
              class:on={visit !== null}
              class:picked={selectedCode === district.code}
              aria-pressed={selectedCode === district.code}
              aria-label={`${district.name} ${
                visit ? (visit.date ? prettyDate(visit.date) + ' 스탬프' : '스탬프 완료') : '스탬프 전'
              }`}
              onclick={() => select(district)}
              onmouseenter={() => (hovered = district.code)}
              onmouseleave={() => (hovered = null)}
            >
              {#if visit}
                <span class="seal" class:fresh={justStamped === district.code} aria-hidden="true">
                  <PawPrint size={16} strokeWidth={2.2} />
                  <strong>{district.name}</strong>
                  <small>{visit.date ? stampDate(visit.date) : '강원'}</small>
                </span>
              {:else}
                <span class="slot-empty" aria-hidden="true">
                  <span class="slot-name">{district.name}</span>
                </span>
              {/if}
              <span class="slot-caption">
                {#if visit}<Check size={12} strokeWidth={3} />{visit.date
                    ? prettyDate(visit.date)
                    : '스탬프 완료'}{:else}아직이에요{/if}
              </span>
            </button>
          </li>
        {/each}
      </ol>

      <p class="book-note">
        {#if !dogName}
          <a href="/web/dog">우리 강아지</a>를 등록하면 아이 이름으로 스탬프가 남아요.
        {:else if complete}
          강원 스탬프 투어를 완주했어요. 다음 여행에서도 {dogName}{josa(dogName, '와/과')} 좋은 하루
          보내세요.
        {:else}
          시군구마다 스탬프는 하나예요. 날짜는 위에서 고른 시군구 카드에서 고칠 수 있어요.
        {/if}
      </p>
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
    max-width: 720px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--muted);
    word-break: keep-all;
  }

  /* 지도 · 오른쪽 칸. 좁아지면 아래 미디어 쿼리에서 한 줄로 접어요. */
  .stamp-layout {
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(300px, 360px);
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
  .gangwon {
    display: block;
    width: 100%;
    max-width: 620px;
    margin: 4px auto 0;
    height: auto;
    overflow: visible;
  }

  .area-shape {
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
  /* 도장·이름표 한 겹. 도형 위에 떠 있을 뿐이라 마우스는 그대로 도형이 받습니다. */
  .marker {
    pointer-events: none;
  }
  .marker text {
    text-anchor: middle;
    dominant-baseline: hanging;
    /* 경계선 위에 글자가 걸려도 읽히도록 글자 둘레에 바탕색 테두리 */
    paint-order: stroke;
    stroke: #fff;
    stroke-width: 5px;
    stroke-linejoin: round;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.4px;
    fill: var(--brown-warm);
    transition:
      fill 0.2s ease,
      stroke 0.2s ease;
  }
  /* 빈 핀 — 아직 스탬프가 없는 곳 */
  .pin-body {
    fill: #fff;
    stroke: var(--brand);
    stroke-width: 2.2px;
  }
  .pin-hole {
    fill: var(--brand);
  }
  /* 도장 — 스탬프를 찍은 곳. 흰 테두리 위에 브랜드색 링 두 겹과 체크 */
  .seal-ring {
    fill: var(--brand-deep);
    stroke: #fff;
    stroke-width: 2.5px;
  }
  .seal-inner {
    fill: none;
    stroke: #ffffffb8;
    stroke-width: 1.4px;
    stroke-dasharray: 2.2 2.2;
  }
  .seal-check {
    fill: none;
    stroke: #fff;
    stroke-width: 2.6px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .seal-mark {
    transform-box: fill-box;
    transform-origin: center;
    animation: seal-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes seal-in {
    from {
      transform: scale(1.7);
      opacity: 0;
    }
  }
  .area {
    cursor: pointer;
    outline: none;
  }
  .area:hover .area-shape,
  .area:focus-visible .area-shape {
    fill: var(--brand-soft);
    stroke: var(--brand);
  }
  .marker.hot text {
    stroke: var(--brand-soft);
  }
  .area:focus-visible .area-shape {
    stroke-width: 2.4px;
  }
  /* 스탬프를 찍은 시군구 */
  .area.on .area-shape {
    fill: var(--brand);
    stroke: var(--brand-deep);
  }
  .marker.on text {
    fill: #fff;
    stroke: var(--brand);
  }
  .marker.on.hot text {
    stroke: var(--brand-deep);
  }

  /* 지금 열어 둔 시군구는 지도에서도 테두리로 표시해요 */
  .area.picked .area-shape {
    stroke: var(--brand-deep);
    stroke-width: 2.6px;
  }
  /* 고른 시군구가 이웃 도형에 가려지지 않게 하는 일은 마크업 쪽 mapOrder 가 맡습니다. */

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
  .progress-card.complete {
    background: linear-gradient(140deg, var(--brand-deep) 0%, #6f3f28 100%);
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
    word-break: keep-all;
  }

  .district-card {
    padding: 20px 20px 22px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    min-height: 300px;
  }
  .district-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
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
  /* 이 화면의 주 버튼 — 스탬프 찍기 */
  .stamp-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 58px;
    margin-bottom: 12px;
    padding: 12px 16px;
    border: 0;
    border-radius: 16px;
    background: var(--brand);
    color: #fff;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.3px;
    cursor: pointer;
    box-shadow: 0 6px 16px #b5704e3d;
    transition:
      background 0.16s,
      transform 0.16s,
      box-shadow 0.16s;
  }
  .stamp-button:hover {
    background: var(--brand-deep);
    box-shadow: 0 8px 20px #b5704e52;
  }
  .stamp-button:active {
    transform: translateY(1px) scale(0.99);
  }
  .district-seal {
    display: grid;
    place-items: center;
    padding: 6px 0 14px;
  }
  .district-date {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    font-size: 13.5px;
    color: var(--muted);
  }
  .district-date input {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 7px 10px;
    font: inherit;
    font-size: 13px;
    color: var(--ink);
    background: #fff;
  }
  .district-explore {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--ivory);
    color: var(--brown-warm);
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .district-explore:hover {
    border-color: var(--brand);
    color: var(--brand);
  }
  .district-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--muted);
  }
  .district-undo {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    padding: 4px 0;
    border: 0;
    background: none;
    color: #bcaa9e;
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }
  .district-undo:hover {
    color: var(--brand);
    text-decoration: underline;
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
  .legacy-note {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--brand-tint);
    color: var(--brown-warm);
    font-size: 13px;
    line-height: 1.55;
  }
  .storage-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }

  /* ---------- 도장 (오른쪽 카드와 스탬프북이 함께 씁니다) ---------- */
  .seal {
    --seal-size: 108px;
    position: relative;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 2px;
    width: var(--seal-size);
    height: var(--seal-size);
    border: 3px solid var(--brand);
    border-radius: 50%;
    color: var(--brand);
    text-align: center;
    transform: rotate(-9deg);
    /* 잉크가 고르게 묻지 않은 것처럼 살짝 흐리게 */
    opacity: 0.94;
    background: radial-gradient(circle at 50% 50%, #ffffff00 58%, #b5704e12 100%);
  }
  /* 바깥 링 안쪽에 점선 링 하나 더 — 관광지 도장 느낌 */
  .seal::before {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1.5px dashed var(--brand);
    border-radius: 50%;
    opacity: 0.7;
  }
  .seal strong {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.15;
  }
  .seal small {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
  }
  .seal.fresh {
    animation: stamp-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes stamp-in {
    from {
      transform: rotate(-9deg) scale(1.6);
      opacity: 0;
    }
    60% {
      transform: rotate(-9deg) scale(0.96);
      opacity: 1;
    }
  }

  /* ---------- 스탬프 기록 ---------- */
  .stamp-book {
    margin-top: 34px;
    padding: 28px 30px 30px;
    border: 1px solid var(--line);
    border-radius: 26px;
    background: #fff;
  }
  .book-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .book-head h2 {
    margin: 10px 0 0;
    font-size: 26px;
    letter-spacing: -1px;
  }
  .book-tools {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .book-count {
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--brand-tint);
    color: var(--brand);
    font-size: 13.5px;
    font-weight: 600;
  }
  .book-count strong {
    font-size: 15px;
    font-weight: 800;
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
  .slots {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 18px 8px 14px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--ivory);
    color: var(--brown-warm);
    font: inherit;
    cursor: pointer;
    transition:
      border-color 0.16s,
      background 0.16s,
      box-shadow 0.16s;
  }
  .slot:hover {
    border-color: var(--brand);
    background: #fff;
  }
  .slot.on {
    background: #fff;
  }
  /* 지금 열어 둔 시군구 */
  .slot.picked {
    border-color: var(--brand);
    box-shadow: 0 0 0 2px #b5704e2e;
  }
  .slot .seal {
    --seal-size: 96px;
  }
  /* 아직 안 찍은 칸 — 점선 원에 이름만 */
  .slot-empty {
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    border: 2px dashed #d9c2ad;
    border-radius: 50%;
    background: #fff;
  }
  .slot-name {
    font-size: 14px;
    font-weight: 600;
    color: #bcaa9e;
    letter-spacing: -0.3px;
  }
  .slot:hover .slot-empty {
    border-color: var(--brand);
  }
  .slot:hover .slot-name {
    color: var(--brand);
  }
  .slot-caption {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .slot.on .slot-caption {
    color: var(--brand);
    font-weight: 600;
  }
  .book-note {
    margin: 22px 0 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--muted);
  }
  .book-note a {
    color: var(--brand);
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .seal.fresh,
    .seal-mark {
      animation: none;
    }
  }
  @media (max-width: 1240px) {
    .slots {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  /* 두 칸이 안 들어가면 지도 아래로 진행상황·시군구 카드를 내립니다. */
  @media (max-width: 1080px) {
    .stamp-layout {
      grid-template-columns: 1fr;
    }
    .gangwon {
      max-width: 560px;
    }
  }
  @media (max-width: 760px) {
    .page {
      width: calc(100% - 32px);
    }
    .slots {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .stamp-book {
      padding: 22px 18px 24px;
    }
  }
</style>
