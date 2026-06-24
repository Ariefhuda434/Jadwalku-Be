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

  const personalTugas = db.prepare(
    `SELECT *, 0 as is_group_task, NULL as group_name, NULL as creator_name
     FROM tugas WHERE user_id = ? AND group_id IS NULL
     AND (judul LIKE ? OR mata_kuliah LIKE ? OR deskripsi LIKE ?) ORDER BY deadline ASC`
  ).all(req.user.id, keyword, keyword, keyword);

  const groupTugas = db.prepare(`
    SELECT t.*, 1 as is_group_task, g.name as group_name, u.username as creator_name
    FROM tugas t
    JOIN groups_table g ON g.id = t.group_id
    JOIN users u ON u.id = t.user_id
    JOIN group_members gm ON gm.group_id = t.group_id AND gm.user_id = ?
    WHERE t.group_id IS NOT NULL
    AND (t.judul LIKE ? OR t.mata_kuliah LIKE ? OR t.deskripsi LIKE ?)
    ORDER BY t.deadline ASC
  `).all(req.user.id, keyword, keyword, keyword);

  const tugas = [...personalTugas, ...groupTugas];

  res.json({ jadwal, tugas });
});

module.exports = router;
