const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const { tenure, amount, type } = req.query;
    
    let sql = `SELECT * FROM master WHERE is_active = TRUE`;
    const params = [];
    
    if (tenure) {
      params.push(parseInt(tenure, 10));
      sql += ` AND tenure_months = $${params.length}`;
    }
    
    if (amount) {
      params.push(parseFloat(amount));
      sql += ` AND max_amount >= $${params.length} AND min_fd_amount <= $${params.length}`;
    }
    
    sql += ` ORDER BY tenure_months, interest_rate_bps DESC`;
    
    const result = await query(sql, params);
    res.json({ rates: result.rows });
  } catch (error) {
    console.error('Rates fetch error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

module.exports = router;
