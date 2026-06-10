const express = require('express');
const router = express.Router();

router.get('/portfolio', (req, res) => res.json({ message: 'not implemented' }));
router.post('/book', (req, res) => res.json({ message: 'not implemented' }));
router.get('/:id', (req, res) => res.json({ message: 'not implemented' }));

module.exports = router;
