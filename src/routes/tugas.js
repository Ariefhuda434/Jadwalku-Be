const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const tugas = db.prepare(
    'SELECT * FROM tugas WHERE user_id = ? ORDER BY deadline ASC'
  ).all(req.user.id);

  res.json(tugas);
});

router.post('/', (req, res) => {
  const { mata_kuliah, judul, deskripsi, deadline, prioritas } = req.body;

  if (!mata_kuliah || !judul || !deadline) {
    return res.status(400).json({ message: 'Mata_kuliah, judul, dan deadline wajib diisi.' });
  }

  const p = ['rendah', 'sedang', 'tinggi'].includes(prioritas) ? prioritas : 'sedang';

  const result = db.prepare(
    'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, mata_kuliah, judul, deskripsi || '', deadline, p);

  const tugas = db.prepare('SELECT * FROM tugas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tugas);
});

router.put('/:id', (req, res) => {
  const { mata_kuliah, judul, deskripsi, deadline, status, prioritas } = req.body;

  const existing = db.prepare('SELECT * FROM tugas WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  const p = prioritas !== undefined && ['rendah', 'sedang', 'tinggi'].includes(prioritas) ? prioritas : existing.prioritas;

  db.prepare(
    'UPDATE tugas SET mata_kuliah = ?, judul = ?, deskripsi = ?, deadline = ?, status = ?, prioritas = ? WHERE id = ? AND user_id = ?'
  ).run(
    mata_kuliah || existing.mata_kuliah,
    judul || existing.judul,
    deskripsi !== undefined ? deskripsi : existing.deskripsi,
    deadline || existing.deadline,
    status || existing.status,
    p,
    req.params.id,
    req.user.id
  );

  const tugas = db.prepare('SELECT * FROM tugas WHERE id = ?').get(req.params.id);
  res.json(tugas);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tugas WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  db.prepare('DELETE FROM tugas WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Tugas berhasil dihapus.' });
});

module.exports = router;
