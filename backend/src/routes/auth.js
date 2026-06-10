const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { sign } = require('../utils/jwt');
const fs = require('fs');
const path = require('path');

const UNIVERSAL_OTP = process.env.UNIVERSAL_OTP || '123456';
const PHONES_FILE = path.join(__dirname, '../../data/phones.json');

// Ensure phones.json exists
if (!fs.existsSync(PHONES_FILE)) {
  if (!fs.existsSync(path.dirname(PHONES_FILE))) {
    fs.mkdirSync(path.dirname(PHONES_FILE), { recursive: true });
  }
  fs.writeFileSync(PHONES_FILE, JSON.stringify([]));
}

function appendPhone(phone) {
  try {
    const data = JSON.parse(fs.readFileSync(PHONES_FILE, 'utf8'));
    if (!data.includes(phone)) {
      data.push(phone);
      fs.writeFileSync(PHONES_FILE, JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Error updating phones.json', e);
  }
}

function generateRandomPan() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let pan = '';
  for (let i = 0; i < 5; i++) pan += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 4; i++) pan += digits.charAt(Math.floor(Math.random() * digits.length));
  pan += letters.charAt(Math.floor(Math.random() * letters.length));
  return pan;
}

router.post('/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
    return res.status(400).json({ error: { message: 'Invalid phone number' } });
  }
  res.json({ success: true, otp: UNIVERSAL_OTP });
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
    return res.status(400).json({ error: { message: 'Invalid phone number' } });
  }
  if (otp !== UNIVERSAL_OTP) {
    return res.status(401).json({ error: { message: 'Invalid OTP' } });
  }

  try {
    let userRes = await query('SELECT * FROM "user" WHERE mobile_number = $1', [phone]);
    let user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: { message: 'Demo access restricted to seeded users only. See seeded_phones.txt' } });
    }

    appendPhone(phone);

    const token = sign({ userId: user.user_id, phone: user.mobile_number });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

const { authRequired } = require('../middleware/auth');

router.get('/me', authRequired, async (req, res) => {
  try {
    const userRes = await query('SELECT * FROM "user" WHERE user_id = $1', [req.auth.userId]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

module.exports = router;
