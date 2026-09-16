# 🐕 DangveryWhere (댕브리웨어)

> 2026 관광데이터 활용 공모전 (웹·앱 구현 부문) · 한국관광공사 × 성균관대 AI중심대학사업단
>
> **주제:** 모호한 반려동물 출입 조건 및 규정 인지 오류로 현장 입장 거부 및 헛걸음 유발 문제

반려견과 함께 갈 수 있는 장소를 지도에서 찾고, **크기·실내/야외·목줄 규정** 같은 세부 조건을 미리 확인하는 모바일 웹 앱입니다.
이름은 **댕댕이 + Everywhere** 의 말장난입니다.

---

## ▶ 실행 방법

폴더 맨 위의 **`댕브리웨어 실행`** (로고 아이콘) 을 더블클릭하면 됩니다.

처음 실행하면 자동으로

1. 패키지 설치 (`npm install`, 1~3분)
2. `.env` 파일 생성 (`.env.example` 복사)
3. 개발 서버 시작 후 브라우저 자동 열기 (http://localhost:5173)

까지 진행됩니다. 종료는 검은 창을 닫거나 `Ctrl+C`.

> **지도가 안 보이면:** `.env` 의 `PUBLIC_NAVER_MAP_CLIENT_ID` 에 네이버 지도 Client ID 를 넣고 다시 실행하세요.
> DB(`DATABASE_URL`)·카카오 키가 없어도 강릉 기본 데이터로 동작합니다. 로그인/즐겨찾기만 비활성화됩니다.
>
> **바로가기가 깨졌으면** (폴더를 옮긴 경우): `scripts/make-shortcut.ps1` 우클릭 → *PowerShell로 실행*.

터미널에서 직접 실행하려면:

```bash
npm install
npm run dev -- --open
```

### 🖥 웹(PC) 버전

같은 서버에서 **화면 가득 넓게 보는 PC용 화면**이 `/web` 경로에 있습니다.
폴더 맨 위의 **`댕브리웨어 웹 실행`** 을 더블클릭하면 http://localhost:5173/web 이 바로 열립니다.
(모바일 앱 화면은 http://localhost:5173 그대로. 지도·검색·필터·강아지 프로필·찜·로그인 기능을 모두 공유합니다.)

```bash
npm run dev:web
```

| 주소 | 화면 |
|---|---|
| `/web` | 메인 랜딩페이지 (소개 · 카테고리 · 추천 장소) |
| `/web/explore` | 지도 탐색 (목록 + 네이버 지도 + 상세 패널) |
| `/web/favorites` | 찜한 장소 (로그인 필요) |
| `/web/dog` | 우리 강아지 등록 · 강아지 기준 장소 요약 |

| 파일 | 역할 |
|---|---|
| `src/routes/web/+layout.svelte` | 공통 틀 (왼쪽 메뉴 · 상단 헤더 · 로그인/데이터 안내 창) |
| `src/routes/web/+page.svelte` | 메인 랜딩페이지 |
| `src/routes/web/explore/`, `favorites/`, `dog/` | 각 페이지 |
| `src/routes/web/web.css` | 웹 버전 테마 변수 (크림슨 / 브라운, 크기) — 색·크기를 바꾸려면 여기 |
| `src/lib/web/store.svelte.ts` | 페이지 사이에 유지되는 상태 (검색어 · 강아지 · 찜) |
| `src/lib/components/web/` | 웹 전용 장소 카드 · 상세 패널 |
| `scripts/start-web.cmd` | `댕브리웨어 웹 실행` 버튼이 켜는 스크립트 |

### ⚠️ 검은 창에 "서버가 종료되었습니다"만 뜨고 안 열릴 때 (종료 코드 `-1073740791`)

**Node.js 24.13.0 이하의 버그**입니다. 한글이 포함된 경로(`비교과\관광공모전`)에서 `fs.rmSync` 를 호출하면
오류 메시지 없이 프로세스가 죽습니다 ([nodejs/node#56049](https://github.com/nodejs/node/issues/56049), 24.13.1 에서 수정).
SvelteKit 이 시작할 때 `.svelte-kit\types` 의 오래된 파일을 `rmSync` 로 지우기 때문에, 두 번째 실행부터 서버가 바로 꺼집니다.
`npm run build` 도 같은 이유로 실패합니다.

- **근본 해결:** Node.js 를 **24.13.1 이상**(최신 24 LTS)으로 업데이트 → https://nodejs.org
- **임시 우회:** 실행 버튼(`scripts/start.cmd`)이 시작 전에 `.svelte-kit` 캐시를 cmd 의 `rmdir` 로 지워서 이 경로를 피해 갑니다.
  터미널에서 직접 실행할 때는 아래처럼:

```bash
rmdir /s /q .svelte-kit
npm run dev -- --open
```

---

## 📁 폴더 구조

```
관광공모전/
├─ 댕브리웨어 실행.lnk   ← ★ 실행 버튼 (더블클릭, 모바일 앱 화면)
├─ 댕브리웨어 웹 실행.lnk ← ★ 웹(PC) 화면 실행 버튼
├─ README.md             ← 이 문서
│
├─ src/                  ← 앱 소스 코드
│  ├─ routes/            ← 화면(페이지)과 API 엔드포인트
│  │  ├─ +page.svelte    ←   메인 지도 화면 (모바일 앱)
│  │  ├─ web/            ←   웹(PC) 버전 화면 + 테마 (web.css)
│  │  ├─ api/            ←   즐겨찾기·프로필 API
│  │  └─ auth/           ←   카카오 로그인
│  ├─ lib/
│  │  ├─ components/     ←   지도, 장소 카드, 상세, 반려견 등록 UI
│  │  │  └─ web/         ←   웹(PC) 전용 장소 카드·상세 패널
│  │  ├─ domain/         ←   장소·프로필 규칙 (출입 조건 판정 로직)
│  │  ├─ maps/           ←   네이버 지도 SDK 로더
│  │  └─ server/         ←   DB 접근, 인증, 장소 데이터(강릉 스냅샷)
│  ├─ app.html / app.css ←   HTML 뼈대 · 전역 스타일
│  ├─ hooks.server.ts    ←   요청마다 실행되는 세션 처리
│  └─ service-worker.ts  ←   오프라인(PWA) 지원
│
├─ static/               ← 그대로 배포되는 파일 (앱 아이콘, manifest, 오프라인 페이지)
├─ db/                   ← DB 테이블 생성 SQL
├─ scripts/              ← 실행·DB 유틸 스크립트
│  ├─ start.cmd          ←   실행 버튼이 실제로 켜는 스크립트
│  ├─ start-web.cmd      ←   웹(PC) 실행 버튼이 켜는 스크립트
│  ├─ make-shortcut.ps1  ←   실행 버튼(바로가기) 다시 만들기
│  ├─ database.mjs       ←   npm run db:check / db:setup
│  └─ import-gangneung.mjs
├─ assets/               ← 로고 이미지 (logo.png / logo.ico)
├─ .github/workflows/    ← GitHub CI (검사·테스트·빌드)
│
└─ 설정 파일 (건드릴 일 거의 없음)
   package.json, svelte.config.js, vite.config.ts, tsconfig.json,
   wrangler.jsonc(Cloudflare 배포), .env.example, .prettierrc.json, .gitignore
```

---

## ⚙️ 환경 변수 (`.env`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `PUBLIC_NAVER_MAP_CLIENT_ID` | 지도 표시에 필수 | 네이버 클라우드 Maps > Web Dynamic Map. 로컬 URL(`http://localhost:5173`) 등록 필요 |
| `DATABASE_URL` | 선택 | Neon Postgres 연결 문자열. 없으면 강릉 스냅샷으로 동작 |
| `APP_ORIGIN` | 로그인 시 필수 | 예: `http://127.0.0.1:5173` (끝에 `/` 없음) |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 로그인 시 필수 | 카카오 개발자 콘솔. Redirect URI 는 `{APP_ORIGIN}/auth/kakao/callback` |

---

## 🛠 npm 스크립트

| 명령 | 역할 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run dev:web` | 개발 서버 + 웹(PC) 화면(`/web`) 자동 열기 |
| `npm run build` / `npm run preview` | 프로덕션 빌드 / 빌드 결과 미리보기 |
| `npm run check` | 타입·Svelte 검사 |
| `npm test` | 단위 테스트 (vitest) |
| `npm run db:check` / `npm run db:setup` | DB 연결 확인 / 테이블 생성 + 초기 데이터 |
| `npm run deploy` | Cloudflare Workers 배포 |
| `npm run format` | 코드 포맷 (prettier) |

---

## 🧱 기술 스택

SvelteKit 2 (Svelte 5) · TypeScript · Vite · 네이버 지도 SDK · Neon (Postgres) · 카카오 로그인 · Cloudflare Workers · PWA

## 기능 현황

| 기능 | 상태 |
|---|---|
| 지도 기반 장소 검색 | 🚧 |
| 반려견 조건 필터 (크기, 실내/야외, 목줄) | 🚧 |
| 장소 상세 보기 | 📋 |
| 리뷰 · 방문 기록 | 📋 |
| 즐겨찾기 | 📋 |

🚧 진행 중 · 📋 예정
