#!/usr/bin/env bash
# StockMate —— 一键 Release 构建（前端 + 后端一体化）
# 用法: 在项目根目录执行  ./release.sh  （或  bash release.sh）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "============================================"
echo " StockMate —— 一键 Release 构建（前端 + 后端）"
echo "============================================"

# ---- 步骤 1/2：前端构建（tsc + vite → ui/dist）----
echo
echo "步骤 1/2：构建前端（ui/dist）..."
( cd ui && npm run build )

# ---- 步骤 2/2：后端 Release 打包（内嵌 dist → exe）----
echo
echo "步骤 2/2：后端 Release 打包..."
# 确保 cargo 在 PATH 中
if ! command -v cargo >/dev/null 2>&1; then
  CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin"
  export PATH="$CARGO_BIN:$PATH"
fi

# 用项目内的 Tauri CLI；--no-bundle 只产出主 exe（如需安装包，去掉 --no-bundle）
./ui/node_modules/.bin/tauri build --no-bundle

echo
echo "============================================"
echo " ✅ Release 构建完成！"
echo "    可执行文件: target/release/stockmate-tauri.exe"
echo "============================================"
