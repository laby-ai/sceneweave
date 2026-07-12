#!/bin/bash
set -Eeuo pipefail

WORKSPACE_PATH="${WORKSPACE_PATH:-$(pwd)}"

PORT="${PORT:-5000}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"
BIND_HOST="${BIND_HOST:-127.0.0.1}"

if [[ "${NODE_ENV:-production}" == "production" && ! "${HUIYING_OBSERVABILITY_HASH_KEY:-}" =~ ^.{32,}$ ]]; then
    echo "observability hash key is required in production" >&2
    exit 78
fi


start_service() {
    cd "${WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} BIND_HOST=${BIND_HOST} node dist/server.js
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
