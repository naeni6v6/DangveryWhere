<script lang="ts">
  import { X } from '@lucide/svelte';

  /**
   * 소셜 로그인 창 (카카오 · 네이버 · 구글)
   *
   * 실제 연동을 붙일 때는 providers 의 href 만 채우면 됩니다.
   *  - 카카오: 이미 /auth/kakao 라우트가 있어요. (.env 의 KAKAO_REST_API_KEY 가 있으면 활성화)
   *  - 네이버: /auth/naver 라우트 + NAVER_LOGIN_CLIENT_ID / SECRET 을 추가하세요.
   *  - 구글:   /auth/google 라우트 + GOOGLE_CLIENT_ID / SECRET 을 추가하세요.
   * href 가 없으면 버튼을 눌렀을 때 '준비 중' 안내만 보여줘요.
   */
  let {
    kakaoEnabled = false,
    returnPath = '/',
    onpending
  }: {
    kakaoEnabled?: boolean;
    returnPath?: string;
    onpending?: (providerName: string) => void;
  } = $props();

  let dialog: HTMLDialogElement;

  export function open() {
    dialog?.showModal();
  }
  export function close() {
    dialog?.close();
  }

  type Provider = {
    id: 'kakao' | 'naver' | 'google';
    label: string;
    name: string;
    href: string | null;
  };
  const providers = $derived<Provider[]>([
    {
      id: 'kakao',
      name: '카카오',
      label: '카카오로 시작하기',
      href: kakaoEnabled ? `/auth/kakao?return=${encodeURIComponent(returnPath)}` : null
    },
    { id: 'naver', name: '네이버', label: '네이버로 시작하기', href: null },
    { id: 'google', name: '구글', label: '구글로 시작하기', href: null }
  ]);

  function pending(provider: Provider) {
    onpending?.(provider.name);
  }

  // 바깥(배경)을 누르면 닫혀요
  function onBackdrop(event: MouseEvent) {
    if (event.target === dialog) close();
  }
</script>

<dialog
  bind:this={dialog}
  class="app-dialog login-dialog"
  aria-labelledby="mobile-login-title"
  onclick={onBackdrop}
>
  <button class="login-close" aria-label="로그인 창 닫기" onclick={close}><X size={22} /></button>

  <h2 id="mobile-login-title">
    <img class="login-logo" src="/wordmark.png" alt="댕브리웨어" width="393" height="138" />
  </h2>
  <p class="login-sub">3초 만에 시작하고 강아지와 갈 곳을 찜해 보세요</p>

  <div class="login-buttons">
    {#each providers as provider (provider.id)}
      {#if provider.href}
        <a class={`login-button ${provider.id}`} href={provider.href}>
          {@render logo(provider.id)}<span>{provider.label}</span>
        </a>
      {:else}
        <button
          type="button"
          class={`login-button ${provider.id}`}
          onclick={() => pending(provider)}
        >
          {@render logo(provider.id)}<span>{provider.label}</span>
        </button>
      {/if}
    {/each}
  </div>

  <p class="login-foot">
    로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.<br />
    <em
      >* 카카오·네이버·구글 로그인이 연동될 예정이에요. 지금은 로그인 없이도 모든 장소를 볼 수
      있어요.</em
    >
  </p>
</dialog>

{#snippet logo(id: Provider['id'])}
  <span class="login-icon" aria-hidden="true">
    {#if id === 'kakao'}
      <svg viewBox="0 0 24 24" width="20" height="20"
        ><path
          fill="currentColor"
          d="M12 3.2c-5.3 0-9.6 3.4-9.6 7.6 0 2.7 1.8 5.1 4.5 6.4l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.4 0 .7.1 1.1.1 5.3 0 9.6-3.4 9.6-7.6S17.3 3.2 12 3.2Z"
        /></svg
      >
    {:else if id === 'naver'}
      <svg viewBox="0 0 24 24" width="16" height="16"
        ><path
          fill="currentColor"
          d="M15.6 12.8 8.1 2H2v20h6.4V11.2L15.9 22H22V2h-6.4v10.8Z"
        /></svg
      >
    {:else}
      <svg viewBox="0 0 24 24" width="21" height="21"
        ><path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z"
        /><path
          fill="#34A853"
          d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1C3.3 21.4 7.3 24 12 24Z"
        /><path
          fill="#FBBC05"
          d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1Z"
        /><path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.5l4 3.1c1-2.8 3.6-4.8 6.7-4.8Z"
        /></svg
      >
    {/if}
  </span>
{/snippet}

<style>
  .login-dialog {
    position: relative;
    width: 440px;
    max-width: calc(100% - 32px);
    padding: 40px 32px 28px !important;
    text-align: center;
  }
  .login-close {
    position: absolute;
    top: 14px;
    right: 14px;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .login-close:hover {
    background: var(--sand);
    color: var(--ink);
  }
  .login-logo {
    display: block;
    width: 160px;
    height: auto;
    margin: 0 auto 12px;
  }
  .login-dialog h2 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -1px;
    color: var(--ink);
  }
  .login-sub {
    margin: 10px 0 28px;
    font-size: 15px;
    color: var(--muted);
    word-break: keep-all;
  }
  .login-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .login-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 56px;
    border: 0;
    border-radius: 14px;
    font: inherit;
    font-size: 16.5px;
    font-weight: 700;
    letter-spacing: -0.3px;
    text-decoration: none;
    cursor: pointer;
    transition:
      filter 0.15s,
      transform 0.15s;
  }
  .login-button:hover {
    filter: brightness(0.96);
  }
  .login-button:active {
    transform: scale(0.99);
  }
  .login-button:focus-visible {
    outline: 3px solid var(--brand);
    outline-offset: 2px;
  }
  .login-icon {
    display: grid;
    place-items: center;
    width: 22px;
  }
  /* 각 서비스의 공식 브랜드 색 */
  .login-button.kakao {
    background: #fee500;
    color: #191600;
  }
  .login-button.naver {
    background: #03c75a;
    color: #fff;
  }
  .login-button.google {
    background: #fff;
    color: #1f1f1f;
    border: 1px solid #dadce0;
  }
  .login-foot {
    margin: 24px 0 0;
    font-size: 12.5px;
    line-height: 1.8;
    color: var(--muted);
    word-break: keep-all;
  }
  .login-foot em {
    font-style: normal;
    color: #b89f8e;
  }
</style>
