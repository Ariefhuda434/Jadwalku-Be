const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getStatus } = require('../whatsappService');

const router = express.Router();

router.use(verifyToken);

router.get('/status', (req, res) => {
  res.json(getStatus());
});

module.exports = router;
