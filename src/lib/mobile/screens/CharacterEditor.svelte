<script lang="ts">
  let { basePath = '' }: { basePath?: string } = $props();
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    ChevronDown,
    Check,
    Map,
    PawPrint,
    RotateCcw,
    Sparkles,
    TriangleAlert,
    X
  } from '@lucide/svelte';
  import {
    DEFAULT_PARAMS,
    eyeShapes,
    furColors,
    sliders,
    traitLabels,
    type CharacterParams
  } from '$lib/domain/character';
  import { breedCharacterBase } from '$lib/domain/breedCharacter';
  import { findBreed } from '$lib/domain/breeds';
  import { josa } from '$lib/domain/korean';
  import { MASCOT_IMAGE, MASCOT_NAME } from '$lib/domain/mascot';
  import { shrinkDataUrl } from '$lib/character/image';
  import type { CharacterRenderer } from '$lib/character/renderer';
  import CharacterCanvas from '$lib/components/web/CharacterCanvas.svelte';
  import ReadableText from '$lib/components/mobile/ReadableText.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  const AFTER_TUTORIAL_PATH = $derived(`${basePath}/explore`);

  /**
   * 캐릭터 세부 꾸미기.
   *
   * 예전에는 사진 한 장을 올리면 AI 가 견종을 알아맞혀 캐릭터를 그려 주는 화면이었는데,
   * 사진만 보고 견종을 맞히는 정확도가 너무 낮아 사진 업로드를 걷어 냈습니다.
   * 지금은 프로필에 적어 둔 견종의 캐릭터를 밑그림으로 놓고, 그 위에서 눈·귀·얼굴 크기와
   * 털 색을 우리 아이에 가깝게 맞추는 화면이에요. 모두 브라우저에서 바로 그리므로
   * 기다릴 것도, 부를 서버도 없습니다.
   *
   * 모바일 튜토리얼(/start) 마지막 단계와 [우리 강아지](/dog) 에서 들어옵니다.
   * 어느 강아지의 캐릭터인지는 ?dog=<id> 로 받고, 없으면 지금 기준인 아이로 둡니다.
   */
  const store = getWebStore();
  type Stage = 'customize' | 'done';
  const steps = ['꾸미기', '완료'] as const;
  const stageIndex: Record<Stage, number> = { customize: 0, done: 1 };

  let stage = $state<Stage>('customize');
  let direction = $state(1);
  const dog = $derived(
    store.dogs.find((item) => item.id === page.url.searchParams.get('dog')) ?? store.dog
  );
  const dogName = $derived(dog?.name ?? '우리 강아지');

  /** 프로필 견종. 목록에 없는 견종(믹스·직접 입력)이면 undefined 입니다. */
  const profileBreed = $derived(findBreed(dog?.breed ?? ''));
  /** 밑그림 한 벌 — 그림 주소·부위 위치·그림 본래의 털 색·기본 특징. */
  const base = $derived(breedCharacterBase(profileBreed, dog?.breed));

  let renderer = $state<CharacterRenderer | null>(null);
  let canvas = $state<CharacterCanvas>();
  let error = $state('');
  let saving = $state(false);
  let saved = $state<{ finalImage: string; local: boolean } | null>(null);

  /**
   * 같은 아이의 캐릭터를 다시 열면 저장한 조절값으로 이어서 꾸밉니다.
   * 프로필 견종이 바뀌었으면 새 밑그림의 기본값을 사용합니다.
   */
  let params = $state<CharacterParams>({ ...DEFAULT_PARAMS });
  let paramsFor = '';
  $effect(() => {
    const key = `${dog?.id ?? ''}:${base.key}`;
    if (paramsFor === key) return;
    paramsFor = key;
    const previous = store.characterFor(dog?.id);
    const sameBreed =
      previous?.traits.breedKey === base.traits.breedKey &&
      previous?.traits.breedGuess === base.traits.breedGuess;
    params = {
      ...DEFAULT_PARAMS,
      furColor: base.baseColor,
      ...(sameBreed ? previous?.params : {})
    };
  });

  const changed = $derived(
    sliders.some((slider) => params[slider.key] !== 1) ||
      params.eyeShape !== 'basic' ||
      params.furColor !== base.baseColor
  );
  /** 귀를 키울 때 어디를 붙잡고 늘릴지. 쫑긋한 귀는 아래를, 늘어진 귀는 위를 붙잡습니다. */
  const earAnchor = $derived(
    base.traits.earType === 'upright' || base.traits.earType === 'semi'
      ? 'bottom'
      : base.traits.earType === 'floppy'
        ? 'top'
        : 'center'
  );
  const traitChips = $derived(
    [
      base.traits.breedGuess,
      `${furColors.find((color) => color.key === base.traits.coatColor)?.label ?? ''} 털`,
      traitLabels.furTexture[base.traits.furTexture],
      traitLabels.earType[base.traits.earType],
      traitLabels.muzzle[base.traits.muzzle],
      traitLabels.tail[base.traits.tail]
    ].filter(Boolean)
  );

  const bubble = $derived.by(() => {
    if (stage === 'done')
      return `${dogName}의 캐릭터가 완성됐어요! 앞으로 우리 강아지 화면에서 이 모습으로 만날 수 있어요.`;
    if (!profileBreed)
      return `프로필 견종에 맞는 캐릭터가 아직 없어서 기본 캐릭터로 시작할게요. 눈·귀·털 색을 ${dogName}${josa(dogName, '와/과')} 가깝게 맞춰 주세요!`;
    return `${base.traits.breedGuess} 캐릭터를 밑그림으로 놓았어요. 슬라이더를 움직이면 바로 바뀌니, ${dogName}${josa(dogName, '와/과')} 닮게 다듬어 주세요!`;
  });

  function go(to: Stage) {
    direction = stageIndex[to] >= stageIndex[stage] ? 1 : -1;
    stage = to;
  }

  function resetParams() {
    params = { ...DEFAULT_PARAMS, furColor: base.baseColor };
  }

  /** [이 캐릭터로 완성]: 지금 모습을 그림으로 굳혀 저장합니다. */
  async function finish() {
    if (!canvas?.isReady() || saving) return;
    saving = true;
    error = '';
    try {
      const finalImage = canvas.exportImage(640);
      if (!finalImage)
        throw new Error('캐릭터 그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      // 밑그림도 함께 남겨 둡니다. 나중에 같은 캐릭터를 다시 꾸밀 때 쓸 수 있어요.
      const characterImage = await shrinkDataUrl(base.image, 768, 'image/webp', 0.9);
      const result = await store.applyCharacter({
        dogId: dog?.id ?? null,
        characterImage,
        finalImage,
        traits: base.traits,
        layout: renderer?.layout ??
          base.layout ?? {
            head: { x: 0.4, y: 0.1, w: 0.5, h: 0.4 },
            body: { x: 0.1, y: 0.4, w: 0.6, h: 0.5 },
            eyeLeft: null,
            eyeRight: null,
            nose: null,
            earLeft: null,
            earRight: null,
            tail: null
          },
        params,
        expression: 'smile'
      });
      if (!result) return;
      saved = { finalImage: result.finalImage, local: !store.loggedIn };
      go('done');
    } catch (failure) {
      error = failure instanceof Error ? failure.message : '저장하지 못했어요.';
      console.error('[character] save failed', failure);
    } finally {
      saving = false;
    }
  }

  function toMap() {
    store.mode = 'dog';
    store.hideKnownMismatch = true;
    goto(AFTER_TUTORIAL_PATH);
  }
  /** 튜토리얼에서 왔는지 우리 강아지에서 왔는지 모르니, 왔던 길로 되돌려 보냅니다. */
  function back() {
    if (typeof history !== 'undefined' && history.length > 1) history.back();
    else goto(`${basePath}/dog`);
  }
</script>

<svelte:head>
  <title>캐릭터 세부 꾸미기 — 댕브리웨어</title>
</svelte:head>

<div class="tutorial">
  <div class="tutorial-bar">
    <a class="bar-brand" href={basePath || '/mobile'}>
      <img class="bar-logo" src="/logo.png" alt="" width="34" height="34" />
      <!-- 헤더(+layout.svelte)·메인·튜토리얼과 같은 글자 로고 1번 시안, 같은 높이(46px)로 -->
      <img class="bar-wordmark" src="/wordmark.png" alt="댕브리웨어" width="393" height="138" />
    </a>
    <a class="bar-skip" href={stage === 'done' ? `${basePath}/dog` : AFTER_TUTORIAL_PATH}
      >{stage === 'done' ? '우리 강아지로' : '나중에 할게요'}</a
    >
  </div>

  <div class="card" class:wide={stage === 'customize'}>
    <header class="card-head">
      <span class="eyebrow">
        <!-- 블록 첫머리의 공백은 컴파일할 때 잘려 나가서, 가운뎃점 앞 한 칸까지 문자열로 넣습니다 -->
        캐릭터 세부 꾸미기{#if stage === 'done'}{' · 완료'}{:else}{` · ${stageIndex[stage] + 1} / ${steps.length}`}{/if}
      </span>
      <h1>
        {#if stage === 'customize'}{dogName} 캐릭터 꾸미기{:else}{dogName} 캐릭터 완성!{/if}
      </h1>
      <p class="lead">
        {#if stage === 'customize'}
          <ReadableText
            text="견종 캐릭터를 밑그림으로 놓고 눈·귀·얼굴 크기와 털 색을 맞춥니다. 원래 모습에서 너무 멀어지지 않게 범위를 정해 두었어요."
          />
        {:else}
          <ReadableText
            text={saved?.local
              ? '이 캐릭터는 이 브라우저에 저장했어요. 로그인 후 만든 캐릭터는 계정에 저장돼요.'
              : '계정에 저장했어요. 다른 기기에서도 같은 캐릭터를 볼 수 있어요.'}
          />
        {/if}
      </p>
      <ol
        class="progress"
        aria-label={`진행 상황: ${stageIndex[stage] + 1} / ${steps.length} 단계`}
      >
        {#each steps as label, index (label)}
          <li
            class:done={index <= stageIndex[stage]}
            aria-current={index === stageIndex[stage] ? 'step' : undefined}
          >
            <span class="sr-only">{label}</span>
          </li>
        {/each}
      </ol>
    </header>

    {#key stage}
      <div class="card-body" in:fly={{ x: 28 * direction, duration: 260 }}>
        <div class="guide">
          <img
            class="mascot mascot-small"
            src={MASCOT_IMAGE}
            alt={`마스코트 ${MASCOT_NAME}`}
            draggable="false"
          />
          <p class="speech"><ReadableText text={bubble} /></p>
        </div>

        {#if error}
          <div class="error" role="alert">
            <TriangleAlert size={18} /><span><ReadableText text={error} /></span>
            <button type="button" class="error-close" aria-label="닫기" onclick={() => (error = '')}
              ><X size={16} /></button
            >
          </div>
        {/if}

        {#if stage === 'customize'}
          <!-- STEP 1. 꾸미기: 왼쪽 캐릭터 · 오른쪽 옵션 -->
          <div class="customize">
            <div class="custom-stage">
              <div class="custom-figure">
                <CharacterCanvas
                  bind:this={canvas}
                  src={base.image}
                  layout={base.layout}
                  originalColor={base.baseColor}
                  {earAnchor}
                  {params}
                  alt={`${dogName} 캐릭터 미리보기`}
                  onready={(ready) => (renderer = ready)}
                  onerror={() =>
                    (error = '캐릭터 그림을 불러오지 못했어요. 잠시 후 다시 열어 주세요.')}
                />
              </div>
              <div class="custom-stage-foot">
                <span class="stage-badge"><Sparkles size={13} />실시간 미리보기</span>
                <button type="button" class="link-button" disabled={!changed} onclick={resetParams}
                  ><RotateCcw size={14} />처음 모습으로</button
                >
              </div>
              <details class="trait-card">
                <summary class="trait-label">
                  <PawPrint size={16} aria-hidden="true" />
                  <span>밑그림으로 쓴 캐릭터</span>
                  <ChevronDown size={19} class="trait-chevron" aria-hidden="true" />
                </summary>
                <ul class="chips">
                  {#each traitChips as chip (chip)}<li>{chip}</li>{/each}
                </ul>
                <p class="trait-note">
                  {#if profileBreed}
                    <ReadableText
                      text={`프로필에 적어 둔 견종(${dog?.breed})의 캐릭터예요. 견종을 바꾸려면 우리 강아지 화면에서 고쳐 주세요.`}
                    />
                  {:else}
                    아직 {dog?.breed ?? '이 견종'} 캐릭터가 없어서 기본 캐릭터로 시작해요.
                  {/if}
                </p>
              </details>
            </div>

            <div class="options">
              {#each ['얼굴', '몸'] as group (group)}
                <section class="option-group">
                  <h2>{group}</h2>
                  {#each sliders.filter((s) => s.group === group) as slider (slider.key)}
                    <label class="slider">
                      <span class="slider-label"
                        >{slider.label}<em>{Math.round(params[slider.key] * 100)}%</em></span
                      >
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        bind:value={params[slider.key]}
                      />
                      <span class="slider-ends"><small>작게</small><small>크게</small></span>
                    </label>
                  {/each}
                  {#if group === '얼굴'}
                    <div class="presets">
                      <span class="preset-label">눈 모양</span>
                      <div class="segmented" role="radiogroup" aria-label="눈 모양">
                        {#each eyeShapes as shape (shape.key)}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={params.eyeShape === shape.key}
                            class:on={params.eyeShape === shape.key}
                            onclick={() => (params.eyeShape = shape.key)}>{shape.label}</button
                          >
                        {/each}
                      </div>
                    </div>
                  {/if}
                </section>
              {/each}
              <section class="option-group">
                <h2>털 색상</h2>
                <div class="swatches" role="radiogroup" aria-label="털 색상">
                  {#each furColors as color (color.key)}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={params.furColor === color.key}
                      class="swatch"
                      class:on={params.furColor === color.key}
                      style:--swatch={color.hex}
                      onclick={() => (params.furColor = color.key)}
                    >
                      <span class="swatch-dot"
                        >{#if params.furColor === color.key}<Check
                            size={14}
                            strokeWidth={3}
                          />{/if}</span
                      >
                      <span
                        >{color.label}{#if base.baseColor === color.key}<small>원래 색</small
                          >{/if}</span
                      >
                    </button>
                  {/each}
                </div>
              </section>
            </div>
          </div>
        {:else}
          <!-- STEP 2. 완료 -->
          <div class="done-card">
            <div class="done-figure">
              {#if saved}<img
                  src={saved.finalImage}
                  alt={`${dogName} 캐릭터`}
                  draggable="false"
                />{/if}
            </div>
            <div class="done-copy">
              <strong>{dogName}</strong>
              <span
                >{base.traits.breedGuess} · {furColors.find((c) => c.key === params.furColor)
                  ?.label ?? ''} 털</span
              >
              <small
                >우리 강아지 화면과 앞으로 나올 여행 기록에서 이 캐릭터를 다시 쓸 수 있어요.</small
              >
            </div>
          </div>
        {/if}
      </div>
    {/key}

    <footer class="card-foot">
      {#if stage === 'done'}
        <a class="btn-back" href={`${basePath}/dog`}><PawPrint size={17} />우리 강아지</a>
        <button type="button" class="btn-next finish" onclick={toMap}
          ><Map size={19} />지도 찾기</button
        >
      {:else}
        <button type="button" class="btn-back" onclick={back} disabled={saving}>
          <ArrowLeft size={17} />돌아가기
        </button>
        <button
          type="button"
          class="btn-next finish"
          disabled={saving || !renderer}
          onclick={finish}
        >
          <Check size={19} strokeWidth={2.5} />{saving ? '저장하는 중…' : '이 캐릭터로 완성'}
        </button>
      {/if}
    </footer>
  </div>
</div>

<style>
  /* ---------- 튜토리얼과 같은 뼈대 (src/routes/web/start/+page.svelte 참고) ---------- */
  .tutorial {
    min-height: calc(100dvh / var(--ui-zoom, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px 56px;
    background: #fff;
    color: var(--ink);
  }
  .tutorial-bar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px clamp(4px, 2vw, 20px);
  }
  .bar-brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
  }
  .bar-logo {
    flex-shrink: 0;
    transform: rotate(-8deg);
    filter: drop-shadow(0 4px 8px #b5704e40);
  }
  /* 글자 로고는 높이만 정하고 너비는 비율대로. 다른 화면과 같은 46px 입니다. */
  .bar-wordmark {
    flex-shrink: 0;
    height: 46px;
    width: auto;
  }
  .bar-skip {
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14.5px;
    color: var(--muted);
    text-decoration: none;
  }
  .bar-skip:hover {
    background: var(--sand);
    color: var(--brand);
  }
  .card {
    width: min(620px, 100%);
    margin: clamp(8px, 4vh, 40px) auto 0;
    display: flex;
    flex-direction: column;
    padding: 44px 44px 36px;
    border: 1px solid var(--line);
    border-radius: 30px;
    background: #fff;
    box-shadow: 0 24px 60px #4a342812;
    transition: width 0.35s ease;
  }
  .card.wide {
    width: min(1060px, 100%);
  }
  .card-head {
    margin-bottom: 26px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--brand);
  }
  .card-head h1 {
    margin: 12px 0 0;
    font-size: 30px;
    letter-spacing: -1.2px;
    line-height: 1.25;
  }
  .lead {
    margin: 10px 0 0;
    font-size: 14.5px;
    color: var(--muted);
    word-break: keep-all;
  }
  .progress {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    list-style: none;
    margin: 26px 0 0;
    padding: 0;
  }
  .progress li {
    height: 5px;
    border-radius: 999px;
    background: var(--line);
    transition: background 0.3s;
  }
  .progress li.done {
    background: var(--brand);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .card-body {
    flex: 1;
    min-height: 300px;
    display: flex;
    flex-direction: column;
  }
  .mascot {
    mix-blend-mode: multiply;
    user-select: none;
  }
  .guide {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
  }
  .mascot-small {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    object-fit: contain;
    transform: scaleX(-1);
  }
  .speech {
    position: relative;
    flex: 1;
    margin: 0;
    padding: 13px 16px;
    border-radius: 18px;
    background: var(--brand-tint);
    border: 1px solid var(--brand-soft);
    font-size: 14.5px;
    line-height: 1.65;
    color: var(--brown-warm);
    word-break: keep-all;
  }
  .speech::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    width: 14px;
    height: 14px;
    background: inherit;
    border-left: 1px solid var(--brand-soft);
    border-bottom: 1px solid var(--brand-soft);
    transform: translateY(-50%) rotate(45deg);
  }
  .error {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #fdeeee;
    border: 1px solid #f3c9c9;
    color: #a03b3b;
    font-size: 14px;
    line-height: 1.5;
  }
  .error span {
    flex: 1;
  }
  .error-close {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  /* ---------- 1. 꾸미기 ---------- */
  .link-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 6px 4px;
    border: 0;
    background: none;
    color: var(--brand);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .link-button:disabled {
    color: var(--muted);
    cursor: default;
  }
  /* 밑그림으로 쓴 견종 캐릭터가 어떤 아이인지 알려 주는 카드 */
  .trait-card {
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--cream);
  }
  .trait-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--brand);
    min-height: 48px;
    cursor: pointer;
    list-style: none;
  }
  .trait-label::-webkit-details-marker {
    display: none;
  }
  .trait-label > span {
    flex: 1;
  }
  .trait-label :global(.trait-chevron) {
    transition: transform 180ms ease;
  }
  .trait-card[open] .trait-label :global(.trait-chevron) {
    transform: rotate(180deg);
  }
  .trait-card[open] {
    padding-bottom: 16px;
  }
  .trait-card[open] .trait-note {
    margin-top: 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .chips li {
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--sand);
    color: var(--brown-warm);
    font-size: 13px;
    font-weight: 600;
  }
  .trait-note {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--muted);
    word-break: keep-all;
  }
  .customize {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 26px;
  }
  .custom-stage {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .custom-figure {
    position: relative;
    padding: 14px;
    border-radius: 24px;
    background:
      radial-gradient(120% 70% at 50% 8%, #fff 0%, transparent 60%),
      linear-gradient(170deg, var(--brand-tint) 0%, var(--brand-soft) 100%);
    box-shadow: inset 0 0 0 1px var(--line);
    overflow: hidden;
  }
  .custom-stage-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--brand-tint);
    color: var(--brand);
    font-size: 12.5px;
    font-weight: 700;
  }
  .segmented {
    display: flex;
    padding: 3px;
    border-radius: 12px;
    background: var(--sand);
  }
  .segmented button {
    flex: 1;
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--brown-warm);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .segmented button.on {
    background: #fff;
    color: var(--brand);
    box-shadow: 0 2px 6px #4a342820;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-height: 640px;
    overflow: auto;
    padding-right: 6px;
  }
  .option-group h2 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--brand);
  }
  .slider {
    display: block;
    padding: 8px 0;
  }
  .slider-label {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
  }
  .slider-label em {
    font-style: normal;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    font-weight: 500;
  }
  .slider input {
    width: 100%;
    margin: 8px 0 2px;
    accent-color: var(--brand);
    cursor: pointer;
  }
  .slider-ends {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--muted);
  }
  .presets {
    margin-top: 6px;
  }
  .preset-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .swatch:hover {
    border-color: var(--brand);
  }
  .swatch.on {
    border-color: var(--brand);
    background: var(--brand-tint);
    box-shadow: 0 0 0 2px #b5704e33;
  }
  .swatch > span:last-child {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .swatch small {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
  }
  .swatch-dot {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--swatch);
    color: #fff;
    box-shadow: inset 0 0 0 1px #00000014;
  }
  .swatch[style*='#f5f0e6'] .swatch-dot,
  .swatch[style*='#f0e0c2'] .swatch-dot {
    color: var(--brand);
  }

  /* ---------- 2. 완료 ---------- */
  .done-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 22px 24px;
    border: 1px solid var(--line);
    border-radius: 22px;
    background: linear-gradient(160deg, #fff 0%, var(--brand-tint) 100%);
  }
  .done-figure {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 170px;
    height: 170px;
  }
  .done-figure img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: 50% 92%;
    animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .done-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .done-copy strong {
    font-size: 26px;
    letter-spacing: -0.8px;
  }
  .done-copy span {
    font-size: 15px;
    color: var(--brown-warm);
  }
  .done-copy small {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
    word-break: keep-all;
  }

  /* ---------- 아래 버튼 ---------- */
  .card-foot {
    display: flex;
    gap: 10px;
    margin-top: 30px;
  }
  .btn-back,
  .btn-next {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 60px;
    border-radius: 16px;
    font: inherit;
    font-size: 17px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.16s,
      color 0.16s,
      border-color 0.16s;
  }
  .btn-back {
    flex: 0 0 auto;
    padding: 0 26px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--brown-warm);
  }
  .btn-back:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
  }
  .btn-next {
    flex: 1;
    padding: 0 26px;
    border: 0;
    background: var(--brand);
    color: #fff;
  }
  .btn-next:hover:not(:disabled) {
    background: var(--brand-deep);
  }
  .btn-next:disabled,
  .btn-back:disabled {
    cursor: default;
  }
  .btn-next:disabled {
    background: #ded4cb;
    color: #fff;
  }
  .btn-back:disabled {
    opacity: 0.5;
  }
  .btn-next.finish:not(:disabled) {
    background: linear-gradient(160deg, #c8825c 0%, var(--brand) 48%, var(--brand-deep) 100%);
    box-shadow: 0 10px 24px #b5704e40;
  }

  @media (max-width: 900px) {
    .customize {
      grid-template-columns: 1fr;
    }
    .options {
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }
  }
  @media (max-width: 640px) {
    .tutorial {
      padding-inline: 0;
    }
    .card,
    .card.wide {
      width: 100%;
      margin-top: 0;
      padding: 28px 22px 24px;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .swatches {
      grid-template-columns: repeat(2, 1fr);
    }
    .done-card {
      flex-direction: column;
      text-align: center;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .done-figure img {
      animation: none;
    }
  }
</style>
