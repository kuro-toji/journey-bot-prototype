# FD Platform Prototype

A simplified demo prototype for an FD booking platform.

## Features
- Mobile-responsive UI using plain HTML/JS/CSS.
- Simple OTP-less login flow for demo purposes (OTP is hardcoded to `123456`).
- Browse fixed deposit rates across multiple banks.
- Direct booking flow mocking KYC and payment layers.
- View portfolio and confirmed bookings.
- **FinBot** — a click-driven chat assistant with two parts:
  - **FAQ bot** (hardcoded, no LLM): 14 chip-driven Q&As about FDs
    (definition, DICGC, compounding, taxation, senior citizen rates,
    KYC/VKYC, comparison, etc.) and personalized portfolio queries
    (active FDs, total value, maturity, biggest FD). Anon visitors
    can also look up their own FDs after a phone+DOB+PAN exact-match
    verification.
  - **Talk to assistant** (LLM-backed, optional): a free-form Q&A
    chip that calls MiniMax-M2.7 with a strict FD-only system
    prompt and a whitelisted set of read-only DB tools
    (`list_banks`, `get_rates`, `compare_rates`). The LLM refuses
    off-topic questions, code, and personalised financial advice.
    Think-tag stripping happens server-side so the user never sees
    internal reasoning.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Database:**
   Ensure PostgreSQL is running and the database matches the `.env` settings.
   To run migrations or seeds:
   ```bash
   psql -d blostem -f ../db/schema.sql
   psql -d blostem -f ../db/seed.sql
   ```

3. **Start the server:**
   ```bash
   npm run start
   # or for development: npm run dev
   ```

4. **Access the application:**
   Open `http://localhost:4000` in your browser.

## FinBot

The bot is intentionally simple: no LLM for the FAQ flow (hardcoded
strings), no embeddings, no vector store. This keeps costs zero,
responses instant, and PII risk minimal for the FAQ path.

The LLM-backed "Talk to assistant" chip is the one place the bot
calls an external model. It is gated by:
  - per-user / per-IP rate limit (default 20/hr authed, 5/hr anon)
  - per-message max completion tokens (default 800)
  - 30s upstream timeout
  - audit log of every call (no PII, no API key)

API key storage: `backend/.env` is gitignored. The key is never
committed.

### Architecture

```
                  +------------+   click-intent  +-----------+
   user clicks -> |  widget.js | --------------->|  /api/bot |
                  | (Shadow    |   <JSON------    |   routes |
                  |   DOM)     |                  +-----+-----+
                  +------------+                        |
                                                       v
                                              +----------------+
                                              |  bot/service.js|
                                              |  (dispatcher)  |
                                              +---+----+----+--+
                                                  |    |    |
                                       +----------+    |    +---------+
                                       v               v              v
                                  bot/faq.js     bot/cache.js   bot/verify.js
                                  (hardcoded     (in-memory     (phone+dob+pan
                                   Q&A)          Map, 30min)    exact match)
```

### Key files

| Path | What it does |
|------|--------------|
| `backend/src/bot/faq.js`        | 13 hardcoded Q&A entries (FD definition, DICGC, compounding, taxation, senior citizen, min amount, FD comparison, how to book, KYC, VKYC, RD) plus menu builder. |
| `backend/src/bot/cache.js`      | In-memory `Map<userId, {bookings, expiresAt}>` with 30-min idle TTL, periodic sweep. |
| `backend/src/bot/verify.js`     | Anon verification: exact match on (mobile_number, date_of_birth, pan_number). Issues an opaque 24-byte token (in-memory map, 30-min TTL). Pre-fetches bookings and warms the cache. |
| `backend/src/bot/service.js`    | Intent router. Maps click-intents to pure handler(identity, params) functions. |
| `backend/src/bot/log.js`        | Audit log: prints one line per `/verify` attempt to stdout with masked PII. |
| `backend/src/middleware/ratelimit.js` | `express-rate-limit` — 5 attempts/IP/hour on `/api/bot/verify`. |
| `backend/src/routes/bot.js`     | HTTP routes: `GET /menu`, `POST /ask`, `POST /verify`, `POST /cache/clear`. Soft auth (JWT optional, no 401). |
| `backend/src/routes/auth.js`    | On `verify-otp` success: warm the bot cache for `userId`. New `POST /logout`: clear cache. |
| `frontend/widget.js`            | Shadow-DOM chat widget. Floating FAB, click-driven chips, multi-step verify flow, mobile full-screen. Auto-loads on every page via `<script src="widget.js" defer>`. |

### HTTP API

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/bot/menu`            | optional | List of clickable chips. Authed viewers get the personalized menu; anon viewers get the full FAQ menu plus 'Check my FDs'. |
| `POST /api/bot/ask`            | optional | `{intent, params?}` — returns `{type, text, followUps}`. |
| `POST /api/bot/verify`         | none, rate-limited | `{phone, dob, pan}` — returns `{ok, token, user, bookings}` or `{ok:false, reason}`. |
| `POST /api/bot/cache/clear`    | optional | Clears cache for the authed user and/or the supplied `anonToken`. |

### Security model

- **Exact match, three-of-three.** A `/verify` lookup requires phone + DOB + PAN to all match. PAN is `UNIQUE` in the schema, so the result is at most one row. No OR logic, no phone-only lookup.
- **Read-only.** The bot has zero write path. `/ask` and `/menu` never call `INSERT`/`UPDATE`/`DELETE`. `/verify` only reads.
- **Rate-limited.** `/verify` is capped at 5 attempts per IP per hour.
- **Opaque verification token.** On success the server issues a 24-byte base64url random string, stores it in an in-memory map, and returns it to the client. The client stores it in `sessionStorage` (cleared on refresh). The token is required on follow-up `/ask` requests to use the 'anon-verified' identity.
- **Logged for audit.** Every `/verify` attempt is printed to stdout with masked phone/dob/pan and the outcome. No DB write.
- **Cache isolation.** The cache is keyed by `userId` only. `setCache`/`getCache` ignore the call if `userId` is missing. The cache is wiped on logout and on the next login (defense-in-depth).
- **Masked logging.** PII is masked before any log line: `97****00`, `****-**-10`, `UC****NIQ1000P`.

### Verification flow (anon)

1. User clicks 'Check my FDs'.
2. Bot shows the format hints (10-digit phone, YYYY-MM-DD dob, AAAAA9999A pan).
3. Widget opens a 3-step input form. Each step validates the shape client-side.
4. On submit, `POST /api/bot/verify` is called.
5. On success, the widget stores the token in `sessionStorage` and immediately calls `POST /api/bot/ask {intent: 'check_my_fds', anonToken}` to render the bookings.
6. On failure, the widget shows the reason ('no_match' / 'too_many_attempts') and re-opens step 1.
7. Subsequent FAQ clicks do not require the token. 'My FDs' / 'Total value' / 'Maturity' / 'Biggest FD' do require it (or a logged-in JWT).

### Refresh behaviour

- The widget reads `auth_token` from `localStorage` (set by `js/auth.js` on login). Survives refresh.
- The widget stores `finbot_anon_token` in `sessionStorage` only. Cleared on refresh, per the spec.
- The server-side cache survives refresh for 30 minutes idle. Cleared on logout or next login.

## LLM chip (Talk to assistant)

### Setup

1. Get a MiniMax API key at <https://platform.minimax.io> → API Keys.
2. Add it to `backend/.env` (which is gitignored):
   ```
   MINIMAX_API_KEY=sk-cp-...
   MINIMAX_MODEL=MiniMax-M2.7
   MINIMAX_BASE_URL=https://api.minimax.io/v1
   MINIMAX_TIMEOUT_MS=30000
   LLM_RATE_LIMIT_AUTHED=20
   LLM_RATE_LIMIT_ANON=5
   LLM_MAX_COMPLETION_TOKENS=800
   LLM_TEMPERATURE=0.5
   ```
   `.env.example` documents every var. The real key is **never** committed.

### System prompt (strict FD-only)

The LLM is told to ONLY help with:
- Fixed Deposit concepts (rates, compounding, cumulative vs
  non-cumulative, premature withdrawal, DICGC, taxation, min/max)
- Comparing FDs across the banks on this platform (via tools)
- Related Indian banking concepts (KYC, Aadhaar eKYC, VKYC, PAN)

It is told to REFUSE and redirect to the FAQ bot for:
- Stocks, mutual funds, crypto, NPS, PPF, insurance, loans
- General knowledge, math, programming, code, SQL, scripts
- Personalised financial advice

Refusal line: *"I can only help with Fixed Deposits and FD comparison
on this platform. Try the FAQ bot for that."*

### Tools (read-only, never writes)

| Tool | Args | Returns |
|------|------|---------|
| `list_banks` | — | All banks on the platform with customer types served |
| `get_rates`  | `bank_code?`, `tenure_months?`, `customer_type?` | Rate rows from `master` |
| `compare_rates` | `tenure_months` (required), `customer_type?` | Per-bank comparison sorted by yield DESC |

All queries are `SELECT`. The LLM cannot make any write. Tool
definitions are in `backend/src/bot/llmTools.js`; the dispatch
function is whitelisted by name.

### Think-tag stripping

M2.7 emits its internal reasoning in `<think>...</think>` blocks
inside the response `content` field. `bot/llm.js` strips these
server-side (handles both well-formed and unterminated blocks) so
the widget never sees them. The length of the thinking content is
captured via `usage.completion_tokens` for cost tracking.

### UX flow

1. User clicks `Talk to assistant` chip.
2. Bot says *"Hi, I'm FinBot's AI assistant. I can help with Fixed
   Deposits, FD comparison, and related banking topics. Ask me
   anything."*
3. A persistent input opens with placeholder *"Ask about FDs,
   rates, or comparison…"*
4. During the API round-trip, the user sees *"Assistant is
   thinking…"* + 3 bouncing dots.
5. On success, the final cleaned reply renders, followed by a
   small grey meta line: `_(tokens: 432 · used compare_rates · 18
   of 20 messages left this hour)_`, then a `← Main menu` chip.
6. On error, a red error bubble + `← Main menu` + `Try again`
   chips. Different copy for each reason
   (quota/rate-limit/auth/timeout/etc).

### Security model

- **No PII to LLM.** `userId`, `ip`, phone, PAN, etc. are NOT
  forwarded to MiniMax. Only the user-typed message is sent, after
  a length check (1..500 chars).
- **Tool whitelist.** Only the three tools above are exposed. The
  LLM cannot ask the backend to run arbitrary SQL or code.
- **Read-only DB.** `llmTools.js` is SELECT-only. There is no
  `INSERT`, `UPDATE`, or `DELETE` anywhere in the LLM path.
- **Rate limit.** In-memory, per-user or per-IP, 1-hour sliding
  window. Configurable via `LLM_RATE_LIMIT_AUTHED` /
  `LLM_RATE_LIMIT_ANON`.
- **Token cap.** `LLM_MAX_COMPLETION_TOKENS` (default 800) caps
  per-message output. Roughly Rs 0.001 / call at M2.7 pricing.
- **Audit log.** Every call logs `status, reason, iter, pt, ct,
  tt, tools, user, ip` to stdout. The API key is never logged.
- **Quota detection.** MiniMax's `usage_limit_error` is
  distinguished from generic `rate_limit_error` so the user gets
  a clear "quota hit, try later" message instead of a generic
  "try again".
- **No streaming.** Simplifies error handling; the existing
  typing indicator covers the "thinking" period. Streaming can be
  added later without API changes.
