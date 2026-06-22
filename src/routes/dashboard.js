const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

router.get('/', (req, res) => {
  const now = new Date();
  const hariIni = HARI_INDONESIA[now.getDay()];

  const tanggalLocal = now.toISOString().split('T')[0];

  const akhirMinggu = new Date(now);
  akhirMinggu.setDate(now.getDate() + 7);
  const akhirMingguStr = akhirMinggu.toISOString().split('T')[0];

  const jadwal_hari_ini = db.prepare(
    'SELECT * FROM jadwal WHERE user_id = ? AND hari = ? ORDER BY jam_mulai'
  ).all(req.user.id, hariIni);

  const tugas_minggu_ini = db.prepare(
    "SELECT * FROM tugas WHERE user_id = ? AND status = 'pending' AND date(deadline) >= ? AND date(deadline) <= ? ORDER BY deadline ASC"
  ).all(req.user.id, tanggalLocal, akhirMingguStr);

  res.json({ jadwal_hari_ini, tugas_minggu_ini });
});

module.exports = router;
