require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { query } = require('./src/config/db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;

app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', async (req, res) => {
  try {
    const r = await query('SELECT 1 AS ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Mounted later
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/rates', require('./src/routes/rates'));
app.use('/api/banks', require('./src/routes/banks'));
app.use('/api/journey', require('./src/routes/journey'));
app.use('/api/kyc', require('./src/routes/kyc'));
app.use('/api/bot', require('./src/routes/bot'));

// Static frontend (served from /)
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Fallback to index.html for SPA-ish navigation
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FD demo backend listening on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});
