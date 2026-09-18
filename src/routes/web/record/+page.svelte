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
  import { GANGWON_VIEWBOX, gangwonDistricts, type GangwonDistrict } from '$lib/domain/gangwonMap';
  import { koreaRegions } from '$lib/domain/koreaRegions';
  import { koreaDistricts } from '$lib/domain/koreaDistricts';
  import { regionCatalog } from '$lib/domain/region';
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
   * 강원 18개 시군구 지도. 경계도 시군구 목록도 swcho/korea-maps(MIT, 통계청 SGIS) 에서 가져왔어요.
   * ($lib/domain/gangwonMap.ts · $lib/domain/koreaDistricts.ts)
   *
   * 다루는 지역을 강원으로 좁히면서 이 지도도 강원만 크게 보여 줍니다.
   * 강원 밖에 찍어 둔 예전 기록은 지우지 않고 그대로 둡니다 — 나중에 지역을 넓히면 다시 살아나야 하고,
   * 화면이 좁아졌다고 남의 기록을 버릴 이유는 없으니까요. 대신 이 화면의 숫자에서는 빼고 셉니다.
   */
  const districts = gangwonDistricts;
  const gangwonCodes = new Set(districts.map((district) => district.code));
  // 저장된 기록을 거를 때만은 전국 코드로 봅니다. 강원 밖 기록을 읽다가 버리지 않으려고요.
  const validCodes = new Set(Object.values(koreaDistricts).flat().map((d) => d.code));
  const validIds = new Set(koreaRegions.map((province) => province.id));

  // 예전에는 시도 단위로만 기록했어요. 그때 칠한 기록을 잃지 않으려고 키를 따로 둡니다.
  const PROVINCE_KEY = 'dangverywhere-visited-provinces';
  const DISTRICT_KEY = 'dangverywhere-visited-districts';

  let visits = $state<Visit[]>([]);
  /** 예전 시도 단위 기록 중 아직 세부 지역을 안 고른 것 */
  let coarseProvinces = $state<string[]>([]);
  let selectedCode = $state<string | null>(null);
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

  const visitedCodes = $derived(new Set(visits.map((visit) => visit.code)));
  /** 지도에 칠할지 여부 — 그 시군구 기록이 있거나, 예전 '강원' 통째 기록이 남아 있으면 칠합니다. */
  const isOn = (code: string) => visitedCodes.has(code) || coarseProvinces.includes('gangwon');

  function select(district: GangwonDistrict) {
    selectedCode = selectedCode === district.code ? null : district.code;
  }

  function toggleDistrict(code: string) {
    const on = visitedCodes.has(code);
    persist(
      on
        ? visits.filter((visit) => visit.code !== code)
        : [...visits, { code, date: today(), dog: dogName }],
      // 시군구를 하나라도 고르는 순간 예전의 '강원 전체' 표시는 역할이 끝나요.
      on ? coarseProvinces : coarseProvinces.filter((id) => id !== 'gangwon')
    );
  }

  /** 강원 18곳 한 번에. 다른 시도에 찍어 둔 예전 기록은 건드리지 않습니다. */
  function toggleWholeProvince() {
    const codes = districts.map((district) => district.code);
    const allOn = codes.every((code) => visitedCodes.has(code));
    const day = today();
    persist(
      allOn
        ? visits.filter((visit) => !gangwonCodes.has(visit.code))
        : [
            ...visits,
            ...codes
              .filter((code) => !visitedCodes.has(code))
              .map((code) => ({ code, date: day, dog: dogName }))
          ],
      coarseProvinces.filter((id) => id !== 'gangwon')
    );
    store.notify(
      allOn ? '강원 기록을 모두 지웠어요.' : '강원 18개 시군구를 모두 다녀온 곳으로 표시했어요.'
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

  /** 이 화면이 보여 준 것만 지웁니다. 화면 밖(강원 밖) 기록까지 말없이 지우지 않아요. */
  function resetAll() {
    persist(
      visits.filter((visit) => !gangwonCodes.has(visit.code)),
      coarseProvinces.filter((id) => id !== 'gangwon')
    );
    store.notify('강원 지도 기록을 지웠어요.');
  }

  const selected = $derived(districts.find((district) => district.code === selectedCode) ?? null);
  /** 이 화면이 세는 것은 강원 안의 기록입니다. */
  const filled = $derived(visits.filter((visit) => gangwonCodes.has(visit.code)).length);
  const percent = $derived(Math.round((filled / districts.length) * 100));
  const hoveredName = $derived(districts.find((d) => d.code === hovered)?.name ?? null);
  /** 강원 밖에 남아 있는 예전 기록. 지우지 않았다는 것만 알려 줍니다. */
  const outside = $derived(visits.filter((visit) => !gangwonCodes.has(visit.code)).length);
  const dateOf = (code: string) => visits.find((visit) => visit.code === code)?.date ?? '';
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

  /**
   * 코드 → 시도·시군구 이름 (타임라인 문장을 만들 때 씁니다).
   * 강원 밖 예전 기록도 이름이 제대로 나오도록 전국 목록을 그대로 씁니다.
   */
  const placeNames = new globalThis.Map<string, { province: string; district: string }>();
  for (const province of koreaRegions)
    for (const district of koreaDistricts[province.id] ?? [])
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
        {dogName || '강아지'}{josa(dogName || '강아지', '와/과')} 다녀온 곳을 기록해 보세요. 강원
        {districts.length}개 시군구를 지도에서 바로 눌러, 어느 동네까지 가 봤는지 체크할 수 있어요.
      </p>
    </header>

    <div class="record-layout">
      <!-- 왼쪽: 강원 지도 -->
      <section class="map-card">
        <div class="map-top">
          <strong>강원 {districts.length}개 시군구</strong>
          <span
            >{hoveredName ? `${hoveredName} — 눌러서 기록` : '시군구를 눌러 다녀온 곳을 체크해요'}</span
          >
        </div>

        <svg
          class="gangwon"
          viewBox={GANGWON_VIEWBOX}
          role="img"
          aria-label={`강원 ${districts.length}개 시군구 방문 기록 지도`}
        >
          <!--
            도형을 먼저 다 그리고, 핀과 이름은 그 위에 한 겹 더 올립니다.
            SVG 에는 z-index 가 없어 나중에 그린 것이 위로 오는데, 한 묶음으로 그리면
            이웃 시군구의 도형이 앞서 그린 이름을 덮어 버려요(속초·동해처럼 작은 곳이 그랬습니다).
          -->
          {#each mapOrder as district (district.code)}
            {@const on = isOn(district.code)}
            <g
              class="area"
              class:on
              class:picked={selectedCode === district.code}
              role="button"
              tabindex="0"
              aria-pressed={on}
              aria-label={`${district.name} ${on ? '다녀옴' : '아직'}`}
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
            {@const on = isOn(district.code)}
            <g
              class="marker"
              class:on
              class:hot={hovered === district.code || selectedCode === district.code}
              aria-hidden="true"
            >
              <!-- 핀 끝이 pinX·pinY 에 닿도록 그려요 (그 점이 도형 안쪽에서 가장 여유로운 자리) -->
              <g transform={`translate(${district.pinX} ${district.pinY})`}>
                <path
                  class="pin-body"
                  d="M0,0 C-3.8,-6.5 -9.6,-11.3 -9.6,-16.3 A9.6,9.6 0 1 1 9.6,-16.3 C9.6,-11.3 3.8,-6.5 0,0 Z"
                />
                <circle class="pin-hole" cx="0" cy="-16.3" r="3.6" />
              </g>
              <text x={district.pinX} y={district.pinY + 15}>{district.name}</text>
            </g>
          {/each}
        </svg>
      </section>

      <!-- 가운데: 고른 시군구 -->
      <section class="district-card" aria-live="polite">
        {#if selected}
          {@const on = visitedCodes.has(selected.code)}
          {@const day = dateOf(selected.code)}
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
                >{on
                  ? day
                    ? `${prettyDate(day)} 방문`
                    : '다녀온 곳'
                  : '아직 발자국이 없어요'}</span
              >
            </div>
          </div>

          {#if coarseProvinces.includes('gangwon')}
            <p class="district-legacy">
              예전에 '강원'을 통째로 기록해 둔 게 남아 있어요. 다녀온 시군구를 고르면 이 표시는 사라져요.
            </p>
          {/if}

          <button class="district-all" onclick={() => toggleDistrict(selected.code)}>
            {on ? '다녀온 곳에서 빼기' : '다녀온 곳으로 표시'}
          </button>

          {#if on}
            <label class="district-date">
              <span>다녀온 날</span>
              <input
                type="date"
                value={day}
                max={today()}
                onchange={(event) => setDate(selected.code, event.currentTarget.value)}
              />
            </label>
          {/if}

          <!-- 장소 데이터를 갖고 있는 시군구에서만 탐색으로 건너뜁니다. 없는 링크를 만들지 않아요. -->
          {#if region}
            <a class="district-explore" href={`/web/explore?region=${region.id}`}>
              <Map size={16} />{selected.name}에서 갈 곳 보기
            </a>
          {:else}
            <p class="district-note">
              이 시군구의 장소 데이터는 아직 준비 중이에요. 기록은 지금도 남길 수 있어요.
            </p>
          {/if}
        {:else}
          <div class="district-empty">
            <MapPinned size={30} />
            <strong>시군구를 골라 주세요</strong>
            <p>지도나 아래 목록에서 시군구를 누르면, 다녀온 날짜와 갈 곳을 여기서 볼 수 있어요.</p>
          </div>
        {/if}
      </section>

      <!-- 오른쪽: 진행 상황 + 지역 목록 -->
      <div class="side">
        <section class="progress-card">
          <span class="progress-label">다녀온 강원 시군구</span>
          <strong class="progress-count">{filled}<small> / {districts.length}</small></strong>
          <div class="progress-bar"><span style={`width:${percent}%`}></span></div>
          <p class="progress-note">
            {#if filled === 0 && !coarseProvinces.includes('gangwon')}
              아직 기록이 없어요. 다녀온 시군구부터 눌러 보세요.
            {:else if filled === districts.length}
              강원 {districts.length}개 시군구를 모두 채웠어요! 대단해요 🐾
            {:else}
              강원의 {percent}% 를 함께 다녀왔어요.
            {/if}
          </p>
        </section>

        <section class="list-card">
          <div class="list-head">
            <h2>시군구 목록</h2>
            {#if filled || coarseProvinces.includes('gangwon')}
              <button class="reset" onclick={resetAll}><RotateCcw size={15} />모두 지우기</button>
            {/if}
          </div>
          <button class="district-all" onclick={toggleWholeProvince}>
            {filled === districts.length ? '강원 전체 해제' : '강원 전체 선택'}
          </button>
          <ul>
            {#each districts as district (district.code)}
              {@const on = isOn(district.code)}
              <li>
                <button
                  class="region"
                  class:on
                  class:picked={selectedCode === district.code}
                  aria-pressed={selectedCode === district.code}
                  onclick={() => select(district)}
                  onmouseenter={() => (hovered = district.code)}
                  onmouseleave={() => (hovered = null)}
                >
                  <span class="dot">{#if on}<Check size={13} strokeWidth={3.2} />{/if}</span>
                  {district.name}
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <p class="storage-note">
          지금은 이 브라우저에만 저장돼요. 다른 기기에서도 보이게 하려면 계정 저장이 필요해요.
          <!-- 지역을 강원으로 좁히기 전에 찍어 둔 기록은 지우지 않고 그대로 두었습니다. -->
          {#if outside}<br />강원 밖에 찍어 둔 예전 기록 {outside}곳은 지우지 않고 아래 타임라인에
            남겨 두었어요.{/if}
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
  .gangwon {
    display: block;
    width: 100%;
    max-width: 560px;
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
  /* 핀·이름표 한 겹. 도형 위에 떠 있을 뿐이라 마우스는 그대로 도형이 받습니다. */
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
  /* 핀 — 아직 안 가 본 곳은 비워 두고, 다녀온 곳만 브랜드색으로 채웁니다 */
  .pin-body {
    fill: #fff;
    stroke: var(--brand);
    stroke-width: 2.2px;
    transition:
      fill 0.2s ease,
      stroke 0.2s ease;
  }
  .pin-hole {
    fill: var(--brand);
    transition: fill 0.2s ease;
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
  /* 다녀온 시군구 */
  .area.on .area-shape {
    fill: var(--brand);
    stroke: var(--brand-deep);
  }
  .marker.on text {
    fill: #fff;
    stroke: var(--brand);
  }
  .marker.on .pin-body {
    fill: var(--brand-deep);
    stroke: #fff;
  }
  .marker.on .pin-hole {
    fill: #fff;
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
    border-radius: 12px;
    background: var(--brand);
    color: #fff;
    font-size: 13.5px;
    text-decoration: none;
  }
  .district-explore:hover {
    background: var(--brand-deep);
  }
  .district-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--muted);
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
  /* 지금 열어 둔 시군구 */
  .region.picked {
    border-color: var(--brand);
    box-shadow: 0 0 0 2px #b5704e2e;
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
