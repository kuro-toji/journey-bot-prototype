/**
 * FinBot — chat widget.
 *
 * - Shadow DOM for full CSS isolation (won't fight app styles)
 * - Click-driven menu (chips) — typing only allowed in the
 *   verification sub-flow
 * - All bot traffic goes to /api/bot/*
 * - Auth detection via localStorage 'auth_token' (set by js/auth.js)
 * - Anon verification token stored in sessionStorage so a refresh
 *   wipes it (per user requirement: "once refreshed it would be
 *   deleted")
 * - Mobile-first: floating action button (FAB) bottom-right on
 *   mobile, fixed panel bottom-right on desktop
 * - One global instance; calling load() twice is a no-op
 *
 * Public API:
 *   window.FinBot.load()  - inject the widget (called automatically
 *                            on DOMContentLoaded)
 *   window.FinBot.open()  - open the panel programmatically
 *   window.FinBot.close() - close the panel
 */
(function () {
  'use strict';

  if (window.FinBot && window.FinBot._loaded) return;
  const FB = (window.FinBot = window.FinBot || {});
  FB._loaded = true;

  const API = (window.API_BASE || '').replace(/\/+$/, '');
  const STYLE = `
:host { all: initial; font-family: 'Roboto', system-ui, -apple-system, sans-serif; color: #1f2937; }
* { box-sizing: border-box; font-family: 'Roboto', system-ui, -apple-system, sans-serif; }

/* --- launcher --- */
.fb-launcher {
  position: fixed; right: 20px; bottom: 80px; z-index: 99999;
  width: 56px; height: 56px; border-radius: 50%;
  background: #ecad4f; color: #1f2937;
  border: none; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.18);
  display: flex; align-items: center; justify-content: center;
  transition: transform .15s ease, box-shadow .15s ease;
}
.fb-launcher:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,0.22); }
.fb-launcher[aria-expanded="true"] { display: none; }
.fb-launcher svg { width: 28px; height: 28px; }

/* --- panel --- */
.fb-panel {
  position: fixed; right: 20px; bottom: 20px; z-index: 100000;
  width: 360px; max-width: calc(100vw - 24px);
  height: 540px; max-height: calc(100vh - 100px);
  background: #fff; border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  display: none; flex-direction: column; overflow: hidden;
  animation: fb-pop .18s ease-out;
}
.fb-panel[aria-hidden="false"] { display: flex; }
@keyframes fb-pop {
  from { transform: translateY(8px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}

.fb-header {
  background: #1f2937; color: #ecad4f;
  padding: 14px 16px; display: flex; align-items: center; gap: 10px;
}
.fb-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  border: 2px solid #ecad4f;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
}
.fb-avatar-inner {
  width: 22px; height: 22px; border-radius: 50%;
  background: #ecad4f; color: #1f2937;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
}
.fb-title { font-size: 15px; font-weight: 600; flex: 1; }
.fb-sub { font-size: 11px; color: #d1d5db; }
.fb-close {
  background: transparent; color: #fff; border: none; cursor: pointer;
  font-size: 22px; line-height: 1; padding: 4px 8px; border-radius: 6px;
}
.fb-close:hover { background: rgba(255,255,255,0.1); }

.fb-body {
  flex: 1; overflow-y: auto; padding: 14px;
  background: #f9fafb;
  scroll-behavior: smooth;
}
.fb-body::-webkit-scrollbar { width: 6px; }
.fb-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

.fb-msg { margin-bottom: 12px; max-width: 88%; }
.fb-msg-bot {
  background: #fff; border: 1px solid #e5e7eb;
  padding: 10px 12px; border-radius: 12px 12px 12px 4px;
  font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;
}
.fb-msg-user {
  background: #ecad4f; color: #1f2937;
  padding: 10px 12px; border-radius: 12px 12px 4px 12px;
  font-size: 13.5px; line-height: 1.5; word-wrap: break-word;
  margin-left: auto;
}
.fb-msg-error {
  background: #fef2f2; border: 1px solid #fecaca;
  color: #991b1b; padding: 10px 12px; border-radius: 12px 12px 12px 4px;
  font-size: 13.5px; line-height: 1.5;
}
.fb-msg-user-wrap { display: flex; justify-content: flex-end; }

.fb-chips {
  display: flex; flex-wrap: wrap;
  gap: 8px 10px;
  /* Equal margin above and below so the chip group never
     'sticks' to the next message or to the previous bot
     bubble. The 12px matches the gap used between two
     consecutive .fb-msg bubbles (.fb-msg margin-bottom),
     so the vertical rhythm of the chat is uniform:
       msg  <-- 12px -->  chips  <-- 12px -->  msg */
  margin: 12px 0 12px 0;
}
.fb-chip {
  background: #fff; color: #1f2937;
  border: 1px solid #ecad4f; border-radius: 999px;
  padding: 7px 14px; font-size: 12.5px; font-weight: 500;
  cursor: pointer; transition: background .12s ease;
}
.fb-chip:hover { background: #ecad4f; }
.fb-chip:disabled { opacity: 0.5; cursor: not-allowed; }
.fb-chip[data-intent="undefined"],
.fb-chip[data-intent=""] { display: none; }

.fb-msg-typing-label {
  background: transparent !important;
  border: none !important;
  padding: 4px 12px !important;
  color: #6b7280 !important;
  font-size: 12px !important;
  font-style: italic !important;
  max-width: 100% !important;
}
.fb-msg-meta {
  background: transparent !important;
  border: none !important;
  padding: 2px 12px !important;
  color: #9ca3af !important;
  font-size: 11px !important;
  font-style: italic !important;
  max-width: 100% !important;
}

/* markdown-rendered content inside bot messages */
.fb-md-h1, .fb-md-h2, .fb-md-h3, .fb-md-h4, .fb-md-h5, .fb-md-h6 {
  margin: 8px 0 4px;
  font-weight: 600;
  line-height: 1.3;
  color: #1f2937;
}
.fb-md-h1 { font-size: 18px; }
.fb-md-h2 { font-size: 16px; }
.fb-md-h3 { font-size: 15px; }
.fb-md-h4, .fb-md-h5, .fb-md-h6 { font-size: 14px; }
.fb-md-p { margin: 0 0 8px; }
.fb-md-p:last-child { margin-bottom: 0; }
.fb-md-ul, .fb-md-ol { margin: 4px 0 8px; padding-left: 22px; }
.fb-md-ul li, .fb-md-ol li { margin: 2px 0; }
.fb-md-code {
  background: #f3f4f6;
  border-radius: 3px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  color: #b45309;
}
.fb-md-pre {
  background: #1f2937;
  color: #f9fafb;
  border-radius: 6px;
  padding: 8px 10px;
  margin: 6px 0;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.4;
}
.fb-md-pre code { color: inherit; background: transparent; padding: 0; }
.fb-md-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 6px 0;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}
.fb-md-table {
  border-collapse: collapse;
  font-size: 11.5px;
  min-width: 100%;
  white-space: nowrap;
}
.fb-md-table th, .fb-md-table td {
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}
.fb-md-table th {
  background: #f9fafb;
  font-weight: 600;
  position: sticky;
  top: 0;
}
.fb-md-table tr:last-child td {
  border-bottom: none;
}
.fb-md-hr { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0; }
.fb-md-quote {
  border-left: 3px solid #d1d5db;
  margin: 6px 0;
  padding: 4px 10px;
  color: #4b5563;
  font-style: italic;
  background: #f9fafb;
  border-radius: 0 4px 4px 0;
}

.fb-typing { display: inline-flex; gap: 3px; padding: 4px 0; }
.fb-typing span {
  width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;
  animation: fb-bounce 1.2s infinite ease-in-out;
}
.fb-typing span:nth-child(2) { animation-delay: 0.15s; }
.fb-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes fb-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1);   opacity: 1; }
}

.fb-input {
  border-top: 1px solid #e5e7eb; background: #fff;
  padding: 10px 12px; display: flex; gap: 8px;
}
.fb-input input {
  flex: 1; border: 1px solid #d1d5db; border-radius: 22px;
  padding: 9px 14px; font-size: 13.5px; font-family: inherit;
  outline: none;
}
.fb-input input:focus { border-color: #ecad4f; }
.fb-input button {
  background: #ecad4f; color: #1f2937; border: none;
  border-radius: 22px; padding: 9px 16px; font-weight: 600; font-size: 13px;
  cursor: pointer;
}
.fb-input button:disabled { opacity: 0.5; cursor: not-allowed; }
.fb-hint {
  font-size: 11px; color: #6b7280; margin: 0 14px 8px;
  padding: 6px 10px; background: #fffbeb; border-radius: 8px;
  border: 1px solid #fde68a;
}

/* --- mobile --- */
@media (max-width: 480px) {
  .fb-panel {
    right: 0; left: 0; bottom: 0; width: 100vw; height: 100vh;
    max-width: 100vw; max-height: 100vh;
    border-radius: 0;
  }
  .fb-launcher { right: 16px; bottom: 78px; }
}
`;

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'style') Object.assign(e.style, attrs[k]);
        else if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null) continue;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
      }
    }
    return e;
  }

  /* ---------- state ---------- */
  const state = {
    open: false,
    isAuthed: false,
    anonToken: null,         // sessionStorage-backed
    awaiting: null,          // current verification step
    flowChips: null,         // chips shown after the last bot reply
    busy: false,
    labelMap: Object.create(null), // intent -> label, populated as we learn about intents
  };

  function prettyLabel(intent) {
    if (!intent) return '';
    if (state.labelMap[intent]) return state.labelMap[intent];
    return intent.replace(/^faq_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function rememberChip(c) {
    if (c && c.intent && c.label) state.labelMap[c.intent] = c.label;
  }

  function getAuthToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || null;
  }
  function isAuthed() {
    return !!getAuthToken();
  }
  function getAnonToken() {
    return sessionStorage.getItem('finbot_anon_token') || null;
  }
  function setAnonToken(t) {
    if (t) sessionStorage.setItem('finbot_anon_token', t);
    else sessionStorage.removeItem('finbot_anon_token');
  }

  /* ---------- api ---------- */
  async function callBot(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = getAuthToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const r = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { __error: true, status: r.status, data };
    return data;
  }

  /* ---------- render ---------- */
  let root, shadow, launcher, panel, bodyEl, inputRow, inputEl, submitBtn, hintEl;

  function injectOnce() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'finbot-root';
    root.style.cssText = 'all:initial;';
    shadow = root.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    shadow.appendChild(style);

    // launcher
    launcher = el('button', { class: 'fb-launcher', 'aria-label': 'Open chat', 'aria-expanded': 'false' });
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>';
    launcher.addEventListener('click', open);
    shadow.appendChild(launcher);

    // panel
    panel = el('div', { class: 'fb-panel', 'aria-hidden': 'true' });

    const header = el('div', { class: 'fb-header' }, [
      el('div', { class: 'fb-avatar' }, [
        el('span', { class: 'fb-avatar-inner' }, [state.branding && state.branding.bot && state.branding.bot.avatar_text
          ? state.branding.bot.avatar_text
          : 'F']),
      ]),
      el('div', { style: { flex: '1' } }, [
        el('div', { class: 'fb-title' }, ['FinBot']),
        el('div', { class: 'fb-sub' }, ['FD assistant — ask me anything']),
      ]),
    ]);
    const closeBtn = el('button', { class: 'fb-close', 'aria-label': 'Close' }, ['×']);
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    bodyEl = el('div', { class: 'fb-body' });
    panel.appendChild(bodyEl);

    hintEl = el('div', { class: 'fb-hint', style: { display: 'none' } });
    panel.appendChild(hintEl);

    inputRow = el('div', { class: 'fb-input', style: { display: 'none' } });
    inputEl = el('input', { type: 'text', placeholder: 'Type…' });
    submitBtn = el('button', {}, ['Send']);
    submitBtn.addEventListener('click', onSubmitInput);
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSubmitInput(); });
    inputRow.appendChild(inputEl);
    inputRow.appendChild(submitBtn);
    panel.appendChild(inputRow);

    shadow.appendChild(panel);
    document.body.appendChild(root);
  }

  function appendMessage(role, text, isError, extraClass) {
    const cls = 'fb-msg '
              + (isError ? 'fb-msg-error '
                : (role === 'user' ? 'fb-msg-user ' : 'fb-msg-bot '))
              + (extraClass || '');
    // Bot messages are rendered as safe HTML (markdown -> HTML).
    // User messages and error bubbles are rendered as plain text
    // so the user can see exactly what they typed / what the error
    // string is (no risk of a model injecting <script> in an
    // error message either, since errors are server-side strings).
    let node;
    if (role === 'bot' && !isError) {
      const html = formatBotText(text || '');
      const div = document.createElement('div');
      div.className = cls.trim();
      div.innerHTML = html;
      node = div;
    } else {
      node = el('div', { class: cls.trim() }, [text || '']);
    }
    if (role === 'user') {
      const w = el('div', { class: 'fb-msg-user-wrap' }, [node]);
      bodyEl.appendChild(w);
    } else {
      bodyEl.appendChild(node);
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return node;
  }

  function appendChips(chips) {
    if (!chips || !chips.length) return;
    const wrap = el('div', { class: 'fb-chips' });
    for (const c of chips) {
      const intent = (c && c.intent) || (typeof c === 'string' ? c : null);
      if (!intent) continue; // skip malformed entries rather than render empty buttons
      const label = (c && c.label) || prettyLabel(intent);
      rememberChip({ intent, label });
      const b = el('button', { class: 'fb-chip', 'data-intent': intent }, [label]);
      b.addEventListener('click', () => handleIntentClick(intent, label));
      wrap.appendChild(b);
    }
    if (!wrap.childElementCount) return;
    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function appendTyping() {
    const t = el('div', { class: 'fb-msg fb-msg-bot' });
    t.innerHTML = '<div class="fb-typing"><span></span><span></span><span></span></div>';
    bodyEl.appendChild(t);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return t;
  }

  function setHint(text) {
    if (!text) {
      hintEl.style.display = 'none';
      hintEl.textContent = '';
    } else {
      hintEl.style.display = 'block';
      hintEl.textContent = text;
    }
  }

  function setInputVisible(visible, placeholder, onSubmit) {
    if (!visible) {
      inputRow.style.display = 'none';
      return;
    }
    inputRow.style.display = 'flex';
    inputEl.placeholder = placeholder || 'Type…';
    inputEl.value = '';
    state.awaiting = onSubmit;
    setTimeout(() => inputEl.focus(), 50);
  }

  /* ---------- handlers ---------- */
  async function refreshMenu(opts) {
    const r = await callBot('/api/bot/menu');
    if (!r || !r.menu || !r.menu.length) return;
    for (const c of r.menu) rememberChip(c);
    if (opts && opts.replace) {
      // remove the last chip group (the now-stale follow-ups) and
      // append the fresh menu in its place
      const groups = shadow.querySelectorAll('.fb-chips');
      if (groups.length) groups[groups.length - 1].remove();
    }
    appendChips(r.menu);
    state.flowChips = r.menu;
  }

  async function handleIntentClick(intent, label) {
    if (state.busy) return;
    if (label) rememberChip({ intent, label });
    // disable all chips to prevent double-click
    const chips = shadow.querySelectorAll('.fb-chip');
    chips.forEach(c => c.disabled = true);

    if (intent === 'main_menu') {
      // sentinel — re-render the full menu in place
      appendMessage('user', label || 'Main menu');
      exitFreeForm();
      await refreshMenu({ replace: true });
      chips.forEach(c => c.disabled = false);
      return;
    }

    if (intent === 'talk_to_assistant') {
      // intercept before /api/bot/ask — the backend has no handler
      // for this sentinel. Enter free-form Q&A mode.
      appendMessage('user', label || 'Talk to assistant');
      enterFreeForm();
      chips.forEach(c => c.disabled = false);
      return;
    }

    if (intent === 'verify_start') {
      appendMessage('user', label || 'Check my FDs');
      startVerifyFlow();
      // re-enable remaining chips (we removed the verify_start one from flow)
      chips.forEach(c => { if (c.getAttribute('data-intent') !== 'verify_start') c.disabled = false; });
      return;
    }

    appendMessage('user', label || prettyLabel(intent));
    state.busy = true;
    const typing = appendTyping();
    const r = await callBot('/api/bot/ask', { intent });
    typing.remove();
    state.busy = false;

    if (r.__error) {
      appendMessage('bot', 'Sorry, something went wrong. Please try again.', true);
      // re-enable chips
      chips.forEach(c => c.disabled = false);
      return;
    }

    appendMessage('bot', r.text);
    appendChips(r.followUps);
    state.flowChips = r.followUps;
    // re-enable all chips so the user can keep clicking
    shadow.querySelectorAll('.fb-chip').forEach(c => c.disabled = false);
  }

  /* ---------- verify flow ---------- */
  function startVerifyFlow() {
    state.verifyStep = 0;
    state.verifyData = {};
    setInputVisible(true, '10-digit mobile number (e.g. 9714503400)', submitPhone);
    setHint('Step 1 of 3: Mobile number');
  }
  function submitPhone() {
    const v = inputEl.value.trim();
    if (!/^[6-9]\d{9}$/.test(v)) {
      appendMessage('bot', 'That does not look like a valid 10-digit mobile number. Please try again.', true);
      return;
    }
    state.verifyData.phone = v;
    state.verifyStep = 1;
    setInputVisible(true, 'Date of birth YYYY-MM-DD (e.g. 1990-01-15)', submitDob);
    setHint('Step 2 of 3: Date of birth');
  }
  function submitDob() {
    const v = inputEl.value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      appendMessage('bot', 'Please enter the date of birth in YYYY-MM-DD format.', true);
      return;
    }
    state.verifyData.dob = v;
    state.verifyStep = 2;
    setInputVisible(true, 'PAN (AAAAA9999A, e.g. ABCDE1234F)', submitPan);
    setHint('Step 3 of 3: PAN');
  }
  async function submitPan() {
    const v = inputEl.value.trim().toUpperCase();
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) {
      appendMessage('bot', 'Please enter a valid PAN in the format AAAAA9999A.', true);
      return;
    }
    state.verifyData.pan = v;
    setInputVisible(false);
    setHint('');

    appendMessage('user', v);
    const typing = appendTyping();
    const r = await callBot('/api/bot/verify', state.verifyData);
    typing.remove();

    if (r.__error || !r.ok) {
      const reason = r.data && r.data.reason;
      const msg = reason === 'too_many_attempts'
        ? 'Too many attempts from this network. Please try again later.'
        : "Those details don't match our records. Please double-check all three and try again.";
      appendMessage('bot', msg, true);
      setInputVisible(true, '10-digit mobile number (e.g. 9714503400)', submitPhone);
      setHint('Step 1 of 3: Mobile number');
      return;
    }

    setAnonToken(r.token);
    // Now ask the same intent that the user originally wanted.
    const token = r.token;
    state.busy = true;
    const typing2 = appendTyping();
    const ask = await fetch(API + '/api/bot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'check_my_fds', anonToken: token }),
    });
    const askData = await ask.json();
    typing2.remove();
    state.busy = false;
    appendMessage('bot', askData.text);
    appendChips(askData.followUps);
    state.flowChips = askData.followUps;
    shadow.querySelectorAll('.fb-chip').forEach(c => c.disabled = false);
  }

  async function onSubmitInput() {
    if (!state.awaiting) return;
    const fn = state.awaiting;
    state.awaiting = null;
    await fn();
  }

  /* ---------- free-form Q&A mode (LLM) ----------
   *
   * The user clicks the 'Talk to assistant' chip. The widget:
   *   1) shows a welcome message from the assistant
   *   2) opens the existing input row in persistent mode
   *      (callback = submitLlmQuestion)
   *   3) on each submit, calls POST /api/bot/llm and renders
   *      the reply (already think-tag-stripped server-side)
   *   4) keeps the input open so the user can keep chatting
   *   5) shows '← Main menu' + 'Ask another' chips so the user
   *      can either continue or exit
   *
   * The 'thinking' period is the API round-trip. The existing
   * typing indicator (3 bouncing dots) covers it; the server has
   * already stripped <think>...</think> from the response, so
   * the user never sees internal reasoning.
   */
  function enterFreeForm() {
    state.freeForm = true;
    // Keep the previous FAQ chat history visible. The user can
    // still scroll up to see it, and the '← Main menu' chip at
    // the end of each bot reply is the back button. Clearing the
    // history (as we did previously) made the user feel locked
    // into AI mode with no way back.
    setHint('AI mode — ask about FDs or rates. The model will not entertain off-topic questions.');
    setInputVisible(true, 'Ask about FDs, rates, or comparison…', submitLlmQuestion);
    appendMessage('bot',
      "Hi, I'm FinBot's AI assistant. I can help with Fixed Deposits, " +
      'FD comparison, and related banking topics. Ask me anything.');
  }

  function exitFreeForm() {
    state.freeForm = false;
    setHint('');
    setInputVisible(false);
  }

  async function submitLlmQuestion() {
    if (state.busy) return;
    const text = (inputEl.value || '').trim();
    if (!text) return;
    // Re-assert the persistent input so the user can keep typing
    // after this submission (setInputVisible clears the value).
    setInputVisible(true, 'Ask about FDs, rates, or comparison…', submitLlmQuestion);
    appendMessage('user', text);
    state.busy = true;
    const typing = appendTyping();
    const typingLabel = appendTypingLabel('Assistant is thinking…');
    let r;
    try {
      r = await callBot('/api/bot/llm', { message: text });
    } catch (e) {
      r = { __error: true, reason: 'network' };
    }
    typing.remove();
    typingLabel.remove();
    state.busy = false;

    if (r && r.__error) {
      const reason = r.data && r.data.reason || r.reason;
      const msg = llmErrorToText(reason);
      appendMessage('bot', msg, true);
      // When the LLM is unavailable, offer a relevant FAQ chip so
      // the user has a productive next step. The keyword heuristic
      // maps common user intents to the best matching FAQ.
      const fallback = llmFallbackChip(text);
      const chips = [
        { intent: 'main_menu', label: '← Main menu' },
        { intent: 'talk_to_assistant', label: 'Try again' },
      ];
      if (fallback) chips.push(fallback);
      appendChips(chips);
      shadow.querySelectorAll('.fb-chip').forEach(c => c.disabled = false);
      return;
    }

    appendMessage('bot', r.text || '(no reply)');
    // If the server forwarded to a FAQ (no LLM call), show a
    // small badge so the user understands the answer came from
    // the curated FAQ list, not the AI.
    if (r.forwardedFromFaq) {
      appendMessage('bot',
        `_(forwarded from FAQ: ${r.forwardedFromFaq.label})_`,
        false, 'fb-msg-meta'
      );
    } else if (r.forwardedFromFlow) {
      // The server matched a 'my fd' / 'my deposits' pattern and
      // returned the verify-flow prompt instead of hitting the LLM.
      // Show a badge + the 'Verify identity' chip so the user
      // can immediately start the verify flow.
      appendMessage('bot',
        `_(routed to: ${r.forwardedFromFlow.label})_`,
        false, 'fb-msg-meta'
      );
      appendChips([
        { intent: 'verify_start', label: 'Verify identity' },
        { intent: 'main_menu', label: '← Main menu' },
      ]);
    } else if (r.forwardedFromAuth) {
      // The server matched a 'my fd' pattern AND the user is
      // authed, so the response is the user's actual data
      // (fetched via the self-healing personalized handler).
      // Show a small badge so the user knows it's their data
      // and not a generic FAQ answer.
      appendMessage('bot',
        `_(routed to: ${r.forwardedFromAuth.label})_`,
        false, 'fb-msg-meta'
      );
    }
    // Build the follow-up chip row. On success, also include a
    // relevant FAQ fallback chip if the user's text had a
    // recognizable keyword. This way even when the LLM answers
    // (or refuses) successfully, the user gets a one-click path
    // to the relevant FAQ.
    const followUpChips = [
      { intent: 'main_menu', label: '← Main menu' },
    ];
    const fallback = llmFallbackChip(text);
    if (fallback) followUpChips.push(fallback);
    appendChips(followUpChips);
    // re-enable all chips so the user can keep clicking
    shadow.querySelectorAll('.fb-chip').forEach(c => c.disabled = false);
  }

  function llmErrorToText(reason) {
    switch (reason) {
      case 'missing_api_key':
        return 'The AI assistant is not configured on this server (MINIMAX_API_KEY missing in backend/.env). Please contact the admin.';
      case 'auth_failed':
        return 'The AI assistant is not configured correctly (auth failed). Please contact the admin.';
      case 'upstream_quota_exceeded':
        return "The AI assistant has hit its usage quota and is currently unavailable. " +
               "Try the FAQ bot below or come back later.";
      case 'upstream_rate_limited':
        return "The AI assistant is busy right now. Try the FAQ bot below or retry in a minute.";
      case 'upstream_timeout':
        return 'The AI took too long. Try a shorter question, or use the FAQ bot below.';
      case 'rate_limited':
        return "You've used all your AI questions for this hour. The FAQ bot below has the same answers with no rate limit.";
      case 'message_too_long':
        return 'Your question is too long. Please keep it under 500 characters.';
      default:
        return 'The AI assistant is having trouble. The FAQ bot below has the same answers.';
    }
  }

  // Keyword-to-FAQ heuristic. If the user's question is clearly
  // about a topic we have an FAQ for, return the matching chip so
  // the error message can offer a productive next step.
  function llmFallbackChip(userText) {
    const t = (userText || '').toLowerCase();
    if (/\b(book|booking|how do i (open|start)|sign ?up)\b/.test(t))
      return { intent: 'faq_how_to_book', label: 'How do I book an FD? (FAQ)' };
    if (/\b(kyc|know your customer)\b/.test(t))
      return { intent: 'faq_what_is_kyc', label: 'What is KYC? (FAQ)' };
    if (/\b(vkyc|video kyc)\b/.test(t))
      return { intent: 'faq_why_vkyc', label: 'Why is VKYC required? (FAQ)' };
    if (/\b(aadhaar|aadhar|ekyc)\b/.test(t))
      return { intent: 'faq_aadhaar_ekyc', label: 'What is Aadhaar eKYC? (FAQ)' };
    if (/\b(compare|comparison|best rate|highest rate|which bank)\b/.test(t))
      return { intent: 'faq_fd_comparison', label: 'How do I compare FDs? (FAQ)' };
    if (/\b(tax|tds|taxation)\b/.test(t))
      return { intent: 'faq_taxation', label: 'How is FD interest taxed? (FAQ)' };
    if (/\b(senior|60\+)\b/.test(t))
      return { intent: 'faq_senior_citizen', label: 'Senior citizen rates? (FAQ)' };
    if (/\b(min|minimum|smallest)\b/.test(t))
      return { intent: 'faq_min_amount', label: 'Minimum FD amount? (FAQ)' };
    if (/\b(dicgc|insurance|safe)\b/.test(t))
      return { intent: 'faq_dicgc', label: 'What is DICGC? (FAQ)' };
    if (/\b(compound|compounding|quarterly)\b/.test(t))
      return { intent: 'faq_compounding', label: 'What is compounding? (FAQ)' };
    if (/\b(cumulative|non-cumulative|payout)\b/.test(t))
      return { intent: 'faq_cumulative_vs_non_cumulative', label: 'Cumulative vs Non-Cumulative? (FAQ)' };
    return null;
  }

  function appendTypingLabel(text) {
    const t = el('div', { class: 'fb-msg fb-msg-bot fb-msg-typing-label' }, [text]);
    bodyEl.appendChild(t);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return t;
  }

  /* ---------- safe markdown renderer ----------
   *
   * Renders markdown to safe HTML. The LLM returns text that may
   * contain:
   *   ## headers, **bold**, *italic*, `code`, ```blocks```,
   *   - lists, 1. lists, > quotes, | tables |, --- hr
   *
   * Security: every input byte is HTML-escaped FIRST. Then
   * markdown rules run on the escaped text. This means a bot
   * reply that says '<script>alert(1)</script>' is rendered
   * as the literal 7 characters of escaped text, not as
   * executable HTML. The renderer is ~80 lines of regex
   * replacements; no external library, no innerHTML.
   */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInline(s) {
    // Apply to a single line (no newlines). The escaped string
    // is mutated by these regexes; order matters.
    return s
      // inline code: `code` -> <code>code</code>
      .replace(/`([^`]+)`/g, '<code class="fb-md-code">$1</code>')
      // bold: **text** -> <strong>text</strong>
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // italic: *text* or _text_ -> <em>text</em>
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>');
  }

  function formatBotText(text) {
    if (typeof text !== 'string' || !text) return '';
    // Split into lines, then process block-level constructs.
    const lines = text.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // fenced code block: ```lang\n...\n```
      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, '').trim();
        const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          body.push(escapeHtml(lines[i]));
          i++;
        }
        i++; // skip closing fence
        const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
        out.push(`<pre class="fb-md-pre"${langAttr}><code>${body.join('\n')}</code></pre>`);
        continue;
      }
      // horizontal rule
      if (/^---+\s*$/.test(line)) {
        out.push('<hr class="fb-md-hr">');
        i++; continue;
      }
      // header
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        const inner = formatInline(escapeHtml(h[2]));
        out.push(`<h${Math.min(level, 6)} class="fb-md-h${level}">${inner}</h${Math.min(level, 6)}>`);
        i++; continue;
      }
      // markdown table: header row | --- | data rows
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        const headerCells = splitTableRow(line);
        const sep = splitTableRow(lines[i + 1]);
        i += 2;
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== '') {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        const thead = '<thead><tr>' + headerCells.map(c => `<th>${formatInline(escapeHtml(c))}</th>`).join('') + '</tr></thead>';
        const tbody = '<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${formatInline(escapeHtml(c))}</td>`).join('') + '</tr>').join('') + '</tbody>';
        out.push(`<div class="fb-md-table-wrap"><table class="fb-md-table">${thead}${tbody}</table></div>`);
        continue;
      }
      // unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(formatInline(escapeHtml(lines[i].replace(/^\s*[-*]\s+/, ''))));
          i++;
        }
        out.push('<ul class="fb-md-ul">' + items.map(t => `<li>${t}</li>`).join('') + '</ul>');
        continue;
      }
      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(formatInline(escapeHtml(lines[i].replace(/^\s*\d+\.\s+/, ''))));
          i++;
        }
        out.push('<ol class="fb-md-ol">' + items.map(t => `<li>${t}</li>`).join('') + '</ol>');
        continue;
      }
      // blockquote
      if (/^>\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^>\s+/.test(lines[i])) {
          items.push(formatInline(escapeHtml(lines[i].replace(/^>\s+/, ''))));
          i++;
        }
        out.push('<blockquote class="fb-md-quote">' + items.join('<br>') + '</blockquote>');
        continue;
      }
      // empty line -> paragraph break
      if (line.trim() === '') { i++; continue; }
      // default: paragraph (collect consecutive non-special lines)
      const paraLines = [];
      while (
        i < lines.length
        && lines[i].trim() !== ''
        && !/^(#{1,6}\s|```|-{3,}|\s*[-*]\s|\s*\d+\.\s|>\s|\|)/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length) {
        out.push('<p class="fb-md-p">' + formatInline(escapeHtml(paraLines.join(' '))) + '</p>');
      }
    }
    return out.join('');
  }

  function splitTableRow(line) {
    // strip leading/trailing pipes, split on |, trim each cell
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map(s => s.trim());
  }

  /* ---------- open / close ---------- */
  function open() {
    if (state.open) return;
    injectOnce();
    state.open = true;
    state.isAuthed = isAuthed();
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    if (bodyEl.childElementCount === 0) {
      appendMessage('bot', "Hi, I'm FinBot. I can answer questions about FDs, compare rates, and show your portfolio.");
      refreshMenu();
    }
  }
  function close() {
    if (!state.open) return;
    state.open = false;
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
  }

  FB.load = function () {
    injectOnce();
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // already ready
    } else {
      document.addEventListener('DOMContentLoaded', () => { injectOnce(); });
    }
  };
  FB.open = open;
  FB.close = close;

  // auto-load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    FB.load();
  } else {
    document.addEventListener('DOMContentLoaded', FB.load);
  }
})();
