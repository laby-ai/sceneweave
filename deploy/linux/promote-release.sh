#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${HUIYING_ROOT:-/opt/huiying}"
SERVICE="${HUIYING_SERVICE:-huiying}"
CANDIDATE_PORT="${HUIYING_CANDIDATE_PORT:-5199}"
CANDIDATE_UNIT="${HUIYING_CANDIDATE_UNIT:-huiying-release-candidate}"
STABLE_ENV="${HUIYING_STABLE_ENV:-$ROOT/config/.env.production}"
SHARED_ARTIFACTS="${HUIYING_SHARED_ARTIFACTS:-$ROOT/shared/artifacts}"
RELEASES_ROOT="$ROOT/releases"
CANDIDATE="${1:-}"
PROMOTED=0
OLD_CURRENT=""

die() {
  printf 'promotion_error: %s\n' "$1" >&2
  exit 1
}

stop_candidate() {
  systemctl stop "$CANDIDATE_UNIT" >/dev/null 2>&1 || true
  systemctl reset-failed "$CANDIDATE_UNIT" >/dev/null 2>&1 || true
}

wait_for_health() {
  local port="$1"
  local output="$2"
  local code="000"
  for _ in $(seq 1 80); do
    code=$(curl -sS -o "$output" -w '%{http_code}' --max-time 2 "http://127.0.0.1:${port}/huiying/api/health" || true)
    [[ "$code" == "200" ]] && break
    sleep 1
  done
  [[ "$code" == "200" ]] || return 1
  python3 - "$output" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as handle:
    readiness = json.load(handle)['runtimeReadiness']
for name in ('finalVideoStore', 'subjectStore', 'operationalObservability'):
    assert readiness[name]['ready'] is True, name
PY
}

rollback() {
  local status=$?
  stop_candidate
  if [[ "$PROMOTED" == "1" && -n "$OLD_CURRENT" ]]; then
    printf 'promotion_rollback: restoring previous release\n' >&2
    ln -sfn "$OLD_CURRENT" "$ROOT/.current-rollback"
    mv -Tf "$ROOT/.current-rollback" "$ROOT/current"
    systemctl restart "$SERVICE"
    wait_for_health 5100 /tmp/huiying-rollback-health.json || true
  fi
  exit "$status"
}
trap rollback ERR INT TERM

[[ -n "$CANDIDATE" ]] || die 'usage: promote-release.sh /opt/huiying/releases/<release>'
CANDIDATE=$(realpath "$CANDIDATE")
[[ "$CANDIDATE" == "$RELEASES_ROOT/"* ]] || die 'candidate must be below the releases root'
[[ -d "$CANDIDATE" ]] || die 'candidate release does not exist'
[[ -f "$CANDIDATE/SOURCE_COMMIT" ]] || die 'candidate is missing SOURCE_COMMIT'
grep -Eq '^[0-9a-f]{40}$' "$CANDIDATE/SOURCE_COMMIT" || die 'SOURCE_COMMIT must be a full commit id'
[[ -f "$CANDIDATE/.next/BUILD_ID" && -f "$CANDIDATE/dist/server.js" ]] || die 'candidate build artifacts are incomplete'
[[ -d "$CANDIDATE/node_modules" ]] || die 'candidate production dependencies are missing'
[[ -x "$CANDIDATE/node_modules/ffmpeg-static/ffmpeg" ]] || die 'packaged ffmpeg is unavailable'
[[ -f "$STABLE_ENV" ]] || die 'stable environment file is missing'
[[ "$(stat -c '%a:%U:%G' "$STABLE_ENV")" == '600:root:root' ]] || die 'stable environment must be root:root mode 600'
install -m 600 -o root -g root "$STABLE_ENV" "$CANDIDATE/.env.production"

mkdir -p "$SHARED_ARTIFACTS"
if [[ -L "$CANDIDATE/artifacts" ]]; then
  [[ "$(realpath "$CANDIDATE/artifacts")" == "$(realpath "$SHARED_ARTIFACTS")" ]] || die 'candidate artifacts points outside shared storage'
elif [[ -e "$CANDIDATE/artifacts" ]]; then
  die 'candidate artifacts must be a shared-storage symlink'
else
  ln -s "$SHARED_ARTIFACTS" "$CANDIDATE/artifacts"
fi

(
  cd "$CANDIDATE"
  node scripts/qa-architecture-guard.mjs >/tmp/huiying-candidate-architecture.json
  node scripts/qa-spaghetti-growth-guard.mjs >/tmp/huiying-candidate-growth.json
  node scripts/qa-smart-vimax-agent-render.mjs >/tmp/huiying-candidate-vimax.json
)

stop_candidate
systemd-run \
  --unit="$CANDIDATE_UNIT" \
  --property="WorkingDirectory=$CANDIDATE" \
  --property="EnvironmentFile=$CANDIDATE/.env.production" \
  --setenv=NODE_ENV=production \
  --setenv="PORT=$CANDIDATE_PORT" \
  --setenv=BIND_HOST=127.0.0.1 \
  --setenv=HOSTNAME=127.0.0.1 \
  --setenv=NEXT_PUBLIC_BASE_PATH=/huiying \
  /usr/bin/node dist/server.js >/dev/null

wait_for_health "$CANDIDATE_PORT" /tmp/huiying-candidate-health.json
[[ "$(curl -L -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${CANDIDATE_PORT}/huiying/")" == "200" ]]
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${CANDIDATE_PORT}/huiying/api/subjects")" == "401" ]]
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${CANDIDATE_PORT}/huiying/api/tasks")" == "401" ]]
stop_candidate

OLD_CURRENT=$(realpath "$ROOT/current")
ln -sfn "$OLD_CURRENT" "$ROOT/.previous-next"
mv -Tf "$ROOT/.previous-next" "$ROOT/previous"
ln -sfn "$CANDIDATE" "$ROOT/.current-next"
PROMOTED=1
systemctl stop "$SERVICE"
mv -Tf "$ROOT/.current-next" "$ROOT/current"
systemctl start "$SERVICE"
wait_for_health 5100 /tmp/huiying-production-health.json
[[ "$(cat "$ROOT/current/SOURCE_COMMIT")" == "$(cat "$CANDIDATE/SOURCE_COMMIT")" ]]
[[ "$(realpath "$ROOT/current/artifacts")" == "$(realpath "$SHARED_ARTIFACTS")" ]]

PROMOTED=0
trap - ERR INT TERM
printf 'promotion_complete: current=%s previous=%s\n' "$(realpath "$ROOT/current")" "$(realpath "$ROOT/previous")"
