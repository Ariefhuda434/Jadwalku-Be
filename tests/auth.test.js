jest.mock('../src/whatsappService');
jest.mock('../src/pushService');
jest.mock('../src/socket');

const request = require('supertest');
const { app } = require('../src/app');

const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};
const xssUser = {
  username: '<script>alert(1)</script>',
  email: 'xss@test.com',
  password: 'password123',
};

afterAll(() => {
  const db = require('../src/database');
  db.prepare('DELETE FROM users WHERE email IN (?, ?, ?)').run('test@example.com', 'Test@Example.com', 'xss@test.com');
});

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'abc' });

    expect(res.status).toBe(400);
  });

  it('sanitizes XSS in username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(xssUser);

    expect(res.status).toBe(201);
    expect(res.body.user.username).not.toContain('<script>');
    expect(res.body.user.username).toContain('&lt;script&gt;');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('is case-insensitive for email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'TEST@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});
