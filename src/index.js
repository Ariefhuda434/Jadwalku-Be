require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./database');

const authRoutes = require('./routes/auth');
const jadwalRoutes = require('./routes/jadwal');
const tugasRoutes = require('./routes/tugas');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const { generateNotifications } = require('./notificationService');

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

app.listen(PORT, () => {
  generateNotifications();
  setInterval(generateNotifications, 6 * 60 * 60 * 1000);
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
