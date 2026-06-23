const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function isGroupMember(userId, groupId) {
  return db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, userId);
}

function isGroupAdmin(userId, groupId) {
  return db.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
  ).get(groupId, userId, 'admin');
}

function isSuperAdmin(userId, groupId) {
  const group = db.prepare('SELECT created_by FROM groups_table WHERE id = ?').get(groupId);
  return group && group.created_by === userId;
}

function getGroupWithRole(userId, groupId) {
  return db.prepare(`
    SELECT g.*, gm.role as my_role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups_table g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
    WHERE g.id = ?
  `).get(userId, groupId);
}

router.get('/', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, gm.role as my_role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups_table g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.user.id);

  res.json(groups);
});

router.post('/', (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Nama grup wajib diisi.' });
  }

  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (db.prepare('SELECT id FROM groups_table WHERE invite_code = ?').get(inviteCode));

  const result = db.prepare(
    'INSERT INTO groups_table (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), (description || '').trim(), inviteCode, req.user.id);

  db.prepare(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, 'admin');

  const group = getGroupWithRole(req.user.id, result.lastInsertRowid);
  res.status(201).json(group);
});

router.get('/:id', (req, res) => {
  const group = getGroupWithRole(req.user.id, req.params.id);

  if (!group) {
    return res.status(404).json({ message: 'Grup tidak ditemukan.' });
  }

  const groupCreator = db.prepare('SELECT created_by FROM groups_table WHERE id = ?').get(req.params.id);
  const creatorId = groupCreator ? groupCreator.created_by : 0;

  const members = db.prepare(`
    SELECT u.id, u.username, u.email, gm.role, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY
      CASE WHEN u.id = ? THEN 0 ELSE 1 END,
      gm.role,
      gm.joined_at
  `).all(req.params.id, creatorId);

  res.json({ ...group, members });
});

router.put('/:id', (req, res) => {
  const { name, description } = req.body;

  if (!isGroupAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya admin grup yang bisa mengedit.' });
  }

  if (name !== undefined) {
    db.prepare('UPDATE groups_table SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  }
  if (description !== undefined) {
    db.prepare('UPDATE groups_table SET description = ? WHERE id = ?').run(description.trim(), req.params.id);
  }

  const group = getGroupWithRole(req.user.id, req.params.id);
  res.json(group);
});

router.delete('/:id', (req, res) => {
  if (!isSuperAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya pembuat grup yang bisa menghapus grup.' });
  }

  db.prepare('DELETE FROM groups_table WHERE id = ?').run(req.params.id);
  res.json({ message: 'Grup berhasil dihapus.' });
});

router.post('/join', (req, res) => {
  const { invite_code } = req.body;

  if (!invite_code || !invite_code.trim()) {
    return res.status(400).json({ message: 'Kode undangan wajib diisi.' });
  }

  const group = db.prepare('SELECT * FROM groups_table WHERE invite_code = ?').get(invite_code.trim().toUpperCase());
  if (!group) {
    return res.status(404).json({ message: 'Kode undangan tidak valid.' });
  }

  const existing = isGroupMember(req.user.id, group.id);
  if (existing) {
    return res.status(400).json({ message: 'Anda sudah menjadi anggota grup ini.' });
  }

  db.prepare(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
  ).run(group.id, req.user.id, 'member');

  const result = getGroupWithRole(req.user.id, group.id);

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${group.id}`).emit('group:member:join', {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: 'member',
    });
  }

  res.json(result);
});

router.post('/:id/leave', (req, res) => {
  const { id } = req.params;

  const member = isGroupMember(req.user.id, id);
  if (!member) {
    return res.status(400).json({ message: 'Anda bukan anggota grup ini.' });
  }

  if (isSuperAdmin(req.user.id, id)) {
    return res.status(400).json({ message: 'Pembuat grup tidak bisa keluar. Hapus grup saja.' });
  }

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(id, req.user.id);

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${id}`).emit('group:member:leave', { user_id: req.user.id });
  }

  res.json({ message: 'Berhasil keluar dari grup.' });
});

router.get('/:id/invite', (req, res) => {
  if (!isGroupAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya admin yang bisa melihat kode undangan.' });
  }

  const group = db.prepare('SELECT invite_code FROM groups_table WHERE id = ?').get(req.params.id);
  res.json({ invite_code: group.invite_code });
});

router.post('/:id/invite/reset', (req, res) => {
  if (!isGroupAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya admin yang bisa mereset kode undangan.' });
  }

  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (db.prepare('SELECT id FROM groups_table WHERE invite_code = ?').get(inviteCode));

  db.prepare('UPDATE groups_table SET invite_code = ? WHERE id = ?').run(inviteCode, req.params.id);
  res.json({ invite_code: inviteCode });
});

router.delete('/:id/members/:userId', (req, res) => {
  if (!isGroupAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya admin yang bisa mengeluarkan anggota.' });
  }

  if (parseInt(req.user.id) === parseInt(req.params.userId)) {
    return res.status(400).json({ message: 'Admin tidak bisa mengeluarkan diri sendiri.' });
  }

  if (isSuperAdmin(parseInt(req.params.userId), req.params.id)) {
    return res.status(400).json({ message: 'Pembuat grup (Super Admin) tidak bisa dikeluarkan.' });
  }

  db.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?'
  ).run(req.params.id, req.params.userId);

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${req.params.id}`).emit('group:member:leave', { user_id: parseInt(req.params.userId) });
  }

  res.json({ message: 'Anggota berhasil dikeluarkan.' });
});

router.put('/:id/members/:userId/role', (req, res) => {
  const { role } = req.body;

  if (!role || !['admin', 'member'].includes(role)) {
    return res.status(400).json({ message: 'Role harus admin atau member.' });
  }

  if (!isGroupAdmin(req.user.id, req.params.id)) {
    return res.status(403).json({ message: 'Hanya admin yang bisa mengubah role.' });
  }

  if (isSuperAdmin(parseInt(req.params.userId), req.params.id)) {
    return res.status(400).json({ message: 'Role Super Admin tidak bisa diubah.' });
  }

  db.prepare(
    'UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?'
  ).run(role, req.params.id, req.params.userId);

  const io = req.app.get('io');
  if (io) {
    io.to(`group:${req.params.id}`).emit('group:member:role', {
      user_id: parseInt(req.params.userId),
      role,
    });
  }

  res.json({ message: 'Role berhasil diubah.' });
});

module.exports = router;
