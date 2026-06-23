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

  const personalJadwal = db.prepare(
    `SELECT *, 0 as is_group_schedule, NULL as group_name FROM jadwal WHERE user_id = ? AND (mata_kuliah LIKE ? OR dosen LIKE ? OR ruang LIKE ?)`
  ).all(req.user.id, keyword, keyword, keyword);

  const groupJadwal = db.prepare(`
    SELECT j.*, 1 as is_group_schedule, g.name as group_name
    FROM jadwal j
    JOIN groups_table g ON g.id = j.group_id
    WHERE j.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    AND (j.mata_kuliah LIKE ? OR j.dosen LIKE ? OR j.ruang LIKE ?)
  `).all(req.user.id, keyword, keyword, keyword);

  const jadwal = [...personalJadwal, ...groupJadwal].sort((a, b) => {
    const dayOrder = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 7 };
    return (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99) || a.jam_mulai.localeCompare(b.jam_mulai);
  });

  const tugas = db.prepare(
    `SELECT * FROM tugas WHERE user_id = ? AND (judul LIKE ? OR mata_kuliah LIKE ? OR deskripsi LIKE ?) ORDER BY deadline ASC`
  ).all(req.user.id, keyword, keyword, keyword);

  res.json({ jadwal, tugas });
});

module.exports = router;
