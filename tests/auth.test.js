'use strict';

// Set env before requiring app
process.env.JWT_SECRET = 'test-secret-key-must-be-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1d';

const request = require('supertest');
const db = require('./helpers/db');

// Stub the scheduler so it doesn't try to connect to cron jobs
jest.mock('../src/services/scheduler', () => ({ schedulerInit: jest.fn() }));

// We require the app AFTER setting env so JWT_SECRET validation passes
let app;

beforeAll(async () => {
  await db.connect();
  // Require app after DB is ready so mongoose models register against in-memory DB
  app = require('../src/index');
});

afterAll(async () => {
  await db.disconnect();
});

afterEach(async () => {
  await db.clearCollections();
  jest.clearAllMocks();
});

const validUser = {
  email: 'test@ledgr.dev',
  password: 'Password1!',
  name: 'Test User',
};

// ── Register ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 and a token on successful registration', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(validUser.email);
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── Login ───────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Register a user to log in with
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('returns 200 and a token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@ledgr.dev', password: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
