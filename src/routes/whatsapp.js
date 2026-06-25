const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getStatus, disconnect } = require('../whatsappService');

const router = express.Router();

router.use(verifyToken);

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.post('/disconnect', async (req, res) => {
  try {
    await disconnect();
    res.json({ message: 'WhatsApp disconnected.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
