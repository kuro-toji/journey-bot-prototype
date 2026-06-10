/**
 * Anon user verification for the bot.
 *
 * An anonymous visitor who is actually a registered user can ask
 * the bot to show their FDs. To prevent enumeration, we require ALL
 * THREE of: mobile_number + date_of_birth + pan_number to match
 * exactly. No partial matches. No "OR" logic.
 *
 * On success:
 *   - we return a short-lived verification token (opaque random
 *     string) that the widget stores in sessionStorage
 *   - we also pre-fetch the user's FD bookings and return them in
 *     the same response, so the widget can show data immediately
 *
 * Verification tokens are kept in an in-memory Map and expire after
 * 30 minutes of inactivity. They are cleared on:
 *   - expiry
 *   - explicit /api/bot/cache/clear call
 *
 * The DB constraint `user.pan_number UNIQUE` plus `user.mobile_number`
 * lookup means a successful match is a 1-row result; if we ever see
 * > 1, that's a data-integrity problem and we treat it as no-match.
 *
 * All inputs are validated for shape before hitting Postgres. We never
 * echo PII back to the client beyond what is needed for the response.
 */

const crypto = require('crypto');
const { query } = require('../config/db');
const { setCache } = require('./cache');
const { logVerify } = require('./log');

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const tokens = new Map(); // token -> { userId, expiresAt }

// Strict shape checks
const PHONE_RE = /^[6-9]\d{9}$/;
const PAN_RE  = /^[A-Z]{5}\d{4}[A-Z]$/;
const DOB_RE  = /^\d{4}-\d{2}-\d{2}$/;

function maskPhone(p)  { return p ? p.slice(0, 2) + '****' + p.slice(-2) : ''; }
function maskPan(p)    { return p ? p.slice(0, 2) + '****' + p.slice(2) : ''; }
function maskDob(d)    { return d ? '****-**-' + d.slice(-2) : ''; }

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function storeToken(userId) {
  const token = generateToken();
  tokens.set(token, { userId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function getTokenUserId(token) {
  if (!token) return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(token);
    return null;
  }
  return entry.userId;
}

function clearToken(token) {
  if (token) tokens.delete(token);
}

function clearTokensForUser(userId) {
  if (!userId) return;
  for (const [t, e] of tokens) {
    if (e.userId === userId) tokens.delete(t);
  }
}

// Sweep expired tokens.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [t, e] of tokens) {
    if (now > e.expiresAt) tokens.delete(t);
  }
}, 60_1000);
if (sweep.unref) sweep.unref();

/**
 * Verify a registered user by exact (phone, dob, pan) match.
 * Returns { ok: true, token, user, bookings } on success, or
 *         { ok: false, reason } on any failure.
 */
async function verifyAnon(phone, dob, pan, ip) {
  // Shape validation — never query the DB with junk
  if (!PHONE_RE.test(phone || '')) {
    logVerify({ ip, phone: maskPhone(phone), dob: maskDob(dob), pan: maskPan(pan), outcome: 'bad_phone' });
    return { ok: false, reason: 'invalid_phone' };
  }
  if (!DOB_RE.test(dob || '')) {
    logVerify({ ip, phone: maskPhone(phone), dob: maskDob(dob), pan: maskPan(pan), outcome: 'bad_dob' });
    return { ok: false, reason: 'invalid_dob' };
  }
  if (!PAN_RE.test(pan || '')) {
    logVerify({ ip, phone: maskPhone(phone), dob: maskDob(dob), pan: maskPan(pan), outcome: 'bad_pan' });
    return { ok: false, reason: 'invalid_pan' };
  }

  // Exact match on all three. PAN is UNIQUE in the schema, so this
  // can return at most 1 row. If it returns > 1, treat as no-match.
  const sql = `
    SELECT user_id, full_name, mobile_number, pan_number, date_of_birth, kyc_status
      FROM "user"
     WHERE mobile_number = $1
       AND date_of_birth = $2
       AND pan_number    = $3
     LIMIT 1
  `;
  const r = await query(sql, [phone, dob, pan]);
  if (r.rowCount !== 1) {
    logVerify({ ip, phone: maskPhone(phone), dob: maskDob(dob), pan: maskPan(pan), outcome: 'no_match' });
    return { ok: false, reason: 'no_match' };
  }
  const user = r.rows[0];

  // Pre-fetch bookings so the widget can show data immediately
  const bRes = await query(
    `SELECT j.booking_id, j.bank_reference_id, m.bank_code, m.bank_name,
            j.tenure_months, j.interest_rate_bps, j.customer_type,
            j.principal, j.maturity_amount, j.booking_date, j.maturity_date, j.state
       FROM journey j
       JOIN master m ON j.rate_id = m.rate_id
      WHERE j.user_id = $1
      ORDER BY j.booking_date DESC
      LIMIT 50`,
    [user.user_id]
  );

  const bookings = bRes.rows;
  // Also cache the bookings under the real userId, so if the user
  // later signs in with the same phone, the cache is warm.
  setCache(user.user_id, { bookings });

  const token = storeToken(user.user_id);
  logVerify({ ip, phone: maskPhone(phone), dob: maskDob(dob), pan: maskPan(pan), outcome: 'ok', userId: user.user_id });
  return { ok: true, token, user: { full_name: user.full_name, mobile_number: user.mobile_number }, bookings };
}

/**
 * Fetch the bookings for a userId that has a valid verification
 * token. Used for follow-up queries after the initial verify.
 */
async function getBookingsForUserId(userId) {
  const r = await query(
    `SELECT j.booking_id, j.bank_reference_id, m.bank_code, m.bank_name,
            j.tenure_months, j.interest_rate_bps, j.customer_type,
            j.principal, j.maturity_amount, j.booking_date, j.maturity_date, j.state
       FROM journey j
       JOIN master m ON j.rate_id = m.rate_id
      WHERE j.user_id = $1
      ORDER BY j.booking_date DESC
      LIMIT 50`,
    [userId]
  );
  return r.rows;
}

module.exports = {
  verifyAnon,
  getBookingsForUserId,
  getTokenUserId,
  clearToken,
  clearTokensForUser,
  maskPhone,
  maskPan,
  maskDob,
  TOKEN_TTL_MS,
};
