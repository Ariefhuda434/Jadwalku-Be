jest.mock('../src/whatsappService');
jest.mock('../src/pushService');
jest.mock('../src/socket');

const request = require('supertest');
const { app } = require('../src/app');

describe('GET /api/search', () => {
  let token;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'searchuser', email: 'search@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'search@test.com', password: 'password123' });
    token = res.body.token;
  });

  afterAll(() => {
    const db = require('../src/database');
    db.prepare('DELETE FROM users WHERE email = ?').run('search@test.com');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns jadwal and tugas arrays', async () => {
    const res = await request(app)
      .get('/api/search?q=test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jadwal');
    expect(res.body).toHaveProperty('tugas');
    expect(Array.isArray(res.body.jadwal)).toBe(true);
    expect(Array.isArray(res.body.tugas)).toBe(true);
  });
});
