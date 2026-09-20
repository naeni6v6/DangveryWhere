<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { PawPrint, Map, Stamp, Heart, ArrowRight, ChevronLeft } from '@lucide/svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  let { enabled = true }: { enabled?: boolean } = $props();
  const store = getWebStore();
  const storageKey = 'dangverywhere-mobile-guide-v1';
  const steps = [
    {
      title: '우리 강아지부터 알려 주세요',
      label: '우리 강아지',
      icon: PawPrint,
      description:
        '우리 강아지 정보를 등록하면 장소마다 체중·체급 동반 조건과 비교해서 보여드려요.',
      hint: '프로필 등록부터 나만의 캐릭터 꾸미기까지'
    },
    {
      title: '함께 갈 매장을 찾아요',
      label: '매장 찾기',
      icon: Map,
      description:
        '지역과 카테고리를 고르고, 함께 갈 강아지를 선택해 보세요. 방문 전 동반 규정을 확인해 보세요.',
      hint: '카테고리는 양옆 화살표로 · 사진은 눌러서 크게'
    },
    {
      title: '여행을 댕스탬프로 남겨요',
      label: '댕스탬프',
      icon: Stamp,
      description:
        '강원 18개 시군구를 다녀올 때마다 스탬프를 하나씩 찍어요. 다녀온 시군구를 누르면 스탬프를 남길 수 있어요.',
      hint: '우리 강아지와 함께한 여행이 차곡차곡'
    },
    {
      title: '다음에 갈 곳은 찜해 두세요',
      label: '찜',
      icon: Heart,
      description:
        '지도에서 마음에 드는 곳의 하트를 눌러 보세요. 로그인하지 않아도 이 브라우저에 그대로 남아요.',
      hint: '모아둔 곳을 떠나기 전에 다시 확인하세요.'
    }
  ];
  let dialog: HTMLDialogElement;
  let ready = $state(false);
  let seen = $state(false);
  let index = $state(0);
  const current = $derived(steps[index]);
  const replay = $derived(page.url.searchParams.get('guide') === '1');

  onMount(() => {
    try {
      seen = localStorage.getItem(storageKey) === '1';
    } catch {
      /* The guide still works without storage. */
    }
    ready = true;
  });
  $effect(() => {
    if (ready && enabled && (replay || !seen) && !dialog.open) {
      index = 0;
      dialog.showModal();
    }
  });
  function finish(continueToApp = false) {
    seen = true;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* Remembered for this visit. */
    }
    if (replay) {
      const url = new URL(page.url);
      url.searchParams.delete('guide');
      replaceState(url, page.state);
    }
    dialog.close();
    if (continueToApp) void goto(store.dogs.length ? '/explore' : '/start');
  }
</script>

<dialog
  class="app-tutorial"
  bind:this={dialog}
  aria-labelledby="app-guide-title"
  oncancel={(event) => {
    event.preventDefault();
    finish();
  }}
>
  <header>
    <img src="/wordmark.png" alt="댕브리웨어" width="134" height="47" /><button
      onclick={() => finish()}>건너뛰기</button
    >
  </header>
  <div class="guide-body" aria-live="polite">
    <span class="guide-count">앱 사용법 · {index + 1} / {steps.length}</span>
    <div class="guide-illustration">
      <span><current.icon size={64} strokeWidth={1.4} /></span><strong>{current.label}</strong>
    </div>
    <h2 id="app-guide-title">{current.title}</h2>
    <p>{current.description}</p>
    <small>{current.hint}</small>
  </div>
  <div class="guide-dots" aria-label={`안내 ${index + 1} / ${steps.length}`}>
    {#each steps as step, position}<span class:active={position === index}></span>{/each}
  </div>
  <footer>
    {#if index > 0}<button class="guide-back" onclick={() => (index -= 1)} aria-label="이전 안내"
        ><ChevronLeft size={22} /></button
      >{/if}
    <button
      class="primary-button"
      onclick={() => (index < steps.length - 1 ? (index += 1) : finish(true))}
      >{index < steps.length - 1 ? '다음' : '시작하기'}<ArrowRight size={18} /></button
    >
  </footer>
</dialog>

<style>
  .app-tutorial {
    position: fixed;
    width: min(430px, calc(100% - 28px));
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: 26px;
    background: #fffdf9;
    color: var(--ink);
    overflow: auto;
  }
  .app-tutorial::backdrop {
    background: #30221980;
    backdrop-filter: blur(4px);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  header img {
    max-width: 55%;
    height: auto;
  }
  header button {
    min-height: 44px;
    background: none;
    border: 0;
    padding: 0 3px;
    color: var(--muted);
    font-size: 12px;
  }
  .guide-body {
    text-align: center;
  }
  .guide-count {
    display: block;
    font-size: 10px;
    color: var(--brand);
    margin: 18px 0;
  }
  .guide-illustration {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    min-height: 172px;
    border-radius: 25px;
    background: linear-gradient(145deg, #fcf4e8, #f1dfca);
    color: var(--brown-warm);
  }
  .guide-illustration > span {
    display: grid;
    place-items: center;
    width: 100px;
    height: 94px;
    border-radius: 36px;
    background: #fffcf5c9;
    box-shadow: 0 8px 19px #94623518;
  }
  .guide-illustration strong {
    font-size: 13px;
  }
  h2 {
    font-size: 23px;
    letter-spacing: -1px;
    line-height: 1.45;
    word-break: keep-all;
    margin: 24px 0 13px;
  }
  p {
    min-height: 72px;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.9;
    word-break: keep-all;
    margin: 0 0 12px;
  }
  small {
    display: block;
    font-size: 10px;
    line-height: 1.8;
    color: var(--brown-warm);
    word-break: keep-all;
  }
  .guide-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin: 24px 0 19px;
  }
  .guide-dots span {
    width: 6px;
    height: 6px;
    background: #e4d4c6;
    border-radius: 8px;
  }
  .guide-dots span.active {
    width: 21px;
    background: var(--brand);
  }
  footer {
    display: flex;
    gap: 9px;
  }
  .guide-back {
    display: grid;
    place-items: center;
    width: 48px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: #fff;
    color: var(--brown-warm);
  }
  .primary-button {
    flex: 1;
  }
  @media (max-height: 680px) {
    .guide-illustration {
      min-height: 120px;
      gap: 7px;
    }
    .guide-illustration > span {
      width: 70px;
      height: 66px;
    }
    .guide-illustration :global(svg) {
      width: 44px;
      height: 44px;
    }
    h2 {
      margin-top: 18px;
    }
    .guide-dots {
      margin-top: 15px;
    }
  }
</style>
