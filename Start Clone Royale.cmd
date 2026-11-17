@echo off
setlocal
title Clone Royale Server
cd /d "%~dp0"

echo.
echo  ======================================
echo          CLONE ROYALE SERVER
echo  ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js 20.19 or newer from https://nodejs.org/
  echo Then run this file again.
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

if not exist "node_modules" (
  echo Installing dependencies. This is only needed the first time...
  call npm install
  if errorlevel 1 goto failed
)

echo.
echo Building the game...
call npm run build
if errorlevel 1 goto failed

echo.
echo Starting Clone Royale...
echo Open http://localhost:3001 in your browser.
echo To let friends join, keep this window open and start your tunnel separately.
echo Press Ctrl+C to stop the server.
echo.
call npm start
if errorlevel 1 goto failed
goto end

:failed
echo.
echo Clone Royale could not start. Check the error messages above.
echo.
pause
exit /b 1

:end
endlocal
