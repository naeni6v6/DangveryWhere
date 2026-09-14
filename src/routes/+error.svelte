<script lang="ts">
  import { page } from '$app/state';
  import { PawPrint, ArrowLeft } from '@lucide/svelte';
</script>

<svelte:head><title>잠시만요 — 댕브리웨어</title></svelte:head>
<main class="error-page">
  <PawPrint size={45} strokeWidth={1} /><span>{page.status}</span>
  <h1>잠시 발걸음을 멈췄어요</h1>
  <p>{page.error?.message ?? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'}</p>
  <a class="primary-button" href="/"><ArrowLeft size={16} />장소 탐색으로 돌아가기</a>
</main>

<style>
  .error-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    text-align: center;
    background: var(--cream);
    color: var(--brown);
  }
  .error-page > span {
    margin-top: 20px;
    letter-spacing: 3px;
    font-size: 12px;
  }
  .error-page h1 {
    font-size: 26px;
    letter-spacing: -1px;
  }
  .error-page p {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.8;
    max-width: 400px;
    margin-bottom: 30px;
  }
</style>
