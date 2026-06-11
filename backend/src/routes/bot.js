/**
 * Bot HTTP routes.
 *
 *   GET  /api/bot/menu        - list of clickable chips for the current viewer
 *   POST /api/bot/ask         - dispatch a clicked intent
 *   POST /api/bot/verify      - anon user submits (phone, dob, pan) for verification
 *   POST /api/bot/llm         - free-form Q&A via the MiniMax LLM
 *   POST /api/bot/cache/clear - clear the bot cache for the current user (logout)
 *
 * All routes are read-only with respect to the DB (bot has no write path).
 * The /verify endpoint is rate-limited (5/hour per IP).
 * The /llm endpoint is rate-limited (per-user or per-IP) and proxies
 * to MiniMax with a strict system prompt and a whitelisted set of
 * read-only DB tools.
 */

const express = require('express');
const router = express.Router();

const { dispatch, menuForViewer } = require('../bot/service');
const { verifyAnon, clearToken, clearTokensForUser } = require('../bot/verify');
const { clearCache } = require('../bot/cache');
const { logAnonQuestion } = require('../bot/log');
const { chatCompletion } = require('../bot/llm');
const { TOOL_DEFS, dispatchTool } = require('../bot/llmTools');
const { check: llmCheck, record: llmRecord } = require('../bot/llmRate');

const { verifyLimiter } = require('../middleware/ratelimit');

/**
 * Strict system prompt for the LLM chip.
 *
 * Key rules:
 *  - Scope: ONLY Fixed Deposits, FD comparison, and tightly
 *    related Indian banking concepts (DICGC, KYC, compounding,
 *    TDS on FD interest, premature withdrawal).
 *  - Refuse: off-topic questions, code/SQL requests, PII
 *    collection, personalised financial advice, anything
 *    outside the FD-and-comparison scope.
 *  - Tools: the model can call list_banks, get_rates,
 *    compare_rates. All read-only. Never ask the user to run
 *    SQL or write code.
 *  - Tone: short, friendly, Indian rupees.
 */
const LLM_SYSTEM_PROMPT = [
  "You are FinBot's AI assistant for a Fixed Deposit booking platform (JioFinance-themed, India).",
  "",
  "SCOPE — you ONLY help with:",
  "  - Fixed Deposit concepts: rates, compounding, cumulative vs non-cumulative, premature withdrawal, DICGC insurance, taxation of FD interest, minimum/maximum amounts",
  "  - Comparing FDs across the banks available on this platform (use the compare_rates tool)",
  "  - Indian banking concepts directly related to opening an FD: KYC, Aadhaar eKYC, VKYC, PAN",
  "",
  "OUT OF SCOPE — politely refuse and redirect to the FAQ bot:",
  "  - Stocks, mutual funds, crypto, NPS, PPF, insurance, loans, real estate, taxation beyond FD interest",
  "  - General knowledge, history, science, math, programming, code, SQL, scripts",
  "  - Personal financial advice (you can educate, not advise)",
  "  - Any request to write or run code, queries, or commands",
  "",
  "WHEN REFUSING, say exactly: 'I can only help with Fixed Deposits and FD comparison on this platform. Try the FAQ bot for that.'",
  "",
  "TOOLS YOU CAN USE (read-only, no writes):",
  "  - list_banks(): list all banks on the platform",
  "  - get_rates({bank_code?, tenure_months?, customer_type?}): look up rate rows",
  "  - compare_rates({tenure_months, customer_type?}): side-by-side comparison for a tenure",
  "Never invent a tool. Never claim a tool returned data it did not.",
  "When the user asks for a comparison, make AT MOST 2 tool calls (e.g. one list_banks and one compare_rates), then give the final answer in the next turn.",
  "",
  "FORMAT:",
  "  - Use Indian rupees (Rs) and Indian conventions",
  "  - Keep replies under 220 words unless the user explicitly asks for more",
  "  - Use bullet points for lists, short paragraphs otherwise",
  "  - Be friendly and clear; assume a first-time investor",
  "  - Never ask for or repeat personal data (PAN, Aadhaar, DOB, mobile, OTP, card numbers)",
  "  - If the user shares PII, do NOT echo it back; continue the answer without it",
  "",
  "CONTEXT YOU KNOW:",
  "  - Banks on this platform (queried at runtime via tools): Maro, Sunset, Nomnom (Small Finance Banks), Ion (commercial), Mute Finance (NBFC).",
  "  - The user is a demo investor. Treat the question as advice-seeking but DO NOT give personalised advice.",
].join('\n');

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

router.post('/ask', async (req, res) => {
  const intent = req.body && req.body.intent;
  if (!intent) return res.status(400).json({ error: 'intent_required' });
  if (req.user) {
    logAnonQuestion({ intent, audience: 'auth', ip: req.ip });
  } else {
    logAnonQuestion({ intent, audience: 'anon', ip: req.ip });
  }
  try {
    const out = await dispatch(intent, req);
    res.json(out);
  } catch (e) {
    console.error('/ask error', e);
    res.status(500).json({ type: 'error', text: 'Internal error. Please try again.', followUps: withMainMenu(['faq_fd_definition']) });
  }
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

/* ---------- /llm (free-form Q&A via MiniMax) ----------
 *
 * Auth: optional (anon allowed). Identity drives the rate-limit
 * key (user:<userId> for authed, ip:<ip> for anon).
 *
 * Body: { message: string }
 *  - Trims and length-checks (1..500 chars). Empty / oversize
 *    returns 400.
 *  - No PII is forwarded to MiniMax; we do not include userId,
 *    phone, IP, or any other identifier in the prompt.
 *
 * Response: { text, usage, remaining, toolsUsed } on success.
 *           { error, reason } on failure.
 */
router.post('/llm', async (req, res) => {
  const message = (req.body && req.body.message && String(req.body.message).trim()) || '';
  if (!message) return res.status(400).json({ error: 'message_required' });
  if (message.length > 500) return res.status(400).json({ error: 'message_too_long' });

  const isAuthed = !!(req.user && req.user.userId);
  const key = isAuthed ? `user:${req.user.userId}` : `ip:${req.ip || 'unknown'}`;

  const r = llmCheck(key, isAuthed);
  if (!r.allowed) {
    return res.status(429).json({
      error: 'rate_limited',
      reason: 'rate_limited',
      remaining: 0,
      limit: r.limit,
      resetInMs: r.resetInMs,
    });
  }

  const result = await chatCompletion({
    system: LLM_SYSTEM_PROMPT,
    userMessage: message,
    tools: TOOL_DEFS,
    // Each handler takes only (args) and is bound to its name
    // because dispatchTool has signature (name, args), not (args).
    toolHandlers: {
      list_banks:    (args) => dispatchTool('list_banks',    args),
      get_rates:     (args) => dispatchTool('get_rates',     args),
      compare_rates: (args) => dispatchTool('compare_rates', args),
    },
    userId: isAuthed ? req.user.userId : null,
    ip: req.ip,
  });

  if (result.__error) {
    const statusByReason = {
      missing_api_key:          503,
      auth_failed:              503,
      upstream_rate_limited:    503,
      upstream_quota_exceeded:  503,
      upstream_unreachable:     502,
      upstream_timeout:         504,
      upstream_error:           502,
      malformed_response:       502,
    };
    return res.status(result.status || statusByReason[result.reason] || 500).json({
      error: result.reason,
      reason: result.reason,
    });
  }

  // Record usage AFTER success so failed calls do not count
  const tokens = (result.usage && result.usage.total_tokens) || 0;
  llmRecord(key, tokens);

  res.json({
    text: result.text,
    usage: result.usage,
    toolsUsed: result.toolsUsed,
    remaining: r.remaining - 1,
    limit: r.limit,
  });
});

module.exports = router;
