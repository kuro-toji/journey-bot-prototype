/**
 * Read-only DB tools exposed to the LLM.
 *
 * Public tools (always available, no userId required):
 *   1) list_banks()
 *   2) get_rates({bank_code?, tenure_months?})
 *   3) compare_rates({tenure_months, customer_type?})
 *
 * Per-user tools (only available when the request is authed;
 * the server injects userId from the verified JWT into the
 * tool's context. The tools accept NO userId argument from the
 * LLM, so the model cannot ask for another user's data):
 *   4) get_my_fd_summary(ctx)   -> counts + totals
 *   5) get_my_bookings(ctx)     -> the user's bookings list
 *
 * Schema notes (from db/init_db.sh):
 *   - master has interest_rate_bps (general) AND
 *     senior_citizen_rate_bps as separate columns. There is NO
 *     customer_type column.
 *   - bank_type is an enum: 'commercial' | 'small_finance' | 'nbfc'
 *   - dicgc_insured is boolean
 *   - vkyc_threshold is the amount above which VKYC is required
 *     (0 means always required)
 *
 * No write path. Every handler calls query() (the shared pool
 * from src/config/db.js) with a SELECT.
 */

const { query } = require('../config/db');

const TOOL_NAMES = new Set(['list_banks', 'get_rates', 'compare_rates', 'get_my_fd_summary', 'get_my_bookings']);

// Tools that are only exposed when the request is authed.
// The route layer (routes/bot.js) builds a per-request tool list
// so the LLM never even sees these names for anon viewers.
const USER_SCOPED_TOOLS = new Set(['get_my_fd_summary', 'get_my_bookings']);

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_banks',
      description: 'Return the list of all banks available on the platform, with their bank code, name, type (commercial / small_finance / nbfc), DICGC insured flag, and VKYC threshold.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rates',
      description: 'Return FD rate rows from the master table. Both filters are optional. Each row includes interest_rate_bps (general) and senior_citizen_rate_bps (senior) so the caller can pick the right one.',
      parameters: {
        type: 'object',
        properties: {
          bank_code:     { type: 'string',  description: 'Bank code, e.g. "MARO" or "IONB".' },
          tenure_months: { type: 'integer', description: 'Tenure in months, e.g. 12 or 36.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_rates',
      description: 'Compare FD rates across all banks for a specific tenure and customer type. customer_type defaults to "general". Returns one row per bank sorted by the effective rate descending. Use this when the user asks "which bank has the best 1-year FD?" or similar comparisons.',
      parameters: {
        type: 'object',
        properties: {
          tenure_months: { type: 'integer', description: 'Tenure in months, e.g. 12.' },
          customer_type: { type: 'string', enum: ['general', 'senior'], description: 'Optional. Defaults to "general".' },
        },
        required: ['tenure_months'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_fd_summary',
      description: 'Return a summary of the LOGGED-IN user\'s FD portfolio: counts by state, total invested, total maturing value, breakdown by bank, and the next upcoming maturity. Use this whenever the user asks "how much have I invested?", "what\'s my total FD value?", "what matures next?", etc. Returns an error if called for an unauthenticated user (the server only exposes this tool when the request has a verified JWT).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_bookings',
      description: 'Return the LOGGED-IN user\'s FD bookings as a list, optionally filtered by state ("active", "matured", "withdrawn", or "all"). Each row includes bank, principal, rate, tenure, maturity date and amount, and reference id. Use this when the user asks "show my FDs", "list my active FDs", etc. Returns an error if called for an unauthenticated user.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['active', 'matured', 'withdrawn', 'all'], description: 'Optional. Defaults to "all".' },
          limit: { type: 'integer', description: 'Optional. Defaults to 20. Max 50.' },
        },
        required: [],
      },
    },
  },
];

/* ---------- handlers ---------- */

async function listBanks() {
  const r = await query(`
    SELECT bank_code, bank_name, bank_type, dicgc_insured, vkyc_threshold
      FROM master
     WHERE is_active = TRUE
     GROUP BY bank_code, bank_name, bank_type, dicgc_insured, vkyc_threshold
     ORDER BY bank_name
  `);
  return { banks: r.rows };
}

async function getRates(args) {
  const where = ['is_active = TRUE'];
  const params = [];
  if (args.bank_code) {
    params.push(args.bank_code);
    where.push(`bank_code = $${params.length}`);
  }
  if (args.tenure_months != null) {
    params.push(args.tenure_months);
    where.push(`tenure_months = $${params.length}`);
  }
  const sql = `
    SELECT bank_code, bank_name, bank_type, tenure_months,
           interest_rate_bps, senior_citizen_rate_bps,
           min_fd_amount, max_amount, dicgc_insured, vkyc_threshold
      FROM master
      WHERE ${where.join(' AND ')}
     ORDER BY bank_name, tenure_months
     LIMIT 50
  `;
  const r = await query(sql, params);
  return { count: r.rows.length, rates: r.rows };
}

async function compareRates(args) {
  if (args.tenure_months == null) {
    return { error: 'tenure_months_required' };
  }
  const customerType = (args.customer_type === 'senior') ? 'senior' : 'general';
  const rateCol = customerType === 'senior' ? 'senior_citizen_rate_bps' : 'interest_rate_bps';
  const r = await query(
    `SELECT bank_code, bank_name, bank_type, tenure_months,
            ${rateCol} AS rate_bps,
            (${rateCol}::numeric / 100) AS rate_pct,
            min_fd_amount, max_amount, dicgc_insured, vkyc_threshold
       FROM master
      WHERE tenure_months = $1
        AND is_active = TRUE
      ORDER BY ${rateCol} DESC`,
    [args.tenure_months]
  );
  return {
    tenure_months: args.tenure_months,
    customer_type: customerType,
    count: r.rows.length,
    rows: r.rows,
  };
}

const HANDLERS = {
  list_banks:    listBanks,
  get_rates:     getRates,
  compare_rates: compareRates,
};

/* ---------- per-user tools ----------
 *
 * These take no `userId` arg from the LLM. The server injects the
 * verified userId via the `ctx` arg of dispatchTool. Anon callers
 * (no JWT) will not see these tools in the function-calling schema,
 * and even if the model somehow managed to call them, the handler
 * would refuse with auth_required.
 */
async function getMyFdSummary(args, ctx) {
  if (!ctx || !ctx.userId) {
    return { error: 'auth_required', reason: 'get_my_fd_summary requires a logged-in user' };
  }
  const userId = ctx.userId;
  const r = await query(
    `SELECT
       COUNT(*) FILTER (WHERE j.state = 'fd_active')::int         AS active_count,
       COUNT(*) FILTER (WHERE j.state = 'fd_matured')::int        AS matured_count,
       COUNT(*) FILTER (WHERE j.state = 'fd_withdrawn')::int      AS withdrawn_count,
       COALESCE(SUM(j.principal)       FILTER (WHERE j.state = 'fd_active'), 0)::text AS total_principal,
       COALESCE(SUM(j.maturity_amount)  FILTER (WHERE j.state = 'fd_active'), 0)::text AS total_maturity,
       COALESCE(MIN(j.maturity_date)    FILTER (WHERE j.state = 'fd_active' AND j.maturity_date >= CURRENT_DATE), NULL) AS next_maturity_date,
       COALESCE(SUM(j.principal)       FILTER (WHERE j.state = 'fd_active' AND j.maturity_date = (
         SELECT MIN(j2.maturity_date) FROM journey j2
          WHERE j2.user_id = $1 AND j2.state = 'fd_active' AND j2.maturity_date >= CURRENT_DATE
       )), 0)::text AS next_maturity_amount
     FROM journey j
    WHERE j.user_id = $1`,
    [userId]
  );
  return { user: { user_id: userId }, summary: r.rows[0] };
}

async function getMyBookings(args, ctx) {
  if (!ctx || !ctx.userId) {
    return { error: 'auth_required', reason: 'get_my_bookings requires a logged-in user' };
  }
  const userId = ctx.userId;
  const stateFilter = (args && args.state && args.state !== 'all') ? args.state : null;
  const limit = Math.min(50, parseInt(args && args.limit, 10) || 20);
  // state values from the model are 'active' / 'matured' / 'withdrawn';
  // the DB enum is 'fd_active' / 'fd_matured' / 'fd_withdrawn'.
  let stateClause = '';
  const params = [userId];
  if (stateFilter) {
    params.push('fd_' + stateFilter);
    stateClause = ` AND j.state = $${params.length}`;
  }
  params.push(limit);
  const r = await query(
    `SELECT j.booking_id, j.bank_reference_id, m.bank_code, m.bank_name,
            j.tenure_months, j.interest_rate_bps, j.customer_type,
            j.principal, j.maturity_amount, j.booking_date, j.maturity_date, j.state,
            j.senior_citizen_rate_bps, j.effective_date, j.customer_reference,
            j.branch_code, j.ifsc_code, j.settlement_id,
            j.dicgc_insured, j.interest_payout_frequency, j.tax_slab
       FROM journey j
       JOIN master m ON j.rate_id = m.rate_id
      WHERE j.user_id = $1${stateClause}
      ORDER BY j.booking_date DESC
      LIMIT $${params.length}`,
    params
  );
  return { count: r.rows.length, bookings: r.rows };
}

HANDLERS.get_my_fd_summary = getMyFdSummary;
HANDLERS.get_my_bookings   = getMyBookings;

/**
 * Build the per-request tool list. Public tools are always
 * included; user-scoped tools are only included if the request
 * has a verified userId. The LLM never sees the names of tools
 * it cannot call, so it cannot try to call them.
 */
function buildToolDefsForRequest({ isAuthed }) {
  return TOOL_DEFS.filter(def => {
    if (USER_SCOPED_TOOLS.has(def.function.name)) return isAuthed;
    return true;
  });
}

/**
 * Dispatch a tool call. The LLM client calls this with the
 * (name, args) the model emitted. We additionally pass a `ctx`
 * object with the verified userId (or null for anon).
 *
 * The ctx is the ONLY way userId enters the tool. The model
 * cannot influence ctx; it comes from the JWT in the request.
 */
async function dispatchTool(name, args, ctx) {
  if (!TOOL_NAMES.has(name)) return { error: 'unknown_tool', name };
  // Defense in depth: if a user-scoped tool is somehow called for
  // an anon request, refuse.
  if (USER_SCOPED_TOOLS.has(name) && !(ctx && ctx.userId)) {
    return { error: 'auth_required', name };
  }
  const fn = HANDLERS[name];
  if (!fn) return { error: 'no_handler', name };
  return await fn(args || {}, ctx || {});
}

module.exports = { TOOL_DEFS, TOOL_NAMES, USER_SCOPED_TOOLS, HANDLERS, buildToolDefsForRequest, dispatchTool };
