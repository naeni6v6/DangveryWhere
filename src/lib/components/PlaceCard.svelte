<script lang="ts">
  import {
    ArrowUpRight,
    Coffee,
    House,
    Trees,
    Sparkles,
    Heart,
    MapPin,
    Landmark,
    ShoppingBag
  } from '@lucide/svelte';
  import { categoryNames, placeArea, shortAddress, type Place } from '$lib/domain/place';
  let {
    place,
    selected = false,
    saved = false,
    onselect,
    onsave
  }: {
    place: Place;
    selected?: boolean;
    saved?: boolean;
    onselect: () => void;
    onsave: () => void;
  } = $props();
  // hospital 은 웹(PC) 전용 분류라 이 화면에는 오지 않지만, 타입을 채워 둡니다.
  const icons = {
    food: Coffee,
    stay: House,
    outdoor: Trees,
    activity: Sparkles,
    hospital: MapPin,
    culture: Landmark,
    shopping: ShoppingBag
  };
  const Icon = $derived(icons[place.category]);
  // 전국을 함께 볼 수 있어서 시군구는 남깁니다. 시도만 떼고 동네 두 마디까지 보여 줘요.
  const area = $derived(
    [placeArea(place).city, ...shortAddress(place).split(' ').slice(0, 2)].filter(Boolean).join(' ')
  );
</script>

<article class:chosen={selected} class="place-card">
  <button class="place-main" onclick={onselect} aria-label={`${place.name} 동반 규정 보기`}>
    <!-- 목록은 아이콘만. 실제 사진은 상세에서 봅니다. -->
    <div class="category-art {place.category}" aria-hidden="true">
      <div class="art-halo"></div>
      <Icon size={32} strokeWidth={1.35} /><span>{placeArea(place).city || 'DANGVERYWHERE'}</span>
    </div>
    <div class="place-copy">
      <span class="eyebrow">{categoryNames[place.category]}</span>
      <h3>{place.name}</h3>
      <p class="place-address"><MapPin size={12} />{area}</p>
      <span class="rule-pill"
        >{place.sourceWeight
          ? `원본 제한 체중 ${place.sourceWeight}kg`
          : '동반 규정 확인'}<ArrowUpRight size={12} /></span
      >
    </div>
  </button>
  <button
    class="save-button icon-button"
    aria-label={`${place.name} ${saved ? '찜 해제' : '찜하기'}`}
    aria-pressed={saved}
    onclick={onsave}
    ><Heart size={18} strokeWidth={1.6} fill={saved ? 'currentColor' : 'none'} /></button
  >
</article>

<style>
  .place-card {
    position: relative;
    border-bottom: 1px solid var(--line);
    padding: 18px 4px;
    transition: background 0.18s;
  }
  .place-card.chosen {
    background: var(--cream);
    border-radius: 14px;
    border-color: transparent;
    padding-left: 10px;
    padding-right: 10px;
  }
  .place-main {
    display: flex;
    text-align: left;
    gap: 16px;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .category-art {
    width: 96px;
    height: 110px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #eee8de;
    border-radius: 12px;
    color: #816951;
    position: relative;
    overflow: hidden;
  }
  .art-halo {
    position: absolute;
    width: 90px;
    height: 90px;
    border: 1px solid #ffffff90;
    border-radius: 50%;
    left: 30px;
    top: -30px;
  }
  .category-art::after {
    content: '';
    position: absolute;
    width: 70px;
    height: 70px;
    border: 1px solid #ffffff90;
    border-radius: 50%;
    left: -30px;
    bottom: -24px;
  }
  .category-art span {
    font-size: 7px;
    letter-spacing: 2px;
    margin-top: 12px;
  }
  .category-art.stay {
    background: #eae3dc;
    color: #8c6b58;
  }
  .category-art.outdoor {
    background: #e6ece1;
    color: #718164;
  }
  .category-art.activity {
    background: #ece8df;
    color: #9a8659;
  }
  .category-art.shopping {
    background: #eee4e4;
    color: #946d6d;
  }
  .place-copy {
    min-width: 0;
    flex: 1;
    padding: 2px 22px 0 0;
  }
  .eyebrow {
    font-size: 10px;
    color: var(--muted);
  }
  h3 {
    font-size: 16px;
    letter-spacing: -0.5px;
    margin: 6px 0 7px;
    font-weight: 650;
    line-height: 1.35;
  }
  .place-address {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
    font-size: 11px;
    margin: 0 0 12px;
    line-height: 1.4;
  }
  .rule-pill {
    font-size: 10px;
    color: var(--brown);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f4eee7;
    border-radius: 5px;
    padding: 5px 7px;
    white-space: nowrap;
  }
  .save-button {
    position: absolute;
    right: 7px;
    top: 19px;
    color: #a4998e;
    width: 30px;
    height: 30px;
  }
  .save-button:hover {
    color: var(--brown);
  }
</style>
