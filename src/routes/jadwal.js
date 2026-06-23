const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const { search, hari, group_id } = req.query;

  if (group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(group_id, req.user.id);

    if (!member) {
      return res.status(403).json({ message: 'Anda bukan anggota grup ini.' });
    }

    let query = "SELECT j.*, g.name as group_name FROM jadwal j LEFT JOIN groups_table g ON g.id = j.group_id WHERE j.group_id = ?";
    const params = [group_id];

    if (search && search.trim()) {
      const keyword = `%${search.trim()}%`;
      query += " AND (j.mata_kuliah LIKE ? OR j.dosen LIKE ? OR j.ruang LIKE ?)";
      params.push(keyword, keyword, keyword);
    }

    if (hari) {
      query += " AND j.hari = ?";
      params.push(hari);
    }

    query += " ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_mulai";

    const jadwal = db.prepare(query).all(...params);
    return res.json(jadwal.map(j => ({ ...j, is_group_schedule: 1 })));
  }

  let personalQuery = "SELECT j.*, NULL as group_name, 0 as is_group_schedule FROM jadwal j WHERE j.user_id = ?";
  const personalParams = [req.user.id];

  let groupQuery = "SELECT j.*, g.name as group_name, 1 as is_group_schedule FROM jadwal j JOIN groups_table g ON g.id = j.group_id WHERE j.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)";
  const groupParams = [req.user.id];

  if (search && search.trim()) {
    const keyword = `%${search.trim()}%`;
    personalQuery += " AND (j.mata_kuliah LIKE ? OR j.dosen LIKE ? OR j.ruang LIKE ?)";
    personalParams.push(keyword, keyword, keyword);
    groupQuery += " AND (j.mata_kuliah LIKE ? OR j.dosen LIKE ? OR j.ruang LIKE ?)";
    groupParams.push(keyword, keyword, keyword);
  }

  if (hari) {
    personalQuery += " AND j.hari = ?";
    personalParams.push(hari);
    groupQuery += " AND j.hari = ?";
    groupParams.push(hari);
  }

  personalQuery += " ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_mulai";
  groupQuery += " ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_mulai";

  const personalJadwal = db.prepare(personalQuery).all(...personalParams);
  const groupJadwal = db.prepare(groupQuery).all(...groupParams);

  const merged = [...personalJadwal, ...groupJadwal].sort((a, b) => {
    const dayOrder = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 7 };
    const dayDiff = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99);
    if (dayDiff !== 0) return dayDiff;
    return a.jam_mulai.localeCompare(b.jam_mulai);
  });

  res.json(merged);
});

router.post('/', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id } = req.body;

  if (!hari || !mata_kuliah || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ message: 'Hari, mata_kuliah, jam_mulai, dan jam_selesai wajib diisi.' });
  }

  if (group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa menambah jadwal grup.' });
    }
  }

  const result = db.prepare(
    'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang || '', dosen || '', group_id || null);

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(jadwal);
});

router.put('/:id', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen } = req.body;

  const existing = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  if (existing.group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(existing.group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa mengedit jadwal grup.' });
    }
  } else if (existing.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  db.prepare(
    'UPDATE jadwal SET hari = ?, mata_kuliah = ?, jam_mulai = ?, jam_selesai = ?, ruang = ?, dosen = ? WHERE id = ?'
  ).run(
    hari || existing.hari,
    mata_kuliah || existing.mata_kuliah,
    jam_mulai || existing.jam_mulai,
    jam_selesai || existing.jam_selesai,
    ruang !== undefined ? ruang : existing.ruang,
    dosen !== undefined ? dosen : existing.dosen,
    req.params.id
  );

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(req.params.id);
  res.json(jadwal);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  if (existing.group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(existing.group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa menghapus jadwal grup.' });
    }
  } else if (existing.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  }

  db.prepare('DELETE FROM jadwal WHERE id = ?').run(req.params.id);
  res.json({ message: 'Jadwal berhasil dihapus.' });
});

module.exports = router;
