'use strict';

const request = require('supertest');

jest.mock('../src/config/db', () => jest.fn().mockResolvedValue());
jest.mock('../src/services/scheduler', () => ({ schedulerInit: jest.fn() }));
jest.mock('../src/models/User');

const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const app = require('../src/index');

const validUser = { email: 'test@ledgr.dev', password: 'Password1!', name: 'Test User' };

describe('POST /api/auth/register', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 201 on successful registration', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'uid1', ...validUser, baseCurrency: 'USD' });
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 409 on duplicate email', async () => {
    User.findOne.mockResolvedValue({ email: validUser.email });
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 and token on valid credentials', async () => {
    const hashed = await bcrypt.hash('Password1!', 12);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({
      _id: 'uid1', email: validUser.email, name: validUser.name,
      password: hashed, comparePassword: (p) => bcrypt.compare(p, hashed),
    })});
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email, password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const hashed = await bcrypt.hash('CorrectPass1!', 12);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({
      _id: 'uid1', email: validUser.email, password: hashed,
      comparePassword: (p) => bcrypt.compare(p, hashed),
    })});
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email, password: 'WrongPass' });
    expect(res.status).toBe(401);
  });
});
