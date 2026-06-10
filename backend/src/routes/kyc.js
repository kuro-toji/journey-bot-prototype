const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');

// Mock PAN Verification
router.post('/verify-pan', authRequired, (req, res) => {
  const { pan, dob } = req.body;
  if (!pan || !dob) {
    return res.status(400).json({ error: { message: 'PAN and DOB are required' } });
  }
  // Mock immediate approval
  res.json({ 
    verified: true, 
    name_on_pan: 'Mock User', 
    is_senior: false 
  });
});

// Mock Aadhaar Initiate
router.post('/aadhaar/initiate', authRequired, (req, res) => {
  const { aadhaar } = req.body;
  if (!aadhaar) {
    return res.status(400).json({ error: { message: 'Aadhaar is required' } });
  }
  res.json({ 
    success: true, 
    request_id: 'mock_req_123',
    otp: '123456' // Showing OTP for demo purposes
  });
});

// Mock Aadhaar Verify
router.post('/aadhaar/verify', authRequired, (req, res) => {
  const { request_id, otp } = req.body;
  if (otp !== '123456') {
    return res.status(400).json({ error: { message: 'Invalid OTP' } });
  }
  res.json({ verified: true });
});

// Mock VKYC Complete
router.post('/vkyc/complete', authRequired, (req, res) => {
  // Simulates an auto-approved video KYC session
  res.json({ approved: true, completed_at: new Date().toISOString() });
});

module.exports = router;
