'use strict';

// Set env before requiring app
process.env.JWT_SECRET = 'test-secret-key-must-be-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1d';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/db');

// Stub scheduler and currency service
jest.mock('../src/services/scheduler', () => ({ schedulerInit: jest.fn() }));
jest.mock('../src/services/currency', () => ({
  getExchangeRate: jest.fn().mockResolvedValue(1.0),
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

// Helper: create a user + account + token
async function setup() {
  const user = await User.create({
    email: 'analytics@ledgr.dev',
    password: 'Password1!',
    name: 'Analytics Tester',
    baseCurrency: 'USD',
  });
  const account = await Account.create({
    user: user._id,
    name: 'Main',
    type: 'checking',
    currency: 'USD',
    balance: 0,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return { user, account, token };
}

// Helper: seed transactions for a user
async function seedTransactions(userId, accountId) {
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 15); // Jan 15 this year
  const feb = new Date(now.getFullYear(), 1, 10); // Feb 10 this year

  await Transaction.insertMany([
    {
      user: userId, account: accountId, type: 'income',
      amount: 3000, currency: 'USD', amountInBase: 3000,
      category: 'Salary', date: jan,
    },
    {
      user: userId, account: accountId, type: 'expense',
      amount: 500, currency: 'USD', amountInBase: 500,
      category: 'Food', date: jan,
    },
    {
      user: userId, account: accountId, type: 'expense',
      amount: 200, currency: 'USD', amountInBase: 200,
      category: 'Transport', date: jan,
    },
    {
      user: userId, account: accountId, type: 'income',
      amount: 1000, currency: 'USD', amountInBase: 1000,
      category: 'Freelance', date: feb,
    },
    {
      user: userId, account: accountId, type: 'expense',
      amount: 300, currency: 'USD', amountInBase: 300,
      category: 'Food', date: feb,
    },
  ]);
}

// ── GET /api/analytics/summary ──────────────────────────────────────────────────

describe('GET /api/analytics/summary', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(401);
  });

  it('returns zero summary when no transactions exist', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalIncome).toBe(0);
    expect(res.body.data.totalExpenses).toBe(0);
    expect(res.body.data.netSavings).toBe(0);
    expect(res.body.data.savingsRate).toBe(0);
  });

  it('returns correct totals for all transactions', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // income: 3000 + 1000 = 4000, expenses: 500 + 200 + 300 = 1000
    expect(res.body.data.totalIncome).toBe(4000);
    expect(res.body.data.totalExpenses).toBe(1000);
    expect(res.body.data.netSavings).toBe(3000);
    // savingsRate = (3000/4000)*100 = 75
    expect(res.body.data.savingsRate).toBeCloseTo(75, 1);
  });

  it('filters by from/to date range', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const year = new Date().getFullYear();
    const res = await request(app)
      .get(`/api/analytics/summary?from=${year}-01-01&to=${year}-01-31`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only Jan transactions: income=3000, expenses=500+200=700
    expect(res.body.data.totalIncome).toBe(3000);
    expect(res.body.data.totalExpenses).toBe(700);
    expect(res.body.data.netSavings).toBe(2300);
  });

  it('returns 400 for invalid from date', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/summary?from=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid to date', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/summary?to=bad-date-value')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('only returns data scoped to the authenticated user', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    // Create another user with transactions — should not appear in the response
    const other = await User.create({ email: 'other@ledgr.dev', password: 'Password1!', name: 'Other' });
    const otherAccount = await Account.create({ user: other._id, name: 'Other', type: 'checking', currency: 'USD' });
    await Transaction.create({
      user: other._id, account: otherAccount._id, type: 'income',
      amount: 99999, currency: 'USD', amountInBase: 99999, date: new Date(),
    });

    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Should NOT include the other user's 99999
    expect(res.body.data.totalIncome).toBe(4000);
  });
});

// ── GET /api/analytics/by-category ─────────────────────────────────────────────

describe('GET /api/analytics/by-category', () => {
  it('returns expense breakdown by category', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const res = await request(app)
      .get('/api/analytics/by-category')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Each item should have category, total, count
    res.body.data.forEach((item) => {
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('total');
      expect(item).toHaveProperty('count');
    });

    // Should include Food (500+300=800) and Transport (200) — sorted by total desc
    const categories = res.body.data.map((d) => d.category);
    expect(categories).toContain('Food');
    expect(categories).toContain('Transport');

    const food = res.body.data.find((d) => d.category === 'Food');
    expect(food.total).toBe(800);
    expect(food.count).toBe(2);
  });

  it('filters income categories when type=income', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const res = await request(app)
      .get('/api/analytics/by-category?type=income')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const categories = res.body.data.map((d) => d.category);
    expect(categories).toContain('Salary');
    expect(categories).toContain('Freelance');
    // Expense categories should not appear
    expect(categories).not.toContain('Food');
  });

  it('returns empty array when no transactions match', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/by-category')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('filters by date range', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const year = new Date().getFullYear();
    const res = await request(app)
      .get(`/api/analytics/by-category?from=${year}-01-01&to=${year}-01-31`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only Jan expenses: Food=500, Transport=200
    const food = res.body.data.find((d) => d.category === 'Food');
    expect(food.total).toBe(500);
    expect(food.count).toBe(1);
  });

  it('returns 400 for invalid from date', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/by-category?from=garbage')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/analytics/trend ────────────────────────────────────────────────────

describe('GET /api/analytics/trend', () => {
  it('returns 200 with monthly trend data', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const res = await request(app)
      .get('/api/analytics/trend')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/analytics/trend');
    expect(res.status).toBe(401);
  });

  it('accepts months param and returns grouped data', async () => {
    const { user, account, token } = await setup();
    await seedTransactions(user._id, account._id);

    const res = await request(app)
      .get('/api/analytics/trend?months=12')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Each item should have _id with year/month/type and total
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('_id');
      expect(item._id).toHaveProperty('year');
      expect(item._id).toHaveProperty('month');
      expect(item._id).toHaveProperty('type');
      expect(item).toHaveProperty('total');
    }
  });

  it('returns empty array for user with no transactions', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/trend')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── GET /api/analytics/budget ───────────────────────────────────────────────────

describe('GET /api/analytics/budget', () => {
  it('returns 200 with budget spending by category for current month', async () => {
    const { user, account, token } = await setup();

    // Create expenses in the current month
    const now = new Date();
    await Transaction.insertMany([
      {
        user: user._id, account: account._id, type: 'expense',
        amount: 400, currency: 'USD', amountInBase: 400,
        category: 'Rent', date: now,
      },
      {
        user: user._id, account: account._id, type: 'expense',
        amount: 150, currency: 'USD', amountInBase: 150,
        category: 'Utilities', date: now,
      },
      // income should NOT appear in budget
      {
        user: user._id, account: account._id, type: 'income',
        amount: 5000, currency: 'USD', amountInBase: 5000,
        category: 'Salary', date: now,
      },
    ]);

    const res = await request(app)
      .get('/api/analytics/budget')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('period');
    expect(res.body.period).toHaveProperty('year');
    expect(res.body.period).toHaveProperty('month');
    expect(Array.isArray(res.body.data)).toBe(true);

    const categories = res.body.data.map((d) => d.category);
    expect(categories).toContain('Rent');
    expect(categories).toContain('Utilities');
    // Income category should not appear
    expect(categories).not.toContain('Salary');

    const rent = res.body.data.find((d) => d.category === 'Rent');
    expect(rent.spent).toBe(400);
  });

  it('accepts month and year params', async () => {
    const { user, account, token } = await setup();

    // Create a past-month expense
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    await Transaction.create({
      user: user._id, account: account._id, type: 'expense',
      amount: 250, currency: 'USD', amountInBase: 250,
      category: 'Gym', date: pastDate,
    });

    const year = pastDate.getFullYear();
    const month = pastDate.getMonth() + 1;

    const res = await request(app)
      .get(`/api/analytics/budget?year=${year}&month=${month}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.period.year).toBe(year);
    expect(res.body.period.month).toBe(month);

    const gym = res.body.data.find((d) => d.category === 'Gym');
    expect(gym).toBeDefined();
    expect(gym.spent).toBe(250);
  });

  it('returns empty data array for a month with no expenses', async () => {
    const { token } = await setup();
    const res = await request(app)
      .get('/api/analytics/budget?year=2020&month=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/analytics/budget');
    expect(res.status).toBe(401);
  });
});
