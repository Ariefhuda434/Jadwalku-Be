const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const { sanitize } = require('../sanitize');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, phone, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json(user);
});

router.put('/', (req, res) => {
  const { username, email, phone } = sanitize(req.body, ['username', 'email', 'phone']);

  if (username !== undefined) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  if (email !== undefined) {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(email, req.user.id);
    if (existing) return res.status(409).json({ message: 'Email sudah digunakan.' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.user.id);
  }
  if (phone !== undefined) {
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
  }

  const user = db.prepare(
    'SELECT id, username, email, phone, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json(user);
});

router.put('/password', (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Password lama dan baru wajib diisi.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);

  if (!valid) {
    return res.status(401).json({ message: 'Password lama salah.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

  res.json({ message: 'Password berhasil diubah.' });
});

module.exports = router;
