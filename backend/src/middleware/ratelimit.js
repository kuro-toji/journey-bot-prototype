/**
 * Rate limit middleware using express-rate-limit.
 *
 * For the demo we only need ONE limiter:
 *   - verifyLimiter  : applied to /api/bot/verify (anon phone+dob+pan lookup)
 *                      to prevent brute-force enumeration of users
 *
 * 5 attempts per IP per hour is generous for legitimate use but stops
 * scripted enumeration. Production would tighten this further and
 * also add a per-account lockout.
 */

const rateLimit = require('express-rate-limit');

const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

module.exports = { verifyLimiter };
