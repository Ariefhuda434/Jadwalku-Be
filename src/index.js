const express = require('express');
const cors = require('cors');
const db = require('./database');

const authRoutes = require('./routes/auth');
const jadwalRoutes = require('./routes/jadwal');
const tugasRoutes = require('./routes/tugas');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/tugas', tugasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Pengingat Jadwal Kuliah & Tugas berjalan.' });
});

function generateNotifications() {
  const today = new Date();
  const todayDate = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = days[today.getDay()];

  const allUsers = db.prepare('SELECT id FROM users').all();

  for (const user of allUsers) {
    const tugasBesok = db.prepare(
      "SELECT * FROM tugas WHERE user_id = ? AND DATE(deadline) = ? AND status = 'pending'"
    ).all(user.id, tomorrowDate);

    for (const t of tugasBesok) {
      const existing = db.prepare(
        "SELECT id FROM notifications WHERE user_id = ? AND type = 'deadline' AND related_id = ? AND DATE(created_at) = ?"
      ).get(user.id, t.id, todayDate);

      if (!existing) {
        db.prepare(
          "INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, 'deadline', ?)"
        ).run(user.id, 'Deadline Tugas Besok', `Deadline besok: ${t.judul}`, t.id);
      }
    }

    const jadwalHariIni = db.prepare(
      'SELECT * FROM jadwal WHERE user_id = ? AND hari = ?'
    ).all(user.id, todayName);

    for (const j of jadwalHariIni) {
      const existing = db.prepare(
        "SELECT id FROM notifications WHERE user_id = ? AND type = 'jadwal' AND related_id = ? AND DATE(created_at) = ?"
      ).get(user.id, j.id, todayDate);

      if (!existing) {
        db.prepare(
          "INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, 'jadwal', ?)"
        ).run(user.id, 'Jadwal Hari Ini', `Jadwal ${j.mata_kuliah} hari ini pukul ${j.jam_mulai}`, j.id);
      }
    }
  }
}

app.listen(PORT, () => {
  generateNotifications();
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
