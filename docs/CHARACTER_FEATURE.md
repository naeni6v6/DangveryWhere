# 캐릭터 세부 꾸미기

프로필에 적어 둔 견종의 3D 캐릭터를 밑그림으로 놓고, 눈·귀·얼굴 크기와 털 색을 우리 아이에 가깝게
다듬어 저장하는 기능입니다. 튜토리얼(`/web/start`) 마지막 단계와 우리 강아지(`/web/dog`) 무대에서 들어갑니다.

> **2026-09-20 변경:** 원래는 사진 한 장을 올리면 AI 가 견종을 알아맞혀 캐릭터를 그려 주는
> "내 강아지 캐릭터 만들기" 였습니다. 사진만 보고 견종을 맞히는 정답률이 너무 낮아 **사진 업로드를
> 걷어 내고**, 이미 만들어 둔 얼굴 수정 기능을 살려 지금의 이름·흐름으로 바꿨습니다.
> 서버 AI 파이프라인(아래 "남겨 둔 AI 코드")은 지우지 않고 남겨 두었지만 화면에서 부르지 않습니다.

## 흐름

```
/web/start 완료 단계 ─[캐릭터 세부 꾸미기]─┐
/web/dog 무대 ─[캐릭터 세부 꾸미기]───────┴▶ /web/start/character?dog=<id>
  1 꾸미기  견종 캐릭터를 밑그림으로 불러와 슬라이더·눈 모양·털 색 조절 (전부 브라우저 캔버스)
  2 완성    최종 그림(투명 WebP) + 값 저장 → 로그인 전 localStorage, 로그인 후 dog_characters
```

서버 호출도 AI 호출도 없습니다. 기다림 없이 바로 뜨고, 오프라인에서도 동작합니다.

## 어디서 무엇이 정해지는가

| 구분 | 처리 |
|---|---|
| 밑그림 캐릭터 (`static/dogs/<key>.webp`) | 프로필 견종 → `$lib/domain/breeds.ts` 의 `findBreed` 로 결정. 못 찾으면 말티즈 |
| 견종 기본 특징 (털 색·질감·귀·주둥이·꼬리) | `$lib/domain/breedCharacter.ts` 의 `breedSketches` |
| 부위 위치 (머리·눈·코·귀·몸·꼬리 박스) | 같은 파일의 `breedLayouts`. 손으로 잰 값이라 새 견종을 넣으면 여기도 채워야 함 |
| 눈 크기·간격·모양, 얼굴·머리·귀·꼬리·몸 크기, 몸통 비율, 전체 크기 | `src/lib/character/renderer.ts` 국소 워프 (liquify) |
| 털 색상 6종 | 같은 파일의 재채색. 눈·코·입, 흰 무늬, 분홍 귀 속, 그림자는 보호 |

`expression`(표정)은 자료 구조에만 남아 있고 항상 `smile` 입니다. 표정은 그림 자체를 새로 그려야
바뀌는 값이라, AI 를 걷어 내면서 화면에서 뺐습니다.

## 파일

- `src/lib/domain/character.ts` — 타입, 슬라이더 범위, 색 프리셋, 검증. 서버·브라우저·테스트 공용
- `src/lib/domain/breedCharacter.ts` — **견종별 기본 특징·부위 위치.** 브라우저와 서버가 함께 읽습니다
- `src/lib/character/renderer.ts` — 캔버스 재채색 + 워프, 저장용 내보내기
- `src/lib/character/image.ts` — 저장 전 그림 축소 (`shrinkDataUrl`)
- `src/routes/web/start/character/+page.svelte`, `src/lib/components/web/CharacterCanvas.svelte`
- `src/routes/api/character/+server.ts` — 저장(PUT)·삭제(DELETE). 이건 계속 씁니다
- `db/008_dog_characters.sql` — `npm run db:setup` 으로 적용

## 새 견종을 추가하려면

1. `static/dogs/<key>.webp`(무대용)·`static/dogs/thumb/<key>.webp`(목록용)·`static/dogs/cut/<key>.webp`(배경 지운 판) 추가
   — `scripts/breed-import.py`, `scripts/breed-cutout.py` 참고
2. `src/lib/domain/breeds.ts` 목록에 추가. **격자가 한 줄 다섯 칸이라 23종 + 믹스·기타 = 25칸으로 딱 맞습니다.**
   한 종을 더하려면 한 종을 빼야 줄이 안 삐져나와요
3. `src/lib/domain/breedCharacter.ts` 에 `breedSketches`(기본 특징)와 `breedLayouts`(부위 위치) 추가.
   `breedLayouts` 가 없으면 자동 추정값으로 그려져 슬라이더가 엉뚱한 곳을 늘립니다

## 남겨 둔 AI 코드

`src/lib/server/character/`(`prompts.ts`·`gemini.ts`·`claude.ts`·`references.ts`·`mock.ts`·`index.ts`)와
`src/routes/api/character/{analyze,generate}/+server.ts` 는 **지우지 않고 남아 있지만 화면에서 부르지
않습니다.** 사진 기반 생성을 다시 열려면 그 엔드포인트에 사진을 보내는 화면만 새로 만들면 됩니다.
필요 없다고 판단되면 위 파일들과 `.env` 의 `GEMINI_*`·`ANTHROPIC_API_KEY`·`CHARACTER_MOCK` 을 통째로
지워도 지금 기능은 그대로 동작합니다.

`mock.ts` 는 `breedCharacter.ts` 의 값을 그대로 씁니다. 견종 데이터를 고칠 때 두 곳을 손댈 필요가 없습니다.

## 스타일 가이드 (assets/breeds 견종 캐릭터에서 뽑은 공통점)

머리가 몸만큼 큰 치비 비율, 짧고 통통한 다리, 작은 검은 구슬 눈 + 흰 하이라이트 하나, 둥근 검정 코, 가는 선 미소,
털은 가닥 없이 매끈한 덩어리, 무광 소프트비닐 피규어 질감, 좌상단 조명, 발 아래 옅은 그림자, 흰 배경, 오른쪽을 보는
4분의 3 측면, 따뜻한 파스텔 톤. 이 문장이 `prompts.ts` 의 `STYLE_GUIDE` 입니다. 새 견종 그림을 만들 때 참고하세요.
