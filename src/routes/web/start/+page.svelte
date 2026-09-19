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
    Dog as DogIcon,
    Map,
    PawPrint,
    PencilLine,
    X
  } from '@lucide/svelte';
  import {
    breeds,
    breedThumb,
    breedImage,
    breedByLabel,
    findBreed,
    MYSTERY_IMAGE,
    MYSTERY_THUMB
  } from '$lib/domain/breeds';
  import { validateProfile } from '$lib/domain/profile';
  import { josa } from '$lib/domain/korean';
  import {
    MASCOT_CURIOUS,
    MASCOT_FINISH,
    MASCOT_IMAGE,
    MASCOT_NAME,
    MASCOT_RUN_FRAMES,
    MASCOT_RUN_MS
  } from '$lib/domain/mascot';
  import type { DogSize } from '$lib/domain/place';
  import { getWebStore } from '$lib/web/store.svelte';
  import { AFTER_TUTORIAL_PATH, isTutorialDone, markTutorialDone } from '$lib/web/onboarding';

  /**
   * 처음 한 번만 보여 주는 튜토리얼.
   * 마스코트 댕브리가 멀리서 달려와 인사한 뒤 '나만의 강아지 만들기'(이름 → 견종 → 체급·몸무게)를 거쳐
   * [지도 찾기]를 누르면 강아지를 저장하고 지도(/web/explore)로 이어집니다.
   * 왼쪽 메뉴·헤더 없이 흰 화면에 카드 하나만 두고, 위쪽 막대로 진행 상황을 보여 줍니다.
   */
  const store = getWebStore();
  const unknownBreed = '믹스 / 모름';

  const steps = ['인사', '이름', '견종', '체급·몸무게', '완료'] as const;
  let step = $state(0);
  /** 화면이 어느 쪽에서 들어올지 (다음 → 오른쪽에서, 이전 → 왼쪽에서) */
  let direction = $state(1);
  let saving = $state(false);

  /**
   * 첫 화면: 댕브리가 멀리서 달려오는 장면.
   * 달려오는 동안(MASCOT_RUN_MS) 8프레임을 넘기고, 다 오면 인사 포즈로 바뀌며 말풍선이 뜹니다.
   * 한 번 본 뒤 [이전]으로 돌아오면 기다리게 하지 않고 바로 인사 포즈를 보여 줘요.
   */
  let runFrame = $state(0);
  let arrived = $state(false);
  let helloPlayed = false;
  /**
   * 완료 화면 연출: 두구두구(실루엣이 떨리며 기대감) → 펑! 연기가 한참 머물다 → 걷히면서 캐릭터 등장.
   * 연기는 REVEAL_POOF_MS 동안 머물고, 캐릭터는 연기가 걷히기 시작할 때 나와 그대로 남습니다.
   */
  type Reveal = 'wait' | 'poof' | 'show';
  let reveal = $state<Reveal>('wait');
  const REVEAL_WAIT_MS = 1600;
  const REVEAL_POOF_MS = 2500;
  /** 연기가 완전히 걷히는 데 더 걸리는 시간. 캐릭터가 나온 뒤에도 이만큼은 연기가 남아요. */
  const REVEAL_CLEAR_MS = 700;

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * 달려오는 동안 t(0~1)에 보일 프레임.
   * 시트의 1→8번이 '멀리 → 가까이'라 거리에 맞춰 차례로 넘기되,
   * 한 구간 안에서는 이웃 프레임을 번갈아 보여 발이 계속 움직이는 것처럼 보이게 합니다.
   */
  function frameAt(t: number) {
    const last = MASCOT_RUN_FRAMES.length - 1;
    const seg = Math.min(last - 1, Math.floor(t * last));
    const sub = Math.floor((t * last - seg) * 4);
    return Math.min(last, seg + (sub % 2));
  }

  $effect(() => {
    if (step !== 0) return;
    if (helloPlayed || reducedMotion()) {
      arrived = true;
      return;
    }
    arrived = false;
    runFrame = 0;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / MASCOT_RUN_MS);
      runFrame = frameAt(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        arrived = true;
        helloPlayed = true;
      }
    });
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    if (step !== steps.length - 1) return;
    if (reducedMotion()) {
      reveal = 'show';
      return;
    }
    reveal = 'wait';
    const poof = setTimeout(() => (reveal = 'poof'), REVEAL_WAIT_MS);
    const show = setTimeout(() => (reveal = 'show'), REVEAL_WAIT_MS + REVEAL_POOF_MS);
    return () => {
      clearTimeout(poof);
      clearTimeout(show);
    };
  });

  let name = $state('');
  /** 목록에서 고른 견종 이름. 직접 입력 중이면 비워 둡니다. */
  let breedChoice = $state('');
  let custom = $state(false);
  let customBreed = $state('');
  let size = $state<DogSize>('small');
  /** 몸무게를 넣으면 체급을 자동으로 맞춰 주되, 직접 고른 뒤에는 건드리지 않아요. */
  let sizeTouched = $state(false);
  let weight = $state<number | undefined>(undefined);
  let nameInput = $state<HTMLInputElement>();
  let customInput = $state<HTMLInputElement>();
  let weightInput = $state<HTMLInputElement>();

  const trimmedName = $derived(name.trim());
  const breedValue = $derived(custom ? customBreed.trim() : breedChoice);
  const previewBreed = $derived(findBreed(breedValue));
  const profile = $derived(
    validateProfile({
      name,
      breed: breedValue || unknownBreed,
      size,
      weight: Number(weight)
    })
  );
  const weightValid = $derived(
    weight !== undefined && Number.isFinite(Number(weight)) && Number(weight) >= 0.1 && Number(weight) <= 120
  );
  const canNext = $derived.by(() => {
    if (step === 1) return trimmedName.length > 0 && trimmedName.length <= 20;
    if (step === 2) return breedValue.length > 0;
    if (step === 3) return profile !== null;
    return true;
  });

  const sizes: { value: DogSize; label: string; hint: string; icon: number }[] = [
    { value: 'small', label: '소형견', hint: '대략 10kg 미만', icon: 20 },
    { value: 'medium', label: '중형견', hint: '대략 10~25kg', icon: 26 },
    { value: 'large', label: '대형견', hint: '대략 25kg 이상', icon: 32 }
  ];
  const sizeNames: Record<DogSize, string> = { small: '소형견', medium: '중형견', large: '대형견' };
  const sizeScale: Record<DogSize, number> = { small: 0.7, medium: 0.85, large: 1 };
  /** 완료 화면 효과용: 연기 뭉치 10개, 반짝이 6개 (CSS 에서 --i 로 각도를 정해요) */
  const puffs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const stars = [0, 1, 2, 3, 4, 5];

  /** 마스코트가 단계마다 건네는 말 */
  const bubble = $derived.by(() => {
    const who = trimmedName || '우리 강아지';
    switch (step) {
      case 0:
        return `안녕하세요! 저는 여러분의 반려동물 동반 여행을 도와줄 ${MASCOT_NAME}예요. 지금부터 저와 함께 서비스를 시작해볼까요?`;
      case 1:
        return '먼저, 반려견의 이름을 알려주세요. 앞으로 이 이름으로 불러 드릴게요.';
      case 2:
        return `${who}${josa(who, '은/는')} 어떤 견종이에요? 고르면 캐릭터가 함께 바뀌어요.`;
      case 3:
        return `${who}의 체급과 몸무게를 알려 주세요. 장소마다 체중 제한과 비교해 드릴게요.`;
      default:
        return `${who}${josa(who, '와/과')} 함께 떠날 준비 끝! 이제 지도를 열어 볼까요?`;
    }
  });

  onMount(() => {
    // 이미 마친 브라우저라면 바로 지도로. ?replay 를 붙이면 다시 볼 수 있어요.
    if (isTutorialDone() && !page.url.searchParams.has('replay'))
      goto(AFTER_TUTORIAL_PATH, { replaceState: true });
  });

  // 단계가 바뀌면 그 단계의 첫 입력칸에 커서를 둡니다.
  $effect(() => {
    if (step === 1) nameInput?.focus({ preventScroll: true });
    if (step === 3) weightInput?.focus({ preventScroll: true });
  });

  function go(to: number) {
    direction = to > step ? 1 : -1;
    step = to;
  }
  function next(event?: Event) {
    event?.preventDefault();
    if (!canNext || saving) return;
    if (step >= steps.length - 1) return finish();
    go(step + 1);
  }
  function back() {
    if (step === 0) goto('/web');
    else go(step - 1);
  }
  function skip() {
    markTutorialDone();
    goto(AFTER_TUTORIAL_PATH);
  }

  function pickBreed(label: string) {
    custom = false;
    breedChoice = label;
  }
  async function pickCustom() {
    custom = true;
    breedChoice = '';
    await Promise.resolve();
    customInput?.focus();
  }
  function pickSize(value: DogSize) {
    size = value;
    sizeTouched = true;
  }
  function onWeightInput() {
    if (sizeTouched || !weightValid) return;
    const kg = Number(weight);
    size = kg < 10 ? 'small' : kg < 25 ? 'medium' : 'large';
  }

  /** [지도 찾기]: 강아지를 저장하고, 이 아이 조건이 켜진 지도로 갑니다. */
  async function finish() {
    await finishTo(AFTER_TUTORIAL_PATH);
  }
  /**
   * [내 강아지 캐릭터 만들기]: 같은 저장을 거친 뒤 사진으로 캐릭터를 만드는 화면으로.
   * 방금 저장한 아이가 기준(store.dog)이 되므로 그 id 를 넘깁니다.
   */
  async function finishToCharacter() {
    await finishTo('/web/start/character', true);
  }
  async function finishTo(path: string, withDog = false) {
    if (!profile) return go(3);
    saving = true;
    await store.applyDog(profile);
    markTutorialDone();
    store.mode = 'dog';
    store.hideKnownMismatch = true;
    const dogId = withDog ? store.dog?.id : undefined;
    await goto(dogId ? `${path}?dog=${dogId}` : path);
    saving = false;
  }
</script>

<svelte:head>
  <title>시작하기 — 댕브리웨어</title>
  <!-- 달려오는 동안 다음 장면 그림을 미리 받아 두어 바뀔 때 깜빡이지 않게 합니다 -->
  <link rel="preload" as="image" href={MASCOT_IMAGE} />
  <link rel="preload" as="image" href={MASCOT_CURIOUS} />
  <link rel="preload" as="image" href={MASCOT_FINISH} />
</svelte:head>

<div class="tutorial">
  <div class="tutorial-bar">
    <a class="bar-brand" href="/web"><img src="/logo.png" alt="" width="34" height="34" /><strong
        >댕브리웨어</strong
      ></a
    >
    <button class="bar-skip" type="button" onclick={skip}>건너뛰기</button>
  </div>

  <form class="card" onsubmit={next} novalidate>
    <header class="card-head">
      <span class="eyebrow">
        {#if step === 0}튜토리얼{:else if step === steps.length - 1}나만의 강아지 만들기 · 완료{:else}나만의
          강아지 만들기 · {step} / 3{/if}
      </span>
      <h1>
        {#if step === 0}안녕하세요!{:else if step === 1}강아지 이름을 알려주세요{:else if step === 2}견종을
          골라주세요{:else if step === 3}체급과 몸무게를 알려주세요{:else}{trimmedName} 등록 완료!{/if}
      </h1>
      <p class="lead">
        {#if step === 4}
          입력한 정보는 장소별 체중·체급 동반 조건과 비교하는 데에만 사용해요.
        {:else}
          입력한 정보는 우리 강아지 맞춤 장소 안내에만 사용해요.
        {/if}
      </p>
      <ol class="progress" aria-label={`진행 상황: ${step + 1} / ${steps.length} 단계`}>
        {#each steps as label, index (label)}
          <li class:done={index <= step} aria-current={index === step ? 'step' : undefined}>
            <span class="sr-only">{label}</span>
          </li>
        {/each}
      </ol>
    </header>

    {#key step}
      <div class="card-body" in:fly={{ x: 28 * direction, duration: 260 }}>
        {#if step === 0}
          <!-- 마스코트 인사: 댕브리가 멀리서 달려온 뒤 손을 흔들며 인사합니다 -->
          <div class="hello">
            <div class="run-scene" class:arrived style:--run-ms={`${MASCOT_RUN_MS}ms`}>
              <span class="run-ground" aria-hidden="true"></span>
              {#if arrived}
                <img
                  class="mascot-wave"
                  src={MASCOT_IMAGE}
                  alt={`손을 흔드는 마스코트 ${MASCOT_NAME}`}
                  draggable="false"
                />
              {:else}
                <!-- 8프레임을 겹쳐 두고 하나만 보이게 해서, 프레임이 바뀔 때 새로 불러오느라 깜빡이지 않게 합니다 -->
                <div class="runner" aria-hidden="true">
                  <div class="runner-bob">
                    {#each MASCOT_RUN_FRAMES as src, index (src)}
                      <img class="run-frame" class:on={runFrame === index} {src} alt="" draggable="false" />
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            {#if arrived}
              <p class="speech hello-speech">{bubble}</p>
            {:else}
              <p class="hello-wait" aria-live="polite">
                {MASCOT_NAME}{josa(MASCOT_NAME, '이/가')} 달려오고 있어요<span class="dots" aria-hidden="true"
                  ><i>.</i><i>.</i><i>.</i></span
                >
              </p>
            {/if}
          </div>
        {:else}
          <!-- 단계마다 댕브리가 얼굴을 내밀고 안내. 완료 화면에서는 반짝 떠오른 얼굴로 바뀌어요 -->
          <div class="guide">
            <span class="head-ring" class:finish={step === steps.length - 1}>
              <img
                class="mascot-head"
                src={step === steps.length - 1 ? MASCOT_FINISH : MASCOT_CURIOUS}
                alt=""
                draggable="false"
              />
            </span>
            <p class="speech">{bubble}</p>
          </div>

          {#if step === 1}
            <label class="field">
              <span>강아지 이름</span>
              <input
                bind:this={nameInput}
                bind:value={name}
                placeholder="예: 두부"
                maxlength="20"
                autocomplete="off"
              />
              <small>{trimmedName.length} / 20</small>
            </label>
          {:else if step === 2}
            <div class="breed-stage" class:has-model={Boolean(previewBreed)}>
              {#key previewBreed?.key ?? (breedValue ? 'mystery' : '')}
                {#if previewBreed}
                  <img class="breed-model" src={breedImage(previewBreed)} alt={previewBreed.label} draggable="false" />
                {:else if breedValue}
                  <!-- 기타·믹스·아직 캐릭터가 없는 견종: 미지의 실루엣 -->
                  <img class="breed-model mystery" src={MYSTERY_IMAGE} alt="미지의 강아지" draggable="false" />
                {:else}
                  <span class="breed-empty"><DogIcon size={54} strokeWidth={1.1} /></span>
                {/if}
              {/key}
              <span class="breed-label">
                {#if previewBreed}{previewBreed.label}{:else if breedValue}{breedValue}{:else}견종을
                  고르면 캐릭터가 나타나요{/if}
              </span>
            </div>
            <div class="breed-grid" role="listbox" aria-label="견종 목록">
              {#each breeds as breed (breed.key)}
                {@const on = !custom && breedByLabel(breedChoice)?.key === breed.key}
                <button
                  type="button"
                  role="option"
                  class="breed-option"
                  class:on
                  aria-selected={on}
                  onclick={() => pickBreed(breed.label)}
                >
                  <span class="option-thumb"><img src={breedThumb(breed)} alt="" loading="lazy" /></span>
                  <span class="option-name">{breed.label}</span>
                  {#if on}<span class="option-check"><Check size={12} strokeWidth={3} /></span>{/if}
                </button>
              {/each}
              <!-- 캐릭터가 없는 선택지 둘은 '미지의 강아지' 실루엣으로 -->
              <button
                type="button"
                role="option"
                class="breed-option etc"
                class:on={!custom && breedChoice === unknownBreed}
                aria-selected={!custom && breedChoice === unknownBreed}
                onclick={() => pickBreed(unknownBreed)}
              >
                <span class="option-thumb"><img src={MYSTERY_THUMB} alt="" loading="lazy" /></span>
                <span class="option-name">믹스<br />잘 모름</span>
              </button>
              <button
                type="button"
                role="option"
                class="breed-option etc"
                class:on={custom}
                aria-selected={custom}
                onclick={pickCustom}
              >
                <span class="option-thumb"
                  ><img src={MYSTERY_THUMB} alt="" loading="lazy" /><span class="thumb-badge"
                    ><PencilLine size={12} strokeWidth={2.4} /></span
                  ></span
                >
                <span class="option-name">기타<br />직접 입력</span>
              </button>
            </div>
            {#if custom}
              <div class="custom-row">
                <input
                  bind:this={customInput}
                  bind:value={customBreed}
                  placeholder="예: 말티푸, 코카 스파니엘"
                  maxlength="40"
                  autocomplete="off"
                  aria-label="견종 직접 입력"
                />
                <button
                  type="button"
                  class="custom-clear"
                  aria-label="직접 입력 취소"
                  onclick={() => {
                    custom = false;
                    customBreed = '';
                  }}><X size={16} /></button
                >
              </div>
            {/if}
          {:else if step === 3}
            <div class="size-stage">
              <div class="size-figure" class:has-model={Boolean(previewBreed)} style:--dog-scale={sizeScale[size]}>
                {#if previewBreed}
                  <img src={breedImage(previewBreed)} alt="" draggable="false" />
                {:else if breedValue}
                  <img class="mystery" src={MYSTERY_IMAGE} alt="미지의 강아지" draggable="false" />
                {:else}
                  <span class="breed-empty"><DogIcon size={54} strokeWidth={1.1} /></span>
                {/if}
              </div>
            </div>
            <fieldset class="size-options">
              <legend>체급</legend>
              {#each sizes as option (option.value)}
                <label class:active={size === option.value}>
                  <input
                    type="radio"
                    name="dog-size"
                    value={option.value}
                    checked={size === option.value}
                    onchange={() => pickSize(option.value)}
                  />
                  <PawPrint size={option.icon} />
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </label>
              {/each}
            </fieldset>
            <label class="field weight-field">
              <span>현재 몸무게</span>
              <div class="weight-input">
                <input
                  bind:this={weightInput}
                  type="number"
                  min="0.1"
                  max="120"
                  step="0.1"
                  bind:value={weight}
                  oninput={onWeightInput}
                  placeholder="0.0"
                  inputmode="decimal"
                /><em>kg</em>
              </div>
              <small>0.1~120kg, 소수점 한 자리까지</small>
            </label>
          {:else}
            <!-- 완료: 만든 강아지 카드. 실루엣이 두구두구 떨리다 → 펑! 연기 → 걷히면서 캐릭터 등장 -->
            <div class="done-card">
              <div
                class="done-figure"
                class:has-model={Boolean(previewBreed) && reveal === 'show'}
                style:--wait-ms={`${REVEAL_WAIT_MS}ms`}
                style:--poof-ms={`${REVEAL_POOF_MS + REVEAL_CLEAR_MS}ms`}
              >
                {#if reveal === 'wait'}
                  <img class="tease" src={MYSTERY_IMAGE} alt="" draggable="false" />
                {:else}
                  <!-- 연기는 캐릭터가 나온 뒤에도 남아 있다가 스스로 걷힙니다 -->
                  <span class="poof" aria-hidden="true">
                    {#each puffs as index (index)}<i style:--i={index}></i>{/each}
                  </span>
                {/if}
                {#if reveal === 'show'}
                  <span class="twinkle" aria-hidden="true">
                    {#each stars as index (index)}<i style:--i={index}>✦</i>{/each}
                  </span>
                  <img
                    class="reveal"
                    class:mystery={!previewBreed}
                    src={previewBreed ? breedImage(previewBreed) : MYSTERY_IMAGE}
                    alt=""
                    draggable="false"
                  />
                {/if}
              </div>
              <div class="done-copy" class:revealed={reveal === 'show'}>
                <strong>{trimmedName}</strong>
                <span>{breedValue || unknownBreed} · {sizeNames[size]} · {weight}kg</span>
                <small
                  >{store.loggedIn
                    ? '로그인 상태라 계정에 저장돼요.'
                    : '로그인 전에는 이 브라우저에 저장돼요. 우리 강아지 메뉴에서 언제든 고칠 수 있어요.'}</small
                >
              </div>
            </div>
            <!-- 사진으로 우리 아이만의 캐릭터 만들기 (내 강아지 캐릭터 기능으로 이어짐) -->
            <button type="button" class="character-cta" onclick={finishToCharacter} disabled={saving}>
              <span class="cta-icon"><Camera size={22} /></span>
              <span class="cta-copy">
                <strong>사진으로 {trimmedName} 캐릭터 만들기</strong>
                <small>사진 한 장이면 {trimmedName}의 털 색과 생김새를 살린 3D 캐릭터를 만들어 드려요.</small>
              </span>
              <ArrowRight size={18} />
            </button>
          {/if}
        {/if}
      </div>
    {/key}

    <footer class="card-foot">
      <button type="button" class="btn-back" onclick={back} disabled={saving}>
        {#if step === 0}<ArrowLeft size={17} />메인으로{:else}이전{/if}
      </button>
      <button type="submit" class="btn-next" class:finish={step === steps.length - 1} disabled={!canNext || saving}>
        {#if step === 0}
          네, 시작할게요<ArrowRight size={18} />
        {:else if step === steps.length - 1}
          <Map size={19} />{saving ? '준비하는 중…' : '지도 찾기'}
        {:else}
          다음
        {/if}
      </button>
    </footer>
  </form>
</div>

<style>
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
    border: 0;
    background: none;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14.5px;
    color: var(--muted);
    cursor: pointer;
  }
  .bar-skip:hover {
    background: var(--sand);
    color: var(--brand);
  }

  /* ---------- 카드 ---------- */
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
  }
  .card-head {
    margin-bottom: 26px;
  }
  .eyebrow {
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
    grid-template-columns: repeat(5, 1fr);
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

  /* ---------- 마스코트: 달려와서 인사 ---------- */
  .hello {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 6px;
    text-align: center;
  }
  /* 댕브리가 달려오는 무대. 마스코트 그림은 발끝이 바닥선에 맞춰진 정사각이라
     아래를 기준으로 키우기만 하면 멀리서 다가오는 원근이 살아요. */
  .run-scene {
    position: relative;
    width: min(100%, 440px);
    height: 268px;
    user-select: none;
  }
  /* 바닥: 지평선 쪽으로 좁아지는 옅은 길 */
  .run-ground {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 100%;
    height: 180px;
    transform: translateX(-50%);
    clip-path: polygon(41% 0, 59% 0, 100% 100%, 0 100%);
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    border-radius: 0 0 24px 24px;
  }
  .runner,
  .mascot-wave {
    position: absolute;
    left: 50%;
    bottom: 10px;
    width: 250px;
    height: 250px;
    margin-left: -125px;
    transform-origin: 50% 100%;
  }
  /* 멀리(작고 높게) → 가까이(크고 낮게). 다가올수록 빨리 커지는 원근 곡선 */
  .runner {
    animation: run-approach var(--run-ms, 3000ms) cubic-bezier(0.55, 0.02, 0.85, 0.45) forwards;
  }
  /* 발밑 그림자 — 몸이 통통 튀어도 바닥에 남아요 */
  .runner::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 3%;
    width: 60%;
    height: 8%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(closest-side, #4a342838, transparent);
  }
  .runner-bob {
    position: absolute;
    inset: 0;
    transform-origin: 50% 100%;
    animation: run-bob 0.3s ease-in-out infinite alternate;
  }
  .run-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0;
  }
  .run-frame.on {
    opacity: 1;
  }
  @keyframes run-approach {
    0% {
      opacity: 0;
      transform: translateY(-120px) scale(0.1);
    }
    10% {
      opacity: 1;
    }
    100% {
      transform: translateY(0) scale(1);
    }
  }
  @keyframes run-bob {
    from {
      transform: translateY(0) scale(1, 1);
    }
    to {
      transform: translateY(-7%) scale(0.97, 1.03);
    }
  }
  /* 도착: 살짝 눌렸다 펴지며 서고(착지), 몸을 갸웃갸웃 흔들어 손 인사, 그 뒤엔 숨쉬기 */
  .mascot-wave {
    object-fit: contain;
    animation:
      wave-land 0.55s cubic-bezier(0.34, 1.56, 0.64, 1),
      wave-hi 0.8s ease-in-out 0.5s 3,
      mascot-breathe 3.6s ease-in-out 3s infinite;
  }
  @keyframes wave-land {
    0% {
      transform: scale(1.08, 0.88);
    }
    100% {
      transform: scale(1, 1);
    }
  }
  @keyframes wave-hi {
    0%,
    100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(-4deg) translateX(-3px);
    }
    75% {
      transform: rotate(4deg) translateX(3px);
    }
  }
  .hello-wait {
    margin: 0;
    padding: 16px 0;
    font-size: 15px;
    color: var(--muted);
  }
  .dots i {
    font-style: normal;
    animation: dot-blink 1.2s ease-in-out infinite;
  }
  .dots i:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dots i:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes dot-blink {
    0%,
    60%,
    100% {
      opacity: 0.25;
    }
    30% {
      opacity: 1;
    }
  }
  .speech {
    position: relative;
    margin: 0;
    padding: 16px 20px;
    border-radius: 18px;
    background: var(--brand-tint);
    border: 1px solid var(--brand-soft);
    font-size: 15.5px;
    line-height: 1.75;
    color: var(--brown-warm);
    word-break: keep-all;
  }
  .hello-speech {
    max-width: 440px;
    font-size: 17px;
    color: var(--ink);
    animation: speech-in 0.4s 0.35s ease-out both;
  }
  .hello-speech::before {
    content: '';
    position: absolute;
    top: -9px;
    left: 50%;
    width: 16px;
    height: 16px;
    background: inherit;
    border-left: 1px solid var(--brand-soft);
    border-top: 1px solid var(--brand-soft);
    transform: translateX(-50%) rotate(45deg);
  }
  .guide {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
  }
  /* 동그란 창에서 댕브리가 얼굴만 내밀어요. 아래쪽(몸통)은 창에 가려집니다. */
  .head-ring {
    position: relative;
    flex-shrink: 0;
    width: 88px;
    height: 88px;
    border-radius: 50%;
    overflow: hidden;
    background: radial-gradient(circle at 50% 30%, #fff 0%, var(--brand-tint) 100%);
    box-shadow: inset 0 0 0 1px var(--brand-soft);
  }
  .mascot-head {
    position: absolute;
    left: 50%;
    bottom: -4px;
    width: 92px;
    height: 92px;
    margin-left: -46px;
    object-fit: contain;
    object-position: bottom;
    transform-origin: 50% 95%;
    animation:
      head-peek 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      head-tilt 4s ease-in-out 0.5s infinite;
  }
  /* 완료 화면: 반짝 떠오른 얼굴은 더 밝은 창에 */
  .head-ring.finish {
    background: radial-gradient(circle at 50% 30%, #fff 0%, #fbeccb 100%);
    box-shadow:
      inset 0 0 0 1px #f2d9a8,
      0 0 0 6px #fbeccb66;
  }
  @keyframes head-peek {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.85);
    }
  }
  @keyframes head-tilt {
    0%,
    100% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-5deg);
    }
  }
  .guide .speech {
    flex: 1;
    padding: 13px 16px;
    font-size: 14.5px;
    line-height: 1.65;
  }
  .guide .speech::before {
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
  @keyframes mascot-pop {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(14px);
    }
  }
  @keyframes mascot-breathe {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(1.014, 0.986);
    }
  }
  @keyframes speech-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  /* ---------- 입력칸 공통 ---------- */
  .field {
    display: block;
  }
  .field > span,
  legend {
    display: block;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .field input:not([type='radio']),
  .custom-row input {
    width: 100%;
    height: 58px;
    padding: 0 18px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--cream);
    font-size: 17px;
    outline: none;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
  }
  .field input:not([type='radio']):focus,
  .custom-row input:focus {
    border-color: var(--brand);
    background: #fff;
    box-shadow: 0 0 0 4px #b5704e1f;
  }
  .field small {
    display: block;
    margin-top: 8px;
    font-size: 12.5px;
    color: var(--muted);
    text-align: right;
  }
  .weight-field small {
    text-align: left;
  }

  /* ---------- 견종 ---------- */
  .breed-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 168px;
    margin-bottom: 14px;
    border-radius: 20px;
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    overflow: hidden;
  }
  .breed-model {
    position: absolute;
    inset: 6px 0 26px;
    margin: 0 auto;
    height: calc(100% - 32px);
    width: auto;
    object-fit: contain;
    mix-blend-mode: multiply;
    animation: mascot-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .breed-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: #ffffffc4;
    color: var(--brand);
    transform: translate(-50%, -62%);
  }
  .breed-label {
    position: relative;
    padding: 5px 12px 9px;
    font-size: 13px;
    font-weight: 600;
    color: var(--brown-warm);
  }
  .breed-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .breed-option {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 4px 9px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .breed-option:hover {
    border-color: var(--brand);
    background: var(--brand-tint);
  }
  .breed-option.on {
    border-color: var(--brand);
    background: var(--brand-soft);
    box-shadow: 0 0 0 2px #b5704e33;
  }
  .breed-option:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .option-thumb {
    display: grid;
    place-items: center;
    width: 100%;
    max-width: 64px;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    color: var(--brand);
  }
  .option-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: multiply;
  }
  .etc .option-thumb {
    position: relative;
    background: var(--brand-tint);
  }
  /* 실루엣은 투명 그림이라 multiply 가 필요 없지만, 있어도 해가 없어 같은 규칙을 씁니다 */
  .thumb-badge {
    position: absolute;
    right: 3px;
    bottom: 3px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    color: var(--brand);
    box-shadow: 0 1px 3px #4a342833;
  }
  /* 미지의 강아지: 살짝 숨 쉬듯 흐려졌다 또렷해져요 */
  .mystery {
    animation: mystery-breathe 3.2s ease-in-out infinite;
  }
  .breed-model.mystery {
    animation:
      mascot-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
      mystery-breathe 3.2s ease-in-out 0.45s infinite;
  }
  @keyframes mystery-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.78;
    }
  }
  .option-name {
    font-size: 12px;
    line-height: 1.3;
    text-align: center;
    word-break: keep-all;
  }
  .option-check {
    position: absolute;
    top: 5px;
    right: 5px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
  }
  .custom-row {
    position: relative;
    margin-top: 12px;
  }
  .custom-row input {
    height: 52px;
    padding-right: 46px;
    border-color: var(--brand);
    background: #fff;
    font-size: 15.5px;
  }
  .custom-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .custom-clear:hover {
    background: var(--sand);
  }

  /* ---------- 체급 · 몸무게 ---------- */
  .size-stage {
    display: grid;
    place-items: center;
    height: 190px;
    margin-bottom: 18px;
    border-radius: 20px;
    background: linear-gradient(180deg, #fff 0%, var(--brand-tint) 100%);
    overflow: hidden;
  }
  .size-figure {
    display: grid;
    place-items: center;
    width: 170px;
    height: 170px;
    transform: scale(var(--dog-scale, 1));
    transform-origin: 50% 88%;
    transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .size-figure.has-model {
    mix-blend-mode: multiply;
  }
  .size-figure img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .size-figure .breed-empty {
    position: static;
    transform: none;
  }
  .size-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    border: 0;
    padding: 0;
    margin: 0 0 20px;
  }
  .size-options legend {
    padding: 0;
  }
  .size-options label {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-height: 112px;
    padding: 14px 8px;
    border: 1px solid var(--line);
    border-radius: 16px;
    color: var(--muted);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .size-options label:hover {
    border-color: var(--brand);
  }
  .size-options label strong {
    font-size: 16px;
    color: var(--ink);
  }
  .size-options label small {
    font-size: 12.5px;
  }
  .size-options label.active {
    border-color: var(--brand);
    background: var(--brand-soft);
    color: var(--brand);
    box-shadow: 0 0 0 2px #b5704e33;
  }
  .size-options label.active strong {
    color: var(--brand);
  }
  .size-options input {
    position: absolute;
    opacity: 0;
  }
  .size-options label:has(input:focus-visible) {
    outline: 2px solid var(--brand);
    outline-offset: 3px;
  }
  .weight-input {
    position: relative;
  }
  .weight-input em {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    font-style: normal;
    font-size: 15px;
    color: var(--muted);
  }

  /* ---------- 완료 ---------- */
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
    position: relative;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 150px;
    height: 150px;
  }
  /* 견종 캐릭터 파일은 순백 배경이라, 등장한 뒤에만 multiply 로 배경을 지웁니다 */
  .done-figure.has-model {
    mix-blend-mode: multiply;
  }
  .done-figure img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  /* 두구두구 — 정체 모를 실루엣이 점점 크게 떨립니다 (기대감) */
  .done-figure .tease {
    filter: brightness(0.72) saturate(0.5);
    opacity: 0.85;
    transform-origin: 50% 88%;
    animation: drumroll var(--wait-ms, 1600ms) linear both;
  }
  @keyframes drumroll {
    0% {
      transform: translateX(0) rotate(0deg);
    }
    10% {
      transform: translateX(-1px) rotate(-0.6deg);
    }
    20% {
      transform: translateX(1px) rotate(0.6deg);
    }
    30% {
      transform: translateX(-2px) rotate(-1.2deg);
    }
    40% {
      transform: translateX(2px) rotate(1.2deg);
    }
    50% {
      transform: translateX(-3px) rotate(-2deg);
    }
    60% {
      transform: translateX(3px) rotate(2deg);
    }
    70% {
      transform: translateX(-4px) rotate(-3deg) scale(1.02);
    }
    80% {
      transform: translateX(4px) rotate(3deg) scale(1.03);
    }
    90% {
      transform: translateX(-5px) rotate(-4deg) scale(1.05);
    }
    100% {
      transform: translateX(5px) rotate(4deg) scale(1.07);
    }
  }
  /* 펑! — 연기 뭉치가 확 퍼진 뒤 한참 머물며 일렁이다가, 캐릭터가 나오면 천천히 걷힙니다 */
  .poof {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: smoke-drift 1.6s ease-in-out infinite alternate;
  }
  .poof::before,
  .poof i {
    content: '';
    position: absolute;
    left: 50%;
    top: 52%;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #fff 0%, #ede2d7 55%, #dccab8 100%);
    opacity: 0;
    animation: puff var(--poof-ms, 3200ms) ease-out forwards;
  }
  /* 가운데를 덮는 큰 뭉치 */
  .poof::before {
    --angle: 0deg;
    --dist: 0px;
    width: 120px;
    height: 120px;
    margin: -60px;
  }
  .poof i {
    --angle: calc(var(--i) * 36deg);
    --dist: 46px;
    width: 64px;
    height: 64px;
    margin: -32px;
    animation-delay: calc(var(--i) * 25ms);
  }
  .poof i:nth-child(odd) {
    --dist: 34px;
    width: 78px;
    height: 78px;
    margin: -39px;
  }
  .poof i:nth-child(3n) {
    --dist: 58px;
    width: 50px;
    height: 50px;
    margin: -25px;
  }
  @keyframes puff {
    0% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(0) scale(0.2);
    }
    6% {
      opacity: 1;
      transform: rotate(var(--angle)) translateX(var(--dist)) scale(1.15);
    }
    40% {
      transform: rotate(var(--angle)) translateX(calc(var(--dist) * 1.1)) scale(1.3);
    }
    78% {
      opacity: 0.95;
      transform: rotate(var(--angle)) translateX(calc(var(--dist) * 1.05)) scale(1.2);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(calc(var(--dist) * 1.7)) scale(1.8);
    }
  }
  @keyframes smoke-drift {
    from {
      transform: rotate(-3deg) scale(1);
    }
    to {
      transform: rotate(3deg) scale(1.04);
    }
  }
  /* 등장 — 연기 사이로 캐릭터가 튀어나오고, 별이 둘레에서 반짝이다 사라집니다. 캐릭터는 그대로 남아요. */
  .done-figure .reveal {
    position: relative;
    animation: reveal-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }
  @keyframes reveal-pop {
    0% {
      opacity: 0;
      transform: scale(0.15) translateY(24px) rotate(-12deg);
    }
    55% {
      opacity: 1;
    }
    100% {
      transform: none;
    }
  }
  .twinkle {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .twinkle i {
    --angle: calc(var(--i) * 60deg + 20deg);
    position: absolute;
    left: 50%;
    top: 50%;
    width: 20px;
    height: 20px;
    margin: -10px;
    display: grid;
    place-items: center;
    font-style: normal;
    font-size: 18px;
    line-height: 1;
    color: var(--brand);
    opacity: 0;
    animation: twinkle 1.1s ease-out forwards;
    animation-delay: calc(var(--i) * 70ms + 60ms);
  }
  .twinkle i:nth-child(even) {
    font-size: 12px;
    color: #e0a94f;
  }
  @keyframes twinkle {
    0% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(28px) rotate(calc(-1 * var(--angle))) scale(0);
    }
    35% {
      opacity: 1;
      transform: rotate(var(--angle)) translateX(64px) rotate(calc(-1 * var(--angle))) scale(1.2);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(82px) rotate(calc(-1 * var(--angle))) scale(0.4);
    }
  }
  .done-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    opacity: 0;
    transition: opacity 0.4s ease-out;
  }
  .done-copy.revealed {
    opacity: 1;
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
  .character-cta {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    margin-top: 12px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.15s;
  }
  .character-cta:hover:not(:disabled) {
    border-color: var(--brand);
    background: var(--brand-tint);
    transform: translateY(-1px);
  }
  .character-cta:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .character-cta > :global(svg:last-child) {
    flex-shrink: 0;
    color: var(--brand);
  }
  .cta-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: var(--brand-soft);
    color: var(--brand);
  }
  .cta-copy {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .cta-copy strong {
    font-size: 15px;
  }
  .cta-copy small {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
    word-break: keep-all;
  }

  /* ---------- 아래 버튼 ---------- */
  .card-foot {
    display: flex;
    gap: 10px;
    margin-top: 34px;
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
  .btn-next:disabled {
    background: #ded4cb;
    color: #fff;
    cursor: default;
  }
  .btn-next.finish:not(:disabled) {
    background: linear-gradient(160deg, #c8825c 0%, var(--brand) 48%, var(--brand-deep) 100%);
    box-shadow: 0 10px 24px #b5704e40;
  }
  .btn-back:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (max-width: 640px) {
    .tutorial {
      padding-inline: 0;
    }
    .card {
      margin-top: 0;
      padding: 28px 22px 24px;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .breed-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .done-card {
      flex-direction: column;
      text-align: center;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .runner,
    .runner-bob,
    .mascot-wave,
    .mascot-head,
    .dots i,
    .done-figure .tease,
    .poof,
    .poof::before,
    .poof i,
    .done-figure .reveal,
    .twinkle i,
    .breed-model,
    .hello-speech {
      animation: none;
    }
    .size-figure,
    .done-copy {
      transition: none;
    }
  }
</style>
