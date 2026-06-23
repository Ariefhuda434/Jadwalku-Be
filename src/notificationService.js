const db = require('./database');
const { sendPushToUser } = require('./pushService');

function getLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function generateNotifications() {
  const now = new Date();
  const todayDate = getLocalDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = getLocalDate(tomorrow);
  const todayName = DAYS[now.getDay()];

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

        sendPushToUser(user.id, 'Deadline Tugas Besok', `Deadline besok: ${t.judul}`);
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

        sendPushToUser(user.id, 'Jadwal Hari Ini', `Jadwal ${j.mata_kuliah} hari ini pukul ${j.jam_mulai}`);
      }
    }
  }
}

module.exports = { generateNotifications };
