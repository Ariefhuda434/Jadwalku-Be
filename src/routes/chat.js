const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const { sanitize } = require('../sanitize');

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

function isGroupMember(userId, groupId) {
  return db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, userId);
}

router.get('/', (req, res) => {
  const { id } = req.params;
  const { before } = req.query;
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  if (!isGroupMember(req.user.id, id)) {
    return res.status(403).json({ message: 'Anda bukan anggota grup ini.' });
  }

  let query;
  let params;

  if (before) {
    query = `
      SELECT cm.*, u.username, u.email
      FROM chat_messages cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.group_id = ? AND cm.id < ?
      ORDER BY cm.created_at DESC
      LIMIT ?
    `;
    params = [id, before, limit];
  } else {
    query = `
      SELECT cm.*, u.username, u.email
      FROM chat_messages cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.group_id = ?
      ORDER BY cm.created_at DESC
      LIMIT ?
    `;
    params = [id, limit];
  }

  const messages = db.prepare(query).all(...params).reverse();
  res.json(messages);
});

router.post('/', (req, res) => {
  const { id } = req.params;
  const { message } = sanitize(req.body, ['message']);

  if (!isGroupMember(req.user.id, id)) {
    return res.status(403).json({ message: 'Anda bukan anggota grup ini.' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Pesan tidak boleh kosong.' });
  }

  const result = db.prepare(
    'INSERT INTO chat_messages (group_id, user_id, message) VALUES (?, ?, ?)'
  ).run(id, req.user.id, message.trim());

  const msg = db.prepare(`
    SELECT cm.*, u.username, u.email
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.id = ?
  `).get(result.lastInsertRowid);

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${id}`).emit('group:chat:message', msg);
  }

  res.status(201).json(msg);
});

module.exports = router;
