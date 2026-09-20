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
  import { placeLink, placeLinkLabel } from '$lib/domain/placeLink';
  import { placePhotos } from '$lib/domain/placePhoto';
  import { photoCredit, providerInfo, providerOfUrl } from '$lib/domain/region';
  import { menuBoardOf } from '$lib/data/menuBoards';
  import MenuBoard from '$lib/components/MenuBoard.svelte';
  import PhotoGallery from './PhotoGallery.svelte';
  import ReadableText from './ReadableText.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  let {
    place,
    onclose,
    inline = false
  }: { place: Place; onclose: () => void; inline?: boolean } = $props();
  const titleId = $props.id();
  const store = getWebStore();
  const photos = $derived(placePhotos(place.id));
  const credit = $derived(photoCredit(photos));
  const link = $derived(placeLink(place));
  const phone = $derived(place.phone.replace(/[^0-9+]/g, ''));
  const lines = $derived(policyLines(place.policy));
  const menu = $derived(placeMenu(place.menu ?? '', menuBoardOf(place.id)));
  const notices = $derived(store.activeDogs.map((dog) => ({ dog, ...profileNotice(place, dog) })));
  const source = $derived(providerInfo[providerOfUrl(place.sourceUrl) ?? 'gangwon-pettravel']);
  let dialog = $state<HTMLDialogElement>();
  let sharing = $state(false);
  onMount(() => {
    if (!inline) dialog?.showModal();
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

{#snippet content()}
  {#if !inline}<div class="mobile-detail-handle" aria-hidden="true"></div>{/if}
  <header class="mobile-detail-header">
    <span>{themeNames[placeTheme(place)]}</span>
    <div>
      <button onclick={share} disabled={sharing} aria-label="장소 공유"><Share2 size={20} /></button
      >{#if !inline}<button onclick={onclose} aria-label="장소 상세 닫기"><X size={23} /></button
        >{/if}
    </div>
  </header>
  <div class="mobile-detail-content">
    <h2 id={titleId}>{place.name}</h2>
    <p class="address"><MapPin size={15} /><span>{place.address}</span></p>
    {#if photos.length}
      <PhotoGallery {photos} name={place.name} />
      {#if credit}<p class="credit">{credit}</p>{/if}
    {/if}
    {#if place.description}<section class="detail-about">
        <h3>이런 곳이에요</h3>
        <p class="description">{place.description}</p>
      </section>{/if}
    {#if place.hours}<p class="hours"><Clock3 size={17} /><span>{place.hours}</span></p>{/if}
    <section class="mobile-detail-section">
      <h3>
        <PawPrint size={19} />{place.category === 'hospital' ? '진료 전에' : '함께 가기 전에'}
      </h3>
      {#if place.category !== 'hospital'}{#each notices as notice}<div
            class="dog-notice"
            class:restricted={notice.kind === 'restricted'}
          >
            <strong>{notice.dog.name} · {notice.label}</strong>
            <p><ReadableText text={notice.detail} /></p>
          </div>{/each}
        {#if !store.dogs.length}<a href="/dog" class="register-dog"
            >우리 강아지를 등록하고 조건 비교하기 <ArrowUpRight size={16} /></a
          >{/if}{/if}
      {#if lines.length}<ul>
          {#each lines as line}<li>{line}</li>{/each}
        </ul>{:else}<p>
          <ReadableText
            text={place.category === 'hospital'
              ? '진료 시간과 진료 과목은 원본 데이터에 없어요. 방문 전 전화로 확인해 주세요.'
              : '상세 규정이 부족해요. 방문 전 시설에 문의해 주세요.'}
          />
        </p>{/if}
      <p class="policy-note">
        <Info size={15} /><span
          ><ReadableText
            text={`공공데이터에 등록된 안내예요. ${
              place.category === 'hospital'
                ? '진료 시간과 응급 여부는 전화로 확인해 주세요.'
                : '최근 운영 규정은 방문 전에 확인해 주세요.'
            }`}
          /></span
        >
      </p>
    </section>
    {#if place.category === 'food'}
      <section class="mobile-detail-section">
        <h3>대표 메뉴</h3>
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
      <p>{source.name}<br />데이터 수집 {place.importedAt} · 규정 확인일 미제공</p>
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
      >{placeLinkLabel(link)}<ArrowUpRight size={18} /></a
    >
  </footer>
{/snippet}

{#if inline}
  <section class="mobile-place-sheet inline" aria-labelledby={titleId}>{@render content()}</section>
{:else}
  <dialog
    class="mobile-place-sheet"
    bind:this={dialog}
    aria-labelledby={titleId}
    oncancel={(event) => {
      event.preventDefault();
      onclose();
    }}
    onclick={(event) => {
      if (event.target === dialog) onclose();
    }}
  >
    {@render content()}
  </dialog>
{/if}

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
  .mobile-place-sheet.inline {
    position: relative;
    inset: auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    max-height: none;
    width: 100%;
    margin: 0;
    border-radius: 0;
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
  .detail-about {
    margin-top: 22px;
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
  .inline .mobile-detail-footer {
    padding-bottom: 12px;
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
