<script lang="ts">
  import { onMount } from 'svelte';
  import { X, PawPrint, ArrowRight } from '@lucide/svelte';
  import type { DogProfile, DogSize } from '$lib/domain/place';
  let {
    dog,
    onclose,
    onapply
  }: { dog: DogProfile | null; onclose: () => void; onapply: (dog: DogProfile) => void } = $props();
  let dialog: HTMLDialogElement;
  let name = $state('');
  let breed = $state('');
  let size = $state<DogSize>('small');
  let weight = $state<number | undefined>(undefined);
  onMount(() => {
    if (dog) {
      name = dog.name;
      breed = dog.breed;
      size = dog.size;
      weight = dog.weight;
    }
    dialog.showModal();
  });
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim() || !weight || weight <= 0 || weight > 120) return;
    onapply({ name: name.trim(), breed: breed.trim() || '믹스 / 모름', size, weight });
  }
</script>

<dialog bind:this={dialog} {onclose} class="app-dialog dog-dialog" aria-labelledby="dog-title">
  <button
    class="dialog-close icon-button"
    aria-label="반려견 정보 닫기"
    onclick={() => dialog.close()}><X size={21} /></button
  >
  <div class="dialog-icon"><PawPrint size={29} strokeWidth={1.5} /></div>
  <span class="dialog-eyebrow">MY LITTLE COMPANION</span>
  <h2 id="dog-title">누구와 함께 떠나나요?</h2>
  <p class="dialog-description">
    우리 강아지 정보를 알려주면<br />장소의 동반 조건과 함께 보여드릴게요.
  </p>
  <form onsubmit={submit}>
    <label for="dog-name">강아지 이름</label><input
      id="dog-name"
      bind:value={name}
      placeholder="예: 두부"
      required
      maxlength="20"
      autocomplete="off"
    />
    <label for="dog-breed">견종 <span>선택</span></label><input
      id="dog-breed"
      bind:value={breed}
      placeholder="예: 말티푸, 진돗개, 믹스"
      maxlength="40"
    />
    <fieldset>
      <legend>체급</legend>
      <div class="size-options">
        {#each [['small', '소형견'], ['medium', '중형견'], ['large', '대형견']] as [value, label]}<label
            class:active={size === value}
            ><input
              type="radio"
              name="dog-size"
              {value}
              checked={size === value}
              onchange={() => (size = value as DogSize)}
            /><PawPrint
              size={value === 'large' ? 24 : value === 'medium' ? 20 : 16}
            />{label}</label
          >{/each}
      </div>
    </fieldset>
    <label for="dog-weight">현재 몸무게</label>
    <div class="weight-input">
      <input
        id="dog-weight"
        type="number"
        min="0.1"
        max="120"
        step="0.1"
        bind:value={weight}
        required
        placeholder="0.0"
        inputmode="decimal"
      /><span>kg</span>
    </div>
    <p class="form-note">
      체급 기준은 장소마다 달라요. 실제 체중과 원문 규정을 함께 확인해요. 로그인 전에는 이
      화면에서만 적용돼요.
    </p>
    <button class="primary-button" type="submit">이 정보로 살펴보기<ArrowRight size={17} /></button>
  </form>
</dialog>

<style>
  .dog-dialog {
    width: 430px;
  }
  .dog-dialog form {
    text-align: left;
    margin-top: 27px;
  }
  form > label,
  legend {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  form > label:not(:first-child) {
    margin-top: 18px;
  }
  label > span {
    font-weight: 400;
    font-size: 10px;
    color: var(--muted);
    margin-left: 3px;
  }
  input:not([type='radio']) {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 9px;
    height: 44px;
    padding: 0 13px;
    font-size: 13px;
    background: white;
    outline: none;
  }
  input:not([type='radio']):focus {
    border-color: var(--brown);
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 20px 0;
  }
  legend {
    padding: 0;
  }
  .size-options {
    display: flex;
    gap: 9px;
  }
  .size-options label {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--line);
    height: 48px;
    border-radius: 9px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  .size-options label.active {
    border-color: var(--brown);
    color: var(--brown);
    background: var(--cream);
  }
  .size-options input {
    position: absolute;
    opacity: 0;
  }
  .size-options label:has(input:focus-visible) {
    outline: 2px solid var(--brown);
    outline-offset: 3px;
  }
  .weight-input {
    position: relative;
  }
  .weight-input > span {
    position: absolute;
    right: 14px;
    top: 14px;
    font-size: 12px;
    color: var(--muted);
  }
  .form-note {
    font-size: 10px;
    line-height: 1.8;
    color: var(--muted);
    margin: 17px 0 22px;
  }
  .primary-button {
    width: 100%;
  }
</style>
