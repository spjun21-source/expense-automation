@echo off
setlocal
title Bio-Core Expense App Local Server (v5.2.26)
echo ======================================================
echo   ER 바이오코어 사업단 경비 시스템 로컬 서버 구동기
echo ======================================================

echo [1/3] 파이썬(Python) 환경 확인 중...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 파이썬 확인됨. 서버를 시작합니다...
    start http://localhost:8000
    python -m http.server 8000
    goto :end
)

echo [2/3] 파이썬 미설치. 노드(Node.js/NPX) 환경 확인 중...
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Node.js 확인됨. npx serve를 사용하여 서버를 시작합니다...
    start http://localhost:3000
    npx serve -s .
    goto :end
)

echo [3/3] ❌ 실행 가능한 서버 환경(Python/Node)이 없습니다.
echo.
echo [안내] 크롬이나 엣지 등 최신 브라우저는 보안상 로컬 파일을 
echo 직접 열면 정상 작동하지 않습니다. 
echo 파이썬이나 Node.js를 설치하시거나, 웹 서버 환경에서 열어주세요.
echo.
pause

:end
endlocal
