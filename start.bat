@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js 20+ belum ditemukan.
  echo Install Node.js LTS terlebih dahulu dari https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%A"
if not defined NODE_MAJOR set "NODE_MAJOR=0"
if %NODE_MAJOR% LSS 20 (
  echo Node.js 20+ diperlukan. Versi sekarang:
  node -v
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo npm install gagal.
    pause
    exit /b 1
  )
)

echo.
echo Starting Auction Overlay server...
start "Auction Overlay Server" /min cmd /k "cd /d ""%~dp0"" && node server.mjs"

set "READY="
for /l %%N in (1,1,40) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8000/api/health; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    set "READY=1"
    goto :ready
  )
  timeout /t 1 /nobreak >nul
)

echo.
echo Server gagal merespons di http://localhost:8000
 echo Cek jendela "Auction Overlay Server" untuk error.
pause
exit /b 1

:ready
echo Auction Overlay running at http://localhost:8000
start "" http://localhost:8000/
exit /b 0
