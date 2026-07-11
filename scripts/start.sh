#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

PORT="${PORT:-5000}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"
BIND_HOST="${BIND_HOST:-127.0.0.1}"


start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} BIND_HOST=${BIND_HOST} node dist/server.js
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
