<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    PawPrint,
    Dog,
    Scale,
    TriangleAlert,
    CircleCheck,
    ListChecks,
    Map,
    MapPin,
    ArrowRight,
    Info,
    LogIn,
    Sparkles
  } from '@lucide/svelte';
  import {
    categoryNames,
    profileNotice,
    type DogSize,
    type Place
  } from '$lib/domain/place';
  import { validateProfile } from '$lib/domain/profile';
  import { findBreed, breedImage } from '$lib/domain/breeds';
  import BreedPicker from '$lib/components/web/BreedPicker.svelte';
  import { getWebStore } from '$lib/web/store.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const store = getWebStore();

  const unknownBreed = '믹스 / 모름';
  let name = $state(store.dog?.name ?? '');
  let breed = $state(store.dog && store.dog.breed !== unknownBreed ? store.dog.breed : '');
  let size = $state<DogSize>(store.dog?.size ?? 'small');
  let weight = $state<number | undefined>(store.dog?.weight);
  let formError = $state('');
  let submitting = $state(false);

  const sizes: { value: DogSize; label: string; hint: string; icon: number }[] = [
    { value: 'small', label: '소형견', hint: '대략 10kg 미만', icon: 20 },
    { value: 'medium', label: '중형견', hint: '대략 10~25kg', icon: 26 },
    { value: 'large', label: '대형견', hint: '대략 25kg 이상', icon: 32 }
  ];
  const sizeNames: Record<DogSize, string> = { small: '소형견', medium: '중형견', large: '대형견' };

  /**
   * 왼쪽 무대 미리보기 — 저장 전에도 폼에서 고른 견종·체급이 바로 반영됩니다.
   * 견종 목록·이미지는 $lib/domain/breeds.ts 와 static/dogs/ 에서 관리해요.
   */
  const previewBreed = $derived(findBreed(breed));
  // 체급에 따라 캐릭터가 점점 커져요. (발끝 기준으로 확대)
  const sizeScale: Record<DogSize, number> = { small: 0.66, medium: 0.83, large: 1 };
  const modelLabel = $derived(
    `${previewBreed?.label ?? (breed.trim() || '기본 캐릭터')} · ${sizeNames[size]}`
  );
  const modelAlt = $derived(
    `${name.trim() || '우리 강아지'} ${previewBreed?.label ?? ''} 3D 캐릭터`.replace(/\s+/g, ' ')
  );
  // 이미지 파일을 못 불러오면 임시 자리로 대체합니다.
  let modelReady = $state(true);
  $effect(() => {
    previewBreed;
    modelReady = true;
  });

  const summary = $derived.by(() => {
    const dog = store.dog;
    if (!dog) return null;
    const restricted: Place[] = [];
    const withinWeight: Place[] = [];
    let check = 0;
    for (const place of data.places) {
      if (profileNotice(place, dog).kind === 'restricted') restricted.push(place);
      else if (place.sourceWeight !== null) withinWeight.push(place);
      else check++;
    }
    return { restricted, withinWeight, check };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const profile = validateProfile({
      name,
      breed: breed.trim() || unknownBreed,
      size,
      weight: Number(weight)
    });
    if (!profile) {
      formError = '이름(20자 이내)과 몸무게(0.1~120kg, 소수점 한 자리까지)를 확인해 주세요.';
      return;
    }
    formError = '';
    submitting = true;
    await store.applyDog(profile);
    submitting = false;
  }

  function exploreWithDog() {
    store.mode = 'dog';
    store.hideKnownMismatch = true;
    goto('/web/explore');
  }
</script>

<svelte:head>
  <title>{store.dog ? '우리 강아지' : '우리 강아지 등록'} — 댕브리웨어</title>
</svelte:head>

<div class="page-scroll">
  <div class="page">
    <header class="page-head">
      <span class="page-eyebrow"><PawPrint size={16} fill="currentColor" />MY LITTLE COMPANION</span>
      <!-- 등록 전에는 등록 안내, 등록 후에는 우리 강아지 정보 페이지 -->
      <h1>{store.dog ? '우리 강아지' : '우리 강아지 등록'}</h1>
      <p>우리 강아지 정보를 등록하면 장소마다 체중·체급 동반 조건과 비교해서 보여드려요.</p>
    </header>

    <div class="dog-layout">
      <!-- 왼쪽: 3D 강아지 -->
      <section class="dog-stage">
        <div class="stage-top">
          <span class="stage-badge"><Sparkles size={14} />3D 미리보기</span>
          <span class="stage-breed">{modelLabel}</span>
        </div>

        <div class="stage-figure">
          <div
            class="figure-scale"
            class:has-model={previewBreed && modelReady}
            style:--dog-scale={sizeScale[size]}
          >
            {#key previewBreed?.key}
              {#if previewBreed && modelReady}
                <img
                  class="dog-model"
                  src={breedImage(previewBreed)}
                  alt={modelAlt}
                  draggable="false"
                  onerror={() => (modelReady = false)}
                />
              {:else}
                <!-- 견종을 고르기 전 · 캐릭터가 없는 견종의 임시 자리 -->
                <div class="dog-placeholder"><Dog size={92} strokeWidth={1.1} /></div>
                <span class="stage-shadow" aria-hidden="true"></span>
              {/if}
            {/key}
          </div>
          <div class="size-meter" aria-hidden="true">
            {#each sizes as option (option.value)}<span class:on={size === option.value}
                >{option.label}</span
              >{/each}
          </div>
        </div>

        <div class="stage-caption">
          {#if store.dog}
            <strong>{store.dog.name}</strong>
            <span>{store.dog.breed} · {sizeNames[store.dog.size]} · {store.dog.weight}kg</span>
          {:else}
            <strong>누구와 함께 떠나나요?</strong>
            <span>오른쪽에 정보를 입력하면 여기에 나타나요.</span>
          {/if}
        </div>

        <p class="stage-note">견종을 고르면 캐릭터가 바뀌고, 체급을 바꾸면 크기가 달라져요.</p>
      </section>

      <!-- 오른쪽: 등록 폼 -->
      <div class="form-col">
        <form class="dog-form" onsubmit={submit}>
          <h2>{store.dog ? '정보 수정하기' : '강아지 등록하기'}</h2>
          <div class="field-row">
            <label>
              <span>강아지 이름</span>
              <input bind:value={name} placeholder="예: 두부" required maxlength="20" autocomplete="off" />
            </label>
            <div class="field">
              <span id="dog-breed-label">견종 <em>선택</em></span>
              <BreedPicker bind:value={breed} labelId="dog-breed-label" />
            </div>
          </div>

          <fieldset>
            <legend>체급</legend>
            <div class="size-options">
              {#each sizes as option (option.value)}<label class:active={size === option.value}
                  ><input
                    type="radio"
                    name="dog-size"
                    value={option.value}
                    checked={size === option.value}
                    onchange={() => (size = option.value)}
                  /><PawPrint size={option.icon} /><strong>{option.label}</strong><small
                    >{option.hint}</small
                  ></label
                >{/each}
            </div>
          </fieldset>

          <label class="weight-field">
            <span>현재 몸무게</span>
            <div class="weight-input">
              <input
                type="number"
                min="0.1"
                max="120"
                step="0.1"
                bind:value={weight}
                required
                placeholder="0.0"
                inputmode="decimal"
              /><em>kg</em>
            </div>
          </label>

          {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
          <p class="form-note">
            <Info size={15} />체급 기준은 장소마다 달라요. 실제 체중과 원문 규정을 함께 확인해요.
            {store.loggedIn ? '로그인 상태라 계정에 저장돼요.' : '로그인 전에는 이번 방문에서만 적용돼요.'}
          </p>
          <div class="form-actions">
            <button class="primary-button" type="submit" disabled={submitting}
              >{store.dog ? '수정한 정보 저장' : '이 정보로 등록'}<ArrowRight size={18} /></button
            >
            {#if !store.loggedIn}<button
                type="button"
                class="secondary-button"
                onclick={() => store.requestLogin()}><LogIn size={17} />로그인하고 저장</button
              >{/if}
          </div>
        </form>
      </div>
    </div>

    <!-- 아래: 우리 강아지 기준 요약 -->
    <div class="dog-insight">
        {#if store.dog && summary}
          <section class="panel">
            <div class="panel-head">
              <h2>{store.dog.name} 기준으로 본 강릉</h2>
              <button class="primary-button" onclick={exploreWithDog}
                ><Map size={18} />이 기준으로 지도 보기</button
              >
            </div>
            <div class="stat-row">
              <div class="stat warn">
                <TriangleAlert size={22} /><strong>{summary.restricted.length}</strong><span
                  >체중·체급 제한 안내</span
                >
              </div>
              <div class="stat ok">
                <CircleCheck size={22} /><strong>{summary.withinWeight.length}</strong><span
                  >원본 제한 체중 이내</span
                >
              </div>
              <div class="stat">
                <Scale size={22} /><strong>{summary.check}</strong><span>체중 정보 없음 · 확인 필요</span>
              </div>
            </div>
            <p class="panel-note">
              ‘제한 체중 이내’도 입장을 보장하지 않아요. 허용 구역과 준비물을 꼭 함께 확인해 주세요.
            </p>
          </section>

          <div class="list-columns">
            <section class="panel">
              <h3 class="list-title warn"><TriangleAlert size={19} />제한 안내가 있는 곳</h3>
              {#if summary.restricted.length}
                <ul class="place-list">
                  {#each summary.restricted as place (place.id)}<li>
                      <a href={`/web/explore?place=${place.id}`}>
                        <div>
                          <strong>{place.name}</strong>
                          <span><MapPin size={13} />{categoryNames[place.category]}</span>
                        </div>
                        <em>{profileNotice(place, store.dog).label}</em>
                      </a>
                    </li>{/each}
                </ul>
              {:else}<p class="list-empty">원본 규정상 제한 안내가 있는 곳이 없어요.</p>{/if}
            </section>
            <section class="panel">
              <h3 class="list-title ok"><CircleCheck size={19} />제한 체중 이내인 곳</h3>
              {#if summary.withinWeight.length}
                <ul class="place-list">
                  {#each summary.withinWeight as place (place.id)}<li>
                      <a href={`/web/explore?place=${place.id}`}>
                        <div>
                          <strong>{place.name}</strong>
                          <span><MapPin size={13} />{categoryNames[place.category]}</span>
                        </div>
                        <em class="ok">{place.sourceWeight}kg까지</em>
                      </a>
                    </li>{/each}
                </ul>
              {:else}<p class="list-empty">체중 제한이 기재된 곳 중 해당하는 장소가 없어요.</p>{/if}
            </section>
          </div>
        {:else}
          <section class="panel intro">
            <span class="intro-icon"><Scale size={36} strokeWidth={1.5} /></span>
            <h2>등록하면 이런 걸 볼 수 있어요</h2>
            <ul>
              <li><TriangleAlert size={19} />원본 규정에 체중·체급 제한이 걸리는 장소</li>
              <li><CircleCheck size={19} />제한 체중이 기재되어 있고 그 안에 드는 장소</li>
              <li><Map size={19} />조건에 맞지 않는 곳을 뺀 지도</li>
            </ul>
          </section>
        {/if}

        <section class="panel checklist">
          <h3 class="list-title"><ListChecks size={19} />외출 전 체크리스트</h3>
          <ul>
            <li>리드줄(목줄) · 대부분의 장소에서 필수예요</li>
            <li>배변봉투와 물티슈</li>
            <li>물과 휴대용 물그릇</li>
            <li>이동장·유모차 · 실내 동반 시 요구하는 곳이 있어요</li>
            <li>예방접종 기록 · 숙소에서 확인하는 경우가 있어요</li>
          </ul>
      </section>
    </div>
  </div>
</div>

<style>
  .page-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .page {
    width: min(1320px, calc(100% - 72px));
    margin: 0 auto;
    padding: 44px 0 70px;
  }
  .page-head {
    margin-bottom: 32px;
  }
  .page-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--brand);
  }
  .page-head h1 {
    font-size: 38px;
    letter-spacing: -1.5px;
    margin: 10px 0 8px;
  }
  .page-head p {
    font-size: 17px;
    color: var(--muted);
    margin: 0;
  }
  .dog-layout {
    display: grid;
    /* 왼쪽 3D 강아지 · 오른쪽 등록 폼 */
    grid-template-columns: minmax(380px, 460px) 1fr;
    gap: 28px;
    align-items: stretch;
  }
  .form-col {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
  }
  .dog-insight {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
    margin-top: 28px;
  }

  /* ---------- 왼쪽: 3D 강아지 ---------- */
  .dog-stage {
    display: flex;
    flex-direction: column;
    padding: 22px 24px 26px;
    border: 1px solid var(--line);
    border-radius: 28px;
    background:
      radial-gradient(120% 70% at 50% 8%, #fff 0%, transparent 60%),
      linear-gradient(170deg, var(--brand-tint) 0%, var(--brand-soft) 100%);
    box-shadow: 0 16px 40px #4a342814;
  }
  .stage-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: 999px;
    background: #fff;
    color: var(--brand);
    font-size: 12.5px;
    font-weight: 700;
  }
  .stage-breed {
    font-size: 13px;
    color: var(--brown-warm);
    font-weight: 600;
  }

  /* 강아지가 서 있는 무대 */
  .stage-figure {
    position: relative;
    flex: 1;
    min-height: 360px;
    display: grid;
    place-items: center;
    padding: 6px 0 44px;
  }
  /* 체급별 크기 — 발이 닿는 바닥선(이미지 높이 88%)을 기준으로 커지고 작아집니다 */
  .figure-scale {
    position: relative;
    display: grid;
    place-items: center;
    width: min(100%, 380px);
    aspect-ratio: 1;
    transform: scale(var(--dog-scale, 1));
    transform-origin: 50% 88%;
    transition: transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  /* 이미지의 흰 배경을 무대 색에 녹이고, 그려진 바닥 그림자만 남깁니다.
     transform 이 있는 요소 안쪽에서는 합성이 격리되므로 이 래퍼에 적용해요. */
  .figure-scale.has-model {
    mix-blend-mode: multiply;
  }
  .dog-model {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: 50% 88%;
    user-select: none;
    animation:
      dog-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      dog-breathe 3.8s ease-in-out 0.5s infinite;
  }
  .dog-placeholder {
    display: grid;
    place-items: center;
    width: 190px;
    height: 190px;
    border-radius: 50%;
    background: #ffffffb0;
    color: var(--brand);
    animation: dog-float 4.2s ease-in-out infinite;
  }
  /* 임시 자리용 바닥 그림자 — 떠오를 때 같이 줄었다 커집니다 */
  .stage-shadow {
    position: absolute;
    bottom: 8%;
    width: 180px;
    height: 24px;
    border-radius: 50%;
    background: radial-gradient(closest-side, #4a34282e, transparent);
    animation: dog-shadow 4.2s ease-in-out infinite;
  }
  .size-meter {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: #ffffffc4;
  }
  .size-meter span {
    padding: 4px 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    transition:
      background 0.25s,
      color 0.25s;
  }
  .size-meter span.on {
    background: var(--brand);
    color: #fff;
  }
  @keyframes dog-pop {
    from {
      opacity: 0;
      transform: scale(0.86) translateY(10px);
    }
  }
  @keyframes dog-breathe {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(1.012, 0.988);
    }
  }
  @keyframes dog-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-14px);
    }
  }
  @keyframes dog-shadow {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(0.82);
      opacity: 0.65;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .figure-scale {
      transition: none;
    }
    .dog-model,
    .dog-placeholder,
    .stage-shadow {
      animation: none;
    }
  }

  .stage-caption {
    display: flex;
    flex-direction: column;
    gap: 5px;
    text-align: center;
  }
  .stage-caption strong {
    font-size: 21px;
    letter-spacing: -0.6px;
    color: var(--ink);
  }
  .stage-caption span {
    font-size: 14px;
    color: var(--brown-warm);
  }
  .stage-note {
    margin: 14px 0 0;
    padding-top: 14px;
    border-top: 1px dashed #d9c3b0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--muted);
    text-align: center;
  }
  /* ---------- 폼 ---------- */
  .dog-form {
    padding: 32px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid var(--line);
  }
  .dog-form h2 {
    font-size: 22px;
    letter-spacing: -0.7px;
    margin: 0 0 22px;
  }
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 14px;
  }
  .dog-form label > span,
  .dog-form .field > span,
  legend {
    display: block;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 9px;
  }
  .dog-form label em,
  .dog-form .field em {
    font-style: normal;
    font-weight: 400;
    font-size: 13px;
    color: var(--muted);
    margin-left: 4px;
  }
  .dog-form input:not([type='radio']) {
    width: 100%;
    height: 54px;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 0 16px;
    font-size: 16px;
    background: var(--cream);
    outline: none;
  }
  .dog-form input:not([type='radio']):focus {
    border-color: var(--brand);
    background: #fff;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 22px 0;
  }
  legend {
    padding: 0;
  }
  .size-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .size-options label {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-height: 118px;
    padding: 14px 8px;
    border: 1px solid var(--line);
    border-radius: 16px;
    color: var(--muted);
    cursor: pointer;
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
  .form-error {
    margin: 14px 0 0;
    font-size: 14.5px;
    color: #b0462c;
  }
  .form-note {
    display: flex;
    gap: 7px;
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--muted);
    margin: 18px 0 22px;
    word-break: keep-all;
  }
  .form-note :global(svg) {
    flex-shrink: 0;
    margin-top: 4px;
  }
  .form-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ---------- 오른쪽 패널 ---------- */
  .panel {
    padding: 30px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid var(--line);
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .panel-head h2,
  .intro h2 {
    font-size: 24px;
    letter-spacing: -0.8px;
    margin: 0;
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 20px 22px;
    border-radius: 18px;
    background: var(--cream);
    color: var(--brown-warm);
  }
  .stat strong {
    font-size: 34px;
    letter-spacing: -1px;
    color: var(--ink);
  }
  .stat span {
    font-size: 14.5px;
    color: var(--muted);
  }
  .stat.warn {
    background: #fdf0ec;
    color: #b0462c;
  }
  .stat.ok {
    background: #eef1e6;
    color: #5f7050;
  }
  .panel-note {
    margin: 16px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  .list-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }
  .list-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    letter-spacing: -0.5px;
    margin: 0 0 14px;
    color: var(--brown-warm);
  }
  .list-title.warn {
    color: #b0462c;
  }
  .list-title.ok {
    color: #5f7050;
  }
  .place-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 420px;
    overflow: auto;
  }
  .place-list a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 10px;
    border-bottom: 1px solid var(--line);
    border-radius: 10px;
    color: var(--ink);
    text-decoration: none;
  }
  .place-list a:hover {
    background: var(--cream);
  }
  .place-list div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .place-list strong {
    font-size: 16px;
  }
  .place-list span {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13.5px;
    color: var(--muted);
  }
  .place-list em {
    flex-shrink: 0;
    font-style: normal;
    font-size: 13px;
    padding: 5px 9px;
    border-radius: 8px;
    background: #fdebe4;
    color: #b0462c;
  }
  .place-list em.ok {
    background: #eef1e6;
    color: #5f7050;
  }
  .list-empty {
    font-size: 15px;
    color: var(--muted);
    margin: 0;
  }
  .intro {
    text-align: left;
  }
  .intro-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 22px;
    background: var(--brand-soft);
    color: var(--brand);
    margin-bottom: 20px;
  }
  .intro ul,
  .checklist ul {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .intro li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    color: var(--brown-warm);
  }
  .checklist ul {
    margin-top: 0;
    gap: 0;
  }
  .checklist li {
    position: relative;
    padding: 13px 0 13px 30px;
    border-bottom: 1px solid var(--line);
    font-size: 15.5px;
  }
  .checklist li:last-child {
    border-bottom: 0;
  }
  .checklist li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 50%;
    width: 16px;
    height: 16px;
    border-radius: 5px;
    border: 2px solid var(--brand);
    transform: translateY(-50%);
  }
  @media (max-width: 1280px) {
    .dog-layout,
    .list-columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1080px) {
    .dog-layout {
      grid-template-columns: 1fr;
    }
    .stage-figure {
      min-height: 240px;
    }
  }
</style>
