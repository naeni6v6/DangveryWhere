<script lang="ts">
  import { tick } from 'svelte';
  import { Eye, EyeOff, LoaderCircle, X } from '@lucide/svelte';
  import { getWebStore, type Account } from '$lib/web/store.svelte';
  import {
    normalizeNickname,
    normalizeUsername,
    passwordIsValid,
    PASSWORD_HINT,
    USERNAME_HINT
  } from '$lib/domain/credentials';

  let {
    authEnabled = false,
    kakaoEnabled = false,
    returnPath = '/',
    variant = 'mobile'
  }: {
    authEnabled?: boolean;
    kakaoEnabled?: boolean;
    returnPath?: string;
    variant?: 'mobile' | 'web';
  } = $props();

  let dialog: HTMLDialogElement;
  const store = getWebStore();
  let usernameInput: HTMLInputElement;
  let mode = $state<'login' | 'signup'>('login');
  let username = $state('');
  let nickname = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
  let showPassword = $state(false);
  let busy = $state(false);
  let message = $state('');
  const titleId = $derived(`${variant}-account-title`);
  const signup = $derived(mode === 'signup');

  function clearPasswords() {
    password = '';
    passwordConfirm = '';
    showPassword = false;
  }

  export async function open() {
    mode = 'login';
    message = '';
    clearPasswords();
    dialog?.showModal();
    await tick();
    usernameInput?.focus();
  }

  export function close() {
    if (!busy) dialog?.close();
  }

  async function switchMode() {
    mode = signup ? 'login' : 'signup';
    message = '';
    clearPasswords();
    await tick();
    usernameInput?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !authEnabled) return;
    message = '';
    const normalized = normalizeUsername(username);
    if (!normalized) {
      message = '아이디는 영문, 숫자, 밑줄(_)로 4~24자 입력해 주세요.';
      return;
    }
    if (!passwordIsValid(password)) {
      message = '비밀번호는 영문과 숫자를 포함해 8자 이상, 72바이트 이하로 입력해 주세요.';
      return;
    }
    if (signup && !normalizeNickname(nickname)) {
      message = '닉네임은 1~20자로 입력해 주세요.';
      return;
    }
    if (signup && password !== passwordConfirm) {
      message = '비밀번호가 서로 일치하지 않아요.';
      return;
    }
    busy = true;
    try {
      const response = await fetch(`/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalized,
          password,
          ...(signup ? { nickname: nickname.trim(), passwordConfirm } : {})
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        message = result?.message ?? '로그인을 완료하지 못했어요. 다시 시도해 주세요.';
        return;
      }
      if (!result?.user || !Array.isArray(result.dogs) || !Array.isArray(result.favorites)) {
        message = '계정 정보를 확인하지 못했어요. 다시 시도해 주세요.';
        return;
      }
      clearPasswords();
      store.completeLogin(result as Account, signup);
      dialog.close();
    } catch {
      message = '연결을 확인한 뒤 다시 시도해 주세요.';
    } finally {
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="app-dialog login-dialog"
  aria-labelledby={titleId}
  onclick={(event) => {
    if (event.target === dialog) close();
  }}
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
  onclose={clearPasswords}
>
  <button
    class="login-close"
    type="button"
    aria-label="로그인 창 닫기"
    disabled={busy}
    onclick={close}
  >
    <X size={22} />
  </button>
  <img class="login-logo" src="/wordmark.png" alt="댕브리웨어" width="393" height="138" />
  <h2 id={titleId}>{signup ? '회원가입' : '로그인'}</h2>
  <p class="login-sub">
    {signup
      ? '내 계정을 만들고 반려견과의 여행을 준비하세요.'
      : '내 계정에 저장한 강아지와 찜 목록을 만나보세요.'}
  </p>

  <form onsubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy || !authEnabled}>
      <label>
        <span>아이디</span>
        <input
          bind:this={usernameInput}
          bind:value={username}
          name="username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
          minlength="4"
          maxlength="24"
          placeholder="아이디를 입력해 주세요"
          aria-describedby={signup ? `${variant}-username-hint` : undefined}
        />
        {#if signup}<small id={`${variant}-username-hint`}>{USERNAME_HINT}</small>{/if}
      </label>
      {#if signup}
        <label>
          <span>닉네임</span>
          <input
            bind:value={nickname}
            name="nickname"
            autocomplete="nickname"
            required
            maxlength="20"
            placeholder="사용할 이름을 입력해 주세요"
          />
        </label>
      {/if}
      <label>
        <span>비밀번호</span>
        <span class="password-field">
          <input
            bind:value={password}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autocomplete={signup ? 'new-password' : 'current-password'}
            required
            minlength="8"
            maxlength="72"
            placeholder="비밀번호를 입력해 주세요"
            aria-describedby={signup ? `${variant}-password-hint` : undefined}
          />
          <button
            type="button"
            class="password-toggle"
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={showPassword}
            onclick={() => (showPassword = !showPassword)}
          >
            {#if showPassword}<EyeOff size={19} />{:else}<Eye size={19} />{/if}
          </button>
        </span>
        {#if signup}<small id={`${variant}-password-hint`}>{PASSWORD_HINT}</small>{/if}
      </label>
      {#if signup}
        <label>
          <span>비밀번호 확인</span>
          <input
            bind:value={passwordConfirm}
            name="passwordConfirm"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="72"
            placeholder="비밀번호를 한 번 더 입력해 주세요"
          />
        </label>
      {/if}
    </fieldset>
    {#if message}<p class="form-error" role="alert">{message}</p>{/if}
    {#if !authEnabled}<p class="form-error" role="status">
        계정 연결을 준비 중이에요. 잠시 후 다시 이용해 주세요.
      </p>{/if}
    <button class="submit-button" type="submit" disabled={busy || !authEnabled}>
      {#if busy}<LoaderCircle class="login-spinner" size={19} aria-hidden="true" />{/if}
      {busy
        ? signup
          ? '계정을 만드는 중…'
          : '로그인 중…'
        : signup
          ? '회원가입하고 시작하기'
          : '로그인'}
    </button>
  </form>

  <p class="account-switch">
    {signup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}
    <button type="button" disabled={busy} onclick={switchMode}
      >{signup ? '로그인' : '회원가입'}</button
    >
  </p>
  {#if kakaoEnabled && !signup}
    <a class="kakao-button" href={`/auth/kakao?return=${encodeURIComponent(returnPath)}`}
      >카카오로 로그인</a
    >
  {/if}
  <button class="continue-button" type="button" disabled={busy} onclick={close}
    >로그인 없이 둘러보기</button
  >
</dialog>

<style>
  .login-dialog {
    position: fixed;
    width: 440px;
    max-width: calc(100% - 32px);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 32px 28px 24px !important;
    text-align: center;
  }
  .login-close {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
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
    width: 144px;
    height: auto;
    margin: 0 auto 12px;
  }
  h2 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.8px;
    color: var(--ink);
  }
  .login-sub {
    margin: 8px 0 24px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--muted);
    word-break: keep-all;
  }
  fieldset {
    display: grid;
    gap: 16px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    text-align: left;
  }
  label {
    display: grid;
    gap: 7px;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
  input {
    width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 11px 13px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: white;
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    font-weight: 400;
  }
  small {
    font-size: 14px;
    line-height: 1.5;
    font-weight: 400;
    color: var(--muted);
    word-break: keep-all;
  }
  .password-field {
    position: relative;
    display: block;
  }
  .password-field input {
    padding-right: 48px;
  }
  .password-toggle {
    position: absolute;
    top: 2px;
    right: 2px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .form-error {
    margin: 14px 0 0;
    padding: 11px 12px;
    border-radius: 10px;
    background: #fff1ee;
    color: #963b2a;
    text-align: left;
    font-size: 14px;
    line-height: 1.6;
    word-break: keep-all;
  }
  .submit-button,
  .kakao-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 50px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }
  .submit-button {
    gap: 8px;
    margin-top: 22px;
    background: var(--brand-deep, #684332);
    color: white;
  }
  .submit-button:hover {
    filter: brightness(1.1);
  }
  :global(.login-spinner) {
    animation: login-spin 0.8s linear infinite;
  }
  @keyframes login-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.login-spinner) {
      animation: none;
    }
  }
  .account-switch {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 5px;
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .account-switch button,
  .continue-button {
    min-height: 44px;
    padding: 8px;
    border: 0;
    background: none;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .account-switch button {
    font-weight: 700;
    color: var(--brand-deep, #684332);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .kakao-button {
    margin-top: 12px;
    color: #191600;
    background: #fee500;
  }
  .continue-button {
    color: var(--muted);
  }
  button:disabled,
  fieldset:disabled {
    cursor: default;
    opacity: 0.65;
  }
  input:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--brand);
    outline-offset: 2px;
  }
  @media (max-width: 420px) {
    .login-dialog {
      padding: 28px 20px 18px !important;
    }
  }
</style>
