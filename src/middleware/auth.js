const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️  PERINGATAN: JWT_SECRET tidak diatur di environment! Gunakan string acak yang aman.');
  return 'rahasia_pengingat_jadwal_2024';
})();

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Token tidak disediakan.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token tidak valid.' });
  }
}

module.exports = { verifyToken, JWT_SECRET };
