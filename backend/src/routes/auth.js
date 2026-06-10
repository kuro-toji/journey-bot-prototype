const express = require('express');
const router = express.Router();

router.post('/send-otp', (req, res) => res.json({ message: 'not implemented' }));
router.post('/verify-otp', (req, res) => res.json({ message: 'not implemented' }));
router.get('/me', (req, res) => res.json({ message: 'not implemented' }));

module.exports = router;
