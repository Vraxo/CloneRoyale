@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing project dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

echo.
echo Starting CloneRoyale...
echo The browser will open automatically.
echo Press Ctrl+C here to stop the development server.
echo.
call npm run dev -- --open

if errorlevel 1 (
    echo.
    echo The development server exited with an error.
    pause
)
