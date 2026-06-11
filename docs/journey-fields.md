# Journey Table — Complete Field Reference

The `journey` table is the heart of the platform: one row per FD
booking. It holds the booking receipt, the rate snapshot at the
time of booking, the KYC + payment + lifecycle timestamps, and
the FD receipt details (branch, IFSC, settlement id, etc.).

Below: every column, its type, and where the value comes from.
The columns are grouped by purpose — what the data IS, not when
it was added.

---

## 0. Key identifiers (4 fields, the backbone of every journey row)

These four fields are the spine of every row. They are the only
ones that other tables and APIs key off of, so they get a
dedicated section.

### `booking_id`

- **Type:** `TEXT NOT NULL UNIQUE` (CHECK: `~ '^bk_fd_[0-9]{5}$'`)
- **Task:** The platform's own unique identifier for this booking. The user sees it on the FD receipt, in the portfolio, in confirmation emails, and in the bot's "tell me about my FDs" responses. The LLM tool `get_my_bookings` returns it as the first column of every row.
- **Who generates it:** `backend/src/routes/journey.js` at insert time, via `generateId('bk_fd_', 5)` → e.g. `bk_fd_00001`, `bk_fd_84059`.
- **Who reads it:**
  - The booking confirmation page (`frontend/confirmation.html`) renders it in the receipt.
  - The portfolio page (`frontend/portfolio.html`) lists it next to each FD.
  - The bot's `get_my_bookings` tool surfaces it for the LLM.
  - The user can quote it to support: "my booking id is bk_fd_00001".
- **Why it matters:** without `booking_id` we have no stable handle to talk about a specific booking across surfaces.

### `bank_reference_id`

- **Type:** `TEXT NOT NULL UNIQUE` (CHECK: `length(bank_reference_id) >= 8`)
- **Task:** The bank's own receipt / FD account number. Distinct from `booking_id`: `booking_id` is the platform's internal handle, `bank_reference_id` is what the bank will quote when the user calls their customer support. The user sees both on the FD receipt.
- **Who generates it:** `backend/src/routes/journey.js` at insert time, via `generateId('REF', 8)` → e.g. `REF03576528`. The seed also produces bank-style references like `MARO202506080001` so the existing 100 bookings look like real bank receipts.
- **Who reads it:**
  - The booking confirmation page shows it under "Bank Reference".
  - The bot's `get_my_bookings` tool includes it in every returned row.
  - The user can use it for any future bank-side query (premature withdrawal, etc.).
- **Why it matters:** it's the cross-reference between the platform and the bank. The bank never sees our `booking_id`; they only know `bank_reference_id`.

### `user_id`

- **Type:** `BIGINT NOT NULL`, `REFERENCES "user"(user_id)`
- **Task:** Links the journey row to the customer who booked it. Every personalization path (portfolio, "my FDs", "what matures next") joins on `user_id` to scope data to the logged-in user. The bot uses `req.user.userId` (set by the JWT middleware) to scope every `get_my_bookings` / `get_my_fd_summary` call.
- **Who sets it:** the booking route reads `req.user.userId` from the verified JWT at insert time. The seed picks the user via a `(SELECT user_id FROM "user" WHERE full_name = ... AND pan_number = ...)` subquery.
- **Who reads it:**
  - `backend/src/bot/service.js getBookingsForUser(userId)` — the self-healing personalized-handler cache.
  - `backend/src/bot/llmTools.js getMyBookings` / `getMyFdSummary` — the LLM user-scoped tools.
  - `backend/src/routes/portfolio.js` — the portfolio page.
- **Why it matters:** it's the key for tenant isolation. Every row is owned by exactly one user; every read path is scoped by `user_id`.

### `rate_id`

- **Type:** `BIGINT NOT NULL`, `REFERENCES master(rate_id)`
- **Task:** Links the journey row to the rate row that was picked at booking time. All the rate-snapshot columns below (group 3) are denormalized from this `rate_id`, so even if the master rate changes later, this booking's terms stay frozen.
- **Who sets it:** the booking route picks `rateId` from the request body, validates it, and inserts the row's `rate_id` pointing to the chosen `master` row.
- **Who reads it:**
  - The portfolio page joins `journey` with `master` to render bank name, FD type, and min/max amount alongside the booking.
  - The bot's `get_my_bookings` tool joins with `master` to include `m.bank_name` and `m.bank_code` in every row.
  - The booking confirmation page joins to render the rate details.
- **Why it matters:** it's the link between the booking and the bank product. Without `rate_id`, the booking would be just a number; with it, the booking is a complete, queryable record.

---

## 1. Public IDs (2 fields)

| Field | Type | Source |
|---|---|---|
| `booking_id` | `TEXT` NOT NULL | See section 0 above. |
| `bank_reference_id` | `TEXT` NOT NULL | See section 0 above. |

## 2. Foreign keys (2 fields)

| Field | Type | Source |
|---|---|---|
| `user_id` | `BIGINT` NOT NULL | See section 0 above. |
| `rate_id` | `BIGINT` NOT NULL | See section 0 above. |

## 3. Rate at booking (6 fields, frozen snapshot)

| Field | Type | Source |
|---|---|---|
| `tenure_months` | `SMALLINT` NOT NULL | `rate.tenure_months` (12 / 24 / 36). |
| `tenure_days` | `INTEGER` NOT NULL | `rate.tenure_days` (360 / 720 / 1080). |
| `interest_rate_bps` | `SMALLINT` NOT NULL | The customer's GENERAL rate (`rate.interest_rate_bps`), regardless of `customer_type`. For senior citizens, the actual rate they get is in `senior_citizen_rate_bps` (group 10). |
| `customer_type` | `TEXT` NOT NULL | `general` or `senior_citizen`, from the booking request body. Defaults to `general`. |
| `compounding` | `compounding_enum` NOT NULL | `rate.compounding` (`quarterly` etc.). |
| `payout_type` | `payout_type_enum` NOT NULL | `rate.payout_type` (`cumulative` / `non_cumulative`). |

## 4. Money (3 fields)

| Field | Type | Source |
|---|---|---|
| `principal` | `NUMERIC(12,2)` NOT NULL | The deposit amount in rupees, from the booking request body. Must be > 0 and within the rate's `[min_fd_amount, max_amount]`. |
| `maturity_amount` | `NUMERIC(12,2)` NOT NULL | Computed at insert: `principal * (1 + rate/100)^(tenure_days/365)` (compounded quarterly). Must be `>= principal`. |
| `interest_earned` | `NUMERIC(12,2)` GENERATED | `GENERATED ALWAYS AS (maturity_amount - principal) STORED`. Postgres-computed; never written. |

## 5. Calendar (2 fields)

| Field | Type | Source |
|---|---|---|
| `booking_date` | `DATE` NOT NULL | The current date when the row is inserted. The CHECK constraint enforces `<= CURRENT_DATE` (no future-dated bookings). |
| `maturity_date` | `DATE` NOT NULL | `booking_date + (tenure_days || ' days')::INTERVAL`. CHECK constraint enforces this. |

## 6. State (1 field)

| Field | Type | Source |
|---|---|---|
| `state` | `booking_state_enum` NOT NULL | Default `fd_pending_vkyc`. The booking route inserts as `fd_active` directly (VKYC is auto-approved in this demo). Transitions: `fd_active` → `fd_matured` → `fd_withdrawn`. |

## 7. Nominee (2 fields, both nullable, paired if present)

| Field | Type | Source |
|---|---|---|
| `nominee_name` | `TEXT` | Optional. From the booking request body. |
| `nominee_relationship` | `nominee_relationship_enum` | Optional. From the booking request body. CHECK (at app level): if `nominee_name` is set, this should be set too. |

## 8. KYC + VKYC timestamps (4 fields)

| Field | Type | Source |
|---|---|---|
| `pan_verified_at` | `TIMESTAMPTZ` NOT NULL | Auto-set to `NOW()` in the INSERT. In a real system: time the PAN was verified against the income-tax dept. |
| `aadhaar_ekyc_at` | `TIMESTAMPTZ` NOT NULL | Auto-set to `NOW()`. Aadhaar eKYC completion time. CHECK: `>= pan_verified_at`. |
| `vkyc_scheduled_at` | `TIMESTAMPTZ` | NULL if VKYC not required (e.g. small principal, or Aadhaar eKYC used). Set when VKYC is scheduled. CHECK: `>= aadhaar_ekyc_at` if set. |
| `vkyc_completed_at` | `TIMESTAMPTZ` | NULL if VKYC not required. Set when the video call completes. CHECK: `>= vkyc_scheduled_at` if set. |

## 9. Payment + FD lifecycle timestamps (5 fields)

| Field | Type | Source |
|---|---|---|
| `payment_initiated_at` | `TIMESTAMPTZ` NOT NULL | Auto-set to `NOW()`. CHECK: `>= COALESCE(vkyc_completed_at, aadhaar_ekyc_at)`. |
| `payment_completed_at` | `TIMESTAMPTZ` NOT NULL | Auto-set to `NOW()`. CHECK: `>= payment_initiated_at`. |
| `fd_activated_at` | `TIMESTAMPTZ` | NULL until the FD is actually opened at the bank. CHECK: `>= payment_completed_at` if set. |
| `fd_matured_at` | `TIMESTAMPTZ` | NULL until the FD reaches `maturity_date`. CHECK: `>= fd_activated_at` if set. |
| `fd_withdrawn_at` | `TIMESTAMPTZ` | NULL until the user withdraws (or auto-renews). CHECK: `>= fd_activated_at` if set. |

## 10. FD receipt details (9 fields)

These are the fields a real Indian bank's booking receipt / FD
passbook returns in addition to the basics. They make the journey
row a complete snapshot of the booking, not just a reference to it.

| Field | Type | Source |
|---|---|---|
| `senior_citizen_rate_bps` | `SMALLINT` | The rate the customer ACTUALLY gets. For `senior_citizen` customers: `rate.senior_citizen_rate_bps`. For general: same as `interest_rate_bps`. Denormalized from `master` so the booking is a complete snapshot. |
| `effective_date` | `DATE` | When interest starts accruing. For this demo: same as `booking_date` (T+0 settlement). For non-cumulative FDs in real life this could be `booking_date + 1`. |
| `customer_reference` | `TEXT` | Optional customer-side reference number (the user can set this in the booking form for their own tracking). |
| `branch_code` | `TEXT` | The branch that holds the FD. Fictional: `MUM-ANDH-001` (Maro), `BLR-IND-001` (Sunset), `DEL-CON-001` (Nomnom), `MUM-BKC-001` (Ion), `CHE-SHO-001` (Mute). Real system: bank's branch code. |
| `ifsc_code` | `CHAR(11)` | 4 letters (bank code) + 0 + 6 digits (branch number). E.g. `MARO0000001`. Real system: bank's IFSC. |
| `settlement_id` | `TEXT` | The payment transaction ID. Format: `STL<YYYYMMDD><NNNNNN>` (e.g. `STL20250611000001`). Real system: UPI/IMPS/NEFT reference number. |
| `dicgc_insured` | `BOOLEAN` | Snapshot from `rate.dicgc_insured`. True for SFBs and commercial banks, false for NBFCs (Mute). True for the user-facing "DICGC Insured" badge. |
| `interest_payout_frequency` | `TEXT` | For `payout_type = 'cumulative'`: `at_maturity`. For `non_cumulative`: `monthly`. (Could also be `quarterly` if the bank supports it; not used in this demo.) |
| `tax_slab` | `TEXT` | Approximate personal-income tax bracket based on the principal alone (educational only; real tax depends on total income). Brackets: `< Rs 1L` → `0%`, `< Rs 5L` → `5%`, `< Rs 10L` → `20%`, `>= Rs 10L` → `30%`. |

## 11. Audit (2 fields)

| Field | Type | Source |
|---|---|---|
| `created_at` | `TIMESTAMPTZ` NOT NULL | `DEFAULT NOW()` at insert. |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | `DEFAULT NOW()` at insert. (No trigger updates this on UPDATE in the current schema; the booking route doesn't update journey rows after insert.) |

---

## Group summary (38 columns total)

| # | Group | Fields |
|---|---|---|
| 1 | Public IDs | 2 |
| 2 | Foreign keys | 2 |
| 3 | Rate at booking | 6 |
| 4 | Money | 3 |
| 5 | Calendar | 2 |
| 6 | State | 1 |
| 7 | Nominee | 2 |
| 8 | KYC + VKYC timestamps | 4 |
| 9 | Payment + FD lifecycle timestamps | 5 |
| 10 | FD receipt details | 9 |
| 11 | Audit | 2 |

**Total: 38 columns.** All but the audit + lifecycle timestamps are sourced from either the booking request body, the `master` rate row, or derived values.
