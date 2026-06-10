const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

// Calculate maturity based on simple interest for the prototype
function calculateMaturity(principal, rateBps, months) {
  const rate = rateBps / 10000;
  const years = months / 12;
  const amount = principal * (1 + rate * years);
  return amount.toFixed(2);
}

function generateId(prefix, length) {
  const digits = '0123456789';
  let id = prefix;
  for (let i = 0; i < length; i++) id += digits.charAt(Math.floor(Math.random() * digits.length));
  return id;
}

router.post('/book', authRequired, async (req, res) => {
  const { rateId, principal, customerType = 'general', nomineeName, nomineeRelationship } = req.body;
  const userId = req.auth.userId;

  if (!rateId || !principal || principal <= 0) {
    return res.status(400).json({ error: { message: 'Invalid rate or principal' } });
  }

  try {
    // 1. Fetch rate details
    const rateRes = await query('SELECT * FROM master WHERE rate_id = $1', [rateId]);
    const rate = rateRes.rows[0];
    if (!rate) {
      return res.status(404).json({ error: { message: 'Rate not found' } });
    }

    // 2. Validate limits
    if (principal < rate.min_fd_amount || principal > rate.max_amount) {
      return res.status(400).json({ error: { message: `Principal must be between ${rate.min_fd_amount} and ${rate.max_amount}` } });
    }

    const rateBps = customerType === 'senior_citizen' ? rate.senior_citizen_rate_bps : rate.interest_rate_bps;
    const maturityAmount = calculateMaturity(principal, rateBps, rate.tenure_months);
    
    const bookingId = generateId('bk_fd_', 5);
    const bankRefId = generateId('REF', 8);

    // 3. Insert journey row
    const insertSql = `
      INSERT INTO journey (
        booking_id, bank_reference_id, user_id, rate_id,
        tenure_months, tenure_days, interest_rate_bps, customer_type,
        compounding, payout_type, principal, maturity_amount,
        booking_date, maturity_date, state,
        nominee_name, nominee_relationship,
        pan_verified_at, aadhaar_ekyc_at, payment_initiated_at, payment_completed_at, fd_activated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        CURRENT_DATE, CURRENT_DATE + ($6::text || ' days')::INTERVAL, 'fd_active',
        $13, $14,
        NOW(), NOW(), NOW(), NOW(), NOW()
      ) RETURNING *
    `;

    const params = [
      bookingId, bankRefId, userId, rateId,
      rate.tenure_months, rate.tenure_days, rateBps, customerType,
      rate.compounding, rate.payout_type, principal, maturityAmount,
      nomineeName || null, nomineeRelationship || null
    ];

    const result = await query(insertSql, params);
    res.json({ success: true, booking: result.rows[0] });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.get('/portfolio', authRequired, async (req, res) => {
  try {
    const sql = `
      SELECT j.*, m.bank_name, m.bank_code 
      FROM journey j 
      JOIN master m ON j.rate_id = m.rate_id 
      WHERE j.user_id = $1
      ORDER BY j.created_at DESC
    `;
    const result = await query(sql, [req.auth.userId]);
    res.json({ bookings: result.rows });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const sql = `
      SELECT j.*, m.bank_name, m.bank_code 
      FROM journey j 
      JOIN master m ON j.rate_id = m.rate_id 
      WHERE j.user_id = $1 AND j.journey_id = $2
    `;
    const result = await query(sql, [req.auth.userId, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Booking not found' } });
    }
    res.json({ booking: result.rows[0] });
  } catch (error) {
    console.error('Booking fetch error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

module.exports = router;
