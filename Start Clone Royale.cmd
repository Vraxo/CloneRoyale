@echo off
setlocal
title Clone Royale Launcher
cd /d "%~dp0"

echo.
echo  ======================================
echo          CLONE ROYALE LAUNCHER
echo  ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js 20.19 or newer from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a<20||(a===20&&b<19)) process.exit(1)"
if errorlevel 1 (
  echo ERROR: Node.js 20.19 or newer is required.
  echo Installed version: %NODE_VERSION%
  echo Update Node.js from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm included.
  echo.
  pause
  exit /b 1
)

set "TAILSCALE="
for /f "delims=" %%T in ('where tailscale 2^>nul') do if not defined TAILSCALE set "TAILSCALE=%%T"
if not defined TAILSCALE if exist "%ProgramFiles%\Tailscale\tailscale.exe" set "TAILSCALE=%ProgramFiles%\Tailscale\tailscale.exe"
if not defined TAILSCALE if exist "%ProgramFiles(x86)%\Tailscale\tailscale.exe" set "TAILSCALE=%ProgramFiles(x86)%\Tailscale\tailscale.exe"
if not defined TAILSCALE (
  echo ERROR: Tailscale was not found.
  echo Install it with:
  echo   winget install -e --id Tailscale.Tailscale
  echo Then sign in to Tailscale and run this launcher again.
  echo.
  pause
  exit /b 1
)

echo Checking Tailscale connection...
"%TAILSCALE%" status >nul 2>nul
if errorlevel 1 (
  echo ERROR: Tailscale is not connected.
  echo Open Tailscale, sign in, and make sure it says Connected.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies. This is only needed the first time...
  call npm install
  if errorlevel 1 goto failed
)

echo.
echo Building Clone Royale...
call npm run build
if errorlevel 1 goto failed

echo.
echo Starting the game server in a separate window...
start "Clone Royale Server" /min cmd /c "cd /d ""%~dp0"" && npm start"

echo Waiting for the game server to become ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3001/healthz -TimeoutSec 2; if($r.StatusCode -eq 200 -and $r.Content -eq 'ok'){ $ready=$true; break } } catch {}; Start-Sleep -Seconds 1 }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo ERROR: The game server did not become ready on port 3001.
  echo Check the separate Clone Royale Server window.
  echo.
  pause
  exit /b 1
)

echo.
echo Enabling the public Tailscale Funnel...
"%TAILSCALE%" funnel --bg 3001
if errorlevel 1 (
  echo.
  echo ERROR: Tailscale could not enable Funnel.
  echo If this is the first run, open Tailscale's approval link or enable Funnel
  echo for your tailnet in the Tailscale admin console, then run this file again.
  echo See https://tailscale.com/kb/1223/funnel/
  echo.
  pause
  exit /b 1
)

echo.
echo  ======================================
echo       CLONE ROYALE IS NOW ONLINE
echo  ======================================
echo.
echo Local address:
echo   http://localhost:3001
echo.
echo Opening Clone Royale in your browser...
start "" "http://localhost:3001"
echo.
echo Public Tailscale address:
"%TAILSCALE%" funnel status
echo.
echo Keep Tailscale running. The game server is in its own minimized window.
echo Close the Clone Royale Server window to stop the game server.
echo.
pause
goto end

:failed
echo.
echo Clone Royale could not start. Check the error messages above.
echo.
pause
exit /b 1

:end
endlocal
