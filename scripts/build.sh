#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline 2>&1 | tail -5

echo "Building the Next.js project..."
# basePath 必须在 build 时写入产物；仅 runtime 设 NEXT_PUBLIC_BASE_PATH 无法修正 HTML 里的 /_next 路径。
if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
pnpm next build 2>&1 | tail -30

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify 2>&1 | tail -5

echo "Build completed successfully!"
