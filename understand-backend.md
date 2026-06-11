# Backend Architecture & Services Documentation

This document explains the components, route endpoints, database configurations, and bot features of the **FD Platform Prototype Backend**.

---

## 1. Directory Structure

The backend application lives inside the `/backend` folder and is organized as follows:

```
backend/
├── server.js               # Application Entry Point
├── package.json            # Node.js dependencies & scripts
├── .env.example            # Environment templates
├── src/
│   ├── config/
│   │   └── db.js           # PostgreSQL Connection Pool
│   ├── middleware/
│   │   ├── auth.js         # JWT Validation Middleware
│   │   └── ratelimit.js    # Rate limiting configurations
│   ├── utils/
│   │   └── jwt.js          # JSON Web Token helpers
│   ├── routes/
│   │   ├── auth.js         # OTP send/verify, session info, logout
│   │   ├── banks.js        # Bank details API
│   │   ├── rates.js        # FD interest rate lists API
│   │   ├── journey.js      # Booking flow & portfolio management
│   │   ├── kyc.js          # KYC status and updates
│   │   └── bot.js          # Chatbot endpoints (FAQ & LLM router)
│   └── bot/
│       ├── cache.js        # In-memory session cache
│       ├── faq.js          # Hardcoded FAQ list
│       ├── llm.js          # MiniMax integration (Think stripping, OpenAI-compatible)
│       ├── llmRate.js      # In-memory LLM rate limits
│       ├── llmTools.js     # Whitelisted read-only DB tools
│       ├── log.js          # PII-masked audit logger
│       ├── service.js      # Chat intent router and portfolio calculations
│       └── verify.js       # Phone/DOB/PAN validation and token manager
```

---

## 2. Server Configuration (`server.js`)

The application entry point is `server.js`, running on Express.
- **Port:** Configured via `process.env.PORT` (defaults to `4000`).
- **Static Assets:** Serves static frontend files located at `../frontend` on root `/`.
- **SPA Routing:** Supports SPA route fallback for paths not matching `/api` (redirects to `index.html`).
- **Health Check:** `/api/health` queries `SELECT 1 AS ok` against the database to confirm pool status.

---

## 3. Database Layer (`src/config/db.js`)

The database connection is established using the `pg` pool library. It utilizes the standard PostgreSQL environment variables:
- `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`
- **Pool Settings:** 10 maximum clients, 30s idle timeout, and 5s connection timeout.
- **Slow Query Log:** If any SQL execution exceeds 500ms, it is logged automatically.

---

## 4. API Endpoints

### A. Auth Routes (`/api/auth`)
- `POST /send-otp`: Generates a OTP mock code (`123456`).
- `POST /verify-otp`: Validates the phone and OTP. Only phone numbers seeded in `"user"` table can log in. Warms up the bot cache on success and issues a JWT token.
- `POST /logout` *(Authed)*: Clears local cached data and token states.
- `GET /me` *(Authed)*: Fetches current logged-in user profile.

### B. Journey Routes (`/api/journey`)
- `POST /book` *(Authed)*: Inserts a new FD booking (`journey` table) for a given rate, principal amount, nominee, and relationship. Maturity amounts are computed server-side using simple interest based on the bank's compounding policies.
- `GET /portfolio` *(Authed)*: Lists all FD bookings of the user.
- `GET /:id` *(Authed)*: Retrieves detailed parameters of a single booking.

### C. Rates & Banks Routes (`/api/rates` & `/api/banks`)
- Query the `master` table to list available banks and active interest rate listings.

### D. Bot Routes (`/api/bot`)
- `GET /menu`: Compiles menu chips contextually for anonymous vs. authenticated viewers.
- `POST /ask`: Dispatches the selected intent. If the intent has a handler (e.g., portfolio requests), it aggregates bookings and formats a rupee text response.
- `POST /verify`: Performs a strict exact-match lookup using phone, DOB, and PAN.
- `POST /cache/clear`: Wipes cache keys.

---

## 5. Free-Form LLM Bot (`/api/bot/llm`)

The LLM-backed chat assistant allows free-form text input from users.

### A. Parameters
- **API Model:** `MiniMax-M2.7`
- **Rate Limits:** In-memory tracking (`src/bot/llmRate.js`) restricts users to 20 messages/hour for authed users and 5/hour for anon IPs.
- **Message Constraints:** Trims user input to a maximum of 500 characters.

### B. Think-Tag Stripping
MiniMax M2.7 generates internal reasoning thoughts inside `<think>...</think>` tags. The server strips these tags dynamically in `src/bot/llm.js` using regular expressions before sending the output back:
```javascript
function stripThinkTags(s) {
  if (typeof s !== 'string') return s;
  let out = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  out = out.replace(/<think>[\s\S]*$/g, '');
  return out.trim();
}
```

### C. Whitelisted Database Tools
The LLM is provided with three read-only Postgres tools:
1. `list_banks()`: Returns all active bank names, codes, types, and thresholds.
2. `get_rates({bank_code, tenure_months})`: Retrieves active rates matching constraints.
3. `compare_rates({tenure_months, customer_type})`: Performs comparison queries sorted by effective yield descending.

The model is strictly prohibited from running raw SQL or execute writes. If tool execution loops more than 2 iterations, the server stops execution and forces the model to summarize available findings.
