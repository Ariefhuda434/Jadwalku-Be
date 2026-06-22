const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const jadwalRoutes = require('./routes/jadwal');
const tugasRoutes = require('./routes/tugas');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/tugas', tugasRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Pengingat Jadwal Kuliah & Tugas berjalan.' });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
