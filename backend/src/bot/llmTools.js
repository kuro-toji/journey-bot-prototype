/**
 * Read-only DB tools exposed to the LLM.
 *
 * Three tools, all whitelisted and all read-only:
 *
 *   1) list_banks()
 *        Returns one row per bank with code, name, bank type,
 *        DICGC insured flag, and VKYC threshold.
 *
 *   2) get_rates({bank_code?, tenure_months?})
 *        Returns rate rows from the 'master' table. Both filters
 *        are optional. customer_type is implicit in the
 *        interest_rate_bps vs senior_citizen_rate_bps pair;
 *        we return both columns so the LLM can pick the
 *        relevant one.
 *
 *   3) compare_rates({tenure_months, customer_type?})
 *        Returns a per-bank comparison for the given tenure.
 *        customer_type is 'general' (default) or 'senior'.
 *        Sorted by effective rate desc.
 *
 * Schema notes (from db/init_db.sh):
 *   - master has interest_rate_bps (general) AND
 *     senior_citizen_rate_bps as separate columns. There is NO
 *     customer_type column. (Earlier draft of this file used the
 *     wrong column name and the tools were silently returning
 *     errors, which made the model loop forever.)
 *   - bank_type is an enum: 'commercial' | 'small_finance' | 'nbfc'
 *   - dicgc_insured is boolean
 *   - vkyc_threshold is the amount above which VKYC is required
 *     (0 means always required)
 *
 * No write path. Every handler calls query() (the shared pool
 * from src/config/db.js) with a SELECT.
 */

const { query } = require('../config/db');

const TOOL_NAMES = new Set(['list_banks', 'get_rates', 'compare_rates']);

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

async function dispatchTool(name, args) {
  if (!TOOL_NAMES.has(name)) return { error: 'unknown_tool', name };
  const fn = HANDLERS[name];
  if (!fn) return { error: 'no_handler', name };
  return await fn(args || {});
}

module.exports = { TOOL_DEFS, TOOL_NAMES, dispatchTool, HANDLERS };
