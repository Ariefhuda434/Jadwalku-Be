const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', (req, res) => {
  const { search, status } = req.query;

  const personal = db.prepare(`
    SELECT t.*, NULL as group_name, t.status as submission_status,
           0 as is_group_task, NULL as creator_name
    FROM tugas t WHERE t.user_id = ?
  `).all(req.user.id);

  const groupTasks = db.prepare(`
    SELECT t.*, g.name as group_name,
           COALESCE(ts.status, 'pending') as submission_status,
           1 as is_group_task, u.username as creator_name
    FROM tugas t
    JOIN groups_table g ON g.id = t.group_id
    JOIN users u ON u.id = t.user_id
    JOIN group_members gm ON gm.group_id = t.group_id AND gm.user_id = ?
    LEFT JOIN tugas_submissions ts ON ts.tugas_id = t.id AND ts.user_id = ?
    WHERE t.group_id IS NOT NULL
  `).all(req.user.id, req.user.id);

  let all = [...personal, ...groupTasks];

  if (search && search.trim()) {
    const keyword = search.trim().toLowerCase();
    all = all.filter(t =>
      t.judul.toLowerCase().includes(keyword) ||
      t.mata_kuliah.toLowerCase().includes(keyword)
    );
  }

  if (status && ['pending', 'selesai'].includes(status)) {
    all = all.filter(t => t.submission_status === status);
  }

  all.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  res.json(all);
});

router.post('/', (req, res) => {
  const { mata_kuliah, judul, deskripsi, deadline, prioritas, group_id } = req.body;

  if (!mata_kuliah || !judul || !deadline) {
    return res.status(400).json({ message: 'Mata_kuliah, judul, dan deadline wajib diisi.' });
  }

  if (group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa menambah tugas grup.' });
    }
  }

  const p = ['rendah', 'sedang', 'tinggi'].includes(prioritas) ? prioritas : 'sedang';

  const result = db.prepare(
    'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, mata_kuliah, judul, deskripsi || '', deadline, p, group_id || null);

  if (group_id) {
    const members = db.prepare(
      'SELECT user_id FROM group_members WHERE group_id = ?'
    ).all(group_id);

    const insertSub = db.prepare(
      'INSERT OR IGNORE INTO tugas_submissions (tugas_id, user_id, status) VALUES (?, ?, ?)'
    );

    for (const m of members) {
      insertSub.run(result.lastInsertRowid, m.user_id, 'pending');
    }
  }

  const tugas = db.prepare('SELECT * FROM tugas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tugas);
});

router.put('/:id', (req, res) => {
  const { mata_kuliah, judul, deskripsi, deadline, status, prioritas } = req.body;

  const existing = db.prepare('SELECT * FROM tugas WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  if (existing.group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(existing.group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa mengedit tugas grup.' });
    }
  } else if (existing.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  const p = prioritas !== undefined && ['rendah', 'sedang', 'tinggi'].includes(prioritas) ? prioritas : existing.prioritas;

  db.prepare(
    'UPDATE tugas SET mata_kuliah = ?, judul = ?, deskripsi = ?, deadline = ?, status = ?, prioritas = ? WHERE id = ?'
  ).run(
    mata_kuliah || existing.mata_kuliah,
    judul || existing.judul,
    deskripsi !== undefined ? deskripsi : existing.deskripsi,
    deadline || existing.deadline,
    status || existing.status,
    p,
    req.params.id
  );

  const tugas = db.prepare('SELECT * FROM tugas WHERE id = ?').get(req.params.id);
  res.json(tugas);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tugas WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  if (existing.group_id) {
    const member = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
    ).get(existing.group_id, req.user.id, 'admin');

    if (!member) {
      return res.status(403).json({ message: 'Hanya admin grup yang bisa menghapus tugas grup.' });
    }
  } else if (existing.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
  }

  db.prepare('DELETE FROM tugas WHERE id = ?').run(req.params.id);
  res.json({ message: 'Tugas berhasil dihapus.' });
});

router.post('/:id/submit', (req, res) => {
  const existing = db.prepare('SELECT * FROM tugas WHERE id = ? AND group_id IS NOT NULL').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tugas grup tidak ditemukan.' });
  }

  const member = db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(existing.group_id, req.user.id);

  if (!member) {
    return res.status(403).json({ message: 'Anda bukan anggota grup ini.' });
  }

  const sub = db.prepare(
    'SELECT * FROM tugas_submissions WHERE tugas_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (sub) {
    const newStatus = sub.status === 'selesai' ? 'pending' : 'selesai';
    db.prepare(
      'UPDATE tugas_submissions SET status = ?, submitted_at = ? WHERE id = ?'
    ).run(newStatus, newStatus === 'selesai' ? new Date().toISOString() : null, sub.id);
    res.json({ status: newStatus });
  } else {
    db.prepare(
      'INSERT INTO tugas_submissions (tugas_id, user_id, status, submitted_at) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, req.user.id, 'selesai', new Date().toISOString());
    res.json({ status: 'selesai' });
  }
});

module.exports = router;
