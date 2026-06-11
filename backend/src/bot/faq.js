/**
 * FAQ — hardcoded Q&A for the bot.
 *
 * Each entry has:
 *   id        - stable identifier used in URLs/payloads
 *   intent    - the click-intent that fetches this answer
 *   audience  - 'all' (everyone) or 'auth' (verified/logged-in only)
 *   label     - the chip text shown to the user
 *   answer    - the bot's response
 *   followUps - chip-intents offered as next steps
 */

const FAQ = {
  fd_definition: {
    id: 'fd_definition',
    intent: 'faq_fd_definition',
    audience: 'all',
    label: 'What is a Fixed Deposit?',
    answer:
      "A Fixed Deposit (FD) is a financial instrument offered by banks " +
      "where you deposit a lump sum for a fixed tenure at a fixed interest rate. " +
      "On maturity, you get back your principal plus the accumulated interest. " +
      "FDCs are one of the safest investment options in India, with bank FDs insured " +
      "by DICGC up to Rs 5,00,000 per depositor per bank.",
    followUps: ['faq_fd_details', 'faq_dicgc', 'faq_compounding'],
  },
  fd_details: {
    id: 'fd_details',
    intent: 'faq_fd_details',
    audience: 'all',
    label: 'Tell me more about FD details',
    answer:
      "Key FD details to know:\n\n" +
      "• Tenure: from 7 days to 10 years (most common: 1, 2, 3 years)\n" +
      "• Minimum: usually Rs 1,000 (some SFBs start at Rs 100)\n" +
      "• Compounding: most banks compound quarterly\n" +
      "• Payout: cumulative (paid at maturity) or non-cumulative (monthly/quarterly interest)\n" +
      "• Premature withdrawal: allowed with a small penalty (usually 0.5%-1% lower rate)\n" +
      "• Senior citizens get 0.5% extra at most banks\n" +
      "• Interest is fully taxable; TDS applies if yearly interest > Rs 40,000",
    followUps: ['faq_senior_citizen', 'faq_taxation', 'faq_cumulative_vs_non_cumulative'],
  },
  dicgc: {
    id: 'dicgc',
    intent: 'faq_dicgc',
    audience: 'all',
    label: 'What is DICGC insurance?',
    answer:
      "DICGC (Deposit Insurance and Credit Guarantee Corporation) is a RBI subsidiary " +
      "that insures your bank deposits. Coverage: up to Rs 5,00,000 per depositor per bank. " +
      "This covers both principal and interest. It applies to all commercial banks and " +
      "most cooperative banks. Note: NBFC fixed deposits (like Shriram) are NOT covered by DICGC.",
    followUps: ['faq_fd_definition', 'faq_premature_withdrawal', 'faq_min_amount'],
  },
  cumulative_vs_non_cumulative: {
    id: 'cumulative_vs_non_cumulative',
    intent: 'faq_cumulative_vs_non_cumulative',
    audience: 'all',
    label: 'Cumulative vs Non-Cumulative?',
    answer:
      "• Cumulative FD: interest is compounded and paid at maturity along with principal. " +
      "Best for wealth building — you earn interest-on-interest.\n\n" +
      "• Non-Cumulative FD: interest is paid out monthly or quarterly. " +
      "Best if you want regular income (like a salary).\n\n" +
      "Choose cumulative for long-term growth, non-cumulative for cash flow.",
    followUps: ['faq_compounding', 'faq_fd_details'],
  },
  compounding: {
    id: 'compounding',
    intent: 'faq_compounding',
    audience: 'all',
    label: 'What is compounding?',
    answer:
      "Compounding means you earn interest on your interest. For example, on a 1-year FD:\n\n" +
      "• Simple interest: Rs 1,00,000 at 8% = Rs 8,000 interest\n" +
      "• Quarterly compounding: same FD pays ~Rs 8,243 (about 0.3% more)\n\n" +
      "Most bank FDs compound quarterly. The longer the FD and the more frequent the " +
      "compounding, the bigger the difference. Our platform shows the effective yield " +
      "on every rate card so you can compare apples to apples.",
    followUps: ['faq_cumulative_vs_non_cumulative', 'faq_taxation'],
  },
  taxation: {
    id: 'taxation',
    intent: 'faq_taxation',
    audience: 'all',
    label: 'How is FD interest taxed?',
    answer:
      "FD interest is fully taxable as 'Income from Other Sources' under your ITR.\n\n" +
      "• Banks deduct TDS at 10% if yearly interest exceeds Rs 40,000 (Rs 50,000 for senior citizens)\n" +
      "• Submit Form 15G/15H to avoid TDS if your total income is below the taxable limit\n" +
      "• Form 26AS / AIS shows the TDS credit — claim it while filing ITR\n" +
      "• Regular FDs do NOT qualify for 80C deduction. Only 5-year Tax-Saver FDs do, " +
      "and they have a lock-in with no premature withdrawal.",
    followUps: ['faq_senior_citizen', 'faq_premature_withdrawal', 'faq_compounding'],
  },
  senior_citizen: {
    id: 'senior_citizen',
    intent: 'faq_senior_citizen',
    audience: 'all',
    label: 'Do senior citizens get higher rates?',
    answer:
      "Yes, most banks offer an additional 0.50% per annum for resident senior citizens " +
      "(age 60 and above). Some banks give 0.75% or 1.00% extra on tenures of 5 years or more. " +
      "TDS threshold is also higher at Rs 50,000 (vs Rs 40,000 for non-seniors). " +
      "Our rate cards show both general and senior rates side by side so you can pick " +
      "the best option.",
    followUps: ['faq_fd_details', 'faq_taxation'],
  },
  min_amount: {
    id: 'min_amount',
    intent: 'faq_min_amount',
    audience: 'all',
    label: 'What is the minimum FD amount?',
    answer:
      "On this platform, minimum FD amounts are:\n\n" +
      "• Small Finance Banks (Maro, Sunset, Nomnom): Rs 5,000\n" +
      "• Commercial Banks (Ion): Rs 10,000\n" +
      "• NBFC (Mute Finance): Rs 10,000\n\n" +
      "Maximum amounts go up to Rs 1 crore for banks and Rs 50 lakh for the NBFC. " +
      "Each rate card shows the exact min/max for that bank.",
    followUps: ['faq_fd_details', 'check_my_fds'],
  },
  premature_withdrawal: {
    id: 'premature_withdrawal',
    intent: 'faq_premature_withdrawal',
    audience: 'all',
    label: 'What if I withdraw my FD before maturity?',
    answer:
      "Premature withdrawal is allowed at most banks, but the rate is reduced. " +
      "Typically the bank pays 0.5%-1.0% LESS than the contracted rate for the " +
      "actual tenure you held the FD. Some specifics:\n\n" +
      "  - SFBs (Maro, Sunset, Nomnom): usually 0.5% penalty\n" +
      "  - Commercial banks (Ion): usually 1.0% penalty\n" +
      "  - NBFCs (Mute Finance): often no penalty (check the loan agreement)\n\n" +
      "You receive the original principal back; only the interest is reduced. " +
      "TDS already deducted is not adjusted against your final payout.",
    followUps: ['faq_dicgc', 'faq_taxation', 'check_my_fds'],
  },
  fd_comparison: {
    id: 'fd_comparison',
    intent: 'faq_fd_comparison',
    audience: 'all',
    label: 'How do I compare FDs across banks?',
    answer:
      "Comparing FDs is more than just the headline rate. Here's what to look at:\n\n" +
      "1. Effective rate (after quarterly compounding)\n" +
      "2. Senior citizen rate (if applicable)\n" +
      "3. Min/max amount you can invest\n" +
      "4. Lock-in period and premature withdrawal penalty\n" +
      "5. DICGC insurance status (yes for SFBs and commercial banks, no for NBFCs)\n\n" +
      "Our Discover page shows all of these side by side. You can also ask me " +
      "'Compare 1-year FDs' and I'll show you a table.",
    followUps: ['my_active_fds', 'check_my_fds'],
  },
  how_to_book: {
    id: 'how_to_book',
    intent: 'faq_how_to_book',
    audience: 'all',
    label: 'How do I book an FD?',
    answer:
      "Booking an FD on this platform takes 4 steps:\n\n" +
      "1. Sign in with your mobile number + OTP (universal demo OTP is 123456)\n" +
      "2. Browse rates on the Discover page and pick a bank + tenure + amount\n" +
      "3. Walk through KYC (PAN + Aadhaar + VKYC are mocked for the demo)\n" +
      "4. Confirm booking and view it in your Portfolio\n\n" +
      "The whole flow takes about 2 minutes. You can also type a question here " +
      "and I'll guide you through it.",
    followUps: ['faq_what_is_kyc', 'faq_why_vkyc', 'my_active_fds'],
  },
  what_is_kyc: {
    id: 'what_is_kyc',
    intent: 'faq_what_is_kyc',
    audience: 'all',
    label: 'What is KYC?',
    answer:
      "KYC stands for Know Your Customer. Banks need to verify your identity before " +
      "opening any account, per RBI rules. The four RBI-permitted KYC methods are:\n\n" +
      "1. Aadhaar eKYC — fastest, OTP-based, instant\n" +
      "2. Video KYC (VKYC) — live video call with a bank rep, for new-to-bank customers\n" +
      "3. CKYC lookup — reuses KYC from any other financial institution\n" +
      "4. DigiLocker — fetches PAN/Aadhaar digitally from the government wallet\n\n" +
      "On this demo platform, all KYC steps are auto-approved so you can see the full flow.",
    followUps: ['faq_why_vkyc', 'faq_aadhaar_ekyc', 'how_to_book'],
  },
  aadhaar_ekyc: {
    id: 'aadhaar_ekyc',
    intent: 'faq_aadhaar_ekyc',
    audience: 'all',
    label: 'What is Aadhaar eKYC?',
    answer:
      "Aadhaar eKYC is the fastest KYC method permitted by RBI. The flow is:\n\n" +
      "1. You give the bank consent to fetch your Aadhaar data\n" +
      "2. You enter your 12-digit Aadhaar number\n" +
      "3. UIDAI sends a one-time passcode to your Aadhaar-linked mobile\n" +
      "4. You enter the OTP; UIDAI returns your name, address, DOB, photo\n" +
      "5. The bank matches it against your PAN and opens the account\n\n" +
      "Pros:\n" +
      "  - 100% paperless, no branch visit\n" +
      "  - Account opened in under 5 minutes\n" +
      "  - Free of cost\n\n" +
      "Cons:\n" +
      "  - Only works if your mobile is linked to Aadhaar\n" +
      "  - Cap of Rs 50,000 per FD for non-video KYC by some banks\n" +
      "  - Doesn't work if Aadhaar is locked or biometrics are disabled\n\n" +
      "For deposits above the threshold, banks will fall back to VKYC or in-person KYC.",
    followUps: ['faq_why_vkyc', 'faq_what_is_kyc', 'how_to_book'],
  },
  why_vkyc: {
    id: 'why_vkyc',
    intent: 'faq_why_vkyc',
    audience: 'all',
    label: 'Why is VKYC required?',
    answer:
      "VKYC (Video KYC) is needed when you are a new customer of a bank (new-to-bank) AND " +
      "your deposit is above the bank's threshold. Each bank sets its own threshold — " +
      "for example, Unity SFB requires VKYC for every FD, while IndusInd requires it only " +
      "above Rs 90,000. NBFCs (like Mute Finance) don't require VKYC at all.\n\n" +
      "During VKYC, a bank rep verifies your face against your Aadhaar/PAN, checks your " +
      "original documents, and runs a liveness check. The whole call is recorded for audit.",
    followUps: ['faq_what_is_kyc', 'faq_aadhaar_ekyc', 'check_my_fds'],
  },
  rd_definition: {
    id: 'rd_definition',
    intent: 'faq_rd_definition',
    audience: 'all',
    label: 'What is a Recurring Deposit?',
    answer:
      "A Recurring Deposit (RD) is like an FD but you deposit a fixed amount every month " +
      "instead of a lump sum upfront. Useful for building a corpus through disciplined " +
      "monthly savings. On maturity, you get back all your monthly deposits plus accumulated " +
      "interest. RDs are great for goals like 'save Rs 5 lakh in 3 years'.\n\n" +
      "Note: this demo platform currently supports FD only. RD is on the roadmap.",
    followUps: ['faq_fd_definition', 'faq_compounding'],
  },
};

/**
 * Personalized / synthetic intents that are NOT FAQ entries. Their
 * labels live here so the menu builder and the follow-up chip
 * resolver stay in sync.
 */
const PERSONAL_INTENTS = {
  check_my_fds:       'Check my FDs',
  my_active_fds:      'Show my active FDs',
  my_total_value:     "What's my total FD value?",
  my_maturity:        'When do my FDs mature?',
  my_biggest_fd:      'Show my biggest FD',
  verify_start:       'Verify identity',
  talk_to_assistant:  'Talk to assistant',
};

/**
 * Look up a FAQ by intent id.
 */
function getFaq(intent) {
  return FAQ[intent] || null;
}

/**
 * Phrase-level triggers for FAQ forwarding. When the user types a
 * free-form question in 'Talk to assistant' mode, the /api/bot/llm
 * route calls matchFaq(userText) BEFORE spending an LLM call: if
 * the user's text strongly matches one of these triggers, the
 * FAQ's hardcoded answer is returned directly (zero LLM cost, zero
 * latency). The widget shows a small 'forwarded from FAQ' badge.
 *
 * The matching is intentionally simple: lowercased substring check
 * with a length-weighted score. This is a hand-curated list (14
 * entries) so we don't need an embedding model for this.
 */
const FAQ_TRIGGERS = {
  fd_definition: [
    'what is a fixed deposit', 'what is an fd', 'what are fds',
    'fixed deposit meaning', 'fd meaning', 'define fd',
    'what does fd mean', 'tell me about fd',
    'about fd', 'about fixed deposit', 'know about fd',
    'learn about fd', 'fd info', 'fd basics', 'fd introduction',
  ],
  fd_details: [
    'fd details', 'fd types', 'types of fd', 'fd tenure',
    'fd options', 'fd amount', 'tenure options',
  ],
  dicgc: [
    'dicgc', 'dicgc insurance', 'deposit insurance', 'is fd safe',
    'fd insurance', 'insured deposit',
    // common typos
    'digc', 'dicsgc', 'digi c', 'deposit insur',
  ],
  premature_withdrawal: [
    'premature withdrawal', 'early withdrawal', 'withdraw fd',
    'break fd', 'fd before maturity', 'premature',
  ],
  // Personal data: when the user's text mentions 'my fd' or
  // 'my fixed deposit' or 'my deposits', forward to the verify
  // flow (which prompts for phone + DOB + PAN). The matchFaq
  // function returns a special {kind:'flow', text, followUps}
  // object for these instead of a FAQ entry.
  check_my_fds: [
    'my fd', 'my fixed deposit', 'my fds', 'my fixed deposits',
    'my deposit', 'my deposits', 'my booking', 'my bookings',
    'show my fd', 'list my fd', 'see my fd', 'view my fd',
  ],
  cumulative_vs_non_cumulative: [
    'cumulative vs non', 'cumulative', 'non-cumulative', 'non cumulative',
    'payout option', 'payout vs cumulative', 'fd payout',
  ],
  compounding: [
    'compounding', 'compound interest', 'how does compounding work',
    'quarterly compounding', 'compounding frequency',
  ],
  taxation: [
    'tax', 'tds', 'taxation', 'fd tax', 'interest tax',
    'is fd interest taxable', 'tax on fd',
  ],
  senior_citizen: [
    'senior citizen', 'senior citizens', 'senior', '60+', 'elderly',
    'old age', 'retiree',
  ],
  min_amount: [
    'minimum amount', 'minimum fd', 'min fd', 'smallest fd',
    'lowest fd', 'how much can i invest', 'how much to invest',
  ],
  fd_comparison: [
    'compare', 'comparison', 'best rate', 'highest rate',
    'which bank', 'best fd', 'which is best',
  ],
  how_to_book: [
    'book fd', 'booking fd', 'how to book', 'how do i book',
    'open fd', 'start fd', 'apply for fd', 'fd process',
    'how to invest in fd', 'want to book',
  ],
  what_is_kyc: [
    'kyc', 'know your customer', 'what is kyc', 'kyc process',
    'kyc meaning', 'why kyc',
  ],
  aadhaar_ekyc: [
    'aadhaar', 'aadhar', 'ekyc', 'aadhaar ekyc', 'otp kyc',
    'aadhaar kyc',
  ],
  why_vkyc: [
    'vkyc', 'video kyc', 'why vkyc', 'video verification',
    'video call kyc',
  ],
  rd_definition: [
    'recurring deposit', 'rd', 'what is rd', 'monthly deposit',
  ],
};

/**
 * Find the FAQ that best matches the user's free-form text.
 * Returns { faq, score } or { faq: null, score: bestScore }.
 *
 * Scoring: for each FAQ key, sum the lengths of the user's
 * triggers that appear in the lowercased text. The FAQ with the
 * highest score wins. We require a minimum total score (DEFAULT
 * FAQ_MATCH_THRESHOLD chars) to avoid false positives on short
 * generic text. The FAQ label itself is also added to the trigger
 * set with a +50% weight, so direct matches like "What is DICGC?"
 * always win regardless of the threshold.
 */
const FAQ_MATCH_THRESHOLD = 4;

function matchFaq(userText) {
  if (!userText || typeof userText !== 'string') return { faq: null, score: 0 };
  const t = userText.toLowerCase();

  // First: personal data — 'my fd' / 'my deposits' should route
  // to the verify flow. Return a special 'flow' object that
  // routes/bot.js will forward to the check_my_fds handler.
  const personalTriggers = FAQ_TRIGGERS.check_my_fds || [];
  let personalScore = 0;
  for (const trig of personalTriggers) {
    if (t.includes(trig)) personalScore += trig.length;
  }
  if (personalScore >= 4) {
    return {
      faq: null,
      flow: {
        id: 'check_my_fds',
        label: 'Check my FDs',
        text:
          "To check your FDs anonymously, I need to verify you with three details. " +
          "Please enter them in this exact format:\n\n" +
          "1. Mobile number: 10 digits, no spaces (e.g. 9714503400)\n" +
          "2. Date of birth: YYYY-MM-DD (e.g. 1990-01-15)\n" +
          "3. PAN: AAAAA9999A (e.g. ABCDE1234F)",
        followUps: ['verify_start'],
      },
      score: personalScore,
    };
  }

  // Second: FAQ keyword triggers (curated FAQ answers).
  let best = null;
  let bestScore = 0;
  for (const key of Object.keys(FAQ_TRIGGERS)) {
    if (key === 'check_my_fds') continue; // handled above
    let score = 0;
    const faq = FAQ[key];
    if (faq && faq.label) {
      const label = faq.label.toLowerCase();
      if (t.includes(label)) score += Math.floor(label.length * 1.5);
    }
    for (const trig of FAQ_TRIGGERS[key]) {
      if (t.includes(trig)) score += trig.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = faq || null;
    }
  }
  if (!best || bestScore < FAQ_MATCH_THRESHOLD) return { faq: null, score: bestScore };
  return { faq: best, score: bestScore };
}

/**
 * Build the menu of clickable chips for a given role.
 *
 * For BOTH audiences, the menu includes:
 *   - all hardcoded FAQ chips (so a logged-in user can still ask
 *     'What is DICGC?' without losing access)
 *   - the 'Talk to assistant' chip (LLM mode)
 *
 * For 'all' (anon) only:
 *   - the 'Check my FDs' verify trigger
 *
 * For 'auth' (logged in) only:
 *   - the four personalized 'my FDs' actions, listed first so
 *     they are visible at the top of the panel
 */
function getMenu(audience) {
  const items = [];
  if (audience === 'auth') {
    for (const intent of ['my_active_fds', 'my_total_value', 'my_maturity', 'my_biggest_fd']) {
      items.push({ intent, label: PERSONAL_INTENTS[intent] });
    }
  }
  for (const key of Object.keys(FAQ)) {
    items.push({ intent: FAQ[key].intent, label: FAQ[key].label });
  }
  items.push({ intent: 'talk_to_assistant', label: PERSONAL_INTENTS.talk_to_assistant });
  if (audience === 'all') {
    items.push({ intent: 'check_my_fds', label: 'Check my FDs (verify identity)' });
  }
  return items;
}

module.exports = { FAQ, getFaq, getMenu, PERSONAL_INTENTS, FAQ_TRIGGERS, matchFaq };
