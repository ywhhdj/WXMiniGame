#!/usr/bin/env bash
# 编译全部云函数 TypeScript → JavaScript（部署产物）。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node scripts/sync-shared.js >/dev/null
TSC="${TSC_BIN:-$ROOT/node_modules/.bin/tsc}"
if [ ! -x "$TSC" ]; then
  echo "[build:cloud] 未找到本地 tsc，请先执行 npm install" >&2
  exit 1
fi
for dir in cloudfunctions/game cloudfunctions/getMiniProgramCode; do
  echo "[build:cloud] 编译 $dir"
  "$TSC" -p "$dir/tsconfig.json"
done
echo "[build:cloud] 完成（.js 产物由 .gitignore 排除，不入库）"
