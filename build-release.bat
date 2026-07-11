@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd /d "C:\Users\gao_y\Documents\Kimi\Workspaces\sstock\stockmate"
C:\Users\gao_y\.cargo\bin\cargo.exe build --release -p stockmate-tauri > "C:\Users\gao_y\Documents\Kimi\Workspaces\sstock\stockmate\build.log" 2>&1
echo BUILD_EXIT_CODE=%ERRORLEVEL% >> "C:\Users\gao_y\Documents\Kimi\Workspaces\sstock\stockmate\build.log"
