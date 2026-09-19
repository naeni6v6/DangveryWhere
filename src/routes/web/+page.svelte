<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import {
    Sparkles,
    PawPrint,
    Map,
    Heart,
    ArrowRight,
    ArrowUpRight,
    MapPin,
    LogIn,
    LogOut,
    Smartphone
  } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import placeImages from '$lib/data/placeImages.json';
  import { providerInfo } from '$lib/domain/region';
  import { placeArea, placeTheme, themeNames, type Place, type Theme } from '$lib/domain/place';
  import { getWebStore } from '$lib/web/store.svelte';
  import { AFTER_TUTORIAL_PATH, TUTORIAL_PATH, isTutorialDone } from '$lib/web/onboarding';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();

  // [시작하기]: 처음 온 브라우저는 튜토리얼로, 이미 마쳤으면 바로 지도로.
  // 완료 여부는 브라우저에만 있어서 서버 렌더 때는 튜토리얼 주소로 두고, 마운트 뒤에 바꿉니다.
  let startHref = $state(TUTORIAL_PATH);
  onMount(() => {
    if (isTutorialDone()) startHref = AFTER_TUTORIAL_PATH;
  });

  // 동물병원은 '동반 장소'가 아니라 진료 시설이라, 소개 문구의 수에서 뺍니다.
  const companionPlaces = $derived(data.places.filter((place) => place.category !== 'hospital'));
  const companionCount = $derived(companionPlaces.length);
  const weightCount = $derived(companionPlaces.filter((place) => place.sourceWeight !== null).length);
  const hospitalCount = $derived(data.places.length - companionCount);
  // 지역명과 출처를 문구에 박아 두지 않고 지금 고른 지역에서 끌어옵니다.
  const region = $derived(data.regions.find((item) => item.id === data.regionId) ?? data.regions[0]);
  const area = $derived(region.label);
  const sources = $derived(region.sources.map((id) => providerInfo[id]));
  const collectedAt = $derived(
    data.places
      .map((place) => place.importedAt)
      .sort()
      .at(-1)
      ?.slice(0, 7)
      .replace('-', '.') ?? ''
  );

  /**
   * 메인 상단 산책 영상 (static/media/walk-2026-09-18.mp4 · 1280x720 · 8초).
   *
   * 영상을 바꿀 때는 **반드시 파일 이름도 같이 바꾸세요**(날짜를 붙이면 편해요).
   * 서비스 워커가 static/ 파일을 경로 단위로 캐시해서, 같은 이름으로 덮어쓰면 이미 방문한
   * 브라우저는 예전 영상을 계속 틀어 줍니다. ?v=2 같은 쿼리로는 비켜 갈 수 없어요.
   *
   * 영상 비율이 16:9 가 아니면 아래 .film 의 aspect-ratio 도 같이 맞춰 주세요.
   * null 이면 검은 화면으로 비워 둡니다.
   */
  const walkVideo: string | null = '/media/walk-2026-09-18.mp4';
  const walkPoster: string | null = null;
  const isGif = $derived(Boolean(walkVideo && /\.gif$/i.test(walkVideo)));

  /** 가게 사진 (static/places, 장소 id → 경로 목록). 상세 화면과 같은 자료를 씁니다. */
  const photosOf = (id: string) => (placeImages as Record<string, string[]>)[id] ?? [];

  /**
   * 사진 띠 — 사진이 있는 동반 장소를 분류별로 돌아가며 뽑습니다.
   * 카페만 줄줄이 이어지지 않게 하려는 것이고, 열네 장이면 한 화면을 넉넉히 채워요.
   */
  const strip = $derived.by(() => {
    // 위에서 lucide 의 Map 아이콘을 들여와서, 자료구조 Map 은 globalThis 로 구분해 부릅니다.
    const queues = new globalThis.Map<Theme, Place[]>();
    for (const place of companionPlaces) {
      if (!photosOf(place.id).length) continue;
      const theme = placeTheme(place);
      if (!queues.has(theme)) queues.set(theme, []);
      queues.get(theme)!.push(place);
    }
    const rounds = [...queues.values()];
    const picked: Place[] = [];
    for (let i = 0; picked.length < 14 && rounds.some((queue) => queue.length); i++) {
      const next = rounds[i % rounds.length].shift();
      if (next) picked.push(next);
    }
    return picked;
  });

  const allCategoryCards = [
    { id: 'cafe', copy: '테라스만? 실내도? 매장마다 다른 규정을 미리' },
    { id: 'restaurant', copy: '밥 먹는 동안 같이 있을 수 있는 곳인지 먼저' },
    { id: 'stay', copy: '체중·마릿수 제한과 추가 요금을 떠나기 전에' },
    { id: 'outdoor', copy: '목줄 규정과 출입 가능한 구역을 한눈에' },
    { id: 'activity', copy: '반려견과 함께 즐길 수 있는 체험 프로그램' },
    { id: 'culture', copy: '박물관·미술관에 함께 들어갈 수 있는지부터' },
    { id: 'shopping', copy: '같이 들어가 장을 볼 수 있는 매장인지 미리' }
  ] as const;
  const count = (theme: Theme) =>
    data.places.filter((place) => placeTheme(place) === theme).length;
  // 그 지역에 한 곳도 없는 분류는 빼서, 0곳짜리 타일이 서 있지 않게 합니다.
  const categoryCards = $derived(allCategoryCards.filter((item) => count(item.id) > 0));
  /** 분류 타일의 바탕 사진 — 그 분류에서 사진이 있는 첫 장소. 없으면 갈색 바탕에 아이콘만. */
  const coverOf = (theme: Theme) => {
    const place = data.places.find(
      (item) => placeTheme(item) === theme && photosOf(item.id).length
    );
    return place ? photosOf(place.id)[0] : null;
  };

  /**
   * 스크롤해서 화면에 들어오면 아래에서 위로 떠오르게 합니다.
   * 한 번 나타난 요소는 다시 숨기지 않습니다.
   */
  function reveal(node: HTMLElement) {
    // 움직임을 줄이도록 설정한 사용자, 또는 지원하지 않는 브라우저에서는 그냥 그대로 보여 줍니다.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    node.classList.add('reveal');
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      node.classList.add('is-in');
      observer.disconnect();
      clearTimeout(fallback);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) show();
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(node);
    // 감지가 어떤 이유로든 동작하지 않아도 내용이 계속 숨겨지지 않도록 하는 안전장치.
    const fallback = setTimeout(show, 2500);

    return {
      destroy: () => {
        observer.disconnect();
        clearTimeout(fallback);
      }
    };
  }
</script>

<svelte:head>
  <title>댕브리웨어 — 강아지와 함께, 헛걸음 없이</title>
  <meta
    name="description"
    content="강아지와 함께 갈 수 있는 카페, 식당, 숙소, 관광지. 체중 제한부터 실내외 동반 규정까지, 떠나기 전에 확인하세요."
  />
</svelte:head>

<div class="landing">
  <!-- 상단 내비게이션. 지역 선택은 지도 화면 헤더에만 두고, 메인에서는 뺐습니다. -->
  <header class="landing-nav">
    <a class="nav-brand" href="/web">
      <img class="nav-logo" src="/logo.png" alt="" width="42" height="42" />
      <!-- 헤더와 같은 글자 로고 1번 시안 -->
      <img class="nav-wordmark" src="/wordmark.png" alt="댕브리웨어" width="393" height="138" />
    </a>
    <nav class="nav-links" aria-label="주 메뉴">
      <a href="/web/explore"><Map size={17} />가게 찾기</a>
      <a href="/web/favorites"><Heart size={17} />찜한 장소</a>
      <a href="/web/dog"><PawPrint size={17} />우리 강아지</a>
    </nav>
    <div class="nav-right">
      {#if dev}
        <!-- 개발용: 튜토리얼 화면 확인 링크. 배포 전 삭제 -->
        <a class="nav-mobile dev-link" href="/web/start?replay"
          ><Sparkles size={16} />튜토리얼 페이지 보기</a
        >
      {/if}
      <a class="nav-mobile" href="/"><Smartphone size={16} />모바일 버전</a>
      {#if store.loggedIn}
        <button class="nav-account" onclick={() => store.logout()}><LogOut size={16} />로그아웃</button>
      {:else}
        <button class="nav-account" onclick={() => store.requestLogin()}
          ><LogIn size={16} />로그인</button
        >
      {/if}
    </div>
  </header>

  <!-- 산책 영상: 좌우 여백 없이 화면 끝까지. walkVideo 가 없으면 검은 화면으로 비워 둡니다. -->
  <section class="film" aria-label="반려견과 산책하는 영상">
    {#if walkVideo && isGif}
      <img class="film-media" src={walkVideo} alt="반려견과 주인이 산책하는 모습" />
    {:else if walkVideo}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        class="film-media"
        src={walkVideo}
        poster={walkPoster ?? undefined}
        autoplay
        muted
        loop
        playsinline
        preload="auto"
        oncanplay={(event) => {
          // autoplay 속성만으로는 재생이 안 되는 경우가 있어 한 번 더 확실히 시작시킵니다.
          const el = event.currentTarget as HTMLVideoElement;
          if (el.paused) el.play().catch(() => {});
        }}
      ></video>
    {/if}
  </section>

  <main class="stage">
    <!-- 서비스 소개 -->
    <section class="intro" use:reveal>
      <span class="intro-eyebrow"><MapPin size={15} />{area} 반려견 동반 여행</span>
      <h1>강아지와 함께,<br /><em>헛걸음 없이</em></h1>
      <p class="intro-lead">
        “여기 강아지 들어갈 수 있나요?” 매번 전화로 묻지 않아도 되도록,<br />
        {area} 반려견 동반 장소 <strong>{companionCount}곳</strong>의 출입 규정을 한곳에 모았어요.
      </p>

      <div class="cta">
        <a class="cta-button" href={startHref}>시작하기<ArrowRight size={19} /></a>
      </div>
    </section>
  </main>

  <!--
    ================================================================
    [시작하기] 아래.
    카드 격자 대신 실제 가게 사진과 큰 글자로 끌고 갑니다 — 사진 띠 · 짙은 선언부 · 사진 타일 · 마무리.
    ================================================================
  -->

  <!-- 사진 띠: 실제 가게 사진이 천천히 흘러갑니다. 올리면 멈추고, 누르면 그 가게로. -->
  {#if strip.length}
    <section class="strip" aria-label="사진으로 보는 동반 장소">
      <div class="strip-head" use:reveal>
        <div>
          <span class="eyebrow">REAL PLACES · {area}</span>
          <h2>사진으로 먼저 둘러보는 <em>{companionCount}곳</em></h2>
        </div>
        <a class="text-link" href="/web/explore">지도에서 전체 보기<ArrowRight size={17} /></a>
      </div>
      <div class="marquee-clip">
        <!-- 같은 목록을 두 번 이어 붙여 끝없이 흐르게 합니다. 두 번째 묶음은 보조기기에서 숨겨요. -->
        <div class="marquee">
          {#each [0, 1] as copy (copy)}
            <div class="marquee-set" aria-hidden={copy === 1}>
              {#each strip as place (place.id)}
                <a
                  class="shot"
                  href={`/web/explore?place=${place.id}`}
                  tabindex={copy === 1 ? -1 : undefined}
                >
                  <img src={photosOf(place.id)[0]} alt="" loading="lazy" decoding="async" />
                  <span class="shot-tag">{themeNames[placeTheme(place)]}</span>
                  <span class="shot-info">
                    <strong>{place.name}</strong>
                    <span>{placeArea(place).province} {placeArea(place).city}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- 선언부: 짙은 갈색 바탕에 큰 글자. 기능 셋은 카드 대신 번호 붙은 줄로, 숫자는 아래 한 줄로. -->
  <section class="manifesto">
    <div class="manifesto-inner">
      <div class="manifesto-copy" use:reveal>
        <span class="eyebrow gold">WHY DANGVERYWHERE</span>
        <h2>출입 조건,<br />도착해서<br />확인하지 마세요.</h2>
        <p>
          모호한 반려동물 동반 규정 때문에 생기는 입장 거부와 헛걸음을 줄이는 것이 댕브리웨어의
          목표예요.
        </p>
      </div>
      <ol class="reasons" use:reveal>
        <li>
          <span class="reason-num">01</span>
          <div>
            <h3>우리 강아지 조건으로 비교</h3>
            <p>체급과 몸무게를 등록하면 원본 규정의 체중·체급 제한과 맞지 않는 곳을 알려드려요.</p>
          </div>
        </li>
        <li>
          <span class="reason-num">02</span>
          <div>
            <h3>동반 규정을 한눈에</h3>
            <p>실내·야외 허용 구역, 목줄, 배변 매너 같은 조건을 항목별로 나눠 보여드려요.</p>
          </div>
        </li>
        <li>
          <span class="reason-num">03</span>
          <div>
            <h3>출처가 분명한 공공데이터</h3>
            <p>
              {sources.map((source) => source.shortName).join(' · ')} 자료를 쓰고, 수집일과 원문
              링크를 함께 표시해요.
            </p>
          </div>
        </li>
      </ol>
      <dl class="figures" use:reveal>
        <div><dt>반려견 동반 장소</dt><dd>{companionCount}<small>곳</small></dd></div>
        <div><dt>체중 제한이 기재된 곳</dt><dd>{weightCount}<small>곳</small></dd></div>
        <!-- 동물병원은 강원 원본에만 있어서, 없는 지역에서는 0곳 칸을 세우지 않습니다. -->
        {#if hospitalCount}
          <div><dt>동물병원</dt><dd>{hospitalCount}<small>곳</small></dd></div>
        {:else}
          <div><dt>장소 분류</dt><dd>{categoryCards.length}<small>가지</small></dd></div>
        {/if}
        <div><dt>공공데이터 수집 시점</dt><dd class="date">{collectedAt}</dd></div>
      </dl>
    </div>
  </section>

  <!-- 분류: 흰 카드 대신 그 분류의 실제 가게 사진을 깐 세로 타일 -->
  <section class="explore">
    <div class="explore-inner">
      <div class="explore-head" use:reveal>
        <div>
          <span class="eyebrow">EXPLORE BY TYPE</span>
          <h2>어디로 함께 갈까요?</h2>
        </div>
        <p>분류를 고르면 그 종류의 장소만 지도에 남겨요.</p>
      </div>
      <div class="tiles">
        {#each categoryCards as item (item.id)}
          {@const cover = coverOf(item.id)}
          <a class="tile" class:plain={!cover} href={`/web/explore?category=${item.id}`} use:reveal>
            {#if cover}
              <img src={cover} alt="" loading="lazy" decoding="async" />
            {/if}
            <span class="tile-icon"><ThemeIcon theme={item.id} size={22} strokeWidth={1.8} /></span>
            <span class="tile-body">
              <strong>{themeNames[item.id]}</strong>
              <span class="tile-count">{count(item.id)}곳</span>
              <span class="tile-copy">{item.copy}</span>
            </span>
          </a>
        {/each}
      </div>
    </div>
  </section>

  <!-- 마무리: 댕브리가 손을 흔들며 배웅합니다 -->
  <section class="closing">
    <div class="closing-inner" use:reveal>
      <div class="closing-copy">
        <span class="eyebrow">THIS WEEKEND</span>
        <h2>이번 주말,<br />강아지와 어디 가 볼까요?</h2>
        <p>지도를 열고 함께 갈 수 있는 곳부터 찾아보세요.</p>
        <div class="closing-actions">
          <a class="closing-primary" href="/web/explore">지도에서 찾기<ArrowRight size={19} /></a>
          <a class="closing-secondary" href="/web/dog">우리 강아지 등록</a>
        </div>
      </div>
      <div class="closing-figure" aria-hidden="true">
        <!-- 흰 배경 이미지라 multiply 로 바탕에 녹입니다 (static/mascot/안내.txt) -->
        <img src="/mascot/dangbri-hello.webp" alt="" width="760" height="760" loading="lazy" />
      </div>
    </div>
  </section>

  <footer class="landing-footer">
    <div>
      <strong>댕브리웨어 DangveryWhere</strong>
      <p>2026 관광데이터 활용 공모전 · 웹·앱 구현 부문</p>
    </div>
    <div class="footer-links">
      {#each sources as source (source.url)}
        <a href={source.url} target="_blank" rel="noreferrer"
          >데이터 출처: {source.shortName}<ArrowUpRight size={14} /></a
        >
      {/each}
      <span>규정은 현지 사정에 따라 바뀔 수 있어요. 방문 전 시설에 확인해 주세요.</span>
    </div>
  </footer>
</div>

<style>
  .landing {
    min-height: calc(100dvh / var(--ui-zoom, 1));
    background:
      radial-gradient(1100px 520px at 76% -18%, #fff 0%, transparent 60%),
      radial-gradient(760px 420px at 6% 112%, var(--brand-tint) 0%, transparent 58%),
      linear-gradient(180deg, #fffdfa 0%, var(--ivory) 46%, #f8efe3 100%);
    color: var(--ink);
  }

  /* ---------- 상단 내비게이션 + 가로줄 ---------- */
  .landing-nav {
    display: flex;
    align-items: center;
    gap: 26px;
    padding: 18px clamp(22px, 4vw, 56px);
    border-bottom: 1px solid #e7d8c9;
    background: #fffdfbd9;
    backdrop-filter: saturate(180%) blur(18px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
  }
  .nav-logo {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    transform: rotate(-8deg);
    filter: drop-shadow(0 6px 10px #b5704e40);
  }
  /* 헤더(+layout.svelte)의 글자 로고와 같은 크기로 맞춰 둡니다. */
  .nav-wordmark {
    flex-shrink: 0;
    height: 46px;
    width: auto;
  }
  .nav-links {
    display: flex;
    gap: 4px;
    margin-left: 12px;
  }
  .nav-links a {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 15px;
    border-radius: 12px;
    font-size: 15px;
    color: var(--brown-warm);
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.16s, color 0.16s;
  }
  .nav-links a:hover {
    background: #fff;
    color: var(--brand);
  }
  .nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nav-mobile,
  .nav-account {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 16px;
    border: 0;
    border-radius: 12px;
    background: none;
    font-size: 14.5px;
    color: var(--muted);
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.16s, color 0.16s;
  }
  .nav-mobile:hover,
  .nav-account:hover {
    background: #fff;
    color: var(--brand);
  }
  /* 개발용 링크 — 눈에 띄게 점선 테두리. 배포 전 삭제 */
  .dev-link {
    border: 1px dashed var(--brand);
    color: var(--brand);
  }

  /* ---------- 본문 ---------- */
  .stage {
    position: relative;
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    /* 영상 아래쪽 흐려진 구간까지 문구를 끌어올려 자연스럽게 이어 붙입니다. */
    margin: clamp(-96px, -5vw, -34px) auto 0;
    padding: 0 0 clamp(60px, 9vh, 110px);
  }

  /* ----------------------------------------------------------------
     산책 영상 — 화면 좌우 끝까지, 영상 원본 비율(1280x720 = 16:9)에 맞춤.
     아래쪽은 마스크로 서서히 사라지게 해서 배경 그라데이션과 이어집니다.
     (배경색을 덧칠하는 대신 영상 자체를 투명하게 지우므로,
      배경이 어떤 색이든 경계선 없이 자연스럽게 이어집니다.)
  ---------------------------------------------------------------- */
  .film {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: calc(78vh / var(--ui-zoom, 1));
    overflow: hidden;
    -webkit-mask-image: linear-gradient(
      to bottom,
      #000 0%,
      #000 38%,
      #000000cc 58%,
      #00000080 72%,
      #00000033 86%,
      transparent 97%
    );
    mask-image: linear-gradient(
      to bottom,
      #000 0%,
      #000 38%,
      #000000cc 58%,
      #00000080 72%,
      #00000033 86%,
      transparent 97%
    );
  }
  .film-media {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* ---------- 소개 ---------- */
  .intro {
    margin-top: 0;
    text-align: center;
  }
  .intro-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 17px;
    border-radius: 999px;
    background: #fffffff2;
    border: 1px solid #efe0d2;
    color: var(--brand);
    font-size: 13.5px;
    font-weight: 600;
    box-shadow: 0 3px 10px #4a34280f;
  }
  .intro h1 {
    margin: 22px 0 0;
    font-size: clamp(38px, 5.6vw, 68px);
    line-height: 1.12;
    letter-spacing: -2.6px;
    font-weight: 800;
  }
  .intro h1 em {
    font-style: normal;
    background: linear-gradient(120deg, #c8825c 0%, var(--brand) 42%, var(--brand-deep) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .intro-lead {
    margin: 22px auto 0;
    max-width: 620px;
    font-size: clamp(16px, 1.3vw, 18.5px);
    line-height: 1.8;
    color: var(--brown-warm);
  }
  .intro-lead strong {
    color: var(--brand);
    font-weight: 700;
  }

  /* ---------- 시작하기 ---------- */
  .cta {
    margin-top: clamp(40px, 6vh, 64px);
  }
  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 62px;
    padding: 0 40px;
    border-radius: 999px;
    background: linear-gradient(160deg, #c8825c 0%, var(--brand) 48%, var(--brand-deep) 100%);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.4px;
    text-decoration: none;
    box-shadow:
      0 1px 1px #ffffff59 inset,
      0 10px 24px #b5704e4d,
      0 22px 48px #b5704e2e;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  .cta-button:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 1px #ffffff59 inset,
      0 14px 30px #b5704e59,
      0 28px 58px #b5704e38;
  }

  /* ================================================================
     [시작하기] 아래 — 공통 글자 규칙
     그라데이션·둥근 알약·흰 카드 격자를 쓰지 않고, 사진·큰 글자·가는 선으로만 구분합니다.
     ================================================================ */
  .eyebrow {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 2.6px;
    color: var(--brand);
  }
  .eyebrow.gold {
    color: var(--gold);
  }
  .text-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid currentColor;
    color: var(--brand-deep);
    font-size: 15.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.16s;
  }
  .text-link:hover {
    color: var(--brand);
  }

  /* ---------- 사진 띠 ---------- */
  .strip {
    padding: clamp(56px, 8vh, 96px) 0 0;
  }
  .strip-head {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto 30px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }
  .strip-head h2 {
    margin: 12px 0 0;
    font-size: clamp(28px, 3.2vw, 40px);
    letter-spacing: -1.4px;
    line-height: 1.15;
  }
  .strip-head h2 em {
    font-style: normal;
    color: var(--brand);
  }
  .marquee-clip {
    overflow: hidden;
    /* 좌우 끝을 살짝 흐려, 띠가 화면 밖으로 이어지는 느낌만 줍니다. */
    -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
    mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
  }
  .marquee {
    display: flex;
    width: max-content;
    padding: 6px 0 14px;
    animation: marquee 80s linear infinite;
  }
  .marquee-set {
    display: flex;
    gap: 16px;
    padding-right: 16px;
  }
  /* 올리면 멈추고, 그 사이에 원하는 가게를 누를 수 있어요. */
  .strip:hover .marquee,
  .strip:focus-within .marquee {
    animation-play-state: paused;
  }
  @keyframes marquee {
    to {
      transform: translateX(-50%);
    }
  }
  .shot {
    position: relative;
    width: 300px;
    aspect-ratio: 4 / 3;
    flex-shrink: 0;
    border-radius: 12px;
    overflow: hidden;
    background: var(--sand);
    color: #fff;
    text-decoration: none;
    box-shadow: 0 10px 28px #4a342821;
    transition: transform 0.25s ease;
  }
  .shot:hover,
  .shot:focus-visible {
    transform: translateY(-4px);
    outline: none;
  }
  .shot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.6s ease;
  }
  .shot:hover img {
    transform: scale(1.05);
  }
  .shot-tag {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 5px 9px;
    border-radius: 6px;
    background: #fffffff0;
    color: var(--brand-deep);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  /* 글자가 사진 위에서 읽히게 하는 최소한의 어둠. 장식이 아니라 가독성용입니다. */
  .shot-info {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 44px 16px 14px;
    background: linear-gradient(to top, #1f140ecc, transparent);
  }
  .shot-info strong {
    font-size: 17px;
    letter-spacing: -0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .shot-info > span {
    font-size: 12.5px;
    color: #ffffffd0;
  }

  /* ---------- 선언부 ---------- */
  .manifesto {
    margin-top: clamp(56px, 8vh, 96px);
    background: #3a281d;
    color: #fbf3ea;
  }
  .manifesto-inner {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    padding: clamp(72px, 10vh, 120px) 0 clamp(56px, 8vh, 88px);
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    column-gap: clamp(40px, 6vw, 96px);
    row-gap: clamp(56px, 8vh, 88px);
  }
  .manifesto-copy h2 {
    margin: 18px 0 0;
    font-size: clamp(38px, 4.6vw, 62px);
    line-height: 1.06;
    letter-spacing: -2.4px;
    font-weight: 800;
    color: #fff;
  }
  .manifesto-copy p {
    margin: 22px 0 0;
    max-width: 380px;
    font-size: 16.5px;
    line-height: 1.8;
    color: #e6d3c3;
    word-break: keep-all;
  }
  .reasons {
    margin: 0;
    padding: 0;
    list-style: none;
    align-self: center;
  }
  .reasons li {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 14px;
    padding: 26px 0;
    border-top: 1px solid #ffffff24;
  }
  .reasons li:last-child {
    border-bottom: 1px solid #ffffff24;
  }
  .reason-num {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--gold);
    font-variant-numeric: tabular-nums;
    padding-top: 4px;
  }
  .reasons h3 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.7px;
    color: #fff;
  }
  .reasons p {
    margin: 8px 0 0;
    font-size: 15.5px;
    line-height: 1.75;
    color: #d9c4b2;
    word-break: keep-all;
  }
  .figures {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    margin: 0;
    padding-top: 36px;
    border-top: 1px solid #ffffff24;
  }
  .figures dt {
    font-size: 13.5px;
    color: #d9c4b2;
  }
  .figures dd {
    margin: 8px 0 0;
    font-size: clamp(38px, 4vw, 54px);
    font-weight: 800;
    letter-spacing: -2px;
    line-height: 1;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .figures dd small {
    margin-left: 3px;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--gold);
  }
  .figures dd.date {
    font-size: clamp(30px, 3vw, 40px);
    letter-spacing: -1.2px;
  }

  /* ---------- 분류 타일 ---------- */
  .explore {
    padding: clamp(72px, 10vh, 120px) 0;
  }
  .explore-inner {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
  }
  .explore-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 32px;
  }
  .explore-head h2 {
    margin: 12px 0 0;
    font-size: clamp(30px, 3.4vw, 42px);
    letter-spacing: -1.5px;
  }
  .explore-head p {
    margin: 0;
    font-size: 15.5px;
    color: var(--muted);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 14px;
  }
  .tile {
    position: relative;
    display: block;
    aspect-ratio: 3 / 4;
    border-radius: 12px;
    overflow: hidden;
    background: var(--brand-deep);
    color: #fff;
    text-decoration: none;
    box-shadow: 0 10px 28px #4a342821;
    transition: transform 0.25s ease;
  }
  .tile:hover,
  .tile:focus-visible {
    transform: translateY(-5px);
    outline: none;
  }
  .tile img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s ease;
  }
  .tile:hover img {
    transform: scale(1.06);
  }
  /* 사진이 없는 분류: 갈색 바탕에 아이콘을 크게 */
  .tile.plain .tile-icon {
    top: 50%;
    left: 50%;
    width: 68px;
    height: 68px;
    transform: translate(-50%, -80%);
    background: #ffffff1f;
  }
  .tile-icon {
    position: absolute;
    top: 14px;
    left: 14px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #fffffff0;
    color: var(--brand-deep);
  }
  .tile.plain .tile-icon {
    color: #fff;
  }
  /* 아래쪽만 살짝 어둡게 — 사진 위 글자를 읽히게 하는 용도 */
  .tile-body {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 60px 16px 18px;
    background: linear-gradient(to top, #1f140ed6, #1f140e33 70%, transparent);
  }
  .tile-body strong {
    font-size: 23px;
    letter-spacing: -0.7px;
  }
  .tile-count {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--gold);
  }
  .tile-copy {
    margin-top: 6px;
    font-size: 12.5px;
    line-height: 1.55;
    color: #ffffffcc;
    word-break: keep-all;
  }

  /* ---------- 마무리 ---------- */
  .closing {
    border-top: 1px solid var(--line);
    background: #fff;
  }
  .closing-inner {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    align-items: center;
    gap: clamp(24px, 5vw, 72px);
    padding: clamp(40px, 6vh, 72px) 0 0;
  }
  .closing-copy {
    padding-bottom: clamp(40px, 6vh, 72px);
  }
  .closing-copy h2 {
    margin: 14px 0 0;
    font-size: clamp(34px, 4.2vw, 54px);
    line-height: 1.1;
    letter-spacing: -2px;
    font-weight: 800;
  }
  .closing-copy p {
    margin: 18px 0 0;
    font-size: 17px;
    color: var(--muted);
  }
  .closing-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 34px;
  }
  .closing-primary,
  .closing-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 58px;
    padding: 0 28px;
    border-radius: 12px;
    font-size: 16.5px;
    font-weight: 700;
    text-decoration: none;
    transition: background 0.16s, color 0.16s, border-color 0.16s;
  }
  .closing-primary {
    background: #3a281d;
    color: #fff;
  }
  .closing-primary:hover {
    background: var(--brand-deep);
  }
  .closing-secondary {
    border: 1.5px solid var(--line);
    color: var(--brand-deep);
  }
  .closing-secondary:hover {
    border-color: var(--brand);
    color: var(--brand);
  }
  .closing-figure {
    align-self: end;
    display: flex;
    justify-content: center;
  }
  .closing-figure img {
    width: min(100%, 420px);
    height: auto;
    display: block;
    mix-blend-mode: multiply;
    animation: wave 3.6s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  @keyframes wave {
    0%,
    100% {
      transform: rotate(-1.5deg) translateY(0);
    }
    50% {
      transform: rotate(1.5deg) translateY(-6px);
    }
  }

  /* ---------- 푸터 ---------- */
  .landing-footer {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin-inline: auto;
    display: flex;
    justify-content: space-between;
    gap: 30px;
    padding: 40px 0 50px;
    color: var(--muted);
  }
  .landing-footer strong {
    font-size: 17px;
    color: var(--brown-warm);
  }
  .landing-footer p {
    font-size: 14px;
    margin: 8px 0 0;
  }
  .footer-links {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    font-size: 14px;
  }
  .footer-links a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--brand);
    text-decoration: none;
  }

  /* ---------- 스크롤 등장 효과 ----------
     클래스를 스크립트에서 붙이므로 :global 로 둡니다. */
  :global(.reveal) {
    opacity: 0;
    transform: translateY(26px);
    transition:
      opacity 0.72s cubic-bezier(0.22, 0.61, 0.36, 1),
      transform 0.72s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: opacity, transform;
  }
  :global(.reveal.is-in) {
    opacity: 1;
    transform: none;
  }
  /* 타일은 살짝 시차를 둬서 차례로 올라오게 합니다. */
  .tiles > :nth-child(2) {
    transition-delay: 0.07s;
  }
  .tiles > :nth-child(3) {
    transition-delay: 0.14s;
  }
  .tiles > :nth-child(4) {
    transition-delay: 0.21s;
  }
  .tiles > :nth-child(5) {
    transition-delay: 0.28s;
  }
  .tiles > :nth-child(6) {
    transition-delay: 0.35s;
  }
  @media (prefers-reduced-motion: reduce) {
    .marquee {
      animation: none;
    }
    .marquee-clip {
      overflow-x: auto;
      mask-image: none;
      -webkit-mask-image: none;
    }
    .closing-figure img {
      animation: none;
    }
  }

  /* ---------- 좁은 화면 ---------- */
  @media (max-width: 1100px) {
    .manifesto-inner {
      grid-template-columns: 1fr;
    }
    .manifesto-copy p {
      max-width: 560px;
    }
    .tiles {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 980px) {
    .nav-links {
      display: none;
    }
    .closing-inner {
      grid-template-columns: 1fr;
    }
    .closing-figure img {
      width: min(100%, 320px);
    }
  }
  @media (max-width: 760px) {
    .strip-head,
    .explore-head {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    .figures {
      grid-template-columns: 1fr 1fr;
    }
    .tiles {
      grid-template-columns: repeat(2, 1fr);
    }
    .shot {
      width: 240px;
    }
    .landing-footer {
      flex-direction: column;
    }
    .footer-links {
      align-items: flex-start;
    }
  }
  @media (max-width: 720px) {
    .nav-mobile {
      display: none;
    }
  }
</style>
