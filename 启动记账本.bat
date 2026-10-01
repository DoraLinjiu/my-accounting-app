@echo off
cd /d "%~dp0"
title JiZhangBen - local server

set PYEXE=C:\Users\28786\.workbuddy\binaries\python\envs\default\Scripts\python.exe
if not exist "%PYEXE%" set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python

rem ---------------------------------------------------------------
rem Mirror the GitHub Pages URL shape locally.
rem manifest start_url / scope are /my-accounting-app/ , so the app
rem is also served under that same path here. Otherwise an app
rem installed from localhost would open a 404 page.
rem A directory junction is used, which needs no admin rights.
rem (This file is ASCII-only on purpose: Chinese text in a .bat gets
rem  mis-decoded under a non-UTF8 console codepage and corrupts the
rem  surrounding if-blocks.)
rem ---------------------------------------------------------------
set APPNAME=my-accounting-app
set APPDIR=%~dp0
if "%APPDIR:~-1%"=="\" set APPDIR=%APPDIR:~0,-1%
set SERVEROOT=%TEMP%\jizhangben-serve

if not exist "%SERVEROOT%" mkdir "%SERVEROOT%" >nul 2>&1
if not exist "%SERVEROOT%\%APPNAME%\index.html" (
  if exist "%SERVEROOT%\%APPNAME%" rmdir "%SERVEROOT%\%APPNAME%" >nul 2>&1
  mklink /J "%SERVEROOT%\%APPNAME%" "%APPDIR%" >nul 2>&1
)

if exist "%SERVEROOT%\%APPNAME%\index.html" (
  set OPENURL=http://localhost:8765/%APPNAME%/
) else (
  set SERVEROOT=%APPDIR%
  set OPENURL=http://localhost:8765/index.html
)

echo.
echo   ========================================
echo      JiZhangBen  local server is running
echo      URL: %OPENURL%
echo.
echo      Install as a desktop app:
echo        browser menu  -^>  Install app
echo      Do NOT use "Create shortcut" (that adds a browser badge).
echo.
echo      Close this window to stop the server.
echo   ========================================
echo.

start "JiZhangBen Server" /min "%PYEXE%" -m http.server 8765 --bind 127.0.0.1 --directory "%SERVEROOT%"
timeout /t 2 /nobreak >nul
start "" "%OPENURL%"
