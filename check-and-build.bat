@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

cd /d "c:\Users\Ivan Work\Projects\intermingled-"

echo ==== Checking node_modules structure ====
echo.
if exist "node_modules\expo-router\entry.js" (
    echo [OK] expo-router/entry.js found in root node_modules
) else (
    echo [WARN] expo-router/entry.js NOT in root node_modules
    dir /s /b "node_modules\expo-router\entry.js" 2>nul
    echo ---
    dir /s /b "node_modules\expo-router" 2>nul | findstr /i "entry"
)
echo.
if exist "artifacts\flirtfest-mobile\node_modules" (
    if exist "artifacts\flirtfest-mobile\node_modules\expo-router\entry.js" (
        echo [OK] expo-router/entry.js found in project local node_modules
    ) else (
        echo [WARN] project node_modules exists but no expo-router/entry.js
    )
) else (
    echo Project does not have local node_modules
)
echo.
echo ==== Starting Build ====
echo.
cd /d "c:\Users\Ivan Work\Projects\intermingled-\artifacts\flirtfest-mobile\android"
echo Current dir: !cd!
echo.
gradlew.bat :app:bundleRelease --info 2>&1
echo.
echo ==== Build Exit Code: !ERRORLEVEL! ====
ENDLOCAL

