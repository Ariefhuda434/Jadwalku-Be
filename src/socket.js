const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');
const db = require('./database');

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const groups = db.prepare(
      'SELECT group_id FROM group_members WHERE user_id = ?'
    ).all(socket.user.id);

    groups.forEach((g) => {
      socket.join(`group:${g.group_id}`);
    });

    socket.join(`user:${socket.user.id}`);
  });

  return io;
}

module.exports = setupSocket;
