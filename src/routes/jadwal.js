const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const jadwal = db.prepare(
    "SELECT * FROM jadwal WHERE user_id = ? ORDER BY CASE hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, jam_mulai"
  ).all(req.user.id);

  res.json(jadwal);
});

router.post('/', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen } = req.body;

  if (!hari || !mata_kuliah || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ message: 'Hari, mata_kuliah, jam_mulai, dan jam_selesai wajib diisi.' });
  }

  const result = db.prepare(
    'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang || '', dosen || '');

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(jadwal);
});

router.put('/:id', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen } = req.body;

  const existing = db.prepare('SELECT * FROM jadwal WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  db.prepare(
    'UPDATE jadwal SET hari = ?, mata_kuliah = ?, jam_mulai = ?, jam_selesai = ?, ruang = ?, dosen = ? WHERE id = ? AND user_id = ?'
  ).run(
    hari || existing.hari,
    mata_kuliah || existing.mata_kuliah,
    jam_mulai || existing.jam_mulai,
    jam_selesai || existing.jam_selesai,
    ruang !== undefined ? ruang : existing.ruang,
    dosen !== undefined ? dosen : existing.dosen,
    req.params.id,
    req.user.id
  );

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(req.params.id);
  res.json(jadwal);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM jadwal WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  db.prepare('DELETE FROM jadwal WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Jadwal berhasil dihapus.' });
});

module.exports = router;
