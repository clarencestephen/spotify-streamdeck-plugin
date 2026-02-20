@echo off
setlocal

echo.
echo  Essentials for Spotify - Installer
echo  ====================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download it from https://nodejs.org/ (version 20 or later)
    echo.
    pause
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_VER=%%v
set NODE_VER=%NODE_VER:v=%
if %NODE_VER% lss 20 (
    echo  [ERROR] Node.js 20 or later is required. You have v%NODE_VER%.
    echo  Download it from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo  [1/3] Installing dependencies...
call npm install --silent
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)

echo  [2/3] Building plugin...
call npm run build --silent
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed.
    pause
    exit /b 1
)

echo  [3/3] Installing to Stream Deck...
set PLUGIN_DIR=%APPDATA%\Elgato\StreamDeck\Plugins\com.cognosis.spotify-playlist-ops.sdPlugin

:: Remove old installation if present
if exist "%PLUGIN_DIR%" (
    echo  Removing previous installation...
    rmdir /s /q "%PLUGIN_DIR%"
)

:: Copy plugin
xcopy "com.cognosis.spotify-playlist-ops.sdPlugin" "%PLUGIN_DIR%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo  [ERROR] Failed to copy plugin files.
    pause
    exit /b 1
)

echo.
echo  Done! Restart Stream Deck to load the plugin.
echo  Then drag the "Setup" button onto your deck to get started.
echo.
pause
