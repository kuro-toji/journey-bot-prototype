/**
 * Bot service — the intent router.
 *
 * Each click on a chip maps to an "intent" string. The router looks
 * up the handler for that intent and returns:
 *
 *   {
 *     type:      'faq' | 'data' | 'flow' | 'error',
 *     text:      string,                  // shown to the user
 *     followUps: [intent, ...],           // next chip options
 *     data:      any                      // optional structured data
 *   }
 */

const { getFaq, getMenu } = require('./faq');
const { getCache } = require('./cache');
const { getTokenUserId } = require('./verify');

/* ---------- helpers ---------- */

function formatRupee(n) {
  if (n == null) return '—';
  return 'Rs ' + Number(n).toLocaleString('en-IN');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function computeSummary(bookings) {
  const active = bookings.filter(b => b.state === 'fd_active');
  const matured = bookings.filter(b => b.state === 'fd_matured');
  const withdrawn = bookings.filter(b => b.state === 'fd_withdrawn');
  const totalPrincipal = active.reduce((s, b) => s + Number(b.principal || 0), 0);
  const totalMaturity  = active.reduce((s, b) => s + Number(b.maturity_amount || 0), 0);
  const byBank = {};
  for (const b of active) {
    const k = b.bank_name || 'Unknown';
    byBank[k] = byBank[k] || { count: 0, principal: 0 };
    byBank[k].count += 1;
    byBank[k].principal += Number(b.principal || 0);
  }
  const next = active
    .map(b => ({ date: b.maturity_date, amount: b.maturity_amount, bank: b.bank_name, ref: b.bank_reference_id }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  return { active, matured, withdrawn, totalPrincipal, totalMaturity, byBank, next };
}

function renderBookingsList(bookings) {
  if (!bookings.length) return 'You have no FD bookings yet.';
  const lines = bookings.map((b, i) => {
    const state = b.state === 'fd_active' ? 'Active'
              : b.state === 'fd_matured' ? 'Matured'
              : b.state === 'fd_withdrawn' ? 'Withdrawn'
              : b.state;
    return `${i + 1}. ${b.bank_name} — ${formatRupee(b.principal)} @ ${(b.interest_rate_bps / 100).toFixed(2)}% `
         + `for ${b.tenure_months}m (${state})\n`
         + `   Ref: ${b.bank_reference_id}\n`
         + `   Matures: ${formatDate(b.maturity_date)} → ${formatRupee(b.maturity_amount)}`;
  });
  return lines.join('\n\n');
}

function resolveIdentity(req) {
  if (req.user && req.user.userId) {
    return { kind: 'auth', userId: req.user.userId, name: null };
  }
  const token = req.body && req.body.anonToken;
  if (token) {
    const userId = getTokenUserId(token);
    if (userId) return { kind: 'anon-verified', userId, name: null };
  }
  return { kind: 'anon', userId: null, name: null };
}

function makeFaqHandler(intentId) {
  return () => {
    const f = getFaq(intentId);
    if (!f) return { type: 'error', text: 'Unknown question.', followUps: ['faq_fd_definition'] };
    return { type: 'faq', text: f.answer, followUps: f.followUps };
  };
}

function serveMyFds(identity) {
  const cached = identity.userId ? getCache(identity.userId) : null;
  const bookings = cached && cached.bookings ? cached.bookings : null;
  if (!bookings) {
    return { type: 'data', text: 'I could not find your bookings right now. Please try again.', followUps: ['check_my_fds'] };
  }
  return { type: 'data', text: renderBookingsList(bookings), followUps: ['my_total_value', 'my_maturity', 'my_biggest_fd', 'check_my_fds'] };
}

function handleCheckMyFds(identity) {
  if (identity.kind === 'anon') {
    return {
      type: 'flow',
      text: "To check your FDs anonymously, I need to verify you with three details. " +
            "Please enter them in this exact format:\n\n" +
            "1. Mobile number: 10 digits, no spaces (e.g. 9714503400)\n" +
            "2. Date of birth: YYYY-MM-DD (e.g. 1990-01-15)\n" +
            "3. PAN: AAAAA9999A (e.g. ABCDE1234F)",
      followUps: ['verify_start'],
    };
  }
  return serveMyFds(identity);
}

function handleMyActiveFds(identity) {
  if (identity.kind === 'anon') {
    return { type: 'flow', text: 'Please verify your identity first.', followUps: ['check_my_fds'] };
  }
  return serveMyFds(identity);
}

function handleMyTotalValue(identity) {
  if (identity.kind === 'anon') {
    return { type: 'flow', text: 'Please verify your identity first.', followUps: ['check_my_fds'] };
  }
  const cached = getCache(identity.userId);
  const bookings = cached && cached.bookings ? cached.bookings : null;
  if (!bookings) return { type: 'error', text: 'Bookings not loaded.' };
  const s = computeSummary(bookings);
  const lines = [
    `Active FDs: ${s.active.length}`,
    `Total invested: ${formatRupee(s.totalPrincipal)}`,
    `Total maturing value: ${formatRupee(s.totalMaturity)}`,
  ];
  if (Object.keys(s.byBank).length) {
    lines.push('', 'By bank:');
    for (const [k, v] of Object.entries(s.byBank)) {
      lines.push(`  - ${k}: ${v.count} FD, ${formatRupee(v.principal)}`);
    }
  }
  return { type: 'data', text: lines.join('\n'), followUps: ['my_active_fds', 'my_maturity', 'my_biggest_fd', 'check_my_fds'] };
}

function handleMyMaturity(identity) {
  if (identity.kind === 'anon') {
    return { type: 'flow', text: 'Please verify your identity first.', followUps: ['check_my_fds'] };
  }
  const cached = getCache(identity.userId);
  const bookings = cached && cached.bookings ? cached.bookings : null;
  if (!bookings) return { type: 'error', text: 'Bookings not loaded.' };
  const s = computeSummary(bookings);
  if (!s.next) return { type: 'data', text: 'You have no active FDs maturing in the future.', followUps: ['my_active_fds', 'check_my_fds'] };
  return {
    type: 'data',
    text: `Your next maturity:\n  - ${s.next.bank} on ${formatDate(s.next.date)} → ${formatRupee(s.next.amount)}\n    Ref: ${s.next.ref}`,
    followUps: ['my_active_fds', 'my_total_value', 'my_biggest_fd', 'check_my_fds'],
  };
}

function handleMyBiggestFd(identity) {
  if (identity.kind === 'anon') {
    return { type: 'flow', text: 'Please verify your identity first.', followUps: ['check_my_fds'] };
  }
  const cached = getCache(identity.userId);
  const bookings = cached && cached.bookings ? cached.bookings : null;
  if (!bookings) return { type: 'error', text: 'Bookings not loaded.' };
  const active = bookings.filter(b => b.state === 'fd_active');
  if (!active.length) return { type: 'data', text: 'No active FDs.', followUps: ['my_active_fds', 'check_my_fds'] };
  const biggest = active.slice().sort((a, b) => Number(b.principal) - Number(a.principal))[0];
  return {
    type: 'data',
    text: `Your biggest active FD:\n  ${biggest.bank_name} — ${formatRupee(biggest.principal)} @ ${(biggest.interest_rate_bps / 100).toFixed(2)}%\n  Ref: ${biggest.bank_reference_id}\n  Matures: ${formatDate(biggest.maturity_date)} → ${formatRupee(biggest.maturity_amount)}`,
    followUps: ['my_active_fds', 'my_total_value', 'my_maturity', 'check_my_fds'],
  };
}

function handleHowToBook(identity) {
  return makeFaqHandler('how_to_book')();
}

const handlers = {
  faq_fd_definition:                  makeFaqHandler('fd_definition'),
  faq_fd_details:                    makeFaqHandler('fd_details'),
  faq_dicgc:                         makeFaqHandler('dicgc'),
  faq_cumulative_vs_non_cumulative:  makeFaqHandler('cumulative_vs_non_cumulative'),
  faq_compounding:                   makeFaqHandler('compounding'),
  faq_taxation:                      makeFaqHandler('taxation'),
  faq_senior_citizen:                makeFaqHandler('senior_citizen'),
  faq_min_amount:                    makeFaqHandler('min_amount'),
  faq_fd_comparison:                 makeFaqHandler('fd_comparison'),
  faq_how_to_book:                   handleHowToBook,
  faq_what_is_kyc:                   makeFaqHandler('what_is_kyc'),
  faq_why_vkyc:                      makeFaqHandler('why_vkyc'),
  faq_rd_definition:                 makeFaqHandler('rd_definition'),

  check_my_fds:                      handleCheckMyFds,
  my_active_fds:                     handleMyActiveFds,
  my_total_value:                    handleMyTotalValue,
  my_maturity:                       handleMyMaturity,
  my_biggest_fd:                     handleMyBiggestFd,
};

function dispatch(intent, req) {
  const fn = handlers[intent];
  if (!fn) return { type: 'error', text: 'I do not know that one yet.', followUps: ['faq_fd_definition'] };
  const identity = resolveIdentity(req);
  return fn(identity, (req.body && req.body.params) || {});
}

function menuForViewer(isAuthed) {
  return getMenu(isAuthed ? 'auth' : 'all');
}

module.exports = { dispatch, menuForViewer, computeSummary, renderBookingsList };
