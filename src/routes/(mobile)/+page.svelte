<script lang="ts">
  import { goto } from '$app/navigation';
  import { Search, ArrowUpRight, ChevronRight, MapPin, PawPrint, Heart } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import MobilePlaceCard from '$lib/components/mobile/MobilePlaceCard.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import { photoFirst } from '$lib/domain/placePhoto';
  import { directLinkFirst } from '$lib/domain/placeLink';
  import { breedCutout, findBreed, MYSTERY_IMAGE } from '$lib/domain/breeds';
  import { placeTheme, type Theme, type Place } from '$lib/domain/place';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  const region = $derived(data.regions.find((item) => item.id === data.regionId)!);
  const dogBreed = $derived(findBreed(store.dog?.breed ?? ''));
  const dogPhoto = $derived(
    store.dog
      ? (store.characterFor(store.dog.id)?.finalImage ??
          (dogBreed ? breedCutout(dogBreed) : MYSTERY_IMAGE))
      : MYSTERY_IMAGE
  );
  const themes: { id: Theme; label: string }[] = [
    { id: 'cafe', label: '카페' },
    { id: 'restaurant', label: '식당' },
    { id: 'stay', label: '숙소' },
    { id: 'outdoor', label: '관광·산책' },
    { id: 'activity', label: '체험' },
    { id: 'culture', label: '문화시설' },
    { id: 'shopping', label: '쇼핑' },
    { id: 'hospital', label: '동물병원' }
  ];
  const suggestions = $derived.by(() => {
    const ranked = photoFirst(directLinkFirst(data.places));
    // 현재 지역에 있는 유형마다 한 곳씩. 사진과 직접 연결되는 업소 정보가 있는 곳을 우선합니다.
    return themes.flatMap((theme) => {
      const place = ranked.find((item) => placeTheme(item) === theme.id);
      return place ? [place] : [];
    });
  });
  function search(event: SubmitEvent) {
    event.preventDefault();
    goto('/explore');
  }
  function openPlace(place: Place) {
    goto(`/explore?region=${data.regionId}&place=${encodeURIComponent(place.id)}`);
  }
</script>

<svelte:head
  ><title>댕브리웨어 — 강아지와 함께, 헛걸음 없이</title><meta
    name="description"
    content="반려견과 함께 갈 장소를 찾고, 동반 규정을 확인하고, 우리만의 여행 기록을 모아요."
  /></svelte:head
>
<div class="mobile-home">
  <section class="home-hero">
    <div class="hero-copy">
      <span class="home-eyebrow">EVERYWHERE, TOGETHER</span>
      <h1>강아지와 함께,<br />헛걸음 없이</h1>
      <p>반려견 동반 장소의 출입 규정을 한곳에 모았어요.</p>
      <a href={store.dogs.length ? '/explore' : '/start'}>시작하기<ArrowUpRight size={17} /></a>
    </div>
    <div class="hero-dog">
      <img
        src={dogPhoto}
        alt={store.dog ? `${store.dog.name}의 캐릭터` : '등록을 기다리는 강아지 캐릭터'}
        fetchpriority="high"
        width="180"
        height="180"
      />
      <span>{store.dog ? store.dog.name : '우리 강아지를 만나볼까요?'}</span>
    </div>
  </section>
  {#if !store.dog}<p class="home-start-hint">강아지 등록부터 차근차근 시작해요.</p>{/if}
  <form class="home-search" role="search" onsubmit={search}>
    <Search size={20} /><input
      aria-label="장소 검색"
      placeholder="우리 어디로 떠나볼까?"
      bind:value={store.query}
    /><button type="submit" aria-label="검색하기"><ChevronRight size={21} /></button>
  </form>
  <section class="home-section">
    <div class="section-title">
      <h2>어떤 하루를 보낼까?</h2>
      <a href="/explore">전체 보기<ChevronRight size={14} /></a>
    </div>
    <div class="home-themes">
      {#each themes as theme}<a href={`/explore?category=${theme.id}`}
          ><span><ThemeIcon theme={theme.id} size={24} /></span>{theme.label}</a
        >{/each}
    </div>
  </section>
  {#if store.dog}<a class="home-dog" href="/dog"
      ><img src={dogPhoto} alt="" width="84" height="84" />
      <div>
        <small
          >{store.dog.name}{store.dogs.length > 1 ? ` 외 ${store.dogs.length - 1}마리` : ''}</small
        >
        <strong>우리 강아지 관리</strong>
        <p>프로필 수정 · 캐릭터 꾸미기</p>
      </div>
      <ChevronRight size={19} /></a
    >{/if}
  <section class="home-section home-places">
    <div class="section-title">
      <div>
        <span class="section-location"><MapPin size={12} />{region.label}</span>
        <h2>함께 가볼 만한 곳</h2>
      </div>
      <a href="/explore">지도 보기<ChevronRight size={14} /></a>
    </div>
    <p class="home-places-intro">카테고리별로 한 곳씩 둘러보세요.</p>
    {#each suggestions as place (place.id)}<MobilePlaceCard
        {place}
        onselect={() => openPlace(place)}
      />{/each}
    <p class="home-data-note">
      공공데이터의 동반 정보를 모았어요. 방문 전 규정을 다시 확인해 주세요.
    </p>
  </section>
  <section class="home-shortcuts">
    <a class="shortcut-record" href="/record"
      ><span class="shortcut-icon" aria-hidden="true"
        ><PawPrint size={27} fill="currentColor" strokeWidth={1.5} /></span
      ><strong>발도장 모으기</strong><span class="shortcut-description"
        >우리의 여행을 기록해요<ChevronRight size={13} /></span
      ></a
    ><a class="shortcut-favorites" href="/favorites"
      ><span class="shortcut-icon" aria-hidden="true"
        ><Heart size={26} fill="currentColor" strokeWidth={1.5} /></span
      ><strong>다음에 함께 갈 곳</strong><span class="shortcut-description"
        >찜한 장소 {store.savedIds.length}곳<ChevronRight size={13} /></span
      ></a
    >
  </section>
  <footer class="mobile-home-footer">
    <img src="/wordmark.png" alt="댕브리웨어" width="112" height="39" /><span
      >DangveryWhere · 반려견 동반 지도</span
    >
    <a href="/?guide=1">앱 사용법 다시 보기</a><a href="/web"
      >PC 웹으로 보기 <ArrowUpRight size={13} /></a
    >
  </footer>
</div>

<style>
  .mobile-home {
    padding: 8px 20px 24px;
  }
  .home-hero {
    display: flex;
    position: relative;
    align-items: center;
    background: #f7e9d8;
    min-height: 230px;
    border-radius: 23px;
    padding: 25px 21px;
    overflow: hidden;
  }
  .hero-copy {
    position: relative;
    z-index: 1;
  }
  .home-eyebrow {
    display: block;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: #a77451;
  }
  h1 {
    font-size: clamp(25px, 7vw, 30px);
    line-height: 1.4;
    letter-spacing: -1.5px;
    margin: 13px 0 10px;
  }
  .hero-copy p {
    font-size: 10px;
    color: #8c705b;
    max-width: 150px;
    line-height: 1.7;
  }
  .hero-copy a {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    margin-top: 8px;
    padding: 11px 13px;
    border-radius: 10px;
    text-decoration: none;
    font-size: 11px;
    color: #fff;
    background: #a36746;
  }
  .hero-dog {
    position: absolute;
    width: 45%;
    right: 12px;
    bottom: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .hero-dog img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
    filter: drop-shadow(0 8px 7px #8f60321a);
  }
  .hero-dog > span {
    max-width: 100%;
    margin-top: -3px;
    padding: 5px 9px;
    border: 1px solid #e9d4bd;
    border-radius: 30px;
    background: #fffaf3cc;
    color: #84634d;
    font-size: 10px;
    line-height: 1.4;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .home-start-hint {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 11px;
    text-align: center;
  }
  .home-search {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 10px 0 16px;
    height: 52px;
    border-radius: 14px;
    border: 1px solid var(--line);
    margin-top: 17px;
    background: #fff;
    color: var(--brown-warm);
  }
  .home-search input {
    width: 0;
    flex: 1;
    border: 0;
    outline: none;
    background: none;
    font-size: 14px;
  }
  .home-search button {
    display: grid;
    place-items: center;
    border: 0;
    background: none;
    width: 44px;
    height: 44px;
  }
  .home-section {
    margin-top: 29px;
  }
  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 18px;
    letter-spacing: -0.6px;
    margin: 0;
  }
  .section-title > a {
    display: flex;
    align-items: center;
    font-size: 11px;
    text-decoration: none;
    color: var(--muted);
    min-height: 44px;
  }
  .home-themes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 19px 10px;
    margin-top: 14px;
  }
  .home-themes a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    font-size: 11px;
  }
  .home-themes a > span {
    display: grid;
    place-items: center;
    height: 55px;
    width: 55px;
    background: var(--cream);
    border-radius: 18px;
  }
  .home-dog {
    margin-top: 31px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #eadccc;
    background: #fcf7ef;
    border-radius: 19px;
    padding: 10px;
    text-decoration: none;
  }
  .home-dog img {
    object-fit: contain;
    width: 75px;
    height: 82px;
  }
  .home-dog div {
    flex: 1;
    min-width: 0;
  }
  .home-dog small {
    font-size: 11px;
    color: var(--brand);
  }
  .home-dog strong {
    display: block;
    font-size: 14px;
    margin: 7px 0;
    letter-spacing: -0.4px;
  }
  .home-dog p {
    font-size: 11px;
    margin: 0;
    color: var(--muted);
  }
  .section-location {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--brand);
    font-size: 10px;
    margin-bottom: 5px;
  }
  .home-data-note {
    color: var(--muted);
    font-size: 10px;
    line-height: 1.7;
  }
  .home-places-intro {
    margin: 7px 0 0;
    color: var(--muted);
    font-size: 11px;
  }
  .home-shortcuts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 28px;
  }
  .home-shortcuts a {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-decoration: none;
    gap: 8px;
    padding: 19px 14px;
    background: linear-gradient(145deg, #fbf5e9, #f1e4ce);
    border: 1px solid #ece0cd;
    border-radius: 22px;
    box-shadow: 0 5px 14px #8157350a;
    color: var(--brown-warm);
  }
  .home-shortcuts .shortcut-favorites {
    background: linear-gradient(145deg, #fff5ee, #f3dfd3);
    border-color: #eddbcf;
  }
  .shortcut-icon {
    display: grid;
    place-items: center;
    width: 66px;
    height: 46px;
    border: 1px solid #fff9ec;
    border-radius: 999px;
    background: linear-gradient(145deg, #fffaf0, #e6cba4);
    box-shadow:
      0 5px 10px #92673b1f,
      inset 0 1px 1px #ffffffb3;
    color: #a27248;
  }
  .shortcut-favorites .shortcut-icon {
    background: linear-gradient(145deg, #fff9f3, #e9ba9f);
    border-color: #fff8f2;
    color: #ae6548;
  }
  .home-shortcuts strong {
    font-size: 13px;
    color: var(--ink);
    margin-top: 4px;
  }
  .shortcut-description {
    display: flex;
    align-items: center;
    font-size: 10px;
  }
  .mobile-home-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 10px;
    margin-top: 35px;
  }
  .mobile-home-footer a {
    display: flex;
    align-items: center;
    gap: 3px;
    min-height: 35px;
    text-decoration: none;
  }
  @media (max-width: 359px) {
    h1 {
      font-size: 23px;
    }
    .hero-copy p {
      font-size: 9px;
      max-width: 128px;
    }
    .hero-dog {
      width: 42%;
    }
  }
</style>
