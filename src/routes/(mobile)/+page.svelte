<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    Search,
    ArrowUpRight,
    ChevronRight,
    MapPin,
    PawPrint,
    Stamp,
    Heart
  } from '@lucide/svelte';
  import ThemeIcon from '$lib/components/web/ThemeIcon.svelte';
  import MobilePlaceCard from '$lib/components/mobile/MobilePlaceCard.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import { photoFirst } from '$lib/domain/placePhoto';
  import { directLinkFirst } from '$lib/domain/placeLink';
  import { MASCOT_IMAGE } from '$lib/domain/mascot';
  import { breedImage, findBreed, MYSTERY_IMAGE } from '$lib/domain/breeds';
  import { type Theme, type Place } from '$lib/domain/place';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const store = getWebStore();
  const region = $derived(data.regions.find((item) => item.id === data.regionId)!);
  const suggestions = $derived(
    photoFirst(directLinkFirst(data.places.filter((place) => place.category !== 'hospital'))).slice(
      0,
      4
    )
  );
  const dogPhoto = $derived(
    store.dog
      ? (store.characterFor(store.dog.id)?.finalImage ??
          (findBreed(store.dog.breed) ? breedImage(findBreed(store.dog.breed)!) : MYSTERY_IMAGE))
      : MASCOT_IMAGE
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
  function search(event: SubmitEvent) {
    event.preventDefault();
    goto('/explore');
  }
  function openPlace(place: Place) {
    goto(`/explore?region=${data.regionId}&place=${encodeURIComponent(place.id)}`);
  }
</script>

<svelte:head
  ><title>댕브리웨어 — 강아지와 함께 떠나요</title><meta
    name="description"
    content="반려견과 함께 갈 장소를 찾고, 동반 규정을 확인하고, 우리만의 여행 기록을 모아요."
  /></svelte:head
>
<div class="mobile-home">
  <section class="home-hero">
    <div class="hero-copy">
      <span class="home-eyebrow">EVERYWHERE, TOGETHER</span>
      <h1>오늘도 너와<br />함께라서 좋아.</h1>
      <p>발길 닿는 곳마다, 우리만의 여행.</p>
      <a href={store.dogs.length ? '/explore' : '/start'}
        >{store.dogs.length ? '함께 갈 곳 찾기' : '우리의 여행 시작하기'}<ArrowUpRight
          size={17}
        /></a
      >
    </div>
    <img src={MASCOT_IMAGE} alt="인사하는 댕브리" fetchpriority="high" width="170" height="190" />
  </section>
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
  <a class="home-dog" href="/dog"
    ><img src={dogPhoto} alt="" width="84" height="84" />
    <div>
      <small>MY LITTLE COMPANION</small><strong
        >{store.dog ? `${store.dogNames}와 떠나는 여행` : '우리 강아지를 소개해 주세요'}</strong
      >
      <p>{store.dog ? '프로필과 캐릭터를 만나보세요' : '체중·체급에 맞춰 장소를 확인해요'}</p>
    </div>
    <ChevronRight size={19} /></a
  >
  <section class="home-section home-places">
    <div class="section-title">
      <div>
        <span class="section-location"><MapPin size={12} />{region.label}</span>
        <h2>함께 가볼 만한 곳</h2>
      </div>
      <a href="/explore">지도 보기<ChevronRight size={14} /></a>
    </div>
    {#each suggestions as place (place.id)}<MobilePlaceCard
        {place}
        onselect={() => openPlace(place)}
      />{/each}
    <p class="home-data-note">
      공공데이터의 동반 정보를 모았어요. 방문 전 규정을 다시 확인해 주세요.
    </p>
  </section>
  <section class="home-shortcuts">
    <a href="/record"
      ><Stamp size={25} /><strong>발도장 모으기</strong><span
        >우리의 여행을 기록해요<ChevronRight size={13} /></span
      ></a
    ><a href="/favorites"
      ><Heart size={25} /><strong>다음에 함께 갈 곳</strong><span
        >찜한 장소 {store.savedIds.length}곳<ChevronRight size={13} /></span
      ></a
    >
  </section>
  <footer class="mobile-home-footer">
    <PawPrint size={18} /><span>함께라서 더 좋은 모든 곳, 댕브리웨어</span><a href="/web"
      >PC 웹으로 보기 <ArrowUpRight size={13} /></a
    >
  </footer>
</div>

<style>
  .mobile-home {
    padding: 8px 20px 145px;
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
  .home-hero > img {
    position: absolute;
    width: 47%;
    height: auto;
    right: -7px;
    bottom: 16px;
    transform: rotate(6deg);
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
    mix-blend-mode: multiply;
    width: 75px;
    height: 82px;
  }
  .home-dog div {
    flex: 1;
    min-width: 0;
  }
  .home-dog small {
    font-size: 8px;
    letter-spacing: 1px;
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
    background: #f5f3ed;
    border-radius: 17px;
    color: var(--brown-warm);
  }
  .home-shortcuts a:last-child {
    background: #f9eee8;
  }
  .home-shortcuts strong {
    font-size: 13px;
    color: var(--ink);
    margin-top: 4px;
  }
  .home-shortcuts span {
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
</style>
