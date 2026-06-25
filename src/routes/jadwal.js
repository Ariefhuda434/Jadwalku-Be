const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const { sanitize } = require('../sanitize');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const { search, hari, group_id, page: pageStr, limit: limitStr } = req.query;
  const usePagination = pageStr !== undefined;
  const page = Math.max(1, parseInt(pageStr) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 50));

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

  if (usePagination) {
    const total = merged.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = merged.slice((page - 1) * limit, page * limit);
    return res.json({ data: paginated, pagination: { page, limit, total, totalPages } });
  }

  res.json(merged);
});

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function checkConflict({ hari, jam_mulai, jam_selesai, userId, groupId, excludeId }) {
  let query, params;
  if (groupId) {
    query = `SELECT * FROM jadwal WHERE group_id = ? AND hari = ? AND id != ?`;
    params = [groupId, hari, excludeId || -1];
  } else {
    query = `SELECT * FROM jadwal WHERE user_id = ? AND group_id IS NULL AND hari = ? AND id != ?`;
    params = [userId, hari, excludeId || -1];
  }

  const schedules = db.prepare(query).all(...params);
  const newStart = toMinutes(jam_mulai);
  const newEnd = toMinutes(jam_selesai);

  return schedules.filter((s) => {
    const sStart = toMinutes(s.jam_mulai);
    const sEnd = toMinutes(s.jam_selesai);
    return newStart < sEnd && sStart < newEnd;
  });
}

router.get('/check-conflict', (req, res) => {
  const { hari, jam_mulai, jam_selesai, group_id, exclude_id } = req.query;
  if (!hari || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ message: 'hari, jam_mulai, jam_selesai wajib diisi.' });
  }
  const conflicts = checkConflict({
    hari, jam_mulai, jam_selesai,
    userId: req.user.id,
    groupId: group_id || null,
    excludeId: exclude_id || null,
  });
  res.json({ conflicts });
});

const validTipe = ['kuliah', 'praktikum', 'seminar', 'responsi'];

router.post('/', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id, tipe } = sanitize(req.body, ['mata_kuliah', 'ruang', 'dosen']);

  if (!hari || !mata_kuliah || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ message: 'Hari, mata_kuliah, jam_mulai, dan jam_selesai wajib diisi.' });
  }

  if (toMinutes(jam_mulai) >= toMinutes(jam_selesai)) {
    return res.status(400).json({ message: 'Jam selesai harus setelah jam mulai.' });
  }

  if (group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa menambah jadwal grup.' });
    }
  }

  const conflicts = checkConflict({
    hari, jam_mulai, jam_selesai,
    userId: req.user.id,
    groupId: group_id || null,
    excludeId: null,
  });

  const tipeVal = validTipe.includes(tipe) ? tipe : 'kuliah';
  const result = db.prepare(
    'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id, tipe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang || '', dosen || '', group_id || null, tipeVal);

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ jadwal, conflicts });
});

router.put('/:id', (req, res) => {
  const { hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, tipe } = sanitize(req.body, ['mata_kuliah', 'ruang', 'dosen']);

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

  const newHari = hari || existing.hari;
  const newJamMulai = jam_mulai || existing.jam_mulai;
  const newJamSelesai = jam_selesai || existing.jam_selesai;

  if (toMinutes(newJamMulai) >= toMinutes(newJamSelesai)) {
    return res.status(400).json({ message: 'Jam selesai harus setelah jam mulai.' });
  }

  const conflicts = checkConflict({
    hari: newHari, jam_mulai: newJamMulai, jam_selesai: newJamSelesai,
    userId: req.user.id,
    groupId: existing.group_id || null,
    excludeId: existing.id,
  });

  const tipeVal = tipe !== undefined ? (validTipe.includes(tipe) ? tipe : existing.tipe) : existing.tipe;
  db.prepare(
    'UPDATE jadwal SET hari = ?, mata_kuliah = ?, jam_mulai = ?, jam_selesai = ?, ruang = ?, dosen = ?, tipe = ? WHERE id = ?'
  ).run(
    newHari,
    mata_kuliah || existing.mata_kuliah,
    newJamMulai,
    newJamSelesai,
    ruang !== undefined ? ruang : existing.ruang,
    dosen !== undefined ? dosen : existing.dosen,
    tipeVal,
    req.params.id
  );

  const jadwal = db.prepare('SELECT * FROM jadwal WHERE id = ?').get(req.params.id);
  res.json({ jadwal, conflicts });
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
