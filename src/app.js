require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const db = require('./database');

const authRoutes = require('./routes/auth');
const jadwalRoutes = require('./routes/jadwal');
const tugasRoutes = require('./routes/tugas');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const groupsRoutes = require('./routes/groups');
const announcementsRoutes = require('./routes/announcements');
const pushRoutes = require('./routes/push');
const profileRoutes = require('./routes/profile');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/tugas', tugasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/groups/:id/announcements', announcementsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Pengingat Jadwal Kuliah & Tugas berjalan.' });
});

module.exports = { app, server, db };
