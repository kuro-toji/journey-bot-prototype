/**
 * Read-only DB tools exposed to the LLM.
 *
 * Three tools, all whitelisted and all read-only:
 *
 *   1) list_banks()
 *        Returns one row per bank with code, name, and the
 *        customer types it serves (general / senior).
 *
 *   2) get_rates({bank_code?, tenure_months?, customer_type?})
 *        Returns rate rows from the 'master' table. All three
 *        filters are optional; with no filters, returns the
 *        full rate table (currently ~15 rows, well within
 *        reasonable LLM context).
 *
 *   3) compare_rates({tenure_months, customer_type?})
 *        Returns a per-bank comparison for the given tenure:
 *        bank_code, bank_name, customer_type, interest_rate_bps,
 *        effective_yield_pct, min_amount, max_amount. Sorted
 *        by effective_yield_pct desc.
 *
 * No write path. Every handler calls query() (the shared pool
 * from src/config/db.js) with a SELECT. We never build an
 * UPDATE/INSERT/DELETE.
 *
 * Tool definitions follow the OpenAI 'tools' shape that
 * MiniMax accepts: {type:'function', function:{name, description,
 * parameters:{type:'object', properties:..., required:...}}}.
 */

const { query } = require('../config/db');

/**
 * Whitelist of tool names. The LLM can ONLY call tools whose
 * name is in this set. Anything else returns {error:'unknown_tool'}
 * and is logged.
 */
const TOOL_NAMES = new Set(['list_banks', 'get_rates', 'compare_rates']);

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_banks',
      description: 'Return the list of all banks available on the platform, with their bank code, full name, and the customer types they serve (general, senior, or both).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rates',
      description: 'Return FD rate rows. All filters are optional. tenure_months is an integer; customer_type is one of "general" or "senior".',
      parameters: {
        type: 'object',
        properties: {
          bank_code:     { type: 'string',  description: 'Bank code, e.g. "MARO" or "ION".' },
          tenure_months: { type: 'integer', description: 'Tenure in months, e.g. 12 or 36.' },
          customer_type: { type: 'string',  enum: ['general', 'senior'], description: 'Customer type.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_rates',
      description: 'Compare FD rates across all banks for a specific tenure (and optional customer type). Returns one row per bank, sorted by effective yield descending. Use this when the user asks "which bank has the best 1-year FD?" or similar comparisons.',
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
    SELECT bank_code, bank_name, customer_type, COUNT(*)::int AS rate_rows
      FROM master
     GROUP BY bank_code, bank_name, customer_type
     ORDER BY bank_name, customer_type
  `);
  return { banks: r.rows };
}

async function getRates(args) {
  const where = [];
  const params = [];
  if (args.bank_code) {
    params.push(args.bank_code);
    where.push(`bank_code = $${params.length}`);
  }
  if (args.tenure_months != null) {
    params.push(args.tenure_months);
    where.push(`tenure_months = $${params.length}`);
  }
  if (args.customer_type) {
    params.push(args.customer_type);
    where.push(`customer_type = $${params.length}`);
  }
  const sql = `
    SELECT bank_code, bank_name, tenure_months, customer_type,
           interest_rate_bps, min_amount, max_amount
      FROM master
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY bank_name, tenure_months, customer_type
     LIMIT 50
  `;
  const r = await query(sql, params);
  return {
    count: r.rows.length,
    rates: r.rows,
  };
}

async function compareRates(args) {
  if (args.tenure_months == null) {
    return { error: 'tenure_months_required' };
  }
  const customerType = args.customer_type || 'general';
  const r = await query(`
    SELECT bank_code, bank_name, customer_type, tenure_months,
           interest_rate_bps,
           (interest_rate_bps::numeric / 100) AS rate_pct,
           min_amount, max_amount
      FROM master
     WHERE tenure_months = $1
       AND customer_type = $2
     ORDER BY interest_rate_bps DESC
  `, [args.tenure_months, customerType]);
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

/**
 * Dispatch a tool call. Whitelisted by name; unknown tools
 * return an error result instead of throwing.
 */
async function dispatchTool(name, args) {
  if (!TOOL_NAMES.has(name)) return { error: 'unknown_tool', name };
  const fn = HANDLERS[name];
  if (!fn) return { error: 'no_handler', name };
  return await fn(args || {});
}

module.exports = { TOOL_DEFS, TOOL_NAMES, dispatchTool, HANDLERS };
