const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const { generateNotifications } = require('../notificationService');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const { page: pageStr, limit: limitStr } = req.query;
  const usePagination = pageStr !== undefined;

  generateNotifications();

  if (usePagination) {
    const page = Math.max(1, parseInt(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 20));
    const total = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?'
    ).get(req.user.id).count;
    const totalPages = Math.ceil(total / limit);
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(req.user.id, limit, (page - 1) * limit);
    return res.json({ data: notifications, pagination: { page, limit, total, totalPages } });
  }

  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);

  res.json(notifications);
});

router.get('/unread-count', (req, res) => {
  const { count } = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id);

  res.json({ count });
});

router.put('/read-all', (req, res) => {
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).run(req.user.id);

  res.json({ message: 'Semua notifikasi telah ditandai dibaca.' });
});

router.put('/:id/read', (req, res) => {
  const existing = db.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!existing) {
    return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
  }

  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user.id);

  res.json({ message: 'Notifikasi telah ditandai dibaca.' });
});

module.exports = router;
