# Huiying Deployment Runbook

The GitHub base branch, `/opt/huiying/repo`, release `SOURCE_COMMIT`, and `current` must identify the same full commit before a release is accepted.

## Build and package

Build on a controlled CI or workstation with `NEXT_PUBLIC_BASE_PATH=/huiying`. Package `.next`, `dist`, `public`, source, contracts, scripts, docs, the lock file, and a full `SOURCE_COMMIT`. Do not package `.git`, `node_modules`, `.env.production`, credentials, or generated member data.

On the server, extract below `/opt/huiying/releases`, install or link the locked production dependencies, and make `artifacts` a symlink to `/opt/huiying/shared/artifacts`. Copy `/opt/huiying/config/.env.production` as root mode `0600`; never derive the only configuration copy from a running process.

## Promote

Run as root after verifying the uploaded package hash:

```bash
/opt/huiying/repo/deploy/linux/promote-release.sh /opt/huiying/releases/<release>
```

The script refuses paths outside the release root and validates build metadata, dependencies, packaged FFmpeg, stable environment permissions, shared artifacts, architecture/growth/Vimax gates, candidate health, and anonymous API boundaries. It then atomically updates `previous` and `current`. A failed production health check restores the prior `current` and restarts the service.

## Post-release evidence

Confirm repo/current/source parity, local and public health, anonymous task/subject 401 JSON, shared artifacts, service logs, and the health stale-path scan. Paid providers require separate explicit authorization; deployment validation must remain no-cost.
