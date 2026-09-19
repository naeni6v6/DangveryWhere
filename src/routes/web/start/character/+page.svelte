<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    ArrowRight,
    Camera,
    Check,
    ImagePlus,
    Map,
    PawPrint,
    RefreshCw,
    RotateCcw,
    Sparkles,
    TriangleAlert,
    Wand2,
    X
  } from '@lucide/svelte';
  import {
    DEFAULT_PARAMS,
    eyeShapes,
    expressions,
    furColors,
    sliders,
    traitLabels,
    type CharacterLayout,
    type CharacterParams,
    type DogTraits,
    type Expression,
    type FurColorKey
  } from '$lib/domain/character';
  import { josa } from '$lib/domain/korean';
  import { MASCOT_IMAGE, MASCOT_NAME } from '$lib/domain/mascot';
  import {
    guessCoatColor,
    prepareDogPhoto,
    shrinkDataUrl,
    UploadError
  } from '$lib/character/upload';
  import type { CharacterRenderer } from '$lib/character/renderer';
  import CharacterCanvas from '$lib/components/web/CharacterCanvas.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import { AFTER_TUTORIAL_PATH } from '$lib/web/onboarding';

  /**
   * 내 강아지 캐릭터 만들기.
   * 튜토리얼(/web/start) 마지막 단계에서 이어지는 화면으로, 같은 카드 레이아웃을 씁니다.
   *   사진 올리기 → AI 생성(분석 → 그림) → 결과 → 꾸미기(슬라이더·색은 브라우저에서 즉시,
   *   표정은 AI 재생성) → 완성(저장)
   * 어느 강아지의 캐릭터인지는 ?dog=<id> 로 받고, 없으면 지금 기준인 아이로 둡니다.
   */
  const store = getWebStore();
  type Stage = 'upload' | 'working' | 'result' | 'customize' | 'done';
  const steps = ['사진', '생성', '꾸미기', '완료'] as const;
  const stageIndex: Record<Stage, number> = {
    upload: 0,
    working: 1,
    result: 1,
    customize: 2,
    done: 3
  };

  let stage = $state<Stage>('upload');
  let direction = $state(1);
  const dog = $derived(
    store.dogs.find((item) => item.id === page.url.searchParams.get('dog')) ?? store.dog
  );
  const dogName = $derived(dog?.name ?? '우리 강아지');

  // 사진
  let photo = $state('');
  let fileInput = $state<HTMLInputElement>();
  let dragging = $state(false);
  let uploadError = $state('');
  let reading = $state(false);

  // 생성
  let traits = $state<DogTraits | null>(null);
  let characterImage = $state('');
  let layout = $state<CharacterLayout | null>(null);
  /** 받은 그림 자체의 털 색. 이 프리셋을 고르면 원본 그대로예요. */
  let baseColor = $state<FurColorKey>('cream');
  let expression = $state<Expression>('smile');
  let mock = $state(false);
  let provider = $state('');
  let phase = $state(0);
  let phaseTimer: ReturnType<typeof setInterval> | undefined;
  let error = $state('');
  let regenerating = $state(false);

  // 꾸미기
  let params = $state<CharacterParams>({ ...DEFAULT_PARAMS });
  let nextExpression = $state<Expression>('smile');
  let canvas = $state<CharacterCanvas>();
  let renderer = $state<CharacterRenderer | null>(null);
  let saving = $state(false);
  let saved = $state<{ finalImage: string; local: boolean } | null>(null);

  const phases = $derived([
    { text: `${dogName}의 특징을 살펴보고 있어요...`, hint: '털 색, 귀 모양, 얼굴형을 읽는 중' },
    {
      text: `${dogName}${josa(dogName, '을/를')} 귀여운 캐릭터로 만드는 중이에요 🐾`,
      hint: '댕브리 친구들과 같은 그림체로 그리는 중'
    },
    { text: '캐릭터를 완성하고 있어요...', hint: '눈·귀·꼬리 위치를 잡는 중' }
  ]);
  const earAnchor = $derived(
    traits?.earType === 'upright' || traits?.earType === 'semi'
      ? 'bottom'
      : traits?.earType === 'floppy'
        ? 'top'
        : 'center'
  );
  const changed = $derived(
    sliders.some((s) => params[s.key] !== 1) ||
      params.eyeShape !== 'basic' ||
      (traits ? params.furColor !== traits.coatColor : false)
  );
  const traitChips = $derived.by(() => {
    const t = traits;
    if (!t) return [];
    return [
      t.breedGuess,
      `${furColors.find((c) => c.key === t.coatColor)?.label ?? t.coatColor} 털`,
      traitLabels.furTexture[t.furTexture],
      traitLabels.earType[t.earType],
      traitLabels.muzzle[t.muzzle],
      traitLabels.tail[t.tail],
      t.coatPattern !== 'solid' ? traitLabels.coatPattern[t.coatPattern] : ''
    ].filter(Boolean);
  });

  const bubble = $derived.by(() => {
    switch (stage) {
      case 'upload':
        return `${dogName}${josa(dogName, '이/가')} 잘 보이는 사진 한 장을 올려 주세요. 제 친구들처럼 3D 캐릭터로 만들어 드릴게요!`;
      case 'result':
        return traits?.summaryKo
          ? `${traits.summaryKo} 이제 마음에 들게 꾸며 볼까요?`
          : `짠! ${dogName}의 캐릭터예요. 이제 마음에 들게 꾸며 볼까요?`;
      case 'customize':
        return '슬라이더를 움직이면 바로 바뀌어요. 표정을 바꾸고 싶으면 아래에서 AI 로 다시 그릴 수 있어요.';
      case 'done':
        return `${dogName}의 캐릭터가 완성됐어요! 앞으로 우리 강아지 화면에서 이 모습으로 만날 수 있어요.`;
      default:
        return '';
    }
  });

  onMount(() => () => clearInterval(phaseTimer));

  function go(to: Stage) {
    direction = stageIndex[to] >= stageIndex[stage] ? 1 : -1;
    stage = to;
  }

  async function pickFile(file: File | undefined | null) {
    if (!file) return;
    uploadError = '';
    reading = true;
    try {
      photo = await prepareDogPhoto(file);
    } catch (failure) {
      uploadError =
        failure instanceof UploadError
          ? failure.message
          : '사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.';
      console.error('[character] upload failed', failure);
    } finally {
      reading = false;
    }
  }
  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    pickFile(event.dataTransfer?.files?.[0]);
  }

  async function post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.message || 'AI 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.');
    return result as T;
  }

  /** [캐릭터 만들기]: 분석 → 생성. 화면에는 단계별 문구를 보여 줍니다. */
  async function create() {
    if (!photo) {
      uploadError = '강아지 사진을 먼저 올려 주세요.';
      return;
    }
    error = '';
    phase = 0;
    go('working');
    try {
      const analysis = await post<{ traits: DogTraits; provider: string; mock: boolean }>(
        '/api/character/analyze',
        {
          image: photo,
          breedHint: dog?.breed && dog.breed !== '믹스 / 모름' ? dog.breed : undefined,
          // 데모 모드에서 사진과 비슷한 색으로 시작하려고 브라우저가 잰 값. AI 가 있으면 무시돼요.
          colorHint: await guessCoatColor(photo)
        }
      );
      traits = analysis.traits;
      mock = analysis.mock;
      provider = analysis.provider;
      await generate(analysis.traits, 'smile');
      params = { ...DEFAULT_PARAMS, furColor: analysis.traits.coatColor };
      go('result');
    } catch (failure) {
      error =
        failure instanceof Error
          ? failure.message
          : '캐릭터를 만들지 못했어요. 다시 시도해 주세요.';
      console.error('[character] create failed', failure);
      go('upload');
    } finally {
      clearInterval(phaseTimer);
    }
  }

  async function generate(current: DogTraits, mood: Expression) {
    phase = 1;
    clearInterval(phaseTimer);
    phaseTimer = setInterval(() => (phase = 2), 18_000);
    const result = await post<{
      image: string;
      layout: CharacterLayout | null;
      baseColor?: FurColorKey;
      expression: Expression;
      provider: string;
      mock: boolean;
    }>('/api/character/generate', { image: photo, traits: current, expression: mood });
    clearInterval(phaseTimer);
    characterImage = result.image;
    layout = result.layout;
    baseColor = result.baseColor ?? current.coatColor;
    expression = result.expression;
    mock = result.mock;
    renderer = null;
  }

  /** [AI 로 다시 생성]: 표정처럼 그림 자체가 바뀌어야 하는 것만 여기서. 슬라이더 값은 유지돼요. */
  async function regenerate(mood: Expression) {
    if (!traits || regenerating) return;
    regenerating = true;
    error = '';
    try {
      await generate(traits, mood);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : '다시 만들지 못했어요.';
      console.error('[character] regenerate failed', failure);
    } finally {
      regenerating = false;
    }
  }

  function resetParams() {
    params = { ...DEFAULT_PARAMS, furColor: traits?.coatColor ?? DEFAULT_PARAMS.furColor };
  }

  /** [캐릭터 완성]: 지금 모습을 그림으로 굳혀 저장합니다. */
  async function finish() {
    if (!traits || !canvas?.isReady() || saving) return;
    saving = true;
    error = '';
    try {
      const finalImage = canvas.exportImage(640);
      if (!finalImage)
        throw new Error('캐릭터 그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      const [sourceImage, baseImage] = await Promise.all([
        shrinkDataUrl(photo, 512),
        shrinkDataUrl(characterImage, 768, 'image/webp', 0.9)
      ]);
      const result = await store.applyCharacter({
        dogId: dog?.id ?? null,
        sourceImage,
        characterImage: baseImage,
        finalImage,
        traits,
        layout: renderer?.layout ??
          layout ?? {
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
        expression
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
  function back() {
    if (stage === 'customize') go('result');
    else if (stage === 'result') go('upload');
    else goto('/web/start?replay');
  }
</script>

<svelte:head>
  <title>내 강아지 캐릭터 만들기 — 댕브리웨어</title>
</svelte:head>

<div class="tutorial">
  <div class="tutorial-bar">
    <a class="bar-brand" href="/web"
      ><img src="/logo.png" alt="" width="34" height="34" /><strong>댕브리웨어</strong></a
    >
    <a class="bar-skip" href={stage === 'done' ? '/web/dog' : AFTER_TUTORIAL_PATH}
      >{stage === 'done' ? '우리 강아지로' : '나중에 할게요'}</a
    >
  </div>

  <div class="card" class:wide={stage === 'customize'}>
    <header class="card-head">
      <span class="eyebrow">
        {#if stage === 'done'}내 강아지 캐릭터 · 완료{:else}내 강아지 캐릭터 만들기 · {stageIndex[
            stage
          ] + 1} / {steps.length}{/if}
        {#if mock}<em
            class="demo-flag"
            title="AI 키가 없어 기존 견종 캐릭터로 흐름만 보여 주는 중이에요">데모</em
          >{/if}
      </span>
      <h1>
        {#if stage === 'upload'}{dogName} 사진을 올려 주세요{:else if stage === 'working'}캐릭터를
          만드는 중이에요{:else if stage === 'result'}✨ {dogName}의 캐릭터 등장!{:else if stage === 'customize'}캐릭터
          꾸미기{:else}{dogName} 캐릭터 완성!{/if}
      </h1>
      <p class="lead">
        {#if stage === 'upload'}
          사진은 캐릭터를 만드는 데에만 쓰고, 이 브라우저와 내 계정 밖으로 공개되지 않아요.
        {:else if stage === 'customize'}
          크기와 색은 바로 바뀌어요. 원래 모습에서 너무 멀어지지 않게 범위를 정해 두었어요.
        {:else if stage === 'done'}
          {saved?.local
            ? '로그인 전에는 이 브라우저에 저장돼요. 로그인하면 계정으로 옮길 수 있어요.'
            : '계정에 저장했어요. 다른 기기에서도 같은 캐릭터를 볼 수 있어요.'}
        {:else}
          사진 속 {dogName}의 털 색과 무늬, 귀와 얼굴 생김새를 그대로 살려서 만들어요.
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
        {#if stage !== 'working'}
          <div class="guide">
            <img
              class="mascot mascot-small"
              src={MASCOT_IMAGE}
              alt={`마스코트 ${MASCOT_NAME}`}
              draggable="false"
            />
            <p class="speech">{bubble}</p>
          </div>
        {/if}

        {#if error}
          <div class="error" role="alert">
            <TriangleAlert size={18} /><span>{error}</span>
            <button type="button" class="error-close" aria-label="닫기" onclick={() => (error = '')}
              ><X size={16} /></button
            >
          </div>
        {/if}

        {#if stage === 'upload'}
          <!-- STEP 1. 사진 업로드 -->
          <input
            bind:this={fileInput}
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onchange={(event) => pickFile((event.currentTarget as HTMLInputElement).files?.[0])}
          />
          <div
            class="dropzone"
            class:dragging
            class:has-photo={Boolean(photo)}
            role="button"
            tabindex="0"
            aria-label="강아지 사진 고르기"
            onclick={() => fileInput?.click()}
            onkeydown={(event) =>
              (event.key === 'Enter' || event.key === ' ') && fileInput?.click()}
            ondragover={(event) => {
              event.preventDefault();
              dragging = true;
            }}
            ondragleave={() => (dragging = false)}
            ondrop={onDrop}
          >
            {#if photo}
              <img class="photo-preview" src={photo} alt={`${dogName} 사진 미리보기`} />
              <span class="photo-change"><RefreshCw size={15} />다른 사진 고르기</span>
            {:else}
              <span class="drop-icon"
                >{#if reading}<RefreshCw size={30} class="spin" />{:else}<ImagePlus
                    size={34}
                    strokeWidth={1.5}
                  />{/if}</span
              >
              <strong
                >{reading
                  ? '사진을 읽는 중...'
                  : '여기를 눌러 사진을 고르거나 끌어다 놓으세요'}</strong
              >
              <small>JPG · PNG · WEBP, 12MB 이하 · 얼굴과 몸이 함께 보이는 사진이 가장 좋아요</small
              >
            {/if}
          </div>
          {#if uploadError}<p class="field-error"><TriangleAlert size={15} />{uploadError}</p>{/if}
          <ul class="tips">
            <li><Camera size={15} />밝은 곳에서 정면이나 살짝 옆에서 찍은 사진</li>
            <li><PawPrint size={15} />다른 강아지나 사람이 함께 나오지 않은 사진</li>
          </ul>
        {:else if stage === 'working'}
          <!-- STEP 2. 생성 중 -->
          <div class="working">
            <div class="working-figure">
              <img class="working-photo" src={photo} alt="" />
              <span class="working-ring" aria-hidden="true"></span>
              <img class="mascot working-mascot" src={MASCOT_IMAGE} alt="" draggable="false" />
            </div>
            {#key phase}
              <p class="working-text" in:fly={{ y: 8, duration: 220 }}>{phases[phase].text}</p>
            {/key}
            <small class="working-hint">{phases[phase].hint}</small>
            <div class="working-bar" aria-hidden="true"><span></span></div>
            <ol class="working-steps" aria-label="진행 단계">
              {#each phases as item, index (index)}
                <li class:done={index < phase} class:now={index === phase}>
                  {#if index < phase}<Check size={13} strokeWidth={3} />{/if}{[
                    '사진 분석',
                    '캐릭터 생성',
                    '마무리'
                  ][index]}
                </li>
              {/each}
            </ol>
          </div>
        {:else if stage === 'result'}
          <!-- STEP 3. 1차 캐릭터 -->
          <div class="result">
            <div class="result-stage">
              <!-- 그림 그대로가 아니라 사진 색(params.furColor)을 입힌 모습으로 보여 줍니다 -->
              <div class="result-model">
                <CharacterCanvas
                  src={characterImage}
                  {layout}
                  originalColor={baseColor}
                  {earAnchor}
                  {params}
                  size={360}
                  alt={`${dogName} 캐릭터`}
                />
              </div>
              <img class="result-source" src={photo} alt="원본 사진" />
            </div>
            <div class="result-copy">
              <span class="result-label"><Sparkles size={14} />AI 가 살펴본 {dogName}</span>
              <ul class="chips">
                {#each traitChips as chip (chip)}<li>{chip}</li>{/each}
              </ul>
              {#if traits?.distinctive.length && !mock}
                <p class="result-note">{traits.distinctive.slice(0, 3).join(' · ')}</p>
              {/if}
              <button
                type="button"
                class="link-button"
                disabled={regenerating}
                onclick={() => regenerate(expression)}
              >
                <RefreshCw size={15} class={regenerating ? 'spin' : ''} />{regenerating
                  ? '다시 그리는 중...'
                  : '마음에 안 들면 다시 생성'}
              </button>
            </div>
          </div>
        {:else if stage === 'customize'}
          <!-- STEP 4. 꾸미기: 왼쪽 캐릭터 · 오른쪽 옵션 -->
          <div class="customize">
            <div class="custom-stage">
              <div class="custom-figure" class:busy={regenerating}>
                <CharacterCanvas
                  bind:this={canvas}
                  src={characterImage}
                  {layout}
                  originalColor={baseColor}
                  {earAnchor}
                  {params}
                  alt={`${dogName} 캐릭터 미리보기`}
                  onready={(ready) => (renderer = ready)}
                  onerror={() => (error = '캐릭터 그림을 불러오지 못했어요. 다시 생성해 주세요.')}
                />
                {#if regenerating}<span class="busy-badge"
                    ><RefreshCw size={14} class="spin" />AI 가 다시 그리는 중</span
                  >{/if}
              </div>
              <div class="custom-stage-foot">
                <span class="stage-badge"><Sparkles size={13} />실시간 미리보기</span>
                <button type="button" class="link-button" disabled={!changed} onclick={resetParams}
                  ><RotateCcw size={14} />처음 모습으로</button
                >
              </div>
              <div class="regen">
                <div class="regen-head">
                  <strong><Wand2 size={15} />AI 로 다시 생성</strong>
                  <small>표정처럼 그림 자체가 바뀌는 건 여기서만 AI 를 불러요</small>
                </div>
                <div class="regen-row">
                  <div class="segmented" role="radiogroup" aria-label="표정">
                    {#each expressions as item (item.key)}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={nextExpression === item.key}
                        class:on={nextExpression === item.key}
                        onclick={() => (nextExpression = item.key)}>{item.label}</button
                      >
                    {/each}
                  </div>
                  <button
                    type="button"
                    class="regen-button"
                    disabled={regenerating || nextExpression === expression}
                    onclick={() => regenerate(nextExpression)}
                  >
                    <RefreshCw size={15} class={regenerating ? 'spin' : ''} />{regenerating
                      ? '그리는 중...'
                      : '적용하기'}
                  </button>
                </div>
              </div>
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
                        >{color.label}{#if traits?.coatColor === color.key}<small>원래 색</small
                          >{/if}</span
                      >
                    </button>
                  {/each}
                </div>
              </section>
            </div>
          </div>
        {:else}
          <!-- STEP 5. 완료 -->
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
                >{traits?.breedGuess ?? dog?.breed ?? ''}{traits
                  ? ` · ${furColors.find((c) => c.key === params.furColor)?.label ?? ''} 털`
                  : ''}</span
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
      {#if stage === 'working'}
        <p class="foot-note">
          사진과 그림체에 따라 20초에서 1분 정도 걸려요. 잠시만 기다려 주세요.
        </p>
      {:else if stage === 'done'}
        <a class="btn-back" href="/web/dog"><PawPrint size={17} />우리 강아지</a>
        <button type="button" class="btn-next finish" onclick={toMap}
          ><Map size={19} />지도 찾기</button
        >
      {:else}
        <button type="button" class="btn-back" onclick={back} disabled={saving || regenerating}>
          {#if stage === 'upload'}<ArrowLeft size={17} />튜토리얼로{:else}이전{/if}
        </button>
        {#if stage === 'upload'}
          <button type="button" class="btn-next" disabled={!photo || reading} onclick={create}
            ><Sparkles size={18} />캐릭터 만들기</button
          >
        {:else if stage === 'result'}
          <button
            type="button"
            class="btn-next"
            disabled={regenerating}
            onclick={() => go('customize')}>캐릭터 꾸미기<ArrowRight size={18} /></button
          >
        {:else}
          <button
            type="button"
            class="btn-next finish"
            disabled={saving || regenerating || !renderer}
            onclick={finish}
          >
            <Check size={19} strokeWidth={2.5} />{saving ? '저장하는 중…' : '이 캐릭터로 완성'}
          </button>
        {/if}
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
  .bar-brand img {
    transform: rotate(-8deg);
    filter: drop-shadow(0 4px 8px #b5704e40);
  }
  .bar-brand strong {
    font-size: 18px;
    letter-spacing: -0.6px;
    color: var(--brand);
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
  .demo-flag {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--gold);
    color: #fff;
    font-size: 11px;
    font-style: normal;
    letter-spacing: 0.3px;
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
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ---------- 1. 사진 ---------- */
  .dropzone {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 250px;
    padding: 24px;
    border: 2px dashed var(--line-soft);
    border-radius: 22px;
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    text-align: center;
    cursor: pointer;
    overflow: hidden;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .dropzone:hover,
  .dropzone.dragging,
  .dropzone:focus-visible {
    border-color: var(--brand);
    background: var(--brand-tint);
    outline: none;
  }
  .dropzone.has-photo {
    padding: 0;
    border-style: solid;
    background: #fff;
  }
  .drop-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #fff;
    color: var(--brand);
    box-shadow: 0 6px 18px #b5704e26;
  }
  .dropzone strong {
    font-size: 16px;
    word-break: keep-all;
  }
  .dropzone small {
    font-size: 12.5px;
    color: var(--muted);
    word-break: keep-all;
  }
  .photo-preview {
    width: 100%;
    max-height: 340px;
    object-fit: contain;
    background: var(--sand);
  }
  .photo-change {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 999px;
    background: #fffffff0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--brand);
    box-shadow: 0 3px 10px #4a342822;
  }
  .field-error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px 0 0;
    font-size: 13.5px;
    color: #a03b3b;
  }
  .tips {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    font-size: 13.5px;
    color: var(--muted);
  }
  .tips li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ---------- 2. 생성 중 ---------- */
  .working {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }
  .working-figure {
    position: relative;
    width: 190px;
    height: 190px;
    margin-bottom: 10px;
    display: grid;
    place-items: center;
  }
  .working-photo {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 12px 30px #4a342826;
  }
  .working-ring {
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    border: 3px dashed var(--brand);
    opacity: 0.55;
    animation: turn 9s linear infinite;
  }
  .working-mascot {
    position: absolute;
    right: -6px;
    bottom: -4px;
    width: 76px;
    height: 76px;
    object-fit: contain;
    animation: bob 1.8s ease-in-out infinite;
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(-5px);
    }
  }
  .working-text {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.4px;
    word-break: keep-all;
  }
  .working-hint {
    font-size: 13.5px;
    color: var(--muted);
  }
  .working-bar {
    width: min(320px, 100%);
    height: 6px;
    margin-top: 14px;
    border-radius: 999px;
    background: var(--sand);
    overflow: hidden;
  }
  .working-bar span {
    display: block;
    width: 40%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--brand-soft), var(--brand), var(--brand-soft));
    animation: slide 1.6s ease-in-out infinite;
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
  .working-steps {
    display: flex;
    gap: 8px;
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
  }
  .working-steps li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-size: 12.5px;
    color: var(--muted);
  }
  .working-steps li.now {
    border-color: var(--brand);
    color: var(--brand);
    font-weight: 700;
  }
  .working-steps li.done {
    background: var(--brand-soft);
    border-color: var(--brand-soft);
    color: var(--brown-warm);
  }

  /* ---------- 3. 결과 ---------- */
  .result {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .result-stage {
    position: relative;
    display: grid;
    place-items: center;
    height: 300px;
    border-radius: 22px;
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    overflow: hidden;
  }
  .result-model {
    /* 무대 높이(300px) 안에 정사각 캔버스를 고정 px 로 둡니다 (grid 안 % 높이는 풀리지 않아요) */
    width: 264px;
    height: 264px;
    animation: pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .result-source {
    position: absolute;
    left: 14px;
    bottom: 14px;
    width: 72px;
    height: 72px;
    border-radius: 16px;
    object-fit: cover;
    border: 3px solid #fff;
    box-shadow: 0 6px 16px #4a342830;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(14px);
    }
  }
  .result-copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .result-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--brand);
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
  .result-note {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
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

  /* ---------- 4. 꾸미기 ---------- */
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
  .custom-figure.busy :global(canvas) {
    filter: saturate(0.6) blur(1px);
    opacity: 0.6;
  }
  .busy-badge {
    position: absolute;
    left: 50%;
    top: 50%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 999px;
    background: #fffffff2;
    color: var(--brand);
    font-size: 13.5px;
    font-weight: 700;
    transform: translate(-50%, -50%);
    box-shadow: 0 6px 18px #4a342826;
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
  .regen {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--cream);
  }
  .regen-head {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 10px;
  }
  .regen-head strong {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14.5px;
  }
  .regen-head small {
    font-size: 12.5px;
    color: var(--muted);
  }
  .regen-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .regen-row .segmented {
    flex: 1;
  }
  .regen-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid var(--brand);
    border-radius: 12px;
    background: #fff;
    color: var(--brand);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .regen-button:hover:not(:disabled) {
    background: var(--brand-soft);
  }
  .regen-button:disabled {
    border-color: var(--line);
    color: var(--muted);
    cursor: default;
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

  /* ---------- 5. 완료 ---------- */
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
  .foot-note {
    flex: 1;
    margin: 0;
    padding: 14px 0 0;
    text-align: center;
    font-size: 13.5px;
    color: var(--muted);
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
    .regen-row .segmented {
      flex-basis: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .result-model,
    .done-figure img,
    .working-ring,
    .working-mascot,
    .working-bar span,
    :global(.spin) {
      animation: none;
    }
  }
</style>
