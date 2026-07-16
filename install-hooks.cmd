@echo off
REM install-hooks.cmd — 安装 git hooks
REM 在项目根目录运行: install-hooks.cmd

set HOOKS_DIR=%~dp0.hooks
set GIT_DIR=%~dp0.git\hooks

if not exist "%GIT_DIR%" (
    echo 错误: .git/hooks 目录不存在
    pause
    exit /b 1
)

echo 安装 post-commit hook...

copy /Y "%HOOKS_DIR%\post-commit" "%GIT_DIR%\post-commit" >nul
if %ERRORLEVEL% neq 0 (
    echo 安装失败
    pause
    exit /b 1
)

echo 安装成功！每次 git commit 后会自动构建前后端。
echo 如需手动关闭，删除 .git/hooks/post-commit
pause
