const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const semesters = db.prepare(
    'SELECT * FROM semesters WHERE user_id = ? ORDER BY start_date DESC'
  ).all(req.user.id);
  res.json(semesters);
});

router.post('/', (req, res) => {
  const { name, start_date, end_date, copy_from_id } = req.body;

  if (!name || !name.trim() || !start_date || !end_date) {
    return res.status(400).json({ message: 'Nama, tanggal mulai, dan tanggal selesai wajib diisi.' });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ message: 'Tanggal selesai harus setelah tanggal mulai.' });
  }

  db.prepare('UPDATE semesters SET is_active = 0 WHERE user_id = ?').run(req.user.id);

  const result = db.prepare(
    'INSERT INTO semesters (user_id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 1)'
  ).run(req.user.id, name.trim(), start_date, end_date);

  const newSemesterId = result.lastInsertRowid;

  if (copy_from_id) {
    const source = db.prepare(
      'SELECT id FROM semesters WHERE id = ? AND user_id = ?'
    ).get(copy_from_id, req.user.id);

    if (source) {
      const jadwalToCopy = db.prepare(
        'SELECT hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, tipe FROM jadwal WHERE user_id = ? AND semester_id = ? AND group_id IS NULL'
      ).all(req.user.id, copy_from_id);

      const insertJadwal = db.prepare(
        'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, tipe, semester_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const j of jadwalToCopy) {
        insertJadwal.run(req.user.id, j.hari, j.mata_kuliah, j.jam_mulai, j.jam_selesai, j.ruang, j.dosen, j.tipe, newSemesterId);
      }

      const tugasToCopy = db.prepare(
        'SELECT mata_kuliah, judul, deskripsi, prioritas FROM tugas WHERE user_id = ? AND semester_id = ? AND group_id IS NULL'
      ).all(req.user.id, copy_from_id);

      const insertTugas = db.prepare(
        'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas, semester_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const t of tugasToCopy) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 14);
        insertTugas.run(req.user.id, t.mata_kuliah, t.judul, t.deskripsi, deadline.toISOString().split('T')[0], t.prioritas, newSemesterId);
      }
    }
  }

  const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(newSemesterId);
  res.status(201).json(semester);
});

router.put('/:id', (req, res) => {
  const { name, start_date, end_date, is_active } = req.body;

  const semester = db.prepare(
    'SELECT * FROM semesters WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!semester) {
    return res.status(404).json({ message: 'Semester tidak ditemukan.' });
  }

  if (is_active) {
    db.prepare('UPDATE semesters SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  }

  db.prepare(
    'UPDATE semesters SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?'
  ).run(
    name || semester.name,
    start_date || semester.start_date,
    end_date || semester.end_date,
    is_active !== undefined ? (is_active ? 1 : 0) : semester.is_active,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const semester = db.prepare(
    'SELECT * FROM semesters WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!semester) {
    return res.status(404).json({ message: 'Semester tidak ditemukan.' });
  }

  db.prepare('UPDATE jadwal SET semester_id = NULL WHERE semester_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  db.prepare('UPDATE tugas SET semester_id = NULL WHERE semester_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  db.prepare('DELETE FROM semesters WHERE id = ?').run(req.params.id);
  res.json({ message: 'Semester berhasil dihapus.' });
});

router.get('/active', (req, res) => {
  const active = db.prepare(
    'SELECT * FROM semesters WHERE user_id = ? AND is_active = 1 LIMIT 1'
  ).get(req.user.id);
  res.json(active || null);
});

module.exports = router;
