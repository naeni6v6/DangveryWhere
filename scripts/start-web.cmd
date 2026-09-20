@echo off
chcp 65001 >nul
title DangveryWhere (댕브리웨어) 웹 버전 실행
cd /d "%~dp0.."

echo ==========================================
echo   댕브리웨어 (DangveryWhere) 웹(PC) 버전 실행
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다. ^(22.12 이상 필요^)
  echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [안내] 처음 실행입니다. 패키지를 설치합니다. ^(1~3분 소요^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [오류] 패키지 설치에 실패했습니다. 인터넷 연결을 확인하세요.
    pause
    exit /b 1
  )
  echo.
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [안내] .env 파일을 새로 만들었습니다.
  echo        지도가 보이려면 .env 의 PUBLIC_NAVER_MAP_CLIENT_ID 값을 입력하세요.
  echo        ^(DB/카카오 로그인 키는 없어도 기본 장소 데이터로 실행됩니다^)
  echo.
)

rem If a dev server is already running, just open the browser.
rem A second server would move to port 5174 (Naver Maps auth fails there)
rem and the .svelte-kit cleanup below would break the running server.
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 goto start_server
echo [안내] 서버가 이미 실행 중이라 브라우저만 엽니다. ^(주소: http://localhost:5173/web^)
start "" http://localhost:5173/web
timeout /t 3 >nul
exit /b 0
:start_server

rem 한글 경로 + Node.js 24.13.0 이하의 fs.rmSync 버그 우회 (scripts/start.cmd 와 동일)
if exist ".svelte-kit\" rmdir /s /q ".svelte-kit"

echo [안내] 서버를 켜고 웹(PC) 화면을 브라우저로 엽니다. ^(주소: http://localhost:5173/web^)
echo        모바일 앱 화면은 http://localhost:5173/mobile 에서 볼 수 있습니다.
echo        종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo.
call npm run dev -- --open /web
set "EXIT_CODE=%errorlevel%"

echo.
if "%EXIT_CODE%"=="0" (
  echo 서버가 종료되었습니다.
) else (
  echo [오류] 서버가 비정상 종료되었습니다. ^(코드 %EXIT_CODE%^)
  if "%EXIT_CODE%"=="-1073740791" (
    echo        이 코드는 Node.js 의 한글 경로 버그입니다. Node.js 를 최신 24 LTS 로 업데이트하세요.
    echo        https://nodejs.org
  ) else (
    echo        위 메시지를 확인하거나, 이 창의 내용을 캡처해서 문의하세요.
  )
)
pause
