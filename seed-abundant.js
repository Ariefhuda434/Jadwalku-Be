require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./src/database');

const password_hash = bcrypt.hashSync('123456', 10);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ========== DELETE EXISTING DATA ==========
console.log('Membersihkan data lama...');
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM tugas_submissions');
db.exec('DELETE FROM notifications');
db.exec('DELETE FROM group_announcements');
db.exec('DELETE FROM group_members');
db.exec('DELETE FROM jadwal');
db.exec('DELETE FROM tugas');
db.exec('DELETE FROM groups_table');
db.exec('DELETE FROM push_subscriptions');
db.exec('DELETE FROM users');
db.exec('PRAGMA foreign_keys = ON');
console.log('Data lama dibersihkan.\n');

// ========== USERS (25 orang) ==========
const usersData = [
  // TI-2023 A (10 orang)
  { username: 'Rico Pratama', email: 'komting@example.com', role: 'admin', group: 'TI-2023 A' },
  { username: 'Ahmad Fauzi', email: 'ahmad.fauzi@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Siti Nurhaliza', email: 'siti.nurhaliza@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Bambang Suprayitno', email: 'bambang@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Dewi Sartika', email: 'dewi.sartika@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Eko Prasetyo', email: 'eko.prasetyo@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Fitri Handayani', email: 'fitri.handayani@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Gilang Ramadhan', email: 'gilang@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Hesti Purnamasari', email: 'hesti@example.com', role: 'member', group: 'TI-2023 A' },
  { username: 'Indra Kusuma', email: 'indra.kusuma@example.com', role: 'member', group: 'TI-2023 A' },
  // TI-2023 B (8 orang)
  { username: 'Rini Wulandari', email: 'rini.wulandari@example.com', role: 'admin', group: 'TI-2023 B' },
  { username: 'Joko Susilo', email: 'joko.susilo@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Mega Sari', email: 'mega.sari@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Dimas Ardiansyah', email: 'dimas@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Putri Ayu', email: 'putri.ayu@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Adi Saputra', email: 'adi.saputra@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Rina Marlina', email: 'rina.marlina@example.com', role: 'member', group: 'TI-2023 B' },
  { username: 'Toni Gunawan', email: 'toni.gunawan@example.com', role: 'member', group: 'TI-2023 B' },
  // SI-2023 A (7 orang)
  { username: 'Fajar Nugroho', email: 'fajar.nugroho@example.com', role: 'admin', group: 'SI-2023 A' },
  { username: 'Nita Sari', email: 'nita.sari@example.com', role: 'member', group: 'SI-2023 A' },
  { username: 'Agus Wibowo', email: 'agus.wibowo@example.com', role: 'member', group: 'SI-2023 A' },
  { username: 'Maya Anggraini', email: 'maya.anggraini@example.com', role: 'member', group: 'SI-2023 A' },
  { username: 'Dedi Kurniawan', email: 'dedi.kurniawan@example.com', role: 'member', group: 'SI-2023 A' },
  { username: 'Rani Permata', email: 'rani.permata@example.com', role: 'member', group: 'SI-2023 A' },
  { username: 'Bayu Pratama', email: 'bayu.pratama@example.com', role: 'member', group: 'SI-2023 A' },
];

console.log('Membuat users...');
const users = [];
for (const u of usersData) {
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(u.username, u.email, password_hash);
  users.push({ ...u, id: result.lastInsertRowid });
  console.log(`  ${u.username} (${u.email})`);
}
console.log(`${users.length} users berhasil dibuat.\n`);

// ========== GROUPS ==========
const groupDefs = [
  { name: 'TI-2023 A', description: 'Kelas TI angkatan 2023 - Gedung FIK Lt. 2', adminEmail: 'komting@example.com' },
  { name: 'TI-2023 B', description: 'Kelas TI angkatan 2023 paralel B - Gedung FIK Lt. 3', adminEmail: 'rini.wulandari@example.com' },
  { name: 'SI-2023 A', description: 'Kelas Sistem Informasi angkatan 2023 - Gedung FIK Lt. 1', adminEmail: 'fajar.nugroho@example.com' },
];

console.log('Membuat grup...');
const groups = {};
for (const g of groupDefs) {
  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (db.prepare('SELECT id FROM groups_table WHERE invite_code = ?').get(inviteCode));

  const adminUser = users.find(u => u.email === g.adminEmail);
  const result = db.prepare(
    'INSERT INTO groups_table (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)'
  ).run(g.name, g.description, inviteCode, adminUser.id);

  groups[g.name] = { id: result.lastInsertRowid, inviteCode, adminId: adminUser.id };
  db.prepare(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, adminUser.id, 'admin');

  // Add members
  for (const u of users) {
    if (u.group === g.name && u.role === 'member') {
      db.prepare(
        'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
      ).run(result.lastInsertRowid, u.id, 'member');
    }
  }

  const memberCount = db.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').get(result.lastInsertRowid).c;
  console.log(`  ${g.name} (kode: ${inviteCode}) - ${memberCount} anggota`);
}
console.log(`${groupDefs.length} grup berhasil dibuat.\n`);

// ========== JADWAL KULIAH PER GRUP ==========
const jadwalPerGrup = {
  'TI-2023 A': [
    { hari: 'Senin', mata_kuliah: 'Kalkulus', jam_mulai: '07:30', jam_selesai: '10:00', ruang: 'R.101', dosen: 'Prof. Budi Santoso' },
    { hari: 'Senin', mata_kuliah: 'Fisika Dasar', jam_mulai: '10:30', jam_selesai: '12:00', ruang: 'Lab Fisika', dosen: 'Dr. Susi Rahmawati' },
    { hari: 'Selasa', mata_kuliah: 'Kalkulus', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R.101', dosen: 'Prof. Budi Santoso' },
    { hari: 'Selasa', mata_kuliah: 'Praktikum Fisika', jam_mulai: '13:00', jam_selesai: '15:30', ruang: 'Lab Fisika', dosen: 'Dr. Susi Rahmawati' },
    { hari: 'Rabu', mata_kuliah: 'Bahasa Inggris', jam_mulai: '09:00', jam_selesai: '10:30', ruang: 'R.203', dosen: 'Ms. Sarah Wijaya' },
    { hari: 'Rabu', mata_kuliah: 'Pendidikan Agama', jam_mulai: '13:00', jam_selesai: '14:30', ruang: 'Aula', dosen: 'Ust. Ahmad Zaini' },
    { hari: 'Kamis', mata_kuliah: 'Aljabar Linear', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R.101', dosen: 'Prof. Budi Santoso' },
    { hari: 'Kamis', mata_kuliah: 'Pemrograman Dasar', jam_mulai: '13:00', jam_selesai: '16:00', ruang: 'Lab Komputer 1', dosen: 'Dr. Deni Kurniawan' },
    { hari: 'Jumat', mata_kuliah: 'Agama', jam_mulai: '07:30', jam_selesai: '09:00', ruang: 'Aula', dosen: 'Ust. Ahmad Zaini' },
    { hari: 'Jumat', mata_kuliah: 'Pemrograman Dasar', jam_mulai: '09:30', jam_selesai: '12:00', ruang: 'Lab Komputer 1', dosen: 'Dr. Deni Kurniawan' },
  ],
  'TI-2023 B': [
    { hari: 'Senin', mata_kuliah: 'Pemrograman Web', jam_mulai: '08:00', jam_selesai: '10:30', ruang: 'Lab Komputer 2', dosen: 'Dr. Rina Marlina' },
    { hari: 'Senin', mata_kuliah: 'Basis Data', jam_mulai: '13:00', jam_selesai: '15:00', ruang: 'R.201', dosen: 'Prof. Agus Setiawan' },
    { hari: 'Selasa', mata_kuliah: 'Struktur Data', jam_mulai: '07:30', jam_selesai: '10:00', ruang: 'Lab Komputer 2', dosen: 'Dr. Rina Marlina' },
    { hari: 'Selasa', mata_kuliah: 'Matematika Diskrit', jam_mulai: '10:30', jam_selesai: '12:00', ruang: 'R.202', dosen: 'Prof. Budi Santoso' },
    { hari: 'Rabu', mata_kuliah: 'Sistem Operasi', jam_mulai: '09:00', jam_selesai: '11:30', ruang: 'Lab Sistem', dosen: 'Dr. Hendra Gunawan' },
    { hari: 'Rabu', mata_kuliah: 'Jaringan Komputer', jam_mulai: '13:00', jam_selesai: '15:30', ruang: 'Lab Jaringan', dosen: 'Dr. Hendra Gunawan' },
    { hari: 'Kamis', mata_kuliah: 'Praktikum Basis Data', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'Lab Komputer 2', dosen: 'Prof. Agus Setiawan' },
    { hari: 'Kamis', mata_kuliah: 'Statistika', jam_mulai: '13:00', jam_selesai: '14:30', ruang: 'R.203', dosen: 'Dr. Maya Putri' },
    { hari: 'Jumat', mata_kuliah: 'Interaksi Manusia Komputer', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R.201', dosen: 'Dr. Maya Putri' },
    { hari: 'Jumat', mata_kuliah: 'Pendidikan Kewarganegaraan', jam_mulai: '10:30', jam_selesai: '12:00', ruang: 'Aula', dosen: 'Dr. Hariyanto' },
  ],
  'SI-2023 A': [
    { hari: 'Senin', mata_kuliah: 'Analisis Proses Bisnis', jam_mulai: '09:00', jam_selesai: '11:30', ruang: 'R.301', dosen: 'Prof. Dwi Astuti' },
    { hari: 'Senin', mata_kuliah: 'Pemrograman Berorientasi Objek', jam_mulai: '13:00', jam_selesai: '15:30', ruang: 'Lab Komputer 3', dosen: 'Dr. Dimas Pratama' },
    { hari: 'Selasa', mata_kuliah: 'Sistem Informasi Manajemen', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R.302', dosen: 'Prof. Dwi Astuti' },
    { hari: 'Selasa', mata_kuliah: 'Desain Database', jam_mulai: '10:30', jam_selesai: '12:30', ruang: 'Lab Komputer 3', dosen: 'Dr. Dimas Pratama' },
    { hari: 'Rabu', mata_kuliah: 'E-Business', jam_mulai: '08:00', jam_selesai: '10:00', ruang: 'R.301', dosen: 'Mba. Linda Kusuma' },
    { hari: 'Rabu', mata_kuliah: 'UI/UX Design', jam_mulai: '13:00', jam_selesai: '15:00', ruang: 'Lab Multimedia', dosen: 'Mba. Linda Kusuma' },
    { hari: 'Kamis', mata_kuliah: 'Manajemen Proyek TI', jam_mulai: '09:00', jam_selesai: '11:00', ruang: 'R.302', dosen: 'Prof. Dwi Astuti' },
    { hari: 'Kamis', mata_kuliah: 'Praktikum Basis Data', jam_mulai: '13:00', jam_selesai: '15:00', ruang: 'Lab Komputer 3', dosen: 'Dr. Dimas Pratama' },
    { hari: 'Jumat', mata_kuliah: 'Bahasa Inggris Bisnis', jam_mulai: '08:00', jam_selesai: '09:30', ruang: 'R.301', dosen: 'Ms. Sarah Wijaya' },
    { hari: 'Jumat', mata_kuliah: 'Etika Profesi TI', jam_mulai: '10:00', jam_selesai: '11:30', ruang: 'R.302', dosen: 'Dr. Hariyanto' },
  ],
};

const insertJadwal = db.prepare(
  'INSERT INTO jadwal (user_id, hari, mata_kuliah, jam_mulai, jam_selesai, ruang, dosen, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

console.log('Membuat jadwal kuliah...');
for (const [groupName, jadwals] of Object.entries(jadwalPerGrup)) {
  const groupId = groups[groupName].id;
  const adminId = groups[groupName].adminId;
  for (const j of jadwals) {
    insertJadwal.run(adminId, j.hari, j.mata_kuliah, j.jam_mulai, j.jam_selesai, j.ruang, j.dosen, groupId);
  }
  console.log(`  ${groupName}: ${jadwals.length} jadwal`);
}

// Personal jadwal for each admin
console.log('Membuat jadwal pribadi...');
const allAdmins = users.filter(u => u.role === 'admin');
for (const admin of allAdmins) {
  const personalJadwals = [
    { hari: 'Senin', mata_kuliah: 'UKM Robotik', jam_mulai: '16:00', jam_selesai: '18:00', ruang: 'Lab Robotik', dosen: 'Coach Andi' },
    { hari: 'Rabu', mata_kuliah: 'UKM Robotik', jam_mulai: '16:00', jam_selesai: '18:00', ruang: 'Lab Robotik', dosen: 'Coach Andi' },
  ];
  for (const j of personalJadwals) {
    insertJadwal.run(admin.id, j.hari, j.mata_kuliah, j.jam_mulai, j.jam_selesai, j.ruang, j.dosen, null);
  }
}
console.log(`  Jadwal pribadi untuk ${allAdmins.length} admin\n`);

// ========== DATE HELPERS ==========
function getDates(daysFromNow) {
  const now = new Date();
  const dates = [];
  for (let i = 0; i < daysFromNow; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getPastDates(daysBack) {
  const now = new Date();
  const dates = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const futureDates = getDates(30);
const pastDates = getPastDates(7);

// ========== TUGAS KELOMPOK PER GRUP ==========
const tugasGrup = {
  'TI-2023 A': [
    { judul: 'Turunan Fungsi Aljabar', mata_kuliah: 'Kalkulus', deskripsi: 'Kerjakan soal turunan fungsi aljabar dari buku paket halaman 45-50. Dikumpulkan dalam bentuk PDF.', deadline: futureDates[3], prioritas: 'tinggi' },
    { judul: 'Laporan Praktikum Fisika', mata_kuliah: 'Fisika Dasar', deskripsi: 'Buat laporan praktikum fisika tentang Hukum Newton. Format laporan sesuai template yang sudah diberikan.', deadline: futureDates[5], prioritas: 'sedang' },
    { judul: 'Program Kalkulator Sederhana', mata_kuliah: 'Pemrograman Dasar', deskripsi: 'Buat program kalkulator sederhana menggunakan bahasa C++ yang bisa melakukan operasi +, -, *, /.', deadline: futureDates[7], prioritas: 'tinggi' },
    { judul: 'Makalah Aljabar Linear', mata_kuliah: 'Aljabar Linear', deskripsi: 'Buat makalah tentang aplikasi aljabar linear dalam ilmu komputer. Minimal 10 halaman.', deadline: futureDates[12], prioritas: 'sedang' },
    { judul: 'PPT Bahasa Inggris', mata_kuliah: 'Bahasa Inggris', deskripsi: 'Buat presentasi tentang technology innovation dalam Bahasa Inggris. Durasi 10 menit.', deadline: futureDates[4], prioritas: 'rendah' },
  ],
  'TI-2023 B': [
    { judul: 'Membuat Landing Page', mata_kuliah: 'Pemrograman Web', deskripsi: 'Buat landing page responsive menggunakan HTML, CSS, dan JavaScript. Tema bebas.', deadline: futureDates[2], prioritas: 'tinggi' },
    { judul: 'Normalisasi Database', mata_kuliah: 'Basis Data', deskripsi: 'Lakukan normalisasi database sampai 3NF dari studi kasus sistem perpustakaan.', deadline: futureDates[6], prioritas: 'tinggi' },
    { judul: 'Implementasi Stack & Queue', mata_kuliah: 'Struktur Data', deskripsi: 'Implementasi struktur data stack dan queue menggunakan bahasa Python.', deadline: futureDates[8], prioritas: 'sedang' },
    { judul: 'Simulasi Jaringan Cisco', mata_kuliah: 'Jaringan Komputer', deskripsi: 'Buat simulasi jaringan dengan 3 router, 2 switch, dan 5 PC menggunakan Cisco Packet Tracer.', deadline: futureDates[14], prioritas: 'tinggi' },
    { judul: 'Makalah Sistem Operasi', mata_kuliah: 'Sistem Operasi', deskripsi: 'Buat makalah perbandingan sistem operasi Windows, Linux, dan macOS.', deadline: futureDates[10], prioritas: 'sedang' },
  ],
  'SI-2023 A': [
    { judul: 'Dokumen SRS Aplikasi E-Library', mata_kuliah: 'Analisis Proses Bisnis', deskripsi: 'Buat Software Requirements Specification untuk aplikasi E-Library kampus.', deadline: futureDates[4], prioritas: 'tinggi' },
    { judul: 'Aplikasi CRUD Java', mata_kuliah: 'Pemrograman Berorientasi Objek', deskripsi: 'Buat aplikasi CRUD sederhana dengan Java OOP. Tema: Manajemen Data Mahasiswa.', deadline: futureDates[9], prioritas: 'tinggi' },
    { judul: 'Desain UI/UX Aplikasi Mobile', mata_kuliah: 'UI/UX Design', deskripsi: 'Buat prototype aplikasi mobile di Figma. Tema: Aplikasi Pemesanan Makanan.', deadline: futureDates[6], prioritas: 'sedang' },
    { judul: 'Makalah E-Business', mata_kuliah: 'E-Business', deskripsi: 'Buat makalah tentang strategi E-Business di era digital. Minimal 8 halaman.', deadline: futureDates[15], prioritas: 'rendah' },
  ],
};

const insertTugas = db.prepare(
  'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

console.log('Membuat tugas grup...');
for (const [groupName, tugas] of Object.entries(tugasGrup)) {
  const groupId = groups[groupName].id;
  const adminId = groups[groupName].adminId;
  for (const t of tugas) {
    const result = insertTugas.run(adminId, t.mata_kuliah, t.judul, t.deskripsi, t.deadline, t.prioritas, groupId);
    // Create submission records for all members
    const members = db.prepare('SELECT user_id, role FROM group_members WHERE group_id = ?').all(groupId);
    for (const m of members) {
      db.prepare('INSERT INTO tugas_submissions (tugas_id, user_id, status) VALUES (?, ?, ?)').run(
        result.lastInsertRowid, m.user_id, 'pending'
      );
    }
  }
  console.log(`  ${groupName}: ${tugas.length} tugas grup`);
}

// Mark some submissions as completed
console.log('  Menandai beberapa tugas sudah dikumpulkan...');
const allSubmissions = db.prepare(
  'SELECT ts.* FROM tugas_submissions ts JOIN tugas t ON t.id = ts.tugas_id WHERE t.group_id IS NOT NULL'
).all();
const usersToMark = users.filter(u => u.role === 'member');
const submissionsPerUser = 2;
for (const user of usersToMark) {
  const userSubs = allSubmissions.filter(s => s.user_id === user.id && s.status === 'pending');
  const toMark = userSubs.slice(0, submissionsPerUser);
  for (const sub of toMark) {
    db.prepare(
      'UPDATE tugas_submissions SET status = ?, submitted_at = ? WHERE id = ?'
    ).run('selesai', new Date().toISOString(), sub.id);
  }
}
console.log(`  ${usersToMark.length * submissionsPerUser} submission ditandai selesai\n`);

// ========== PERSONAL TUGAS UNTUK MEMBER ==========
console.log('Membuat tugas pribadi...');
const personalTugasTemplates = [
  { mata_kuliah: 'Kalkulus', judul: 'PR Turunan Trigonometri', deskripsi: 'Kerjakan soal turunan trigonometri nomor 1-10', prioritas: 'sedang' },
  { mata_kuliah: 'Fisika Dasar', judul: 'Rangkuman Materi Gelombang', deskripsi: 'Buat rangkuman materi gelombang elektromagnetik', prioritas: 'rendah' },
  { mata_kuliah: 'Pemrograman Dasar', judul: 'Tugas Algoritma Sorting', deskripsi: 'Implementasi algoritma bubble sort dan merge sort', prioritas: 'tinggi' },
  { mata_kuliah: 'Bahasa Inggris', judul: 'Esai Bahasa Inggris', deskripsi: 'Tulis esai 500 kata tentang environmental issues', prioritas: 'sedang' },
];

const insertPersonalTugas = db.prepare(
  'INSERT INTO tugas (user_id, mata_kuliah, judul, deskripsi, deadline, prioritas) VALUES (?, ?, ?, ?, ?, ?)'
);

for (const user of users) {
  // 2-3 personal tasks per user
  const count = 2 + (user.id % 2);
  for (let i = 0; i < count && i < personalTugasTemplates.length; i++) {
    const tpl = personalTugasTemplates[(user.id + i) % personalTugasTemplates.length];
    const deadlineIdx = 3 + (user.id * 2 + i) % 20;
    insertPersonalTugas.run(
      user.id, tpl.mata_kuliah, tpl.judul, tpl.deskripsi,
      futureDates[deadlineIdx], tpl.prioritas
    );
  }
}
console.log(`  Tugas pribadi untuk ${users.length} users\n`);

// ========== ANNOUNCEMENTS ==========
const announcementsData = {
  'TI-2023 A': [
    { title: 'Selamat Datang di TI-2023 A!', message: 'Halo semuanya! Selamat datang di grup TI-2023 A. Gunakan grup ini untuk info perkuliahan dan diskusi. Jangan lupa cek jadwal secara berkala ya!', type: 'info' },
    { title: 'KALKULUS Gajadi Besok!', message: 'Assalamualaikum teman-teman. Ada info nih, besok Selasa kelas KALKULUS ditiadakan karena dosen ada rapat. Untuk jadwal susulan menyusul ya.', type: 'info' },
    { title: 'Deadline Tugas Paket Dimajuin!', message: 'Tugas Paket dari Bu Susi yang deadline minggu depan, katanya dimajuin jadi hari Jumat. Cek di halaman tugas masing-masing ya!', type: 'info' },
    { title: 'Info Praktikum Fisika', message: 'Untuk praktikum fisika minggu ini, mohon bawa jurnal praktikum dan kalkulator. Praktikum dimulai pukul 13:00 di Lab Fisika.', type: 'info' },
    { title: 'Jadwal UTS', message: 'Jadwal UTS sudah keluar! Cek di papan pengumuman atau tanya komting. UTS dimulai tanggal 15 bulan depan.', type: 'info' },
  ],
  'TI-2023 B': [
    { title: 'Selamat Datang TI-2023 B!', message: 'Selamat datang teman-teman TI-2023 B! Semoga semangat kuliahnya. Jangan lupa kenalan sama teman-teman satu grup ya!', type: 'info' },
    { title: 'Perubahan Jadwal Web', message: 'Izin ngasih tau, jadwal Pemrograman Web hari ini dimundurkan jam 10:00 karena dosen ada urusan mendadak.', type: 'info' },
    { title: 'Tugas Basis Data Kelompok', message: 'Untuk tugas basis data, dosen minta dikerjakan secara berkelompok. 1 kelompok maksimal 3 orang. Segera bentuk kelompok ya!', type: 'info' },
  ],
  'SI-2023 A': [
    { title: 'Halo SI-2023 A!', message: 'Selamat datang di grup SI-2023 A. Semoga kita semua bisa lulus tepat waktu. Aamiin!', type: 'info' },
    { title: 'Workshop UI/UX', message: 'Ada workshop UI/UX gratis dari kampus hari Sabtu ini. Yang berminat silakan daftar ke admin grup. Terbatas 20 orang!', type: 'info' },
    { title: 'Pengumpulan SRS', message: 'Mohon untuk dokumen SRS dikumpulkan paling lambat hari Kamis. Yang belum konsultasi segera konsultasi ke dosen pembimbing.', type: 'info' },
  ],
};

const insertAnn = db.prepare(
  'INSERT INTO group_announcements (group_id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)'
);

console.log('Membuat pengumuman...');
for (const [groupName, anns] of Object.entries(announcementsData)) {
  const groupId = groups[groupName].id;
  const adminId = groups[groupName].adminId;
  for (const a of anns) {
    insertAnn.run(groupId, adminId, a.title, a.message, a.type);
  }
  console.log(`  ${groupName}: ${anns.length} pengumuman`);
}

// ========== NOTIFICATIONS ==========
console.log('Membuat notifikasi...');
const insertNotif = db.prepare(
  'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?)'
);
for (const user of users) {
  const notifs = [
    { title: 'Selamat Datang!', message: `Selamat datang di Pengingat Jadwal, ${user.username}!`, type: 'info', is_read: 1 },
    { title: 'Deadline Tugas', message: 'Kamu punya 3 tugas yang deadline-nya minggu ini. Cek halaman tugas!', type: 'deadline', is_read: user.id % 2 === 0 ? 1 : 0 },
  ];
  for (const n of notifs) {
    insertNotif.run(user.id, n.title, n.message, n.type, n.is_read);
  }
}
console.log(`  ${users.length * 2} notifikasi dibuat\n`);

// ========== SUMMARY ==========
console.log('╔══════════════════════════════════════════════╗');
console.log('║         SEED ABUNDANT SELESAI!               ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('📋 Ringkasan Data:');
console.log(`   👥 Users: ${users.length} orang`);
console.log(`   📚 Grup: ${groupDefs.length} grup`);
console.log(`   📅 Jadwal Grup: ${Object.values(jadwalPerGrup).flat().length} jadwal`);
console.log(`   📝 Tugas Grup: ${Object.values(tugasGrup).flat().length} tugas`);
console.log(`   📢 Pengumuman: ${Object.values(announcementsData).flat().length} pengumuman`);
console.log('');
console.log('🔑 Login Info (password semua: 123456):');
console.log('╔════════════════════════╦═══════════════════════════╦════════════╗');
console.log('║ Email                  ║ Nama                      ║ Role       ║');
console.log('╠════════════════════════╬═══════════════════════════╬════════════╣');
for (const u of users) {
  const email = u.email.padEnd(22);
  const name = u.username.padEnd(26);
  const role = u.role === 'admin' ? 'Admin Grup' : 'Anggota';
  console.log(`║ ${email} ║ ${name} ║ ${role.padEnd(10)} ║`);
}
console.log('╚════════════════════════╩═══════════════════════════╩════════════╝');
console.log('');
for (const [name, g] of Object.entries(groups)) {
  console.log(`📌 ${name} — Kode Undangan: ${g.inviteCode}`);
}
