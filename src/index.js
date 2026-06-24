const { app, server } = require('./app');
const { generateNotifications } = require('./notificationService');
const setupSocket = require('./socket');
const { initWhatsApp } = require('./whatsappService');
const { checkAndRemind } = require('./deadlineReminder');

const io = setupSocket(server);
const PORT = process.env.PORT || 3001;

app.set('io', io);

server.listen(PORT, () => {
  generateNotifications();
  setInterval(generateNotifications, 6 * 60 * 60 * 1000);
  setTimeout(checkAndRemind, 10 * 1000);
  setInterval(checkAndRemind, 60 * 60 * 1000);
  initWhatsApp(io).catch(() => {});
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
