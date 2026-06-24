const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const { sendPushToUser } = require('../pushService');
const { sendMessage, getStatus } = require('../whatsappService');
const { sanitize } = require('../sanitize');

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

function isGroupAdmin(userId, groupId) {
  return db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
  ).get(groupId, userId, 'admin');
}

function isGroupMember(userId, groupId) {
  return db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, userId);
}

function isSuperAdmin(userId, groupId) {
  const group = db.prepare('SELECT created_by FROM groups_table WHERE id = ?').get(groupId);
  return group && group.created_by === userId;
}

router.get('/', (req, res) => {
  const { id } = req.params;

  if (!isGroupMember(req.user.id, id)) {
    return res.status(403).json({ message: 'Anda bukan anggota grup ini.' });
  }

  const announcements = db.prepare(`
    SELECT a.*, u.username as author_name
    FROM group_announcements a
    JOIN users u ON u.id = a.user_id
    WHERE a.group_id = ?
    ORDER BY a.created_at DESC
  `).all(id);

  res.json(announcements);
});

router.post('/', (req, res) => {
  const { id } = req.params;
  const { title, message, type } = sanitize(req.body, ['title', 'message']);

  if (!isGroupAdmin(req.user.id, id)) {
    return res.status(403).json({ message: 'Hanya admin yang bisa membuat pengumuman.' });
  }

  if (!title || !title.trim() || !message || !message.trim()) {
    return res.status(400).json({ message: 'Judul dan pesan wajib diisi.' });
  }

  const result = db.prepare(
    'INSERT INTO group_announcements (group_id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.user.id, title.trim(), message.trim(), type || 'info');

  const announcement = db.prepare(`
    SELECT a.*, u.username as author_name
    FROM group_announcements a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  const members = db.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?'
  ).all(id, req.user.id);

  const insertNotif = db.prepare(
    'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)'
  );

  for (const member of members) {
    const notifResult = insertNotif.run(
      member.user_id,
      title.trim(),
      message.trim(),
      'info',
      result.lastInsertRowid
    );

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifResult.lastInsertRowid);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${member.user_id}`).emit('notification:new', notification);
    }

    sendPushToUser(member.user_id, title.trim(), message.trim());

    const memberData = db.prepare('SELECT phone FROM users WHERE id = ?').get(member.user_id);
    if (memberData && memberData.phone && getStatus().status === 'connected') {
      sendMessage(memberData.phone, `📢 *${title.trim()}*\n\n${message.trim()}\n\n— ${announcement.author_name}`).catch(() => {});
    }
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${id}`).emit('group:announcement', announcement);
  }

  res.status(201).json(announcement);
});

router.delete('/:annId', (req, res) => {
  const { id, annId } = req.params;

  const ann = db.prepare('SELECT * FROM group_announcements WHERE id = ? AND group_id = ?').get(annId, id);
  if (!ann) {
    return res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
  }

  if (!isGroupAdmin(req.user.id, id) && ann.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Anda tidak memiliki izin.' });
  }

  db.prepare('DELETE FROM group_announcements WHERE id = ?').run(annId);
  res.json({ message: 'Pengumuman berhasil dihapus.' });
});

module.exports = router;
