/**
 * Per-user (and per-IP for anon) rate limiter for the LLM endpoint.
 *
 * Why a separate module from the LLM client?
 *   - The LLM client is stateless; the limiter owns the
 *     request-count state.
 *   - The cap is per-hour, configurable via env.
 *   - We also track total tokens used per key (for cost
 *     visibility) but do NOT enforce a token cap yet — the
 *     per-message max_completion_tokens in llm.js is the
 *     primary cost guard.
 *
 * Storage: in-memory Map. Single-process Node, no locks needed.
 * Restart wipes the counters, which is fine for a demo.
 *
 * Key format: 'user:<userId>' for authed viewers, 'ip:<ip>' for
 * anonymous viewers. The route layer picks the key based on
 * whether req.user is set.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function authedLimit()  { return parseInt(process.env.LLM_RATE_LIMIT_AUTHED, 10) || 20; }
function anonLimit()    { return parseInt(process.env.LLM_RATE_LIMIT_ANON,   10) || 5;  }

const buckets = new Map(); // key -> { count, tokens, windowStart }

function get(key) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, tokens: 0, windowStart: now };
    buckets.set(key, b);
  }
  return b;
}

function check(key, isAuthed) {
  const limit = isAuthed ? authedLimit() : anonLimit();
  const b = get(key);
  const allowed = b.count < limit;
  const remaining = Math.max(0, limit - b.count);
  const resetInMs = Math.max(0, WINDOW_MS - (Date.now() - b.windowStart));
  return { allowed, remaining, limit, resetInMs };
}

function record(key, tokensUsed) {
  const b = get(key);
  b.count += 1;
  b.tokens += tokensUsed || 0;
}

function reset(key) {
  if (key) buckets.delete(key);
}

// Periodic sweep so old buckets don't accumulate forever
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.windowStart >= WINDOW_MS) buckets.delete(k);
  }
}, 5 * 60 * 1000);
if (sweep.unref) sweep.unref();

module.exports = { check, record, reset };
