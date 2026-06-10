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
    followUps: ['faq_fd_definition', 'faq_premature_withdrawal'],
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
    followUps: ['faq_senior_citizen', 'faq_premature_withdrawal'],
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
  check_my_fds:   'Check my FDs',
  my_active_fds:  'Show my active FDs',
  my_total_value: "What's my total FD value?",
  my_maturity:    'When do my FDs mature?',
  my_biggest_fd:  'Show my biggest FD',
  verify_start:   'Verify identity',
};

/**
 * Look up a FAQ by intent id.
 */
function getFaq(intent) {
  return FAQ[intent] || null;
}

/**
 * Build the menu of clickable chips for a given role.
 *
 *   audience = 'all'  -> every FAQ chip + 'Check my FDs' trigger
 *                          (anon: triggers the verify flow)
 *   audience = 'auth' -> 'How do I book an FD?' chip + the four
 *                          personalized 'my FDs' actions
 */
function getMenu(audience) {
  const items = [];
  if (audience === 'all') {
    for (const key of Object.keys(FAQ)) {
      items.push({ intent: FAQ[key].intent, label: FAQ[key].label });
    }
    items.push({ intent: 'check_my_fds', label: 'Check my FDs (verify identity)' });
  } else {
    // authed: keep the booking FAQ + the personalized actions
    items.push({ intent: FAQ.how_to_book.intent, label: FAQ.how_to_book.label });
    for (const intent of ['my_active_fds', 'my_total_value', 'my_maturity', 'my_biggest_fd']) {
      items.push({ intent, label: PERSONAL_INTENTS[intent] });
    }
  }
  return items;
}

module.exports = { FAQ, getFaq, getMenu, PERSONAL_INTENTS };
