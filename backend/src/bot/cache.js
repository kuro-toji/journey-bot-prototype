/**
 * In-memory session cache for the bot.
 *
 * Keyed by `user:<userId>`. The cache holds the user's pre-fetched FD
 * data so that "show my FDs" / "total value" / "maturity" replies are
 * served from memory without hitting Postgres on every click.
 *
 * Lifecycle:
 *   - Populated on successful login (POST /api/auth/verify-otp) by
 *     routes/auth.js.
 *   - Cleared on logout (POST /api/auth/logout) and on the next login
 *     as defense-in-depth.
 *   - Auto-expires after `DEFAULT_TTL_MS` of inactivity.
 *
 * Concurrency: single-process Node, single-threaded JS, no locks
 * needed. If we ever move to multi-process (PM2 cluster), swap this
 * for Redis — same API, just external.
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SWEEP_INTERVAL_MS = 60 * 1000;   // 1 minute

const store = new Map(); // key -> { data, expiresAt }

function setCache(userId, data, ttlMs = DEFAULT_TTL_MS) {
  if (!userId) return;
  const key = `user:${userId}`;
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function getCache(userId) {
  if (!userId) return null;
  const key = `user:${userId}`;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function clearCache(userId) {
  if (!userId) return;
  store.delete(`user:${userId}`);
}

function clearAllCache() {
  store.clear();
}

// Periodic sweep of expired entries.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, SWEEP_INTERVAL_MS);
// Don't keep the event loop alive just for the sweep.
if (sweepTimer.unref) sweepTimer.unref();

module.exports = { setCache, getCache, clearCache, clearAllCache, DEFAULT_TTL_MS };
