require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('./src/database');

const password_hash = bcrypt.hashSync('123456', 10);

const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('test@example.com');
let userId;

if (existingUser) {
  userId = existingUser.id;
  console.log('User test@example.com sudah ada, skipping...');
} else {
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run('Test User', 'test@example.com', password_hash);
  userId = result.lastInsertRowid;
  console.log('User test@example.com / 123456 dibuat');
}

const existingJadwal = db.prepare('SELECT COUNT(*) as count FROM jadwal WHERE user_id = ?').get(userId);
if (existingJadwal.count > 0) {
  console.log('Data jadwal sudah ada, skipping...');
} else {
  const jadwalData = [
    { hari: 'Senin', mata_kuliah: 'Basis Data', jam_mulai: '08:00', jam_selesai: '09:30', ruang: 'Lab Komputer A', dosen: 'Prof. Pratama' },
    { hari: 'Senin', mata_kuliah: 'Pemrograman Web', jam_mulai: '10:00', jam_selesai: '12:30', ruang: 'Ruang 301', dosen: 'Dr. Wijaya' },
    { hari: 'Selasa', mata_kuliah: 'Struktur Data', jam_mulai: '09:00', jam_selesai: '10:30', ruang: 'Ruang 201', dosen: 'Prof. Pratama' },
    { hari: 'Selasa', mata_kuliah: 'Sistem Operasi', jam_mulai: '13:00', jam_selesai: '15:00', ruang: 'Lab Sistem', dosen: 'Dr. Wijaya' },
    { hari: 'Rabu', mata_kuliah: 'Matematika Diskrit', jam_mulai: '07:30', jam_selesai: '09:00', ruang: 'Ruang 101', dosen: 'Prof. Pratama' },
    { hari: 'Rabu', mata_kuliah: 'Jaringan Komputer', jam_mulai: '10:00', jam_selesai: '12:00', ruang: 'Lab Jaringan', dosen: 'Dr. Wijaya' },
    { hari: 'Kamis', mata_kuliah: 'Rekayasa Perangkat Lunak', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'Ruang 302', dosen: 'Prof. Pratama' },
    { hari: 'Kamis', mata_kuliah: 'Kecerdasan Buatan', jam_mulai: '13:30', jam_selesai: '15:30', ruang: 'Lab AI', dosen: 'Dr. Wijaya' },
    { hari: 'Jumat', mata_kuliah: 'Interaksi Manusia & Komputer', jam_mulai: '09:00', jam_selesai: '10:30', ruang: 'Ruang 202', dosen: 'Prof. Pratama' },
    { hari: 'Jumat', mata_kuliah: 'Praktikum Basis Data', jam_mulai: '11:00', jam_selesai: '13:00', ruang: 'Lab Komputer B', dosen: 'Dr. Wijaya' },
    { hari: 'Sabtu', mata_kuliah: 'Statistika', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'Ruang 102', dosen: 'Prof. Pratama' },
  ];

  const insertJadwal = db.prepare(
    'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const j of jadwalData) {
    insertJadwal.run(userId, j.hari, j.mata_kuliah, j.jam_mulai, j.jam_selesai, j.ruang, j.dosen);
  }
  console.log(`${jadwalData.length} jadwal berhasil ditambahkan`);
}

const existingTugas = db.prepare('SELECT COUNT(*) as count FROM tugas WHERE user_id = ?').get(userId);
if (existingTugas.count > 0) {
  console.log('Data tugas sudah ada, skipping...');
} else {
  const now = new Date();
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }

  const tugasData = [
    { mata_kuliah: 'Basis Data', judul: 'Normalisasi Database', deskripsi: 'Membuat normalisasi sampai 3NF dari studi kasus yang diberikan', deadline: dates[1], prioritas: 'tinggi' },
    { mata_kuliah: 'Pemrograman Web', judul: 'Membuat Landing Page', deskripsi: 'Landing page menggunakan HTML, CSS, dan JavaScript', deadline: dates[2], prioritas: 'sedang' },
    { mata_kuliah: 'Struktur Data', judul: 'Implementasi Stack & Queue', deskripsi: 'Buat program implementasi stack dan queue dalam Python', deadline: dates[3], prioritas: 'tinggi' },
    { mata_kuliah: 'Sistem Operasi', judul: 'Makalah Sistem File', deskripsi: 'Buat makalah tentang sistem file di Linux vs Windows', deadline: dates[4], prioritas: 'sedang' },
    { mata_kuliah: 'Matematika Diskrit', judul: 'Soal Himpunan & Relasi', deskripsi: 'Kerjakan 20 soal tentang himpunan dan relasi', deadline: dates[5], prioritas: 'rendah' },
    { mata_kuliah: 'Jaringan Komputer', judul: 'Konfigurasi Cisco Packet Tracer', deskripsi: 'Buat simulasi jaringan dengan 3 router dan 5 PC', deadline: dates[7], prioritas: 'tinggi' },
    { mata_kuliah: 'Rekayasa Perangkat Lunak', judul: 'Dokumen SRS', deskripsi: 'Buat Software Requirements Specification untuk aplikasi E-Library', deadline: dates[8], prioritas: 'tinggi' },
    { mata_kuliah: 'Kecerdasan Buatan', judul: 'Algoritma A*', deskripsi: 'Implementasi algoritma A* untuk pathfinding', deadline: dates[10], prioritas: 'sedang' },
    { mata_kuliah: 'Interaksi Manusia & Komputer', judul: 'Membuat Prototype UI', deskripsi: 'Buat prototype aplikasi mobile di Figma', deadline: dates[12], prioritas: 'sedang' },
    { mata_kuliah: 'Statistika', judul: 'Analisis Data SPSS', deskripsi: 'Lakukan analisis deskriptif dan regresi dari dataset yang diberikan', deadline: dates[13], prioritas: 'rendah' },
  ];

  const insertTugas = db.prepare(
    'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const t of tugasData) {
    insertTugas.run(userId, t.mata_kuliah, t.judul, t.deskripsi, t.deadline, t.prioritas);
  }
  console.log(`${tugasData.length} tugas berhasil ditambahkan`);
}

console.log('\nSeed selesai!');
console.log('Email: test@example.com');
console.log('Password: 123456');
