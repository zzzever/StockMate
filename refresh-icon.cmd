@echo off
chcp 65001 >nul
title StockMate — 刷新图标缓存

echo === 清除 Windows 图标缓存 ===
echo.

:: 关闭正在运行的 StockMate（如果有）
echo 1/3: 关闭已运行的 StockMate...
taskkill /f /im stockmate-tauri.exe 2>nul
timeout /t 1 /nobreak >nul

:: 清除图标缓存
echo 2/3: 删除图标缓存数据库...
if exist "%LocalAppData%\IconCache.db" (
    del /f /q "%LocalAppData%\IconCache.db"
    echo     ✓ 已删除 IconCache.db
) else (
    echo     - IconCache.db 不存在，跳过
)

:: 重启 Explorer（强制刷新）
echo 3/3: 重启 Explorer 刷新任务栏...
taskkill /f /im explorer.exe >nul
timeout /t 2 /nobreak >nul
start explorer.exe

echo.
echo ✓ 图标缓存已清除！
echo.
echo 请双击以下路径启动 StockMate：
echo %~dp0target\release\stockmate-tauri.exe
echo.
pause
