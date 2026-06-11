# Journey Table — Field-by-Field Reference

Every field in the `journey` table, one entry per field. Each
entry says only what the field is and what it is used for.

---

### `journey_id`

The auto-incrementing primary key. Used as the row's internal
handle inside the database; never shown to the user.

### `booking_id`

The platform's own unique identifier for the booking. The user
sees it on the FD receipt, in the portfolio, in confirmation
emails, and in the bot's "tell me about my FDs" responses.

### `bank_reference_id`

The bank's own receipt / FD account number. Distinct from
`booking_id`: this is what the bank quotes when the user calls
their customer support.

### `user_id`

The customer who booked the FD. Every personalization path
(portfolio, "my FDs", "what matures next") joins on this to
scope data to the logged-in user.

### `rate_id`

The bank-product (master) row that was picked at booking. The
row's rate-snapshot fields are denormalized from this so the
booking stays frozen even if the master rate changes.

### `tenure_months`

The tenure in months (12 / 24 / 36). Drives the maturity date
and the interest computation.

### `tenure_days`

The tenure in days (360 / 720 / 1080). Drives the
`interest_earned` calculation together with the rate and the
compounding frequency.

### `interest_rate_bps`

The general interest rate (basis points) that the master
row advertised at the time of booking. Frozen as a snapshot.

### `customer_type`

`general` or `senior_citizen`. Determines whether the customer
gets the senior rate or the general rate at payout.

### `compounding`

How often interest compounds. Pulled from the master row
(`quarterly` in this demo).

### `payout_type`

`cumulative` (interest paid at maturity, added to principal) or
`non_cumulative` (interest paid out monthly). Drives
`interest_payout_frequency`.

### `principal`

The deposit amount in rupees, as chosen by the user in the
booking form.

### `maturity_amount`

The total value the user will receive at maturity. Computed at
insert time from principal + rate + tenure + compounding.

### `interest_earned`

The difference between maturity_amount and principal.
Database-generated, never written.

### `booking_date`

The calendar day the booking was made. The start of the
interest clock.

### `maturity_date`

The calendar day the FD matures. Equal to
`booking_date + tenure_days`. The end of the interest clock.

### `state`

The FD's lifecycle state. Starts as `fd_pending_vkyc`,
transitions through `fd_active` → `fd_matured` → `fd_withdrawn`.

### `nominee_name`

The person nominated to inherit the FD on the holder's death.
Optional.

### `nominee_relationship`

The nominee's relationship to the holder (spouse, parent,
child, etc.). Optional, paired with `nominee_name`.

### `pan_verified_at`

The timestamp the PAN was verified against the income-tax
department. The first step of the KYC chain.

### `aadhaar_ekyc_at`

The timestamp the Aadhaar eKYC was completed. Used as the
"identity established" anchor for the booking.

### `vkyc_scheduled_at`

The timestamp the video KYC was scheduled. NULL if VKYC was
not required for this booking (e.g. small principal, or Aadhaar
eKYC sufficed).

### `vkyc_completed_at`

The timestamp the video KYC was completed. NULL if not
required or not yet done.

### `payment_initiated_at`

The timestamp the user submitted the deposit payment. Must
come after KYC.

### `payment_completed_at`

The timestamp the payment was confirmed by the payment
gateway. Must come after `payment_initiated_at`.

### `fd_activated_at`

The timestamp the bank opened the FD account. NULL until the
bank confirms. After this point the user's money is on the
bank's books and earning the contracted rate.

### `fd_matured_at`

The timestamp the FD reached its maturity date. NULL until
`maturity_date` passes.

### `fd_withdrawn_at`

The timestamp the user (or the auto-renewal process) closed
out the FD. NULL until then.

### `senior_citizen_rate_bps`

The rate the customer ACTUALLY gets. For senior citizens, this
is the higher rate; for general customers, it matches
`interest_rate_bps`. Frozen at booking.

### `effective_date`

The day interest starts accruing. In this demo, equal to
`booking_date`; in real non-cumulative FDs it can be `+1` day.

### `customer_reference`

An optional customer-side reference (a free-text note the
user can set in the booking form for their own tracking).

### `branch_code`

The bank's branch that holds the FD. Used on the receipt and
in any bank-side correspondence.

### `ifsc_code`

The 11-character IFSC of the receiving bank branch. Used for
the deposit payment and on the receipt.

### `settlement_id`

The payment transaction reference (UPI/IMPS/NEFT). The proof
that the money actually moved from the user to the bank.

### `dicgc_insured`

Whether the FD is insured by DICGC (Deposit Insurance and
Credit Guarantee Corporation). TRUE for commercial banks and
SFBs, FALSE for NBFCs. Surfaces as the "DICGC Insured" badge
on the FD card.

### `interest_payout_frequency`

For cumulative FDs: `at_maturity`. For non-cumulative: `monthly`.
The cadence the bank pays out interest.

### `tax_slab`

The personal-income tax bracket implied by the principal.
Educational only — real tax depends on total income, not just
this FD.

### `created_at`

The timestamp the row was inserted into the table.

### `updated_at`

The timestamp the row was last modified. (No trigger updates
this in the current schema; the booking route does not update
journey rows after insert.)
