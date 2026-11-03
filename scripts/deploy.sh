#!/usr/bin/env bash
# 用法：./scripts/deploy.sh <envId> [--dry-run]
# 需要环境变量 WECHAT_CLI 指向微信开发者工具 CLI（--dry-run 时不校验）。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_ID="${1:-}"
DRY=""
[ "${2:-}" = "--dry-run" ] && DRY=1

if [ -z "$ENV_ID" ]; then
  echo "用法: ./scripts/deploy.sh <envId> [--dry-run]" >&2
  exit 1
fi
if ! [[ "$ENV_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "[deploy] envId 含非法字符" >&2
  exit 1
fi
CLI="${WECHAT_CLI:-}"
if [ -z "$DRY" ] && [ -z "$CLI" ]; then
  echo "[deploy] 请设置 WECHAT_CLI 指向微信开发者工具 CLI，例如：" >&2
  echo '  WECHAT_CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli ./scripts/deploy.sh <envId>' >&2
  exit 1
fi

npm run validate:plots
npm run typecheck
npm test
bash scripts/build-cloud.sh

for fn in game getMiniProgramCode; do
  if [ -n "$DRY" ]; then
    echo "[deploy][dry-run] $fn -> $ENV_ID"
  else
    echo "[deploy] 上传 $fn -> $ENV_ID"
    "$CLI" cloud functions deploy --e "$ENV_ID" --n "$fn" --r --project "$ROOT"
  fi
done
echo "[deploy] 完成。请按 docs/部署运维.md 检查集合权限与监控告警。"
