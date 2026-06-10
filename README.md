# FD Platform Prototype

A simplified demo prototype for an FD booking platform.

## Features
- Mobile-responsive UI using plain HTML/JS/CSS.
- Simple OTP-less login flow for demo purposes (OTP is hardcoded to `123456`).
- Browse fixed deposit rates across multiple banks.
- Direct booking flow mocking KYC and payment layers.
- View portfolio and confirmed bookings.
- **FinBot** — a click-driven chat assistant (no LLM, hardcoded replies)
  that answers FD FAQs and lets a registered user browse their portfolio
  through a Shadow-DOM widget. Anon visitors can also look up their own
  FDs after a phone+DOB+PAN exact-match verification.

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

The bot is intentionally simple: no LLM, no embeddings, no vector store.
Every reply is a hardcoded string selected by a click-intent. This keeps
costs zero, responses instant, and PII risk minimal.

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
