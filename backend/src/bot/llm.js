/**
 * MiniMax LLM client (OpenAI-compatible chat completions).
 *
 * - Non-streaming. The widget already shows a typing indicator
 *   during the in-flight request, so streaming is not needed for
 *   basic UX. Streaming can be added later without API changes.
 *
 * - Tool calling is supported. The client takes a list of tool
 *   definitions and a handlers map; when the model emits
 *   tool_calls, we run the whitelisted handlers (read-only DB
 *   access lives in llmTools.js), append the results to the
 *   message history, and call the model again. We cap the
 *   tool-call loop at 3 iterations to prevent runaway spend.
 *
 * - The model is configured to include <think>...</think> blocks
 *   in its output (M2.7 default). We strip them server-side
 *   before returning so the user never sees internal reasoning.
 *   The thinking length is logged for cost visibility but never
 *   leaves the server.
 *
 * - Returns { text, usage, toolsUsed, finishReason } on success.
 *   Returns { __error: true, status, reason } on any failure so
 *   the route layer can map to HTTP status codes.
 *
 * - No API key is ever logged. Errors include a reason string
 *   but never the key.
 */

const https = require('https');
const { URL } = require('url');

// Strip <think>...</think> (non-greedy, multiline) from model output.
// If the model emits an unterminated <think> (truncation), strip
// from <think> to end of string.
function stripThinkTags(s) {
  if (typeof s !== 'string') return s;
  // 1) any well-formed block
  let out = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  // 2) any unterminated block from <think> to end
  out = out.replace(/<think>[\s\S]*$/g, '');
  return out.trim();
}

function readEnv() {
  const apiKey    = process.env.MINIMAX_API_KEY;
  const model     = process.env.MINIMAX_MODEL     || 'MiniMax-M2.7';
  const baseUrl   = process.env.MINIMAX_BASE_URL   || 'https://api.minimax.io/v1';
  const timeoutMs = parseInt(process.env.MINIMAX_TIMEOUT_MS, 10) || 30000;
  const maxTokens = parseInt(process.env.LLM_MAX_COMPLETION_TOKENS, 10) || 800;
  const temperature = (process.env.LLM_TEMPERATURE != null)
    ? parseFloat(process.env.LLM_TEMPERATURE) : 0.5;
  return { apiKey, model, baseUrl, timeoutMs, maxTokens, temperature };
}

/**
 * POST a JSON body to a URL using Node's https module with a
 * hard timeout. Returns { status, body, raw }.
 */
function httpsPost({ url, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { reject(e); return; }
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { /* leave null */ }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('upstream_timeout'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Run a chat completion with optional tools.
 *
 * @param {Object} opts
 * @param {string} opts.system        - system prompt
 * @param {string} opts.userMessage   - the user's question
 * @param {Array}  [opts.tools]       - OpenAI-style tool definitions
 * @param {Object} [opts.toolHandlers]- { [name]: async (args) => result }
 * @param {string} [opts.userId]      - for logging only
 * @param {string} [opts.ip]          - for logging only
 * @returns {Promise<{text, usage, toolsUsed, finishReason} | {__error, status, reason}>}
 */
async function chatCompletion(opts) {
  const { system, userMessage, tools, toolHandlers, userId, ip } = opts;
  const { apiKey, model, baseUrl, timeoutMs, maxTokens, temperature } = readEnv();

  if (!apiKey) {
    return { __error: true, status: 401, reason: 'missing_api_key' };
  }

  // Build initial message history. Tool-call loop mutates a copy.
  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: userMessage },
  ];

  const toolsUsed = [];
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let finishReason = 'stop';
  let lastContent = '';

  // Cap iterations to prevent runaway spend / infinite loops
  const MAX_ITER = 3;
  for (let i = 0; i < MAX_ITER; i++) {
    const body = JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens,
      temperature,
      ...(tools && tools.length ? { tools } : {}),
    });
    const headers = {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type':  'application/json',
    };

    let res;
    try {
      res = await httpsPost({ url: baseUrl + '/chat/completions', headers, body, timeoutMs });
    } catch (e) {
      const reason = e.message === 'upstream_timeout' ? 'upstream_timeout' : 'upstream_unreachable';
      logCall({ userId, ip, iter: i, status: 0, reason, usage: null, latencyMs: 0 });
      return { __error: true, status: 504, reason };
    }

    if (res.status === 401) {
      logCall({ userId, ip, iter: i, status: 401, reason: 'auth_failed', usage: null, latencyMs: 0 });
      return { __error: true, status: 401, reason: 'auth_failed' };
    }
    if (res.status === 429) {
      // MiniMax returns two distinct 429s:
      //   - rate_limit_error     (RPM/TPM cap, retryable)
      //   - usage_limit_error    (account quota, not retryable in-window)
      // We inspect the body to pick the right reason.
      const errType = res.body && res.body.error && res.body.error.type;
      const reason = errType === 'usage_limit_error'
        ? 'upstream_quota_exceeded'
        : 'upstream_rate_limited';
      logCall({ userId, ip, iter: i, status: 429, reason, usage: null, latencyMs: 0 });
      return { __error: true, status: 503, reason };
    }
    if (res.status < 200 || res.status >= 300) {
      logCall({ userId, ip, iter: i, status: res.status, reason: 'upstream_error', usage: null, latencyMs: 0 });
      return { __error: true, status: 502, reason: 'upstream_error', upstreamStatus: res.status };
    }

    const choice = res.body && res.body.choices && res.body.choices[0];
    if (!choice) {
      return { __error: true, status: 502, reason: 'malformed_response' };
    }
    finishReason = choice.finish_reason || finishReason;

    if (res.body.usage) {
      totalUsage.prompt_tokens     += res.body.usage.prompt_tokens     || 0;
      totalUsage.completion_tokens += res.body.usage.completion_tokens || 0;
      totalUsage.total_tokens      += res.body.usage.total_tokens      || 0;
    }

    const msg = choice.message || {};
    lastContent = msg.content || '';

    // No tool calls? -> final answer
    if (!msg.tool_calls || !msg.tool_calls.length) break;

    // Append the assistant turn that issued the tool calls
    messages.push({
      role: 'assistant',
      content: msg.content || null,
      tool_calls: msg.tool_calls,
    });

    // Execute whitelisted tool handlers
    for (const tc of msg.tool_calls) {
      const fn = tc.function || {};
      const name = fn.name;
      let args = {};
      try { args = fn.arguments ? JSON.parse(fn.arguments) : {}; } catch (e) { /* keep {} */ }
      const handler = toolHandlers && toolHandlers[name];
      let result;
      if (!handler) {
        result = { error: 'unknown_tool', name };
      } else {
        try {
          result = await handler(args);
        } catch (e) {
          result = { error: 'tool_failed', message: String(e && e.message || e) };
        }
      }
      toolsUsed.push({ name, args, result });
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
    // loop again with tool results in the message history
  }

  const cleaned = stripThinkTags(lastContent);

  logCall({
    userId, ip,
    iter: toolsUsed.length ? toolsUsed.length : 1,
    status: 200, reason: 'ok',
    usage: totalUsage,
    latencyMs: 0, // not tracked per-iter; aggregate below
    toolsUsed: toolsUsed.map(t => t.name),
  });

  return {
    text: cleaned,
    usage: totalUsage,
    toolsUsed: toolsUsed.map(t => t.name),
    finishReason,
  };
}

function logCall({ userId, ip, iter, status, reason, usage, toolsUsed }) {
  // Never log the API key. userId / ip already PII-light.
  const line = '[bot-llm] ' +
    `status=${status} reason=${reason} ` +
    `iter=${iter} ` +
    `user=${userId || 'anon'} ip=${ip || 'n/a'} ` +
    (usage ? `pt=${usage.prompt_tokens} ct=${usage.completion_tokens} tt=${usage.total_tokens} ` : '') +
    (toolsUsed && toolsUsed.length ? `tools=${toolsUsed.join(',')} ` : '');
  console.log(line.trim());
}

module.exports = { chatCompletion, stripThinkTags };
