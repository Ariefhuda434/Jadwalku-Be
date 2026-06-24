const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const { sanitize } = require('../sanitize');
const { sendMessage, getStatus } = require('../whatsappService');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password } = sanitize(req.body, ['username', 'email']);

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Semua field harus diisi.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ message: 'Email sudah terdaftar.' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(username, email, password_hash);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    message: 'Registrasi berhasil.',
    token,
    user: { id: result.lastInsertRowid, username, email }
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password harus diisi.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login berhasil.',
    token,
    user: { id: user.id, username: user.username, email: user.email }
  });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email wajib diisi.' });
  }

  const user = db.prepare('SELECT id, phone FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) {
    return res.status(404).json({ message: 'Email tidak ditemukan.' });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const hash = bcrypt.hashSync(code, 10);

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(hash, expires, user.id);

  if (user.phone && getStatus().status === 'connected') {
    sendMessage(user.phone, `Kode reset password JadwalKu Anda: ${code}\n\nKode berlaku 15 menit.`).catch(() => {});
  }

  console.log(`[RESET] Kode untuk ${email}: ${code}`);

  res.json({ message: 'Kode reset telah dikirim ke WhatsApp Anda (jika nomor terdaftar).' });
});

router.post('/reset-password', (req, res) => {
  const { email, code, new_password } = req.body;

  if (!email || !code || !new_password) {
    return res.status(400).json({ message: 'Email, kode, dan password baru wajib diisi.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
  }

  const user = db.prepare('SELECT id, reset_token, reset_token_expires FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) {
    return res.status(404).json({ message: 'Email tidak ditemukan.' });
  }

  if (!user.reset_token || !user.reset_token_expires) {
    return res.status(400).json({ message: 'Belum ada permintaan reset password.' });
  }

  if (new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ message: 'Kode reset sudah kedaluwarsa.' });
  }

  const valid = bcrypt.compareSync(code, user.reset_token);
  if (!valid) {
    return res.status(400).json({ message: 'Kode reset salah.' });
  }

  const password_hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(password_hash, user.id);

  res.json({ message: 'Password berhasil direset. Silakan login.' });
});

module.exports = router;
