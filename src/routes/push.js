const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, p256dh, auth } = req.body;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ message: 'Data subscription tidak lengkap.' });
  }

  const existing = db.prepare(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).get(req.user.id, endpoint);

  if (existing) {
    db.prepare(
      'UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?'
    ).run(p256dh, auth, existing.id);
  } else {
    db.prepare(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, endpoint, p256dh, auth);
  }

  res.json({ message: 'Berlangganan push notifikasi berhasil.' });
});

router.delete('/subscribe', (req, res) => {
  const { endpoint } = req.body;

  if (endpoint) {
    db.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).run(req.user.id, endpoint);
  } else {
    db.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ?'
    ).run(req.user.id);
  }

  res.json({ message: 'Berhenti berlangganan push notifikasi berhasil.' });
});

module.exports = router;
