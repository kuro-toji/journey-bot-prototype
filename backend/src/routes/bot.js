/**
 * Bot HTTP routes.
 *
 *   GET  /api/bot/menu       - list of clickable chips for the current viewer
 *   POST /api/bot/ask        - dispatch a clicked intent
 *   POST /api/bot/verify     - anon user submits (phone, dob, pan) for verification
 *   POST /api/bot/cache/clear - clear the bot cache for the current user (logout)
 *
 * All routes are read-only with respect to the DB (bot has no write path).
 * The /verify endpoint is rate-limited separately (5/hour per IP).
 */

const express = require('express');
const router = express.Router();

const { dispatch, menuForViewer } = require('../bot/service');
const { verifyAnon, clearToken, clearTokensForUser } = require('../bot/verify');
const { clearCache } = require('../bot/cache');
const { logAnonQuestion } = require('../bot/log');

const { verifyLimiter } = require('../middleware/ratelimit');

const jwt = require('jsonwebtoken');
function softAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (m) {
    try {
      const payload = jwt.verify(m[1], process.env.JWT_SECRET);
      req.user = { userId: payload.userId, phone: payload.phone };
    } catch (e) {
      // invalid token - treat as anonymous, do NOT 401
    }
  }
  next();
}

router.use(softAuth);

router.get('/menu', (req, res) => {
  const isAuthed = !!(req.user && req.user.userId);
  res.json({ menu: menuForViewer(isAuthed) });
});

router.post('/ask', (req, res) => {
  const intent = req.body && req.body.intent;
  if (!intent) return res.status(400).json({ error: 'intent_required' });
  if (req.user) {
    logAnonQuestion({ intent, audience: 'auth', ip: req.ip });
  } else {
    logAnonQuestion({ intent, audience: 'anon', ip: req.ip });
  }
  res.json(dispatch(intent, req));
});

router.post('/verify', verifyLimiter, async (req, res) => {
  const { phone, dob, pan } = req.body || {};
  const result = await verifyAnon(phone, dob, pan, req.ip);
  if (!result.ok) {
    return res.status(401).json({ ok: false, reason: result.reason });
  }
  res.json({
    ok: true,
    token: result.token,
    user: result.user,
    bookings: result.bookings,
  });
});

router.post('/cache/clear', (req, res) => {
  if (req.user && req.user.userId) {
    clearCache(req.user.userId);
    clearTokensForUser(req.user.userId);
  }
  if (req.body && req.body.anonToken) {
    clearToken(req.body.anonToken);
  }
  res.json({ ok: true });
});

module.exports = router;
