# JadwalKu - Backend API

Express + SQLite API untuk aplikasi pengingat jadwal kuliah dan tugas.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT + bcryptjs

## Struktur

```
backend/
├── src/
│   ├── index.js           # Entry point
│   ├── database.js        # Koneksi & migrasi DB
│   ├── notificationService.js  # Generator notifikasi
│   ├── middleware/
│   │   └── auth.js        # Verifikasi JWT
│   └── routes/
│       ├── auth.js        # Register & Login
│       ├── jadwal.js      # CRUD jadwal
│       ├── tugas.js       # CRUD tugas
│       ├── dashboard.js   # Dashboard summary
│       ├── search.js      # Pencarian global
│       └── notifications.js   # Notifikasi
├── seed.js                # Seed data dummy
├── Dockerfile
└── package.json
```

## Setup

```bash
npm install
cp ../.env.example ../.env  # atau isi manual
npm run dev
```

Berjalan di `http://localhost:3001`.

## Seed Data

```bash
node seed.js
```

Membuat user `test@example.com` / `123456` dengan 11 jadwal & 10 tugas dummy.

## API Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | - | Register |
| POST | `/api/auth/login` | - | Login |
| GET | `/api/jadwal` | ✓ | List jadwal (`?search=&hari=`) |
| POST | `/api/jadwal` | ✓ | Tambah jadwal |
| PUT | `/api/jadwal/:id` | ✓ | Edit jadwal |
| DELETE | `/api/jadwal/:id` | ✓ | Hapus jadwal |
| GET | `/api/tugas` | ✓ | List tugas (`?search=&status=`) |
| POST | `/api/tugas` | ✓ | Tambah tugas |
| PUT | `/api/tugas/:id` | ✓ | Edit tugas |
| DELETE | `/api/tugas/:id` | ✓ | Hapus tugas |
| GET | `/api/dashboard` | ✓ | Ringkasan dashboard |
| GET | `/api/search?q=` | ✓ | Pencarian global |
| GET | `/api/notifications` | ✓ | List notifikasi |
| PUT | `/api/notifications/read-all` | ✓ | Tandai semua dibaca |
| PUT | `/api/notifications/:id/read` | ✓ | Tandai satu dibaca |
