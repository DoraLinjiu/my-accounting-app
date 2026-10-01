@echo off
chcp 65001 >nul
cd /d "%~dp0"
title JiZhangBen - change version

set NODE=C:\Users\28786\.workbuddy\binaries\node\versions\22.22.2-2\node.exe
if not exist "%NODE%" set NODE=node

echo.
echo   Enter a new version number. It updates ALL places at once:
echo     store.js / manifest.webmanifest / sw.js cache name
echo     index.html ?v= refs / README title
echo.
echo   (ASCII-only file on purpose: Chinese text in a .bat gets
echo    mis-decoded under a non-UTF8 console codepage.)
echo.
set /p NV= New version, e.g. 1.2 or 1.2.0 - press Enter to cancel:

if "%NV%"=="" (
  echo.
  echo   Cancelled. Nothing was changed.
  echo.
  pause
  exit /b
)

echo.
"%NODE%" bump.js %NV%
echo.
pause
