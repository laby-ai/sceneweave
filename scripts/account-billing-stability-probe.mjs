// Stability probe for the shared account + entitlement (billing) service.
// Runs ON the server (services bind 127.0.0.1). Reads the app credential from
// an env file so secrets never print. Exercises auth + reserve/settle/release.
import { createHash, createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = parseEnv(process.env.ACCT_ENV_FILE || '/opt/knowtrail/current/.env.production');
const BASE = (env.ACCOUNT_CENTER_API_BASE || 'http://127.0.0.1:8088').replace(/\/$/, '');
const TENANT = env.ACCOUNT_CENTER_TENANT_ID || 'tenant_acme';
const MEMBER = env.ACCOUNT_CENTER_DEFAULT_MEMBER_ID || 'mem_c_1';
const APP_KEY = env.ACCOUNT_CENTER_APP_KEY || '';
const CRED_KEY = env.ACCOUNT_CENTER_CREDENTIAL_KEY || '';
const SECRET = env.ACCOUNT_CENTER_CLIENT_SECRET || '';
const PRODUCT_AREA = env.ACCOUNT_CENTER_PRODUCT_AREA || 'ai.text';

function sign(idempotencyKey, rawBody) {
  const ts = String(Math.floor(Date.now() / 1000));
  const secretHash = createHash('sha256').update(SECRET).digest('hex');
  const signature = createHmac('sha256', secretHash).update(`${ts}.${idempotencyKey}.${rawBody}`).digest('hex');
  return {
    'X-Application-Key': APP_KEY,
    'X-Application-Credential-Key': CRED_KEY,
    'X-Application-Timestamp': ts,
    'X-Application-Signature': `v1=${signature}`,
  };
}

async function timed(fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function postSigned(path, body, idem) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem, ...sign(idem, raw) },
    body: raw,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${payload.error || JSON.stringify(payload).slice(0, 120)}`);
  return payload;
}

async function authJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${payload.error || JSON.stringify(payload).slice(0, 120)}`);
  return payload;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function reserveReleaseCycle(units = 1000) {
  const requestId = `huiying:stability:${randomUUID()}`;
  const reserve = await postSigned(
    `/v1/tenants/${encodeURIComponent(TENANT)}/members/${encodeURIComponent(MEMBER)}/usage-reservations`,
    { product_area: PRODUCT_AREA, model_name: 'doubao-seed-2-0-pro-260215', units, request_ref: requestId },
    `${requestId}:reserve`,
  );
  if (reserve.warning || !reserve.reservation) throw new Error(`reserve_warning:${reserve.warning || 'no_reservation'}`);
  const rid = reserve.reservation.id;
  await postSigned(
    `/v1/tenants/${encodeURIComponent(TENANT)}/usage-reservations/${encodeURIComponent(rid)}/release`,
    {},
    `${requestId}:release`,
  );
  return rid;
}

const report = { base: BASE, tenant: TENANT, member: MEMBER, appKeyConfigured: Boolean(APP_KEY && CRED_KEY && SECRET), checks: {} };

// 1. health
report.checks.health = await timed(() => authJson('/v1/health'));

// 2. register a fresh local user
const email = `hy-stab-${Date.now()}-${Math.floor(Math.random() * 1e4)}@probe.local`;
const password = `Probe!${randomUUID().slice(0, 10)}`;
const reg = await timed(() => authJson('/v1/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, display_name: 'HY Stability Probe', tenant_id: TENANT }),
}));
report.checks.register = { ok: reg.ok, ms: reg.ms, error: reg.error, member: reg.value?.member, hasToken: Boolean(reg.value?.token) };

// 3. login
const login = await timed(() => authJson('/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}));
const token = login.value?.token;
report.checks.login = { ok: login.ok, ms: login.ms, error: login.error, hasToken: Boolean(token) };

// 4. /me
if (token) {
  const me = await timed(() => authJson('/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }));
  report.checks.me = { ok: me.ok, ms: me.ms, error: me.error, member: me.value?.member };
}

// 5. billing: reserve/release stability (sequential + concurrent)
if (report.appKeyConfigured) {
  const seqLat = [];
  let seqOk = 0; let seqFail = 0; const seqErrors = {};
  for (let i = 0; i < 15; i++) {
    const r = await timed(() => reserveReleaseCycle(1000));
    if (r.ok) { seqOk++; seqLat.push(r.ms); } else { seqFail++; seqErrors[r.error] = (seqErrors[r.error] || 0) + 1; }
  }
  report.checks.billingSequential = { ok: seqOk, fail: seqFail, p50: pct(seqLat, 50), p95: pct(seqLat, 95), max: Math.max(0, ...seqLat), errors: seqErrors };

  const conc = await Promise.all(Array.from({ length: 12 }, () => timed(() => reserveReleaseCycle(1000))));
  const concOk = conc.filter(c => c.ok).length;
  const concErrors = {};
  conc.filter(c => !c.ok).forEach(c => { concErrors[c.error] = (concErrors[c.error] || 0) + 1; });
  report.checks.billingConcurrent = { ok: concOk, fail: conc.length - concOk, p95: pct(conc.filter(c => c.ok).map(c => c.ms), 95), errors: concErrors };

  // idempotency: same reserve key twice must be safe
  const idemReq = `huiying:idem:${randomUUID()}`;
  const idemTest = await timed(async () => {
    const body = { product_area: PRODUCT_AREA, model_name: 'doubao-seed-2-0-pro-260215', units: 1000, request_ref: idemReq };
    const a = await postSigned(`/v1/tenants/${encodeURIComponent(TENANT)}/members/${encodeURIComponent(MEMBER)}/usage-reservations`, body, `${idemReq}:reserve`);
    const b = await postSigned(`/v1/tenants/${encodeURIComponent(TENANT)}/members/${encodeURIComponent(MEMBER)}/usage-reservations`, body, `${idemReq}:reserve`);
    const sameId = a.reservation?.id && a.reservation.id === b.reservation?.id;
    await postSigned(`/v1/tenants/${encodeURIComponent(TENANT)}/usage-reservations/${encodeURIComponent(a.reservation.id)}/release`, {}, `${idemReq}:release`);
    return { sameId, idA: a.reservation?.id, idB: b.reservation?.id };
  });
  report.checks.billingIdempotency = idemTest;

  // full reserve -> settle (tiny units, writes ledger once)
  const settleReq = `huiying:settle:${randomUUID()}`;
  report.checks.billingSettle = await timed(async () => {
    const reserve = await postSigned(`/v1/tenants/${encodeURIComponent(TENANT)}/members/${encodeURIComponent(MEMBER)}/usage-reservations`, { product_area: PRODUCT_AREA, model_name: 'doubao-seed-2-0-pro-260215', units: 1000, request_ref: settleReq }, `${settleReq}:reserve`);
    if (!reserve.reservation) throw new Error('no_reservation_for_settle');
    const settled = await postSigned(`/v1/tenants/${encodeURIComponent(TENANT)}/usage-reservations/${encodeURIComponent(reserve.reservation.id)}/settle`, { actual_units: 1000 }, `${settleReq}:settle`);
    return { reservationId: reserve.reservation.id, settledStatus: settled.status || settled.reservation?.status || 'unknown' };
  });
} else {
  report.checks.billing = 'app_credential_not_configured';
}

console.log(JSON.stringify(report, null, 2));
