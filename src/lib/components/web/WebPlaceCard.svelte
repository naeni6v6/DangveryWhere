<script lang="ts">
  import { Heart, MapPin, ArrowUpRight } from '@lucide/svelte';
  import { placeArea, placeTheme, shortAddress, themeNames, type Place } from '$lib/domain/place';
  import ThemeIcon from './ThemeIcon.svelte';
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
  const theme = $derived(placeTheme(place));
  // 동물병원에는 동반 규정이 없어, 카드에 '동반 규정 확인'을 띄우면 거짓말이 됩니다.
  const isHospital = $derived(place.category === 'hospital');
  // 여러 지역을 함께 볼 수 있으니 시군구까지 붙여 보여 줍니다.
  const area = $derived(
    [placeArea(place).city, ...shortAddress(place).split(' ').slice(0, 2)].filter(Boolean).join(' ')
  );
</script>

<article class="web-card" class:chosen={selected} data-id={place.id}>
  <button
    class="card-main"
    onclick={onselect}
    aria-label={`${place.name} ${isHospital ? '정보 보기' : '동반 규정 보기'}`}
  >
    <span class="card-icon" aria-hidden="true"
      ><ThemeIcon {theme} size={28} strokeWidth={1.4} /></span
    >
    <span class="card-copy">
      <span class="card-eyebrow">{themeNames[theme]}</span>
      <strong>{place.name}</strong>
      <span class="card-area"><MapPin size={14} />{area}</span>
      <span class="card-pill" class:weight={place.sourceWeight !== null}
        >{isHospital
          ? '전화·길찾기'
          : place.sourceWeight
            ? `원본 제한 체중 ${place.sourceWeight}kg`
            : '동반 규정 확인'}<ArrowUpRight size={13} /></span
      >
    </span>
  </button>
  <button
    class="card-save icon-button"
    aria-label={`${place.name} ${saved ? '찜 해제' : '찜하기'}`}
    aria-pressed={saved}
    onclick={onsave}
    ><Heart size={21} strokeWidth={1.7} fill={saved ? 'currentColor' : 'none'} /></button
  >
</article>

<style>
  .web-card {
    position: relative;
    border: 1px solid transparent;
    border-bottom-color: var(--line);
    border-radius: 16px;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .web-card:hover {
    background: var(--cream);
    border-color: var(--line);
  }
  .web-card.chosen {
    background: var(--brand-soft);
    border-color: #e7c3c7;
  }
  .card-main {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 18px 54px 18px 14px;
    cursor: pointer;
  }
  /* 미니멀 라인형 — 옅은 원 안에 가는 선 아이콘.
     색을 채우지 않아 목록이 길어져도 시끄럽지 않고, 장소 이름이 먼저 읽힙니다. */
  .card-icon {
    width: 62px;
    height: 62px;
    flex-shrink: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--sand);
    color: var(--ink);
  }
  .web-card:hover .card-icon,
  .web-card.chosen .card-icon {
    background: var(--brand-soft);
    color: var(--brand-deep);
  }
  .card-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 5px;
  }
  .card-eyebrow {
    font-size: 13px;
    color: var(--muted);
  }
  .card-copy strong {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.35;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-area {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: var(--muted);
  }
  /* 채우지 않은 라인 알약. 카드 안에서 버튼처럼 보이되 색으로 튀지 않게. */
  .card-pill {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 7px;
    font-size: 13px;
    color: var(--brown-warm);
    background: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 14px;
    white-space: nowrap;
    transition:
      border-color 0.16s,
      color 0.16s;
  }
  .web-card:hover .card-pill,
  .web-card.chosen .card-pill {
    border-color: var(--brand);
    color: var(--brand);
  }
  /* 제한 체중이 적혀 있는 곳은 한 번 더 눈에 들어와야 해서 선을 진하게 둡니다. */
  .card-pill.weight {
    border-color: var(--brand);
    color: var(--brand);
    font-weight: 600;
  }
  .card-save {
    position: absolute;
    right: 10px;
    top: 14px;
    color: #b9a89d;
  }
  .card-save:hover,
  .card-save[aria-pressed='true'] {
    color: var(--brand);
  }
</style>
