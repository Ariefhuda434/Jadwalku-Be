require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./src/database');

const password_hash = bcrypt.hashSync('123456', 10);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

const users = [
  { username: 'Komting TI-2023', email: 'komting@example.com', role: 'admin' },
  { username: 'Mahasiswa 1', email: 'mahasiswa1@example.com', role: 'member' },
  { username: 'Mahasiswa 2', email: 'mahasiswa2@example.com', role: 'member' },
  { username: 'Mahasiswa 3', email: 'mahasiswa3@example.com', role: 'member' },
  { username: 'Mahasiswa 4', email: 'mahasiswa4@example.com', role: 'member' },
];

const createdUsers = [];
const existingUsers = [];

for (const u of users) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (existing) {
    existingUsers.push({ ...u, id: existing.id });
    console.log(`User ${u.email} sudah ada, skipping...`);
  } else {
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(u.username, u.email, password_hash);
    createdUsers.push({ ...u, id: result.lastInsertRowid });
    console.log(`User ${u.email} / 123456 dibuat`);
  }
}

const allUsers = [...existingUsers, ...createdUsers];
const adminUser = allUsers.find(u => u.role === 'admin');
const memberUsers = allUsers.filter(u => u.role === 'member');

const existingGroup = db.prepare("SELECT id FROM groups_table WHERE name = 'TI-2023 A'").get();
let groupId;

if (existingGroup) {
  groupId = existingGroup.id;
  console.log('Grup TI-2023 A sudah ada, skipping...');
} else {
  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (db.prepare('SELECT id FROM groups_table WHERE invite_code = ?').get(inviteCode));

  const result = db.prepare(
    'INSERT INTO groups_table (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)'
  ).run('TI-2023 A', 'Grup kelas TI angkatan 2023', inviteCode, adminUser.id);
  groupId = result.lastInsertRowid;
  console.log(`Grup TI-2023 A dibuat (kode: ${inviteCode})`);
}

for (const u of allUsers) {
  const existing = db.prepare(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, u.id);

  if (existing) {
    console.log(`  ${u.username} sudah di grup`);
  } else {
    db.prepare(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
    ).run(groupId, u.id, u.role);
    console.log(`  ${u.username} ditambahkan ke grup sebagai ${u.role}`);
  }
}

const existingAnn = db.prepare(
  'SELECT COUNT(*) as count FROM group_announcements WHERE group_id = ?'
).get(groupId);
if (existingAnn.count === 0) {
  const announcements = [
    { title: 'Selamat Datang di TI-2023 A!', message: 'Halo semuanya! Selamat datang di grup TI-2023 A. Gunakan grup ini untuk info perkuliahan dan diskusi. Jangan lupa cek jadwal secara berkala ya!', type: 'info' },
    { title: 'KALKULUS Gajadi Besok!', message: 'Assalamualaikum teman-teman. Ada info nih, besok Selasa 24 Juni kelas KALKULUS ditiadakan karena dosen ada rapat. Untuk jadwal susulan menyusul ya.', type: 'info' },
    { title: 'Tugas Paket Deadlinenya Jumat', message: 'Tugas Paket dari Bu Susi yang deadline minggu depan, katanya dimajuin jadi hari Jumat. Cek di halaman tugas masing-masing ya!', type: 'info' },
  ];

  const insertAnn = db.prepare(
    'INSERT INTO group_announcements (group_id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)'
  );

  for (const a of announcements) {
    insertAnn.run(groupId, adminUser.id, a.title, a.message, a.type);
    console.log(`  Pengumuman: "${a.title}"`);
  }
} else {
  console.log('Pengumuman sudah ada, skipping...');
}

const existingJadwalGrup = db.prepare(
  'SELECT COUNT(*) as count FROM jadwal WHERE group_id = ?'
).get(groupId);
if (existingJadwalGrup.count === 0) {
  const jadwalGrup = [
    { hari: 'Senin', mata_kuliah: 'KALKULUS', jam_mulai: '07:30', jam_selesai: '10:00', ruang: 'R101', dosen: 'Prof. Budi' },
    { hari: 'Senin', mata_kuliah: 'FISIKA DASAR', jam_mulai: '10:30', jam_selesai: '12:00', ruang: 'Lab Fisika', dosen: 'Dr. Susi' },
    { hari: 'Selasa', mata_kuliah: 'KALKULUS', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R101', dosen: 'Prof. Budi' },
    { hari: 'Selasa', mata_kuliah: 'PRAKTIKUM FISIKA', jam_mulai: '13:00', jam_selesai: '15:30', ruang: 'Lab Fisika', dosen: 'Dr. Susi' },
    { hari: 'Rabu', mata_kuliah: 'BAHASA INGGRIS', jam_mulai: '09:00', jam_selesai: '10:30', ruang: 'R203', dosen: 'Ms. Sarah' },
    { hari: 'Kamis', mata_kuliah: 'ALJABAR LINEAR', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R101', dosen: 'Prof. Budi' },
    { hari: 'Kamis', mata_kuliah: 'PEMROGRAMAN DASAR', jam_mulai: '13:00', jam_selesai: '16:00', ruang: 'Lab Komputer', dosen: 'Dr. Deni' },
    { hari: 'Jumat', mata_kuliah: 'AGAMA', jam_mulai: '07:30', jam_selesai: '09:00', ruang: 'Aula', dosen: 'Ust. Ahmad' },
    { hari: 'Jumat', mata_kuliah: 'PEMROGRAMAN DASAR', jam_mulai: '09:30', jam_selesai: '12:00', ruang: 'Lab Komputer', dosen: 'Dr. Deni' },
  ];

  const insertJadwal = db.prepare(
    'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const j of jadwalGrup) {
    insertJadwal.run(adminUser.id, j.hari, j.mata_kuliah, j.jam_mulai, j.jam_selesai, j.ruang, j.dosen, groupId);
  }
  console.log(`${jadwalGrup.length} jadwal grup berhasil ditambahkan`);
} else {
  console.log('Jadwal grup sudah ada, skipping...');
}

for (const u of memberUsers) {
  const count = db.prepare('SELECT COUNT(*) as count FROM tugas WHERE user_id = ?').get(u.id);
  if (count.count > 0) {
    console.log(`Tugas untuk ${u.username} sudah ada, skipping...`);
    continue;
  }

  const now = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }

  const tugas = [
    { mata_kuliah: 'KALKULUS', judul: 'Turunan Fungsi', deskripsi: 'Kerjakan soal turunan fungsi aljabar', deadline: dates[2], prioritas: 'tinggi' },
    { mata_kuliah: 'FISIKA DASAR', judul: 'Laporan Praktikum', deskripsi: 'Buat laporan praktikum fisika', deadline: dates[4], prioritas: 'sedang' },
    { mata_kuliah: 'PEMROGRAMAN DASAR', judul: 'Tugas Koding', deskripsi: 'Buat program kalkulator sederhana', deadline: dates[6], prioritas: 'tinggi' },
  ];

  const insertTugas = db.prepare(
    'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const t of tugas) {
    insertTugas.run(u.id, t.mata_kuliah, t.judul, t.deskripsi, t.deadline, t.prioritas);
  }
  console.log(`${tugas.length} tugas untuk ${u.username} ditambahkan`);
}

console.log('\n========== SEED GROUP SELESAI! ==========');
console.log('Login info (password semua: 123456):');
console.log('  komting@example.com    → Komting (Admin Grup)');
console.log('  mahasiswa1@example.com → Anggota');
console.log('  mahasiswa2@example.com → Anggota');
console.log('  mahasiswa3@example.com → Anggota');
console.log('  mahasiswa4@example.com → Anggota');
console.log('');

const invite = db.prepare('SELECT invite_code FROM groups_table WHERE id = ?').get(groupId);
console.log(`Kode undangan grup: ${invite.invite_code}`);
