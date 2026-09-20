# 🐕 DangveryWhere (댕브리웨어)

> 2026 관광데이터 활용 공모전 (웹·앱 구현 부문) · 한국관광공사 × 성균관대 AI중심대학사업단
>
> **주제:** 모호한 반려동물 출입 조건 및 규정 인지 오류로 현장 입장 거부 및 헛걸음 유발 문제

반려견과 함께 갈 수 있는 장소를 지도에서 찾고, **크기·실내/야외·목줄 규정** 같은 세부 조건을 미리 확인하는 모바일 웹 앱입니다.
이름은 **댕댕이 + Everywhere** 의 말장난입니다.

## 차별성과 발전 방향

**우리 강아지를 중심으로 여행을 준비하고 기억하는 플랫폼**을 지향합니다. 등록한 반려견의 체중·체급을 장소 규정과 비교하고, 최대 두 마리의 동반 조건, 찜, 지역 방문 스탬프, 강아지 캐릭터를 한 서비스에서 다룹니다.

발전계획은 지역 확장, 업소 파트너십, 동선 추천, 장소별 여행 기록, 캐릭터 커스텀 고도화입니다. 여기에 정보 최신성 관리, 반려견 조건별 방문 후기, 상황별 추천을 더합니다. 우선 기존 정보의 정확성과 업체 확인 체계를 갖춘 뒤 지역·여행 기능을 확장합니다.

현재 구현과 향후 계획, 경쟁 서비스 비교 근거, 추진 순서는 [차별성과 발전계획](docs/DIFFERENTIATION_AND_ROADMAP.md)에 정리했습니다.

---

## ▶ 실행 방법

폴더 맨 위의 **`댕브리웨어 실행`** (로고 아이콘) 을 더블클릭하면 됩니다.

처음 실행하면 자동으로

1. 패키지 설치 (`npm install`, 1~3분)
2. `.env` 파일 생성 (`.env.example` 복사)
3. 개발 서버 시작 후 모바일 화면 자동 열기 (http://localhost:5173/mobile)

까지 진행됩니다. 종료는 검은 창을 닫거나 `Ctrl+C`.

> **지도가 안 보이면:** `.env` 의 `PUBLIC_NAVER_MAP_CLIENT_ID` 에 네이버 지도 Client ID 를 넣고 다시 실행하세요.
> DB(`DATABASE_URL`)가 없어도 강릉 기본 데이터와 브라우저에 저장하는 찜·강아지 프로필을 사용할 수 있습니다. 계정별 저장과 아이디·비밀번호 로그인에는 DB가 필요하며, 카카오 키는 카카오 로그인에만 필요합니다.
>
> **바로가기가 깨졌으면** (폴더를 옮긴 경우): `scripts/make-shortcut.ps1` 우클릭 → *PowerShell로 실행*.

터미널에서 직접 실행하려면:

```bash
npm install
npm run dev -- --open
```

### 🖥 웹(PC) 버전

기본 주소(`/`)로 접속하면 **화면 가득 넓게 보는 웹 화면**인 `/web`으로 바로 이동합니다.
폴더 맨 위의 **`댕브리웨어 웹 실행`** 을 더블클릭하면 http://localhost:5173/web 이 바로 열립니다.
(모바일 앱 화면은 http://localhost:5173/mobile 또는 웹 화면의 **모바일 버전** 버튼으로 열 수 있습니다. 지도·검색·필터·강아지 프로필·찜·로그인 기능을 모두 공유합니다. 설치형 앱도 모바일 화면으로 시작합니다.)

```bash
npm run dev:web
```

| 주소 | 화면 |
|---|---|
| `/` | 웹 메인(`/web`)으로 이동 |
| `/web` | 메인 랜딩페이지 (소개 · 카테고리 · 추천 장소) |
| `/mobile` | 모바일 앱 홈 |
| `/web/explore` | 지도 탐색 (목록 + 네이버 지도 + 상세 패널) |
| `/web/favorites` | 찜한 장소 (로그인 필요) |
| `/web/start` | 첫 방문 튜토리얼 (마스코트 인사 → 나만의 강아지 만들기 → 지도로). 한 번 마치면 다시 안 뜨고, `/web/start?replay` 로 다시 볼 수 있음 |
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
│  │  ├─ +page.server.ts ←   기본 접속을 웹 메인으로 연결
│  │  ├─ (mobile)/      ←   모바일 화면 (홈: mobile/)
│  │  ├─ web/            ←   웹(PC) 버전 화면 + 테마 (web.css)
│  │  ├─ api/            ←   즐겨찾기·프로필 API
│  │  └─ auth/           ←   카카오 로그인
│  ├─ lib/
│  │  ├─ components/     ←   지도, 장소 카드, 상세, 반려견 등록 UI
│  │  │  └─ web/         ←   웹(PC) 전용 장소 카드·상세 패널
│  │  ├─ domain/         ←   장소·프로필 규칙 (출입 조건 판정 로직)
│  │  ├─ maps/           ←   네이버 지도 SDK 로더
│  │  └─ server/         ←   DB 접근, 인증, 장소 데이터(강릉 스냅샷 + 지역 저장본)
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

## 지역 확장 준비 데이터

다루는 범위는 **강원도**입니다. 공공데이터가 강원에 가장 두껍게 쌓여 있어, 여러 도를 얕게 펼치기보다
한 도를 제대로 담는 쪽을 골랐습니다. 화면에 연결된 곳은 강릉(DB) + 춘천·양양·홍천·평창(준비 데이터)
**348건**이고, 기본값은 이들을 합친 **강원 전체**입니다. 헤더의 지역 선택으로 한 지역만 좁혀 보면
지도 중심·목록·검색·필터가 함께 바뀝니다.

서귀포·제주시·태안·가평의 후보 저장본도 함께 준비해 두었지만(총 508건 중 253건) 지금은 화면에
연결하지 않았습니다. 파일과 로더는 그대로 있어서 `src/lib/domain/region.ts`에 되돌리면 다시 열립니다.
`npm run data:regions`로 지역코드와 건수를 확인할 수 있습니다. 아직 업체 확인 전이라 화면에
'준비 데이터'로 표시되고, DB(`places` 테이블)에는 넣지 않습니다.
변환 규칙(체중 '미만/이하' 구분, 출처 충돌 보존 등)과 남은 작업은
[지역 데이터 사용 안내](docs/REGION_DATA_GUIDE.txt)에 있습니다.

## ⚙️ 환경 변수 (`.env`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `PUBLIC_NAVER_MAP_CLIENT_ID` | 지도 표시에 필수 | 네이버 클라우드 Maps > Web Dynamic Map. 로컬 URL(`http://localhost:5173`) 등록 필요 |
| `DATABASE_URL` | 선택 | Neon Postgres 연결 문자열. 없으면 강릉 스냅샷으로 동작 |
| `APP_ORIGIN` | 카카오 로그인 시 필수 | 예: `http://127.0.0.1:5173` (끝에 `/` 없음) |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 카카오 로그인 시 필수 | 카카오 개발자 콘솔. Redirect URI 는 `{APP_ORIGIN}/auth/kakao/callback` |

---

## 개인 계정 로그인

모바일과 PC 화면의 **로그인 → 회원가입**에서 아이디, 닉네임, 비밀번호와 비밀번호 확인을 입력하면 계정을 만들고 바로 로그인합니다. 아이디는 대소문자를 구분하지 않으며, 비밀번호는 구분합니다. 로그인한 계정의 강아지·찜·캐릭터를 읽고 저장하며, 로그아웃하면 브라우저의 비회원 기록으로 돌아갑니다.

기존 DB에는 `npm run db:auth`로 계정 마이그레이션만 적용합니다. 신규 DB는 `npm run db:setup`에 포함되어 있습니다. 서버에는 bcrypt 해시만 저장하고 세션은 HttpOnly 쿠키로 유지합니다. 비밀번호 생성·검증은 Neon의 `pgcrypto`에서 비용 12로 수행해 Cloudflare Worker의 CPU 사용을 줄입니다. 기존 계정의 비밀번호와 해시는 그대로 유지됩니다. 로그인·가입 횟수 제한은 DB를 공유하므로 서버 재시작에도 적용됩니다. 만료된 제한 기록은 `DELETE FROM auth_rate_limits WHERE expires_at < now()`로 정리할 수 있습니다.

심사용 계정 등 미리 생성할 계정은 프로세스 환경 변수 `ACCOUNT_PASSWORD`에 비밀번호를 지정하고 `npm run account:create -- <아이디> <닉네임>`으로 만듭니다. 이미 있는 아이디는 덮어쓰지 않으며, 비밀번호는 소스에 기록하지 않습니다. 배포 환경에서도 같은 DB를 연결하고 `009_password_accounts.sql`, `010_database_password_hashing.sql`을 적용해야 합니다.

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
