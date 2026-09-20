<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import {
    Sparkles,
    ChevronLeft,
    ChevronRight,
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
   * 부문마다 맨 앞에 세울 장소.
   * 자료 순서대로 뽑으면 그 부문을 대표하지 못하는 곳이 걸릴 때가 있어요.
   * 여기 적어 둔 곳이 지금 지역에 있고 사진도 있을 때만 앞으로 당기고, 없으면 원래 순서를 씁니다.
   */
  const stripFirst: Partial<Record<Theme, string>> = {
    // 쇼핑은 작은 금은방(은하골드)이 먼저 걸렸어요. 엠백화점 춘천점 건물 사진이 있는 곳으로 바꿉니다.
    shopping: 'region-chuncheon-kto-3307177'
  };

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
    for (const [theme, queue] of queues) {
      const at = queue.findIndex((place) => place.id === stripFirst[theme]);
      if (at > 0) queue.unshift(...queue.splice(at, 1));
    }
    const rounds = [...queues.values()];
    const picked: Place[] = [];
    for (let i = 0; picked.length < 14 && rounds.some((queue) => queue.length); i++) {
      const next = rounds[i % rounds.length].shift();
      if (next) picked.push(next);
    }
    return picked;
  });

  /**
   * 문 앞에서 실제로 듣게 되는 말들.
   * 공모전 주제(모호한 반려동물 출입 조건 · 규정 인지 오류로 인한 입장 거부와 헛걸음)를
   * 설명으로 풀지 않고, 보호자가 현장에서 듣는 문장 그대로 보여 줍니다.
   */
  const doorQuotes = [
    { text: '죄송해요, 실내는 반려견 입장이 어려워요.', where: '가게 문 앞에서' },
    { text: '5kg 넘으면 안 되는데… 몇 kg이에요?', where: '체중 제한을 미리 몰랐을 때' },
    { text: '야외 테라스 자리만 가능하세요.', where: '비 오는 날, 자리가 없을 때' },
    { text: '케이지에 들어가 있어야 입장돼요.', where: '케이지를 안 챙겨 왔을 때' }
  ];

  /** 장소 분류 — 지도에서 고를 수 있는 순서 그대로. */
  const allThemes: Theme[] = [
    'cafe',
    'restaurant',
    'stay',
    'outdoor',
    'activity',
    'culture',
    'shopping'
  ];
  const count = (theme: Theme) =>
    data.places.filter((place) => placeTheme(place) === theme).length;
  // 그 지역에 한 곳도 없는 분류는 세지 않습니다.
  const themes = $derived(allThemes.filter((theme) => count(theme) > 0));

  /**
   * 사진 띠는 같은 목록을 두 벌 이어 붙여 두고 가로 스크롤을 직접 움직입니다.
   * (CSS 애니메이션으로 흘리면 화살표로 되돌려 볼 수가 없어요.)
   * 한 벌 너비를 넘어가면 같은 그림 자리로 되돌려 끝없이 이어지게 합니다.
   */
  let rail = $state<HTMLDivElement>();
  /** 사진 위에 손이 올라가 있거나 안에 초점이 있으면 저절로 흐르지 않게 세웁니다. */
  let railHold = $state(false);
  /**
   * 화살표로 넘어가는 중이면 그 목표 위치, 아니면 null.
   * scrollBy({ behavior: 'smooth' }) 를 쓰면 아래 자동 이동이 매 프레임 scrollLeft 를 건드려
   * 브라우저가 진행 중인 부드러운 스크롤을 취소해 버려요. 그래서 넘기는 것도 같은 고리에서 직접 굴립니다.
   */
  let railTarget: number | null = null;
  /** 저절로 흐르는 속도(px/초). 예전 CSS 애니메이션(80초에 한 바퀴)과 비슷한 빠르기예요. */
  const RAIL_SPEED = 42;
  /** 사진 한 장 + 사이 간격. .marquee-set 의 gap 과 맞춰 둡니다. */
  const RAIL_GAP = 20;

  /**
   * 지금 있어야 할 자리(소수점까지). scrollLeft 를 읽어서 더하면 브라우저가 픽셀에 맞춰 반올림한
   * 값이 돌아와, 목표에 0.x px 을 남기고 영영 닿지 못해 화살표 상태에서 못 빠져나옵니다.
   * 그래서 위치는 우리가 들고 있고 scrollLeft 에는 쓰기만 합니다.
   */
  let railPos = 0;

  $effect(() => {
    const node = rail;
    if (!node) return;
    // 움직임을 줄이도록 설정했다면 저절로 흐르지 않게 두고, 화살표로만 넘기게 합니다.
    const drift = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      // 다른 탭에 다녀오면 dt 가 몇 초씩 되기도 해서, 한 프레임에 확 튀지 않게 잘라 둡니다.
      const dt = Math.min(now - last, 80);
      last = now;
      if (railTarget === null && railHold) {
        // 손이 올라가 있는 동안은 사용자가 굴리는 대로 두고, 자리만 따라 읽어 둡니다.
        railPos = node.scrollLeft;
      } else {
        if (railTarget !== null) {
          const rest = railTarget - railPos;
          // 움직임을 줄이도록 설정했으면 곧장 목표로, 아니면 남은 거리를 프레임마다 좁혀 미끄러지듯.
          if (!drift || Math.abs(rest) < 0.5) {
            railPos = railTarget;
            // 여기서 비워 두어야 손을 떼고 가만두면 다시 저절로 흐릅니다.
            railTarget = null;
          } else {
            railPos += rest * Math.min(1, dt / 90);
          }
        } else if (drift) {
          railPos += (RAIL_SPEED * dt) / 1000;
        }
        // 두 벌 중 한 벌을 지나갔으면 같은 자리로 되돌립니다. 그림이 똑같아 티가 나지 않아요.
        const half = node.scrollWidth / 2;
        if (half > 0 && railPos >= half) {
          railPos -= half;
          if (railTarget !== null) railTarget -= half;
        }
        node.scrollLeft = railPos;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  });

  /** 화살표: 사진 한 장만큼 넘깁니다. 연달아 누르면 그만큼 더 갑니다. */
  function stepRail(direction: 1 | -1) {
    const node = rail;
    if (!node) return;
    const card = node.querySelector('.shot');
    const amount = (card?.getBoundingClientRect().width ?? 320) + RAIL_GAP;
    const half = node.scrollWidth / 2;
    // 넘기는 중이 아니라면 손으로 굴려 둔 자리에서 이어 갑니다.
    if (railTarget === null) railPos = node.scrollLeft;
    let from = railTarget ?? railPos;
    // 뒤로 갈 때 맨 앞이면 갈 곳이 없어요. 그림이 똑같은 두 번째 묶음의 같은 자리로 건너뛰어 둡니다.
    if (direction < 0 && from < amount && half > 0) {
      railPos += half;
      from += half;
      node.scrollLeft = railPos;
    }
    railTarget = from + direction * amount;
  }

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
      <a href="/web/dog"><PawPrint size={17} />우리 강아지</a>
      <a href="/web/explore"><Map size={17} />매장 찾기</a>
      <a href="/web/favorites"><Heart size={17} />찜한 장소</a>
    </nav>
    <div class="nav-right">
      {#if dev}
        <!-- 개발용: 튜토리얼 화면 확인 링크. 배포 전 삭제 -->
        <a class="nav-mobile dev-link" href="/web/start?replay"
          ><Sparkles size={16} />튜토리얼 페이지 보기</a
        >
      {/if}
      <a class="nav-mobile" href="/mobile"><Smartphone size={16} />모바일 버전</a>
      {#if store.loggedIn}
        <button class="nav-account" onclick={() => store.logout()} title={`${store.nickname}님 로그아웃`}><LogOut size={16} /><span class="account-nickname">{store.nickname}님</span> · 로그아웃</button>
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
        <a class="cta-button" href={startHref}>시작하기<ArrowRight size={23} /></a>
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
      <div class="strip-rail">
        <button
          class="rail-arrow prev"
          type="button"
          aria-label="지나간 사진 보기"
          onclick={() => stepRail(-1)}><ChevronLeft size={22} /></button
        >
        <!-- 손이 올라가 있거나 안에 초점이 있는 동안에는 멈춰서, 원하는 사진을 누를 수 있게 합니다. -->
        <div
          class="marquee-clip"
          role="group"
          aria-label="가게 사진 띠"
          bind:this={rail}
          onpointerenter={() => (railHold = true)}
          onpointerleave={() => (railHold = false)}
          onfocusin={() => (railHold = true)}
          onfocusout={() => (railHold = false)}
        >
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
        <button
          class="rail-arrow next"
          type="button"
          aria-label="다음 사진 보기"
          onclick={() => stepRail(1)}><ChevronRight size={22} /></button
        >
      </div>
    </section>
  {/if}

  <!--
    문제 제기: 선언부(짙은 갈색) 바로 앞에 두어 "이런 일 있었죠? → 그래서 만들었어요" 로 이어집니다.
    설명하는 대신 문 앞에서 실제로 듣게 되는 말을 말풍선으로 늘어놓았어요.
  -->
  <section class="problem">
    <div class="problem-inner">
      <div class="problem-copy" use:reveal>
        <span class="eyebrow">WHY WE BUILT THIS</span>
        <h2>큰맘 먹고 나선 날,<br /><em>문 앞에서 돌아선 적</em><br />없으세요?</h2>
        <!-- 줄바꿈은 어절(토큰) 단위로. 좁은 화면에서도 낱말이 잘리지 않게 word-break: keep-all 을 함께 둡니다. -->
        <p>
          <strong>“반려동물 동반 가능”</strong>이라는 한 줄만 믿고 갔다가, 도착해서야 안 되는 이유를
          듣습니다.<br />어디까지 되는지는, 늘 가보고 나서야 알게 됩니다.
        </p>
      </div>
      <!-- 받은 메시지처럼 왼쪽에 붙는 말풍선. 꼬리는 iOS 문자처럼 마지막 글자 아래에 달립니다. -->
      <ul class="quotes" use:reveal aria-label="문 앞에서 흔히 듣는 말">
        {#each doorQuotes as quote, index (quote.text)}
          <li style:--i={index}>
            <div class="bubble">
              <p>{quote.text}</p>
              <svg class="bubble-tail" viewBox="0 0 14 19" aria-hidden="true" focusable="false">
                <path d="M14 1C13.4 8.4 10.4 14.6 1.2 18.8 6.8 19.4 11 18.2 14 15Z" />
              </svg>
            </div>
            <span class="meta">{quote.where}</span>
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- 선언부: 연한 갈색 바탕에 큰 글자. 기능 셋은 세로선에 꿴 단계 목록으로. -->
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
      <!--
        기능 셋. 세로선 하나에 번호를 꿰어 01 → 02 → 03 의 차례가 그대로 보이게 합니다.
        설명의 <br> 은 넓은 화면에서 뜻이 끊기는 자리를 잡아 주는 용도라,
        두 칸이 위아래로 풀리는 1100px 아래에서는 CSS 로 꺼서 글이 스스로 흐르게 둡니다.
      -->
      <ol class="reasons" use:reveal>
        <li>
          <span class="reason-num">01</span>
          <h3>우리 강아지 조건으로 비교</h3>
          <p>체급과 몸무게를 등록하면 원본 규정의 체중·체급 제한과 <br />맞지 않는 곳을 알려드려요.</p>
        </li>
        <li>
          <span class="reason-num">02</span>
          <h3>동반 규정을 한눈에</h3>
          <p>실내·야외 허용 구역, 목줄, 배변 매너 같은 조건을 <br />항목별로 나눠 보여드려요.</p>
        </li>
        <li>
          <span class="reason-num">03</span>
          <h3>출처가 분명한 공공데이터</h3>
          <p>{sources.map((source) => source.shortName).join(' · ')} 자료를 쓰고, <br />수집일과 원문 링크를 함께 표시해요.</p>
        </li>
      </ol>
    </div>
  </section>

  <!-- 숫자 띠: 아이보리 바탕. 숫자 넉 줄 아래에 분류 알약을 한 줄로 촤르륵 펼쳐 둡니다. -->
  <section class="figures-band">
    <dl class="figures" use:reveal>
      <div><dt>반려견 동반 장소</dt><dd>{companionCount}<small>곳</small></dd></div>
      <div><dt>체중 제한이 기재된 곳</dt><dd>{weightCount}<small>곳</small></dd></div>
      <div><dt>카페 · 식당 · 숙소 등</dt><dd>{themes.length}<small>개 부문</small></dd></div>
      <div><dt>공공데이터 수집 시점</dt><dd class="date">{collectedAt}</dd></div>
    </dl>
    <!-- 부문이 이만큼 된다는 걸 보여 주는 자리라, 숫자 칸 아래 한 줄을 통째로 씁니다. -->
    <div class="theme-rack" use:reveal>
      <p class="theme-rack-lead">어디로 갈지부터 고르세요</p>
      <ul class="theme-pills" aria-label="장소 분류">
        {#each themes as theme, index (theme)}
          <li style:--i={index}>
            <a href={'/web/explore?category=' + theme}
              >{themeNames[theme]}<span>{count(theme)}</span></a
            >
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!--
    마무리: 글과 그림을 두 칸으로 나눠 나란히 둡니다.
    예전에는 그림을 오른쪽에 통째로 깔고 왼쪽을 아이보리로 녹였는데,
    넓은 화면에서는 글상자(1120px)가 가운데에 모이는 바람에 그림만 오른쪽 끝으로 쏠려 보였어요.
    이제 그림도 같은 칸 안에 액자로 들어가 좌우 무게가 맞습니다.
  -->
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
      <figure class="closing-art">
        <img
          src="/mascot/dangbri-weekend-2026-09-20.webp"
          alt="가방을 메고 언덕에 앉아 공원·카페·여행 이정표를 올려다보는 댕브리"
          width="1400"
          height="933"
          loading="lazy"
          decoding="async"
        />
      </figure>
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
  .account-nickname {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  /* 메인에서 가장 먼저 눌리는 버튼이라 다른 버튼들보다 확실히 크게 잡습니다. */
  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 15px;
    min-height: 78px;
    /* 좌우 여백을 똑같이 주면 가운데로 보이지 않아요. 오른쪽 화살표가 글자보다 훨씬 가벼워서
       같은 여백이라도 그쪽이 휑해 보이거든요. 오른쪽을 조금 좁혀 눈에 보이는 무게를 맞춥니다. */
    padding-left: clamp(46px, 5vw, 62px);
    padding-right: clamp(34px, 3.7vw, 46px);
    border-radius: 999px;
    background: linear-gradient(160deg, #c8825c 0%, var(--brand) 48%, var(--brand-deep) 100%);
    color: #fff;
    font-size: clamp(19px, 1.7vw, 22px);
    font-weight: 700;
    letter-spacing: -0.4px;
    /* 글자가 그라데이션 위에 납작하게 얹히지 않도록 살짝 띄웁니다. */
    text-shadow: 0 1px 2px #63331b66, 0 3px 12px #4d25133d;
    text-decoration: none;
    box-shadow:
      0 1px 1px #ffffff59 inset,
      0 10px 24px #b5704e4d,
      0 22px 48px #b5704e2e;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  /* 화살표에도 같은 결의 그림자를 얹어 글자와 따로 놀지 않게 합니다. */
  .cta-button :global(svg) {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px #63331b66);
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
  .strip-rail {
    position: relative;
  }
  /* 가로 스크롤은 스크립트(stepRail·자동 이동)가 움직입니다. 막대는 감춰 두었어요. */
  .marquee-clip {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    /* 좌우 끝을 살짝 흐려, 띠가 화면 밖으로 이어지는 느낌만 줍니다. */
    -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
    mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
  }
  .marquee-clip::-webkit-scrollbar {
    display: none;
  }
  .marquee {
    display: flex;
    width: max-content;
    padding: 6px 0 14px;
  }
  .marquee-set {
    display: flex;
    gap: 20px;
    padding-right: 20px;
  }
  /* 지나간 사진으로 되돌아갈 수 있게 하는 화살표. 사진 띠 양 끝에 얹습니다. */
  .rail-arrow {
    position: absolute;
    top: 50%;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-top: -26px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: #fffffff2;
    backdrop-filter: blur(8px);
    color: var(--brown-deep);
    cursor: pointer;
    box-shadow: 0 10px 24px -12px #4a342899;
    transition: background 0.16s, color 0.16s, border-color 0.16s, transform 0.16s;
  }
  .rail-arrow.prev {
    left: clamp(10px, 2vw, 26px);
  }
  .rail-arrow.next {
    right: clamp(10px, 2vw, 26px);
  }
  .rail-arrow:hover,
  .rail-arrow:focus-visible {
    border-color: var(--brand);
    color: var(--brand);
    transform: scale(1.06);
    outline: none;
  }
  .rail-arrow:active {
    transform: scale(0.96);
  }
  .shot {
    position: relative;
    /* 사진이 주인공인 띠라 큼직하게. 화면이 좁아지면 따라 줄어듭니다. */
    width: clamp(300px, 26vw, 420px);
    aspect-ratio: 4 / 3;
    flex-shrink: 0;
    border-radius: 16px;
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
    padding: 52px 18px 16px;
    background: linear-gradient(to top, #1f140ecc, transparent);
  }
  .shot-info strong {
    font-size: 18.5px;
    letter-spacing: -0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .shot-info > span {
    font-size: 13px;
    color: #ffffffd0;
  }

  /* ---------- 문제 제기 ---------- */
  .problem {
    /* 사진 띠에서 눈을 떼고 글을 읽기 시작하는 자리라, 위쪽을 넉넉히 비웁니다. */
    padding: clamp(104px, 15vh, 168px) 0 clamp(64px, 8vh, 96px);
  }
  .problem-inner {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    column-gap: clamp(40px, 6vw, 88px);
    row-gap: clamp(36px, 5vh, 52px);
    align-items: center;
  }
  .problem-copy h2 {
    margin: 16px 0 0;
    font-size: clamp(32px, 3.8vw, 50px);
    line-height: 1.32;
    letter-spacing: -1.8px;
    font-weight: 800;
    word-break: keep-all;
  }
  /* 되묻는 대목만 브랜드색으로 — 물음표까지 한 줄로 읽히게 합니다. */
  .problem-copy h2 em {
    font-style: normal;
    color: var(--brand);
  }
  .problem-copy p {
    margin: 22px 0 0;
    max-width: 420px;
    font-size: 16.5px;
    line-height: 1.85;
    color: var(--muted);
    word-break: keep-all;
  }
  /* 실제로 듣는 말들 — iOS 문자·인스타 DM 의 '받은 메시지' 결을 그대로 가져왔습니다.
     받은 말이라 모두 왼쪽에 붙고, 마지막 글자 아래에 꼬리가 달립니다. */
  .quotes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  .quotes li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 100%;
  }
  /* 한 줄씩 어긋나게 들여 써서 주고받는 것처럼 보이게 합니다.
     전부 왼쪽에 딱 붙여 놓으면 얌전하긴 한데 심심해요. */
  .quotes li:nth-child(even) {
    margin-left: clamp(26px, 6vw, 78px);
  }
  /* 말풍선. 꼬리가 달리는 왼쪽 아래 모서리만 덜 둥글게 깎아 꼬리와 매끄럽게 이어 줍니다. */
  .bubble {
    position: relative;
    max-width: 100%;
    padding: 11px 18px 12px;
    border-radius: 21px 21px 21px 6px;
    background: #fff;
    /* 문자 앱 말풍선에는 그림자가 없지만, 아이보리 바탕에서는 흰색이 묻혀서
       가장자리만 겨우 읽힐 만큼 옅게 깔아 둡니다. */
    box-shadow: 0 1px 2px #4a342812;
  }
  .bubble p {
    margin: 0;
    /* 문자 앱처럼 촘촘한 행간과 살짝 좁은 자간 */
    font-size: clamp(15.5px, 1.35vw, 17px);
    font-weight: 500;
    line-height: 1.42;
    letter-spacing: -0.35px;
    color: var(--ink);
    word-break: keep-all;
  }
  /* 꼬리. 배경색을 맞춰 오려 내는 방식은 이 섹션 배경이 그라데이션이라 못 써서,
     iOS 꼬리 모양을 그대로 딴 조각을 얹었습니다. 말풍선과 5px 겹쳐 이음매를 감춰요. */
  .bubble-tail {
    position: absolute;
    left: -9px;
    bottom: 0;
    width: 14px;
    height: 19px;
    fill: #fff;
    pointer-events: none;
  }
  .meta {
    margin: 7px 0 0 16px;
    font-size: 12.5px;
    letter-spacing: -0.2px;
    color: var(--muted);
  }
  .quotes:global(.is-in) li {
    animation: quote-in 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
    animation-delay: calc(var(--i, 0) * 110ms);
  }
  @keyframes quote-in {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  /* ---------- 선언부 ---------- */
  /* 한 겹 진하게 깐 갈색 위에, 양옆에서 은은하게 밝은 빛을 넣어 평평해 보이지 않게 합니다.
     가운데는 손대지 않아 글자 대비는 그대로예요. */
  .manifesto {
    position: relative;
    /* 문제 제기에서 곧장 이어지는 대목이라, 다른 구간보다 사이를 좁게 둡니다. */
    margin-top: clamp(32px, 4vh, 52px);
    background:
      radial-gradient(70% 90% at 0% 18%, #8a6249a8 0%, transparent 62%),
      radial-gradient(64% 86% at 100% 84%, #7d5a42b8 0%, transparent 60%),
      linear-gradient(160deg, #6a4a37 0%, #5f4230 52%, #543a2a 100%);
    color: #fbf3ea;
  }
  /* 위아래 가장자리만 살짝 눌러 띠가 앞뒤 화면에 자연스럽게 얹히게 합니다. */
  .manifesto::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, #3a271c33 0%, transparent 18%, transparent 86%, #3a271c3d 100%);
  }
  .manifesto-inner {
    position: relative;
    z-index: 1;
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    padding: clamp(72px, 10vh, 120px) 0 clamp(64px, 9vh, 104px);
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    column-gap: clamp(40px, 6vw, 96px);
    row-gap: clamp(40px, 6vh, 64px);
  }
  .manifesto-copy h2 {
    margin: 18px 0 0;
    font-size: clamp(38px, 4.6vw, 62px);
    line-height: 1.24;
    letter-spacing: -2.4px;
    font-weight: 800;
    color: #fff;
    text-shadow: 0 2px 3px #3a271c4d, 0 10px 26px #2c1c1259;
  }
  .manifesto-copy p {
    margin: 22px 0 0;
    max-width: 380px;
    font-size: 16.5px;
    line-height: 1.8;
    color: #f0e2d5;
    word-break: keep-all;
  }
  /* 기능 셋 — 면도 테두리도 없이, 세로선 하나에 번호를 꿴 단계 목록입니다. */
  .reasons {
    position: relative;
    margin: 0;
    /* 왼쪽 큰 글자와 번호가 서로 붙어 보이지 않게, 번호 줄 전체를 오른쪽으로 물립니다.
       오른쪽 칸에는 글이 다 들어가고도 자리가 남아 있어서, 미는 만큼 그대로 여백이 됩니다. */
    margin-left: clamp(24px, 4.5vw, 64px);
    padding: 0 0 0 64px;
    list-style: none;
    align-self: center;
    display: grid;
    gap: 34px;
  }
  /* 셋을 하나로 꿰는 세로선. 위아래 끝은 흐리게 풀어 띠에 얹히게 합니다. */
  .reasons::before {
    content: '';
    position: absolute;
    left: 22px;
    top: 14px;
    bottom: 14px;
    width: 2px;
    background: linear-gradient(
      180deg,
      #d1b49800 0%,
      #d1b49870 14%,
      #d1b49870 86%,
      #d1b49800 100%
    );
  }
  .reasons li {
    position: relative;
  }
  /* 번호 동그라미. 짙은 갈색 띠 위에서 먼저 눈에 띄도록 밝은 베이지로 채우고,
     숫자는 가장 짙은 갈색으로 눌러 대비를 크게 벌립니다(약 9:1). */
  .reason-num {
    position: absolute;
    left: -64px;
    top: -3px;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: radial-gradient(circle at 34% 26%, #ecdcc9 0%, #d1b498 58%, #b99a7c 100%);
    box-shadow:
      inset 0 1px 0 #fff,
      0 5px 14px #24140b4d;
    color: #40291a;
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
  }
  .reasons h3 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.6px;
    color: #fff;
  }
  .reasons p {
    margin: 9px 0 0;
    max-width: 470px;
    font-size: 15px;
    line-height: 1.72;
    color: #ecdccd;
    word-break: keep-all;
  }

  /* ---------- 숫자 띠 (아이보리) ---------- */
  .figures-band {
    background: var(--ivory);
    padding: clamp(56px, 8vh, 88px) 0;
  }
  .figures {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px 24px;
  }
  .figures > div {
    padding-top: 22px;
    border-top: 1px solid var(--line);
  }
  .figures dt {
    font-size: 13.5px;
    color: var(--muted);
  }
  .figures dd {
    margin: 8px 0 0;
    font-size: clamp(38px, 4vw, 54px);
    font-weight: 800;
    letter-spacing: -2px;
    line-height: 1;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .figures dd small {
    margin-left: 3px;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--brand);
  }
  .figures dd.date {
    font-size: clamp(30px, 3vw, 40px);
    letter-spacing: -1.2px;
  }
  /* 분류 알약 — 숫자 칸 아래 한 줄. 부문이 이만큼 된다는 걸 보여 주는 자리라
     숫자보다 크게, 가로로 꽉 차게 늘어놓습니다. */
  .theme-rack {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: clamp(30px, 4vh, 44px) auto 0;
    padding-top: clamp(26px, 3.5vh, 36px);
    border-top: 1px solid var(--line);
  }
  .theme-rack-lead {
    margin: 0 0 16px;
    font-size: 13.5px;
    color: var(--muted);
  }
  .theme-pills {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  /* 한 장씩 차례로 들어와 '촤르륵' 펼쳐지는 느낌. 움직임을 줄인 사용자에게는
     reveal 자체가 붙지 않으니 이 지연도 따라서 없어집니다. */
  .theme-rack:global(.is-in) .theme-pills li {
    animation: pill-in 0.42s cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
  @keyframes pill-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
  }
  .theme-pills a {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 50px;
    padding: 0 22px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid var(--line);
    color: var(--brown-deep);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.3px;
    text-decoration: none;
    box-shadow: 0 6px 16px -10px #4a342866;
    transition: border-color 0.16s, color 0.16s, transform 0.16s, box-shadow 0.16s;
  }
  /* 곳수는 알약 안 작은 배지로 — 숫자가 이름을 밀어내지 않게 합니다. */
  .theme-pills a span {
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--brand-tint);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--brand);
    font-variant-numeric: tabular-nums;
  }
  .theme-pills a:hover,
  .theme-pills a:focus-visible {
    border-color: var(--brand);
    color: var(--brand);
    transform: translateY(-2px);
    box-shadow: 0 12px 22px -12px #4a342866;
    outline: none;
  }

  /* ---------- 마무리 ---------- */
  .closing {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(900px 520px at 88% 40%, #fff6e7 0%, transparent 62%),
      var(--ivory);
    border-top: 1px solid var(--line);
  }
  /* 글 : 그림 = 대략 1 : 1.15. 그림 쪽을 조금 넓게 줘야 가로로 긴 그림이 답답하지 않아요. */
  .closing-inner {
    position: relative;
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    align-items: center;
    gap: clamp(32px, 5vw, 64px);
    padding: clamp(56px, 8vh, 96px) 0;
  }
  .closing-copy {
    max-width: 520px;
    word-break: keep-all;
  }
  /* 그림은 액자에 담아 오른쪽 칸을 채웁니다. 가로로 긴 원본을 4:3 으로 잘라
     이정표와 댕브리가 같이 들어오게 object-position 을 오른쪽 위로 밀어 둡니다. */
  .closing-art {
    margin: 0;
    border-radius: 28px;
    overflow: hidden;
    background: #eaf3fb;
    box-shadow:
      0 1px 0 #ffffffb3 inset,
      0 22px 44px -26px #6b452c59;
  }
  .closing-art img {
    display: block;
    width: 100%;
    height: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    object-position: 68% 42%;
  }
  .closing-copy h2 {
    margin: 14px 0 0;
    font-size: clamp(32px, 3.4vw, 46px);
    line-height: 1.34;
    letter-spacing: -1.6px;
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
    background: var(--brown-deep);
    color: #fff;
  }
  .closing-primary:hover {
    background: var(--brand-deep);
  }
  .closing-secondary {
    border: 1.5px solid #d9c6b4;
    background: #fffdfa;
    color: var(--brand-deep);
  }
  .closing-secondary:hover {
    border-color: var(--brand);
    color: var(--brand);
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
  @media (prefers-reduced-motion: reduce) {
    /* 저절로 흐르지 않으니(스크립트에서 끕니다) 끝을 흐릴 이유도 없습니다. */
    .marquee-clip {
      mask-image: none;
      -webkit-mask-image: none;
    }
  }

  /* ---------- 좁은 화면 ---------- */
  @media (max-width: 1100px) {
    /* 두 칸이 위아래로 풀리면서 글 너비가 달라집니다. 넓은 화면에서만 맞던
       줄바꿈을 그대로 두면 엉뚱한 곳이 끊기므로, 여기서부터는 글이 스스로 흐르게 둡니다.
       마크업에서 <br> 앞에 공백을 하나 두었기 때문에, 꺼도 낱말이 서로 붙지 않아요
       (넓은 화면에서는 줄 끝 공백이라 보이지 않습니다). */
    .reasons p br {
      display: none;
    }
    /* 위아래로 풀리면 왼쪽 글과 같은 선에서 시작해야 해서, 오른쪽으로 물린 것을 되돌립니다. */
    .reasons {
      margin-left: 0;
    }
    .manifesto-inner,
    .problem-inner {
      grid-template-columns: 1fr;
    }
    .manifesto-copy p,
    .problem-copy p {
      max-width: 560px;
    }
  }
  @media (max-width: 980px) {
    .nav-links {
      display: none;
    }
    .figures {
      grid-template-columns: 1fr 1fr;
    }
    /* 좁은 화면에서는 두 칸을 위아래로 풀고, 그림은 납작하게 잘라 글 아래에 둡니다. */
    .closing-inner {
      grid-template-columns: 1fr;
    }
    .closing-copy {
      max-width: none;
    }
    .closing-art img {
      aspect-ratio: 16 / 9;
      object-position: 62% 50%;
    }
  }
  @media (max-width: 760px) {
    .bubble {
      padding: 10px 15px 11px;
    }
    /* 좁은 화면에서는 들여쓰기를 줄여, 어긋난 줄의 글자가 너무 좁아지지 않게 합니다. */
    .quotes li:nth-child(even) {
      margin-left: 18px;
    }
    .strip-head {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    /* 좁은 화면에서는 들여쓰기와 동그라미를 줄여, 글이 들어갈 자리를 넓힙니다. */
    .reasons {
      padding-left: 52px;
      gap: 28px;
    }
    .reasons::before {
      left: 19px;
    }
    .reason-num {
      left: -52px;
      width: 38px;
      height: 38px;
      font-size: 13.5px;
    }
    .shot {
      width: 280px;
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
