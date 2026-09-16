<script lang="ts">
  import {
    PawPrint,
    Map,
    Heart,
    ArrowRight,
    ArrowUpRight,
    MapPin,
    LogIn,
    LogOut,
    Smartphone,
    Scale,
    ShieldCheck,
    Database,
    Coffee,
    House,
    Trees,
    Sparkles
  } from '@lucide/svelte';
  import { categoryNames, policyLines } from '$lib/domain/place';
  import { getWebStore } from '$lib/web/store.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();

  const weightCount = $derived(data.places.filter((place) => place.sourceWeight !== null).length);

  /**
   * 메인 상단 산책 영상 (static/media/walk.mp4 · 1280x720 · 8초).
   * 다른 영상으로 바꾸려면 static/media/ 에 넣고 이 경로만 바꾸면 됩니다.
   * 영상 비율이 16:9 가 아니면 아래 .film 의 aspect-ratio 도 같이 맞춰 주세요.
   * null 이면 검은 화면으로 비워 둡니다.
   */
  const walkVideo: string | null = '/media/walk.mp4';
  const walkPoster: string | null = null;
  const isGif = $derived(Boolean(walkVideo && /\.gif$/i.test(walkVideo)));

  const categoryCards = [
    { id: 'food', icon: Coffee, copy: '테라스만? 실내도? 매장마다 다른 규정을 미리' },
    { id: 'stay', icon: House, copy: '체중·마릿수 제한과 추가 요금을 떠나기 전에' },
    { id: 'outdoor', icon: Trees, copy: '목줄 규정과 출입 가능한 구역을 한눈에' },
    { id: 'activity', icon: Sparkles, copy: '반려견과 함께 즐길 수 있는 체험 프로그램' }
  ] as const;
  const count = (category: string) =>
    data.places.filter((place) => place.category === category).length;
  const featured = $derived(
    data.places.filter((place) => policyLines(place.policy).length >= 2).slice(0, 6)
  );

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
  <title>댕브리웨어 — 강아지와 함께, 헛걸음 없이 강릉</title>
  <meta
    name="description"
    content="강릉에서 강아지와 함께 갈 수 있는 카페, 숙소, 관광지. 체중 제한부터 실내외 동반 규정까지, 떠나기 전에 확인하세요."
  />
</svelte:head>

<div class="landing">
  <!-- 상단 내비게이션 -->
  <header class="landing-nav">
    <a class="nav-brand" href="/web">
      <img class="nav-logo" src="/logo.png" alt="" width="42" height="42" />
      <strong>댕브리웨어</strong>
    </a>
    <nav class="nav-links" aria-label="주 메뉴">
      <a href="/web/explore"><Map size={17} />가게 찾기</a>
      <a href="/web/favorites"><Heart size={17} />찜한 장소</a>
      <a href="/web/dog"><PawPrint size={17} />우리 강아지</a>
    </nav>
    <div class="nav-right">
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
      <span class="intro-eyebrow"><MapPin size={15} />강원 강릉 · 반려견 동반 여행</span>
      <h1>강아지와 함께,<br /><em>헛걸음 없이</em></h1>
      <p class="intro-lead">
        “여기 강아지 들어갈 수 있나요?” 매번 전화로 묻지 않아도 되도록,
        강릉의 반려견 동반 장소 <strong>{data.places.length}곳</strong>의 출입 규정을 한곳에 모았어요.
      </p>


      <div class="cta">
        <a class="cta-button" href="/web/dog">시작하기<ArrowRight size={19} /></a>
        <p class="cta-note">체중 조건이 표기된 곳 {weightCount}곳 · 로그인 없이 둘러볼 수 있어요.</p>
      </div>
    </section>
  </main>

  <!-- 숫자 -->
  <section class="stats" aria-label="데이터 요약" use:reveal>
    <div><strong>{data.places.length}<small>곳</small></strong><span>강릉 반려견 동반 장소</span></div>
    <div><strong>{weightCount}<small>곳</small></strong><span>체중 제한이 기재된 장소</span></div>
    <div><strong>4<small>종</small></strong><span>카페 · 숙소 · 관광 · 체험</span></div>
    <div><strong>2026.09</strong><span>공공데이터 수집 시점</span></div>
  </section>

  <!-- 기능 소개 -->
  <section class="section">
    <div class="section-head" use:reveal>
      <span class="section-eyebrow">WHY DANGVERYWHERE</span>
      <h2>출입 조건, 도착해서 확인하지 마세요</h2>
      <p>모호한 반려동물 동반 규정 때문에 생기는 입장 거부와 헛걸음을 줄이는 것이 목표예요.</p>
    </div>
    <div class="feature-grid">
      <article class="feature" use:reveal>
        <span class="feature-icon"><Scale size={28} /></span>
        <h3>우리 강아지 기준으로 비교</h3>
        <p>체급과 몸무게를 등록하면 원본 규정의 체중·체급 제한과 맞지 않는 곳을 알려드려요.</p>
      </article>
      <article class="feature" use:reveal>
        <span class="feature-icon"><ShieldCheck size={28} /></span>
        <h3>동반 규정을 한눈에</h3>
        <p>실내·야외 허용 구역, 목줄, 배변 매너 같은 조건을 항목별로 나눠 보여드려요.</p>
      </article>
      <article class="feature" use:reveal>
        <span class="feature-icon"><Database size={28} /></span>
        <h3>출처가 분명한 공공데이터</h3>
        <p>강원 반려동물 동반관광 데이터를 사용하고, 수집일과 원문 링크를 함께 표시해요.</p>
      </article>
    </div>
  </section>

  <!-- 카테고리 -->
  <section class="section section-sand">
    <div class="section-head" use:reveal>
      <span class="section-eyebrow">EXPLORE BY TYPE</span>
      <h2>어디로 함께 갈까요?</h2>
    </div>
    <div class="category-grid">
      {#each categoryCards as item (item.id)}<a
          class="category-card {item.id}"
          href={`/web/explore?category=${item.id}`}
          use:reveal
        >
          <span class="category-icon"><item.icon size={30} strokeWidth={1.6} /></span>
          <strong>{categoryNames[item.id]}</strong>
          <p>{item.copy}</p>
          <span class="category-count">{count(item.id)}곳 보기<ArrowRight size={16} /></span>
        </a>{/each}
    </div>
  </section>

  <!-- 추천 장소 -->
  {#if featured.length}
    <section class="section">
      <div class="section-head row" use:reveal>
        <div>
          <span class="section-eyebrow">PLACES TO GO</span>
          <h2>규정이 자세히 적힌 장소</h2>
        </div>
        <a class="secondary-button" href="/web/explore"
          >전체 {data.places.length}곳 보기<ArrowRight size={17} /></a
        >
      </div>
      <div class="place-grid">
        {#each featured as place (place.id)}<a
            class="place-tile"
            href={`/web/explore?place=${place.id}`}
            use:reveal
          >
            <small>{categoryNames[place.category]}</small>
            <strong>{place.name}</strong>
            <span class="tile-address"
              ><MapPin size={14} />{place.address.replace(/^강원(?:특별자치도|도)?\s*/, '')}</span
            >
            <p>{policyLines(place.policy)[0]}</p>
            <span class="tile-more">규정 자세히 보기<ArrowUpRight size={15} /></span>
          </a>{/each}
      </div>
    </section>
  {/if}

  <!-- 마무리 -->
  <section class="closing" use:reveal>
    <PawPrint size={44} strokeWidth={1.2} />
    <h2>이번 주말, 강아지와 강릉 어때요?</h2>
    <p>지도를 열고 함께 갈 수 있는 곳부터 찾아보세요.</p>
    <div class="closing-actions">
      <a class="closing-primary" href="/web/explore">지도에서 찾기<ArrowRight size={19} /></a>
      <a class="closing-secondary" href="/web/dog">우리 강아지 등록</a>
    </div>
  </section>

  <footer class="landing-footer">
    <div>
      <strong>댕브리웨어 DangveryWhere</strong>
      <p>2026 관광데이터 활용 공모전 · 웹·앱 구현 부문</p>
    </div>
    <div class="footer-links">
      <a href="https://www.pettravel.kr/petapi/data/total" target="_blank" rel="noreferrer"
        >데이터 출처: 강원 반려동물 동반관광<ArrowUpRight size={14} /></a
      >
      <span>규정은 현지 사정에 따라 바뀔 수 있어요. 방문 전 시설에 확인해 주세요.</span>
    </div>
  </footer>
</div>

<style>
  .landing {
    min-height: 100dvh;
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
  .nav-brand strong {
    font-size: 21px;
    letter-spacing: -0.8px;
    color: var(--brand);
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
    transition: background 0.16s, color 0.16s;
  }
  .nav-mobile:hover,
  .nav-account:hover {
    background: #fff;
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
    max-height: 78vh;
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
  .cta-note {
    margin: 18px 0 0;
    font-size: 14px;
    color: var(--muted);
  }


  /* ================================================================
     아래 섹션들 — 숫자 · 기능 소개 · 카테고리 · 추천 장소 · 마무리 · 푸터
     ================================================================ */
  .section,
  .stats,
  .landing-footer {
    width: min(1120px, calc(100% - clamp(36px, 8vw, 112px)));
    margin-inline: auto;
  }

  /* ---------- 숫자 ---------- */
  .stats {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin-top: -48px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: 0 18px 50px #4a342814;
    overflow: hidden;
  }
  .stats > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 30px 34px;
    border-right: 1px solid var(--line);
  }
  .stats > div:last-child {
    border-right: 0;
  }
  .stats strong {
    font-size: 38px;
    letter-spacing: -1.5px;
    color: var(--brand);
  }
  .stats small {
    font-size: 18px;
    margin-left: 3px;
    color: var(--brown-warm);
  }
  .stats span {
    font-size: 15px;
    color: var(--muted);
  }

  /* ---------- 섹션 공통 ---------- */
  .section {
    padding: 100px 0;
  }
  .section-sand {
    width: 100%;
    background: var(--sand);
    padding-inline: max(40px, calc((100% - 1280px) / 2));
  }
  .section-head {
    margin-bottom: 44px;
  }
  .section-head.row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }
  .section-eyebrow {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2.5px;
    color: var(--gold);
  }
  .section-head h2 {
    font-size: 40px;
    letter-spacing: -1.5px;
    margin: 12px 0 0;
  }
  .section-head p {
    font-size: 18px;
    color: var(--muted);
    margin: 14px 0 0;
    line-height: 1.7;
  }

  /* ---------- 기능 ---------- */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .feature {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 34px 32px;
  }
  .feature-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .feature h3 {
    font-size: 22px;
    letter-spacing: -0.7px;
    margin: 24px 0 10px;
  }
  .feature p {
    font-size: 16px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0;
    word-break: keep-all;
  }

  /* ---------- 카테고리 ---------- */
  .category-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
  .category-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 30px 28px;
    border-radius: 22px;
    background: #fff;
    border: 1px solid var(--line);
    color: var(--ink);
    text-decoration: none;
    transition:
      transform 0.18s,
      box-shadow 0.18s;
  }
  .category-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px #4a34281a;
  }
  .category-icon {
    display: grid;
    place-items: center;
    width: 62px;
    height: 62px;
    border-radius: 19px;
    margin-bottom: 8px;
  }
  .category-card.food .category-icon {
    background: #f7e7db;
    color: #b5704e;
  }
  .category-card.stay .category-icon {
    background: #f1e6dc;
    color: #8a5a3c;
  }
  .category-card.outdoor .category-icon {
    background: #e9eddf;
    color: #6f7f5b;
  }
  .category-card.activity .category-icon {
    background: #f6ecd9;
    color: #a4783c;
  }
  .category-card strong {
    font-size: 21px;
    letter-spacing: -0.6px;
  }
  .category-card p {
    font-size: 15px;
    line-height: 1.7;
    color: var(--muted);
    margin: 0;
    flex: 1;
    word-break: keep-all;
  }
  .category-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: 15px;
    font-weight: 600;
    color: var(--brand);
  }


  /* ---------- 추천 장소 ---------- */
  .place-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .place-tile {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 26px;
    border-radius: 20px;
    background: #fff;
    border: 1px solid var(--line);
    color: var(--ink);
    text-decoration: none;
    transition: box-shadow 0.18s;
  }
  .place-tile:hover {
    box-shadow: 0 14px 36px #4a34281a;
  }
  .place-tile small {
    font-size: 13.5px;
    color: var(--brand);
    font-weight: 600;
  }
  .place-tile strong {
    font-size: 20px;
    letter-spacing: -0.6px;
  }
  .tile-address {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: var(--muted);
  }
  .place-tile p {
    flex: 1;
    margin: 8px 0 4px;
    padding: 13px 15px;
    border-radius: 12px;
    background: var(--cream);
    font-size: 14.5px;
    line-height: 1.7;
    word-break: keep-all;
  }
  .tile-more {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 14.5px;
    font-weight: 600;
    color: var(--brand);
  }

  /* ---------- CTA · 푸터 ---------- */
  .closing {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 96px 40px;
    background: linear-gradient(135deg, var(--brown-deep) 0%, var(--brand-deep) 100%);
    color: #fff;
  }
  .closing h2 {
    font-size: 40px;
    letter-spacing: -1.5px;
    margin: 22px 0 12px;
  }
  .closing p {
    font-size: 18px;
    color: #ffffffcc;
    margin: 0 0 34px;
  }
  .closing-actions {
    display: flex;
    gap: 12px;
  }
  .closing-primary,
  .closing-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 58px;
    padding: 0 30px;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 600;
    text-decoration: none;
  }
  .closing-primary {
    background: var(--gold);
    color: #3b2414;
  }
  .closing-primary:hover {
    background: #e6b574;
  }
  .closing-secondary {
    border: 1px solid #ffffff66;
    color: #fff;
  }
  .closing-secondary:hover {
    background: #ffffff1a;
  }
  .landing-footer {
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
  /* 한 줄에 여러 칸이 있으면 살짝 시차를 둬서 차례로 올라오게 합니다. */
  .feature-grid > :nth-child(2),
  .category-grid > :nth-child(2),
  .place-grid > :nth-child(2) {
    transition-delay: 0.09s;
  }
  .feature-grid > :nth-child(3),
  .category-grid > :nth-child(3),
  .place-grid > :nth-child(3) {
    transition-delay: 0.18s;
  }
  .category-grid > :nth-child(4),
  .place-grid > :nth-child(4) {
    transition-delay: 0.27s;
  }
  .place-grid > :nth-child(5) {
    transition-delay: 0.36s;
  }
  .place-grid > :nth-child(6) {
    transition-delay: 0.45s;
  }

  /* ---------- 좁은 화면 (복원 섹션) ---------- */
  @media (max-width: 1100px) {
    .feature-grid,
    .place-grid,
    .category-grid,
    .stats {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 760px) {
    .feature-grid,
    .place-grid,
    .category-grid,
    .stats {
      grid-template-columns: 1fr;
    }
    .landing-footer {
      flex-direction: column;
    }
    .footer-links {
      align-items: flex-start;
    }
  }

  /* ---------- 좁은 화면 ---------- */
  @media (max-width: 980px) {
    .nav-links {
      display: none;
    }
    .points {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 720px) {
    .nav-mobile {
      display: none;
    }
  }
</style>
