const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ message: 'Parameter q (keyword) wajib diisi.' });
  }

  const keyword = `%${q.trim()}%`;

  const jadwal = db.prepare(
    `SELECT * FROM jadwal WHERE user_id = ? AND (mata_kuliah LIKE ? OR dosen LIKE ? OR ruang LIKE ?) ORDER BY
      CASE hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4
      WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, jam_mulai`
  ).all(req.user.id, keyword, keyword, keyword);

  const tugas = db.prepare(
    `SELECT * FROM tugas WHERE user_id = ? AND (judul LIKE ? OR mata_kuliah LIKE ? OR deskripsi LIKE ?) ORDER BY deadline ASC`
  ).all(req.user.id, keyword, keyword, keyword);

  res.json({ jadwal, tugas });
});

module.exports = router;
