@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo ====== Starting Android AAB Build ======
echo.
echo Setting up environment...

cd /d "c:\Users\Ivan Work\Projects\intermingled-\artifacts\flirtfest-mobile\android"

echo Current dir: %cd%
echo.

REM Check if platforms exist
echo Checking Android SDK platforms...
dir "c:\Users\Ivan Work\AppData\Local\Android\Sdk\platforms" 2>nul
echo.

echo Starting Gradle bundleRelease...
gradlew.bat :app:bundleRelease 2>&1

echo.
echo ====== Build Complete ======
echo Exit code: %ERRORLEVEL%

ENDLOCAL

