<script lang="ts">
  import { onMount } from 'svelte';
  import {
    X,
    Heart,
    Share2,
    MapPin,
    Phone,
    Clock3,
    PawPrint,
    ArrowUpRight,
    Info
  } from '@lucide/svelte';
  import {
    placeTheme,
    themeNames,
    policyLines,
    profileNotice,
    placeMenu,
    type Place
  } from '$lib/domain/place';
  import { placeLink } from '$lib/domain/placeLink';
  import { placePhotos } from '$lib/domain/placePhoto';
  import { photoCredit, providerInfo, providerOfUrl } from '$lib/domain/region';
  import { menuBoardOf } from '$lib/data/menuBoards';
  import MenuBoard from '$lib/components/MenuBoard.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  let { place, onclose }: { place: Place; onclose: () => void } = $props();
  const store = getWebStore();
  const photos = $derived(placePhotos(place.id));
  const credit = $derived(photoCredit(photos));
  const link = $derived(placeLink(place));
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
  const lines = $derived(policyLines(place.policy));
  const menu = $derived(placeMenu(place.menu ?? '', menuBoardOf(place.id)));
  const notices = $derived(store.activeDogs.map((dog) => ({ dog, ...profileNotice(place, dog) })));
  const source = $derived(providerInfo[providerOfUrl(place.sourceUrl) ?? 'gangwon-pettravel']);
  let dialog: HTMLDialogElement;
  let sharing = $state(false);
  onMount(() => {
    dialog.showModal();
  });
  async function share() {
    sharing = true;
    const url = new URL('/explore', window.location.origin);
    url.searchParams.set('region', 'all');
    url.searchParams.set('place', place.id);
    try {
      if (navigator.share)
        await navigator.share({ title: `${place.name} — 댕브리웨어`, url: url.href });
      else {
        await navigator.clipboard.writeText(url.href);
        store.notify('장소 링크를 복사했어요.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        store.notify('링크를 공유하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      sharing = false;
    }
  }
</script>

<dialog
  class="mobile-place-sheet"
  bind:this={dialog}
  aria-labelledby="mobile-place-title"
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  onclick={(event) => {
    if (event.target === dialog) onclose();
  }}
>
  <div class="mobile-detail-handle" aria-hidden="true"></div>
  <header class="mobile-detail-header">
    <span>{themeNames[placeTheme(place)]}</span>
    <div>
      <button onclick={share} disabled={sharing} aria-label="장소 공유"><Share2 size={20} /></button
      ><button onclick={onclose} aria-label="장소 상세 닫기"><X size={23} /></button>
    </div>
  </header>
  <div class="mobile-detail-content">
    <h2 id="mobile-place-title">{place.name}</h2>
    <p class="address"><MapPin size={15} />{place.address}</p>
    {#if photos.length}
      <div class="mobile-detail-photos" aria-label="장소 사진">
        {#each photos as photo, index}<a
            href={photo}
            target="_blank"
            rel="noreferrer"
            aria-label={`${place.name} 사진 ${index + 1} 크게 보기`}
            ><img src={photo} alt={`${place.name} 사진 ${index + 1}`} loading="lazy" /></a
          >{/each}
      </div>
      {#if credit}<p class="credit">{credit}</p>{/if}
    {/if}
    {#if place.description}<p class="description">{place.description}</p>{/if}
    {#if place.hours}<p class="hours"><Clock3 size={17} /><span>{place.hours}</span></p>{/if}
    {#if place.category !== 'hospital'}
      <section class="mobile-detail-section">
        <h3><PawPrint size={19} />함께 가기 전 확인해요</h3>
        {#each notices as notice}<div
            class="dog-notice"
            class:restricted={notice.kind === 'restricted'}
          >
            <strong>{notice.dog.name} · {notice.label}</strong>
            <p>{notice.detail}</p>
          </div>{/each}
        {#if !store.dogs.length}<a href="/dog" class="register-dog"
            >우리 강아지를 등록하고 조건 비교하기 <ArrowUpRight size={16} /></a
          >{/if}
        {#if lines.length}<ul>
            {#each lines as line}<li>{line}</li>{/each}
          </ul>{:else}<p>제공된 동반 규정이 없어요. 방문 전에 시설에 확인해 주세요.</p>{/if}
        <p class="policy-note">
          <Info size={15} />체중 조건만으로 입장이 보장되지는 않아요. 허용 구역과 준비물도 함께
          확인해 주세요.
        </p>
      </section>
    {/if}
    {#if place.category === 'food'}
      <section class="mobile-detail-section">
        <h3>메뉴·이용 안내</h3>
        <MenuBoard
          groups={menu.groups}
          notes={menu.notes}
          source={menu.source}
          emptyText="메뉴 정보는 시설에 확인해 주세요."
          compact
        />
      </section>
    {/if}
    <section class="mobile-detail-source">
      <h3>정보 출처</h3>
      <p>{source.name} · 수집 {place.importedAt}</p>
      <a href={place.sourceUrl} target="_blank" rel="noreferrer"
        >원본 정보 확인<ArrowUpRight size={14} /></a
      >
    </section>
  </div>
  <footer class="mobile-detail-footer">
    <button
      class:saved={store.isSaved(place.id)}
      class="mobile-detail-save"
      aria-label={store.isSaved(place.id) ? '찜 해제' : '찜하기'}
      aria-pressed={store.isSaved(place.id)}
      onclick={() => store.toggleSave(place)}
      ><Heart size={22} fill={store.isSaved(place.id) ? 'currentColor' : 'none'} /><span>찜</span
      ></button
    >
    {#if phone}<a
        class="mobile-detail-phone"
        href={`tel:${phone}`}
        aria-label={`${place.name} 전화하기`}><Phone size={21} /><span>전화</span></a
      >{/if}
    <a class="primary-button" href={link.url} target="_blank" rel="noreferrer"
      >상세 정보 확인<ArrowUpRight size={18} /></a
    >
  </footer>
</dialog>

<style>
  .mobile-place-sheet {
    position: fixed;
    inset: auto 0 0;
    width: min(100%, 480px);
    max-width: 100%;
    height: 90dvh;
    max-height: 90dvh;
    margin: auto auto 0;
    padding: 0;
    border: 0;
    border-radius: 26px 26px 0 0;
    color: var(--ink);
    background: #fff;
    overflow: hidden;
  }
  .mobile-place-sheet[open] {
    display: flex;
    flex-direction: column;
  }
  .mobile-place-sheet::backdrop {
    background: #30221966;
  }
  .mobile-detail-handle {
    display: block;
    padding: 0;
    min-height: 4px;
    width: 36px;
    height: 4px;
    border-radius: 5px;
    background: #ded5cb;
    margin: 10px auto 0;
    flex-shrink: 0;
  }
  .mobile-detail-header {
    padding: 4px 14px 0 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .mobile-detail-header > span {
    font-size: 12px;
    font-weight: 700;
    color: var(--brand);
  }
  .mobile-detail-header > div {
    display: flex;
  }
  .mobile-detail-header button {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: none;
    border: 0;
  }
  .mobile-detail-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 22px 20px;
  }
  h2 {
    margin: 4px 0 10px;
    font-size: 25px;
    letter-spacing: -1px;
  }
  .address {
    display: flex;
    gap: 5px;
    align-items: flex-start;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 20px;
  }
  .address :global(svg),
  .hours :global(svg),
  .policy-note :global(svg) {
    flex-shrink: 0;
  }
  .mobile-detail-photos {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border-radius: 16px;
  }
  .mobile-detail-photos a {
    width: 90%;
    flex-shrink: 0;
    scroll-snap-align: start;
    border-radius: 16px;
    overflow: hidden;
    background: var(--cream);
  }
  .mobile-detail-photos img {
    display: block;
    width: 100%;
    height: 210px;
    object-fit: contain;
  }
  .credit {
    font-size: 10px;
    color: var(--muted);
    margin: 7px 0;
  }
  .description {
    font-size: 14px;
    line-height: 1.85;
    white-space: pre-line;
  }
  .hours {
    display: flex;
    gap: 9px;
    font-size: 13px;
    line-height: 1.7;
    padding: 13px;
    background: var(--cream);
    border-radius: 12px;
  }
  .mobile-detail-section {
    margin-top: 25px;
    padding-top: 22px;
    border-top: 1px solid var(--line);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 16px;
    margin: 0 0 15px;
  }
  .dog-notice {
    background: #eff3e9;
    padding: 14px;
    border-radius: 12px;
    margin-bottom: 10px;
    font-size: 13px;
  }
  .dog-notice.restricted {
    background: #fff0e9;
    color: #984426;
  }
  .dog-notice p {
    font-size: 12px;
    margin: 7px 0 0;
    line-height: 1.65;
  }
  ul {
    padding-left: 20px;
  }
  li,
  .mobile-detail-section > p {
    font-size: 13px;
    line-height: 1.9;
    white-space: pre-line;
  }
  .register-dog {
    display: flex;
    gap: 5px;
    align-items: center;
    color: var(--brand-deep);
    font-size: 13px;
    margin-bottom: 18px;
  }
  .policy-note {
    display: flex;
    gap: 7px;
    align-items: flex-start;
    color: var(--muted);
    padding: 12px;
    border-radius: 10px;
    background: var(--cream);
    font-size: 11px !important;
  }
  .mobile-detail-source {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    color: var(--muted);
  }
  .mobile-detail-source h3 {
    font-size: 12px;
    margin-bottom: 8px;
  }
  .mobile-detail-source p,
  .mobile-detail-source a {
    font-size: 11px;
  }
  .mobile-detail-source a {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .mobile-detail-footer {
    flex-shrink: 0;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
  }
  .mobile-detail-save,
  .mobile-detail-phone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    background: none;
    text-decoration: none;
    min-width: 44px;
    min-height: 48px;
    font-size: 10px;
    color: var(--muted);
  }
  .mobile-detail-save.saved {
    color: var(--brand);
  }
  .mobile-detail-footer .primary-button {
    flex: 1;
    font-size: 14px;
    padding: 12px;
  }
</style>
