@echo off
chcp 65001 >nul
title StockMate — 安装 git hooks

echo === 安装 StockMate git hooks ===
echo.

:: 复制 hook 到 .git/hooks/
copy /y "%~dp0.hooks\post-commit" "%~dp0.git\hooks\post-commit" >nul
echo ✓ post-commit hook 已安装

echo.
echo 今后每次 git commit 后，将自动构建前端（npm run build）
echo 和后端（cargo build --release）。
echo.
pause
