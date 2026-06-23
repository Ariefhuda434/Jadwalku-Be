const db = require('./database');
const { sendMessage, getStatus } = require('./whatsappService');

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function checkAndRemind() {
  const waStatus = getStatus();
  if (waStatus.status !== 'connected') {
    console.log('[Reminder] WA tidak terhubung, skip reminder');
    return;
  }

  const today = getToday();
  const tomorrow = getTomorrow();
  const now = new Date().toISOString();

  // Personal tasks — deadline hari ini atau besok, status pending
  const personalTasks = db.prepare(`
    SELECT t.*, u.phone, u.username
    FROM tugas t
    JOIN users u ON u.id = t.user_id
    WHERE t.group_id IS NULL
      AND t.status = 'pending'
      AND (t.deadline = ? OR t.deadline = ?)
      AND u.phone != ''
  `).all(today, tomorrow);

  for (const t of personalTasks) {
    const label = t.deadline === today ? 'HARI INI' : 'BESOK';
    const msg = `⏰ *PENGINGAT DEADLINE ${label}*\n\n` +
      `Halo *${t.username}*,\n\nTugas *"${t.judul}"* (${t.mata_kuliah || '-'}) deadlinenya *${label}*!\n\n` +
      `Jangan lupa dikerjakan ya! 📚\n\n- JadwalKu App`;

    try {
      await sendMessage(t.phone, msg);
      console.log(`[Reminder] WA terkirim ke ${t.username} (${t.phone}) — ${t.judul}`);
    } catch (err) {
      console.log(`[Reminder] Gagal kirim WA ke ${t.username}: ${err.message}`);
    }
  }

  // Group tasks — deadline hari ini atau besok, cek yang belum submit
  const groupTasks = db.prepare(`
    SELECT t.id as tugas_id, t.judul, t.mata_kuliah, t.deadline,
           g.name as group_name
    FROM tugas t
    JOIN groups_table g ON g.id = t.group_id
    WHERE t.group_id IS NOT NULL
      AND (t.deadline = ? OR t.deadline = ?)
  `).all(today, tomorrow);

  for (const gt of groupTasks) {
    const members = db.prepare(`
      SELECT u.id, u.username, u.phone,
             COALESCE(ts.status, 'pending') as sub_status
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      LEFT JOIN tugas_submissions ts ON ts.tugas_id = ? AND ts.user_id = u.id
      WHERE gm.group_id = (SELECT group_id FROM tugas WHERE id = ?)
        AND u.phone != ''
        AND (ts.status IS NULL OR ts.status = 'pending')
    `).all(gt.tugas_id, gt.tugas_id);

    const label = gt.deadline === today ? 'HARI INI' : 'BESOK';

    for (const m of members) {
      const msg = `⏰ *PENGINGAT DEADLINE ${label}*\n\n` +
        `Halo *${m.username}*,\n\nTugas grup *"${gt.judul}"* (${gt.mata_kuliah || '-'}) dari grup *${gt.group_name}* deadlinenya *${label}*!\n\n` +
        `Kamu *belum mengumpulkan*. Yuk segera dikerjakan! 📚\n\n- JadwalKu App`;

      try {
        await sendMessage(m.phone, msg);
        console.log(`[Reminder] WA terkirim ke ${m.username} (${m.phone}) — ${gt.judul} (grup: ${gt.group_name})`);
      } catch (err) {
        console.log(`[Reminder] Gagal kirim WA ke ${m.username}: ${err.message}`);
      }
    }
  }

  const totalPersonal = personalTasks.length;
  const totalGroupMembers = groupTasks.reduce((sum, gt) => {
    const members = db.prepare(`
      SELECT COUNT(*) as c FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      LEFT JOIN tugas_submissions ts ON ts.tugas_id = ? AND ts.user_id = u.id
      WHERE gm.group_id = (SELECT group_id FROM tugas WHERE id = ?)
        AND u.phone != ''
        AND (ts.status IS NULL OR ts.status = 'pending')
    `).get(gt.tugas_id, gt.tugas_id);
    return sum + members.c;
  }, 0);

  if (totalPersonal > 0 || totalGroupMembers > 0) {
    console.log(`[Reminder] Selesai — ${totalPersonal} personal + ${totalGroupMembers} anggota grup dikirimi WA`);
  }
}

module.exports = { checkAndRemind };
