const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

const BANK_BLURBS = {
  MARO: 'A leading Small Finance Bank offering competitive deposit rates with a focus on customer-first banking.',
  SUNE: 'A New-Age Digital First Bank providing seamless, technology-driven savings experiences to retail customers.',
  NOMN: 'A scheduled Small Finance Bank serving the underserved with a strong microfinance and banking portfolio.',
  IONB: 'A new-generation private sector bank offering comprehensive retail and digital banking services.',
  MUTE: 'A leading financial services NBFC offering fixed deposit products with attractive interest rates.'
};

const BANK_TYPE_LABEL = {
  sfb: 'Small Finance Bank',
  commercial: 'Commercial Bank',
  nbfc: 'NBFC'
};

// One row per bank, aggregating min/max rate across the 3 tenures
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bank_code,
        bank_name,
        bank_type,
        dicgc_insured,
        vkyc_threshold,
        min_fd_amount,
        MIN(interest_rate_bps)         AS min_rate_bps,
        MAX(interest_rate_bps)         AS max_rate_bps,
        MIN(senior_citizen_rate_bps)   AS min_senior_bps,
        MAX(senior_citizen_rate_bps)   AS max_senior_bps,
        COUNT(*)::int                   AS tenures_count
      FROM master
      WHERE is_active = TRUE
      GROUP BY bank_code, bank_name, bank_type, dicgc_insured, vkyc_threshold, min_fd_amount
      ORDER BY max_rate_bps DESC
    `);

    const banks = result.rows.map(b => ({
      bank_code: b.bank_code,
      bank_name: b.bank_name,
      bank_type: b.bank_type,
      type_label: BANK_TYPE_LABEL[b.bank_type] || 'Bank',
      dicgc_insured: b.dicgc_insured,
      vkyc_threshold: b.vkyc_threshold,
      min_fd_amount: b.min_fd_amount,
      min_rate_pct: (b.min_rate_bps / 100).toFixed(2),
      max_rate_pct: (b.max_rate_bps / 100).toFixed(2),
      min_senior_pct: (b.min_senior_bps / 100).toFixed(2),
      max_senior_pct: (b.max_senior_bps / 100).toFixed(2),
      tenures_count: b.tenures_count,
      blurb: BANK_BLURBS[b.bank_code] || ''
    }));

    res.json({ banks });
  } catch (error) {
    console.error('Banks fetch error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

module.exports = router;
