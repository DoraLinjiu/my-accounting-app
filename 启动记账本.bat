@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Dora 记账本 - 本地服务

set PYEXE=C:\Users\28786\.workbuddy\binaries\python\envs\default\Scripts\python.exe
if not exist "%PYEXE%" set PYEXE=C:\Python314\python.exe
if not exist "%PYEXE%" set PYEXE=python

echo.
echo   ========================================
echo      Dora 记账本  本地服务已启动
echo      地址: http://localhost:8765
echo.
echo      安装为桌面应用:
echo        浏览器右上角菜单 -^> 安装
echo      (不要用「创建快捷方式」, 那样带浏览器角标)
echo.
echo      关闭本窗口即停止服务
echo   ========================================
echo.

start "Dora Server" /min "%PYEXE%" -m http.server 8765 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://localhost:8765/index.html"
