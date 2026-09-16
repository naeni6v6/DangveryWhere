<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    PawPrint,
    Map,
    Heart,
    Search,
    ArrowRight,
    ArrowUpRight,
    Coffee,
    House,
    Trees,
    Sparkles,
    Scale,
    ShieldCheck,
    Database,
    MapPin,
    LogIn,
    LogOut,
    Smartphone,
    Dog,
    Footprints
  } from '@lucide/svelte';
  import { categoryNames, policyLines } from '$lib/domain/place';
  import { getWebStore } from '$lib/web/store.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();

  const categoryCards = [
    { id: 'food', icon: Coffee, copy: '테라스만? 실내도? 매장마다 다른 규정을 미리' },
    { id: 'stay', icon: House, copy: '체중·마릿수 제한과 추가 요금을 떠나기 전에' },
    { id: 'outdoor', icon: Trees, copy: '목줄 규정과 출입 가능한 구역을 한눈에' },
    { id: 'activity', icon: Sparkles, copy: '반려견과 함께 즐길 수 있는 체험 프로그램' }
  ] as const;
  const count = (category: string) =>
    data.places.filter((place) => place.category === category).length;
  const weightCount = $derived(data.places.filter((place) => place.sourceWeight !== null).length);
  const sample = $derived(
    data.places.find(
      (place) => place.sourceWeight !== null && policyLines(place.policy).length >= 2
    ) ?? data.places[0]
  );
  const featured = $derived(
    data.places.filter((place) => policyLines(place.policy).length >= 2).slice(0, 6)
  );

  function search(event: SubmitEvent) {
    event.preventDefault();
    goto('/web/explore');
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
    <a class="nav-brand" href="/web"
      ><span class="nav-logo"><PawPrint size={24} fill="currentColor" strokeWidth={1} /></span
      ><strong>댕브리웨어</strong></a
    >
    <nav class="nav-links" aria-label="주 메뉴">
      <a href="/web/explore"><Map size={18} />지도 탐색</a>
      <a href="/web/favorites"><Heart size={18} />찜한 장소</a>
      <a href="/web/dog"><PawPrint size={18} />우리 강아지</a>
    </nav>
    <div class="nav-right">
      <a class="nav-mobile" href="/"><Smartphone size={17} />모바일 버전</a>
      {#if store.loggedIn}<button class="nav-account" onclick={() => store.logout()}
          ><LogOut size={17} />로그아웃</button
        >{:else}<button class="nav-account" onclick={() => store.requestLogin()}
          ><LogIn size={17} />로그인</button
        >{/if}
      <a class="primary-button nav-cta" href="/web/explore">지도 열기<ArrowRight size={18} /></a>
    </div>
  </header>

  <!-- 히어로 -->
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="hero-eyebrow"><MapPin size={16} />강원 강릉 · 반려견 동반 여행</span>
        <h1>강아지와 함께,<br />헛걸음 없이 떠나요</h1>
        <p>
          “소형견만 돼요”, “테라스만 가능해요”. 도착해서야 알게 되는 출입 조건을<br />
          크기·체중·실내외·목줄 규정까지 떠나기 전에 확인하세요.
        </p>
        <form class="hero-search" role="search" onsubmit={search}>
          <Search size={22} />
          <input
            aria-label="장소 검색"
            placeholder="가고 싶은 장소나 동네를 입력해 보세요"
            bind:value={store.query}
          />
          <button class="primary-button" type="submit">찾아보기</button>
        </form>
        <div class="hero-actions">
          <a class="hero-link" href="/web/explore"><Map size={18} />지도에서 둘러보기</a>
          <a class="hero-link" href="/web/dog"
            ><Dog size={18} />{store.dog ? `${store.dog.name} 정보 보기` : '우리 강아지 등록하기'}</a
          >
        </div>
      </div>

      {#if sample}
        <div class="hero-visual" aria-hidden="true">
          <div class="visual-card">
            <div class="visual-top">
              <span class="visual-icon"><PawPrint size={22} /></span>
              <div>
                <small>{categoryNames[sample.category]} · 강릉</small>
                <strong>{sample.name}</strong>
              </div>
              <Heart size={20} />
            </div>
            <div class="visual-notice">
              <Scale size={17} />
              {sample.sourceWeight !== null
                ? `원본 제한 체중 ${sample.sourceWeight}kg`
                : '동반 규정 확인 필요'}
            </div>
            <ol>
              {#each policyLines(sample.policy).slice(0, 3) as line, i}<li>
                  <span>{String(i + 1).padStart(2, '0')}</span>{line}
                </li>{/each}
            </ol>
          </div>
          <div class="visual-bubble"><Footprints size={18} />방문 전 규정 확인 완료!</div>
        </div>
      {/if}
    </div>
  </section>

  <!-- 숫자 -->
  <section class="stats" aria-label="데이터 요약">
    <div><strong>{data.places.length}<small>곳</small></strong><span>강릉 반려견 동반 장소</span></div>
    <div><strong>{weightCount}<small>곳</small></strong><span>체중 제한이 기재된 장소</span></div>
    <div><strong>4<small>종</small></strong><span>카페 · 숙소 · 관광 · 체험</span></div>
    <div><strong>2026.09</strong><span>공공데이터 수집 시점</span></div>
  </section>

  <!-- 기능 소개 -->
  <section class="section">
    <div class="section-head">
      <span class="section-eyebrow">WHY DANGVERYWHERE</span>
      <h2>출입 조건, 도착해서 확인하지 마세요</h2>
      <p>모호한 반려동물 동반 규정 때문에 생기는 입장 거부와 헛걸음을 줄이는 것이 목표예요.</p>
    </div>
    <div class="feature-grid">
      <article class="feature">
        <span class="feature-icon"><Scale size={28} /></span>
        <h3>우리 강아지 기준으로 비교</h3>
        <p>체급과 몸무게를 등록하면 원본 규정의 체중·체급 제한과 맞지 않는 곳을 알려드려요.</p>
      </article>
      <article class="feature">
        <span class="feature-icon"><ShieldCheck size={28} /></span>
        <h3>동반 규정을 한눈에</h3>
        <p>실내·야외 허용 구역, 목줄, 배변 매너 같은 조건을 항목별로 나눠 보여드려요.</p>
      </article>
      <article class="feature">
        <span class="feature-icon"><Database size={28} /></span>
        <h3>출처가 분명한 공공데이터</h3>
        <p>강원 반려동물 동반관광 데이터를 사용하고, 수집일과 원문 링크를 함께 표시해요.</p>
      </article>
    </div>
  </section>

  <!-- 카테고리 -->
  <section class="section section-sand">
    <div class="section-head">
      <span class="section-eyebrow">EXPLORE BY TYPE</span>
      <h2>어디로 함께 갈까요?</h2>
    </div>
    <div class="category-grid">
      {#each categoryCards as item (item.id)}<a
          class="category-card {item.id}"
          href={`/web/explore?category=${item.id}`}
        >
          <span class="category-icon"><item.icon size={30} strokeWidth={1.6} /></span>
          <strong>{categoryNames[item.id]}</strong>
          <p>{item.copy}</p>
          <span class="category-count">{count(item.id)}곳 보기<ArrowRight size={16} /></span>
        </a>{/each}
    </div>
  </section>

  <!-- 이용 방법 -->
  <section class="section">
    <div class="section-head">
      <span class="section-eyebrow">HOW IT WORKS</span>
      <h2>세 단계면 준비 끝</h2>
    </div>
    <ol class="steps">
      <li>
        <span class="step-number">01</span>
        <h3>우리 강아지 등록</h3>
        <p>이름, 체급, 몸무게만 입력하면 돼요. 로그인하면 다음에도 그대로 불러와요.</p>
        <a href="/web/dog">등록하러 가기<ArrowRight size={16} /></a>
      </li>
      <li>
        <span class="step-number">02</span>
        <h3>지도에서 장소 찾기</h3>
        <p>카테고리와 동반 조건 필터로 함께 갈 수 있는 곳만 골라 보세요.</p>
        <a href="/web/explore">지도 열기<ArrowRight size={16} /></a>
      </li>
      <li>
        <span class="step-number">03</span>
        <h3>규정 확인하고 찜하기</h3>
        <p>상세 규정과 준비물을 확인하고, 마음에 드는 곳은 찜해 두세요.</p>
        <a href="/web/favorites">찜한 장소 보기<ArrowRight size={16} /></a>
      </li>
    </ol>
  </section>

  <!-- 추천 장소 -->
  {#if featured.length}
    <section class="section section-sand">
      <div class="section-head row">
        <div>
          <span class="section-eyebrow">PLACES TO GO</span>
          <h2>규정이 자세히 적힌 장소</h2>
        </div>
        <a class="secondary-button" href="/web/explore">전체 {data.places.length}곳 보기<ArrowRight size={17} /></a>
      </div>
      <div class="place-grid">
        {#each featured as place (place.id)}<a class="place-tile" href={`/web/explore?place=${place.id}`}>
            <small>{categoryNames[place.category]}</small>
            <strong>{place.name}</strong>
            <span class="tile-address"><MapPin size={14} />{place.address.replace(/^강원(?:특별자치도|도)?\s*/, '')}</span>
            <p>{policyLines(place.policy)[0]}</p>
            <span class="tile-more">규정 자세히 보기<ArrowUpRight size={15} /></span>
          </a>{/each}
      </div>
    </section>
  {/if}

  <!-- 마무리 CTA -->
  <section class="cta">
    <PawPrint size={44} strokeWidth={1.2} />
    <h2>이번 주말, 강아지와 강릉 어때요?</h2>
    <p>지도를 열고 함께 갈 수 있는 곳부터 찾아보세요.</p>
    <div class="cta-actions">
      <a class="cta-primary" href="/web/explore">지도에서 찾기<ArrowRight size={19} /></a>
      <a class="cta-secondary" href="/web/dog">우리 강아지 등록</a>
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
    background: var(--cream);
  }
  .section,
  .hero-inner,
  .stats,
  .landing-footer {
    width: min(1280px, calc(100% - 80px));
    margin-inline: auto;
  }

  /* ---------- 내비게이션 ---------- */
  .landing-nav {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 36px;
    height: 84px;
    padding: 0 40px;
    background: #fffffff2;
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    text-decoration: none;
    color: var(--crimson);
  }
  .nav-logo {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 15px;
    background: var(--crimson);
    color: #fff;
    transform: rotate(-6deg);
  }
  .nav-brand strong {
    font-size: 25px;
    letter-spacing: -1px;
  }
  .nav-links {
    display: flex;
    gap: 6px;
  }
  .nav-links a,
  .nav-mobile,
  .nav-account {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 16px;
    border-radius: 12px;
    color: var(--brown-warm);
    text-decoration: none;
    font-size: 16px;
    font-weight: 500;
    border: 0;
    background: none;
  }
  .nav-links a:hover,
  .nav-mobile:hover,
  .nav-account:hover {
    background: var(--sand);
  }
  .nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .nav-mobile {
    font-size: 14.5px;
    color: var(--muted);
  }
  .nav-cta {
    margin-left: 8px;
  }

  /* ---------- 히어로 ---------- */
  .hero {
    background:
      radial-gradient(circle at 85% 20%, #c0584a55 0, transparent 40%),
      linear-gradient(135deg, var(--crimson-deep) 0%, var(--crimson) 55%, #a8523c 100%);
    color: #fff;
    overflow: hidden;
  }
  .hero-inner {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    align-items: center;
    gap: 60px;
    padding: 96px 0 110px;
  }
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 15px;
    color: #ffe1cb;
    background: #ffffff1f;
    border: 1px solid #ffffff33;
    padding: 8px 15px;
    border-radius: 24px;
  }
  .hero h1 {
    font-size: clamp(42px, 4.4vw, 64px);
    line-height: 1.2;
    letter-spacing: -2.5px;
    margin: 26px 0 22px;
  }
  .hero-copy > p {
    font-size: 18px;
    line-height: 1.8;
    color: #ffffffd9;
    margin: 0 0 36px;
    word-break: keep-all;
  }
  .hero-search {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 620px;
    height: 70px;
    padding: 0 9px 0 22px;
    border-radius: 18px;
    background: #fff;
    color: var(--crimson);
    box-shadow: 0 20px 50px #3a0f1a4d;
  }
  .hero-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: none;
    font-size: 17px;
    color: var(--ink);
  }
  .hero-search .primary-button {
    min-height: 54px;
    padding: 0 26px;
    font-size: 16px;
  }
  .hero-actions {
    display: flex;
    gap: 22px;
    margin-top: 24px;
  }
  .hero-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #fff;
    font-size: 16px;
    text-decoration: none;
    border-bottom: 1px solid #ffffff66;
    padding-bottom: 3px;
  }
  .hero-link:hover {
    border-color: #fff;
  }
  .hero-visual {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .visual-card {
    width: min(440px, 100%);
    background: #fff;
    color: var(--ink);
    border-radius: 26px;
    padding: 28px;
    box-shadow: 0 30px 80px #2a0a1266;
    transform: rotate(2deg);
  }
  .visual-top {
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--crimson);
  }
  .visual-top > div {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .visual-top small {
    color: var(--muted);
    font-size: 13px;
  }
  .visual-top strong {
    color: var(--ink);
    font-size: 21px;
    letter-spacing: -0.6px;
  }
  .visual-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--crimson-soft);
  }
  .visual-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 20px 0 8px;
    padding: 13px 15px;
    border-radius: 12px;
    background: var(--cream);
    color: var(--crimson);
    font-size: 15px;
    font-weight: 600;
  }
  .visual-card ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .visual-card li {
    display: flex;
    gap: 12px;
    padding: 13px 0;
    border-bottom: 1px solid var(--line);
    font-size: 14.5px;
    line-height: 1.65;
    word-break: keep-all;
  }
  .visual-card li:last-child {
    border-bottom: 0;
  }
  .visual-card li span {
    color: var(--crimson);
    font-size: 12px;
    font-weight: 700;
    padding-top: 3px;
  }
  .visual-bubble {
    position: absolute;
    left: -10px;
    bottom: -26px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--gold);
    color: #3b2414;
    font-size: 15px;
    font-weight: 700;
    padding: 14px 20px;
    border-radius: 18px 18px 18px 4px;
    box-shadow: 0 14px 30px #2a0a1240;
    transform: rotate(-3deg);
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
    box-shadow: 0 18px 50px #4a302414;
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
    color: var(--crimson);
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
    background: var(--crimson-soft);
    color: var(--crimson);
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
    box-shadow: 0 16px 40px #4a30241a;
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
    background: #f7e5e0;
    color: #a34a4a;
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
    color: var(--crimson);
  }

  /* ---------- 이용 방법 ---------- */
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    counter-reset: step;
  }
  .steps li {
    position: relative;
    padding: 34px 32px;
    border-radius: 22px;
    background: #fff;
    border: 1px solid var(--line);
  }
  .step-number {
    font-size: 44px;
    font-weight: 800;
    color: var(--crimson-soft);
    -webkit-text-stroke: 1px var(--crimson);
    letter-spacing: -1px;
  }
  .steps h3 {
    font-size: 22px;
    margin: 14px 0 10px;
    letter-spacing: -0.7px;
  }
  .steps p {
    font-size: 16px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0 0 18px;
    word-break: keep-all;
  }
  .steps a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--crimson);
    text-decoration: none;
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
    box-shadow: 0 14px 36px #4a30241a;
  }
  .place-tile small {
    font-size: 13.5px;
    color: var(--crimson);
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
    color: var(--crimson);
  }

  /* ---------- CTA · 푸터 ---------- */
  .cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 96px 40px;
    background: linear-gradient(135deg, var(--brown-deep) 0%, var(--crimson-deep) 100%);
    color: #fff;
  }
  .cta h2 {
    font-size: 40px;
    letter-spacing: -1.5px;
    margin: 22px 0 12px;
  }
  .cta p {
    font-size: 18px;
    color: #ffffffcc;
    margin: 0 0 34px;
  }
  .cta-actions {
    display: flex;
    gap: 12px;
  }
  .cta-primary,
  .cta-secondary {
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
  .cta-primary {
    background: var(--gold);
    color: #3b2414;
  }
  .cta-primary:hover {
    background: #e6b574;
  }
  .cta-secondary {
    border: 1px solid #ffffff66;
    color: #fff;
  }
  .cta-secondary:hover {
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
    color: var(--crimson);
    text-decoration: none;
  }

  /* ---------- 좁은 화면 ---------- */
  @media (max-width: 1100px) {
    .hero-inner {
      grid-template-columns: 1fr;
    }
    .hero-visual {
      display: none;
    }
    .feature-grid,
    .steps,
    .place-grid {
      grid-template-columns: 1fr 1fr;
    }
    .category-grid,
    .stats {
      grid-template-columns: 1fr 1fr;
    }
    .nav-mobile {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .nav-links {
      display: none;
    }
    .feature-grid,
    .steps,
    .place-grid,
    .category-grid,
    .stats {
      grid-template-columns: 1fr;
    }
    .section,
    .hero-inner,
    .stats,
    .landing-footer {
      width: calc(100% - 32px);
    }
    .landing-footer {
      flex-direction: column;
    }
    .footer-links {
      align-items: flex-start;
    }
  }
</style>
