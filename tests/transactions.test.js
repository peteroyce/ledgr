'use strict';

// Set env before requiring app
process.env.JWT_SECRET = 'test-secret-key-must-be-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1d';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const db = require('./helpers/db');

// Stub scheduler and currency service
jest.mock('../src/services/scheduler', () => ({ schedulerInit: jest.fn() }));
jest.mock('../src/services/currency', () => ({
  getExchangeRate: jest.fn().mockResolvedValue(1.2),
}));

let app;
let User;
let Account;
let Transaction;

beforeAll(async () => {
  await db.connect();
  app = require('../src/index');
  User = require('../src/models/User');
  Account = require('../src/models/Account');
  Transaction = require('../src/models/Transaction');
});

afterAll(async () => {
  await db.disconnect();
});

afterEach(async () => {
  await db.clearCollections();
  jest.clearAllMocks();
});

// Helper: create a user + account, return { token, user, account }
async function createUserAndAccount() {
  const user = await User.create({
    email: 'txtest@ledgr.dev',
    password: 'Password1!',
    name: 'TX Tester',
    baseCurrency: 'USD',
  });
  const account = await Account.create({
    user: user._id,
    name: 'Checking',
    type: 'checking',
    currency: 'USD',
    balance: 1000,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return { user, account, token };
}

// ── Create transaction ──────────────────────────────────────────────────────────

describe('POST /api/transactions', () => {
  it('creates a transaction and returns 201', async () => {
    const { account, token } = await createUserAndAccount();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account._id.toString(),
        type: 'expense',
        amount: 50,
        currency: 'USD',
        category: 'Food',
        description: 'Lunch',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.amount).toBe(50);
    expect(res.body.transaction.type).toBe('expense');
  });

  it('returns 404 if account not found or not owned by user', async () => {
    const { token } = await createUserAndAccount();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: fakeId, type: 'expense', amount: 50, currency: 'USD' });
    expect(res.status).toBe(404);
  });

  it('returns 400 if amount is zero or negative', async () => {
    const { account, token } = await createUserAndAccount();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account._id.toString(), type: 'expense', amount: -10, currency: 'USD' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 if type is invalid', async () => {
    const { account, token } = await createUserAndAccount();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account._id.toString(), type: 'invalid_type', amount: 50, currency: 'USD' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 if accountId is not a valid ObjectId', async () => {
    const { token } = await createUserAndAccount();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: '$$notAnId$$', type: 'expense', amount: 50, currency: 'USD' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ accountId: 'acc1', type: 'expense', amount: 50, currency: 'USD' });
    expect(res.status).toBe(401);
  });
});

// ── List transactions with pagination ──────────────────────────────────────────

describe('GET /api/transactions', () => {
  it('returns paginated transaction list', async () => {
    const { user, account, token } = await createUserAndAccount();

    // Create 5 transactions
    for (let i = 1; i <= 5; i++) {
      await Transaction.create({
        user: user._id, account: account._id, type: 'expense',
        amount: i * 10, currency: 'USD', amountInBase: i * 10,
        category: 'Test', date: new Date(),
      });
    }

    const res = await request(app)
      .get('/api/transactions?page=1&limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.pages).toBe(2);
    expect(res.body.pagination.limit).toBe(3);
    expect(res.body.pagination.page).toBe(1);
  });

  it('enforces pagination upper bound: limit capped at 100', async () => {
    const { token } = await createUserAndAccount();
    const res = await request(app)
      .get('/api/transactions?page=1&limit=9999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it('enforces pagination lower bound: page cannot be 0', async () => {
    const { token } = await createUserAndAccount();
    const res = await request(app)
      .get('/api/transactions?page=0&limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  it('enforces pagination upper bound: page capped at 1000', async () => {
    const { token } = await createUserAndAccount();
    const res = await request(app)
      .get('/api/transactions?page=9999&limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1000);
  });
});

// ── Get single transaction ──────────────────────────────────────────────────────

describe('GET /api/transactions/:id', () => {
  it('returns a single transaction by id', async () => {
    const { user, account, token } = await createUserAndAccount();
    const tx = await Transaction.create({
      user: user._id, account: account._id, type: 'income',
      amount: 200, currency: 'USD', amountInBase: 200,
      category: 'Salary', date: new Date(),
    });

    const res = await request(app)
      .get(`/api/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction._id).toBe(tx._id.toString());
  });

  it('returns 404 for a transaction that belongs to another user', async () => {
    const { account, token } = await createUserAndAccount();

    // Create a second user's transaction
    const otherUser = await User.create({
      email: 'other@ledgr.dev', password: 'Password1!', name: 'Other',
    });
    const tx = await Transaction.create({
      user: otherUser._id, account: account._id, type: 'expense',
      amount: 50, currency: 'USD', amountInBase: 50, date: new Date(),
    });

    const res = await request(app)
      .get(`/api/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── Update transaction ──────────────────────────────────────────────────────────

describe('PUT /api/transactions/:id', () => {
  it('updates a transaction successfully', async () => {
    const { user, account, token } = await createUserAndAccount();
    const tx = await Transaction.create({
      user: user._id, account: account._id, type: 'expense',
      amount: 100, currency: 'USD', amountInBase: 100,
      category: 'Food', date: new Date(),
    });

    const res = await request(app)
      .put(`/api/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Groceries', description: 'Weekly shop' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.category).toBe('Groceries');
    expect(res.body.transaction.description).toBe('Weekly shop');
  });

  it('returns 404 when updating a transaction owned by another user (ownership check)', async () => {
    const { token } = await createUserAndAccount();

    const otherUser = await User.create({
      email: 'other2@ledgr.dev', password: 'Password1!', name: 'Other2',
    });
    const otherAccount = await Account.create({
      user: otherUser._id, name: 'Other Account', type: 'checking',
      currency: 'USD', balance: 0,
    });
    const tx = await Transaction.create({
      user: otherUser._id, account: otherAccount._id, type: 'expense',
      amount: 75, currency: 'USD', amountInBase: 75, date: new Date(),
    });

    const res = await request(app)
      .put(`/api/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Hacked' });

    expect(res.status).toBe(404);
  });

  it('strips NoSQL injection attempts from update body', async () => {
    const { user, account, token } = await createUserAndAccount();
    const tx = await Transaction.create({
      user: user._id, account: account._id, type: 'expense',
      amount: 100, currency: 'USD', amountInBase: 100,
      category: 'Original', date: new Date(),
    });

    // Attempt to inject a MongoDB operator via update body
    const res = await request(app)
      .put(`/api/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Safe',
        // These fields are NOT in the whitelist and should be stripped
        user: 'hacked-user-id',
        __proto__: { isAdmin: true },
        $set: { user: 'overwrite' },
        _id: 'newid',
      });

    expect(res.status).toBe(200);
    expect(res.body.transaction.category).toBe('Safe');
    // user field must not have been changed
    expect(res.body.transaction.user.toString()).toBe(user._id.toString());
  });
});
