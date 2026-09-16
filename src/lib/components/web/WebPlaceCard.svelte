<script lang="ts">
  import { Coffee, House, Trees, Sparkles, Heart, MapPin, ArrowUpRight } from '@lucide/svelte';
  import { categoryNames, type Place } from '$lib/domain/place';
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
  const icons = { food: Coffee, stay: House, outdoor: Trees, activity: Sparkles };
  const Icon = $derived(icons[place.category]);
  const area = $derived(
    place.address
      .replace(/^강원(?:특별자치도|도)?\s*/, '')
      .replace(/^강릉시\s*/, '')
      .split(' ')
      .slice(0, 2)
      .join(' ')
  );
</script>

<article class="web-card" class:chosen={selected} data-id={place.id}>
  <button class="card-main" onclick={onselect} aria-label={`${place.name} 동반 규정 보기`}>
    <span class="card-icon {place.category}" aria-hidden="true"
      ><Icon size={28} strokeWidth={1.6} /></span
    >
    <span class="card-copy">
      <span class="card-eyebrow">{categoryNames[place.category]}</span>
      <strong>{place.name}</strong>
      <span class="card-area"><MapPin size={14} />{area}</span>
      <span class="card-pill" class:weight={place.sourceWeight !== null}
        >{place.sourceWeight
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
  .card-icon {
    width: 66px;
    height: 66px;
    flex-shrink: 0;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: var(--sand);
    color: var(--brown-warm);
  }
  .card-icon.food {
    background: #f7e5e0;
    color: #a34a4a;
  }
  .card-icon.stay {
    background: #f1e6dc;
    color: #8a5a3c;
  }
  .card-icon.outdoor {
    background: #e9eddf;
    color: #6f7f5b;
  }
  .card-icon.activity {
    background: #f6ecd9;
    color: #a4783c;
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
  .card-pill {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    font-size: 13px;
    color: var(--brand);
    background: #fff;
    border: 1px solid #efd6d9;
    border-radius: 8px;
    padding: 5px 10px;
    white-space: nowrap;
  }
  .card-pill.weight {
    background: var(--brand);
    border-color: var(--brand);
    color: #fff;
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
