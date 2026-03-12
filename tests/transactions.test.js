'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-ok';

jest.mock('../src/config/db', () => jest.fn().mockResolvedValue());
jest.mock('../src/services/scheduler', () => ({ schedulerInit: jest.fn() }));
jest.mock('../src/models/Transaction');
jest.mock('../src/models/Account');
jest.mock('../src/models/User');
jest.mock('../src/services/currency', () => ({ getExchangeRate: jest.fn().mockResolvedValue(1) }));

const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Account = require('../src/models/Account');
const app = require('../src/index');

const mockUser = { _id: 'uid1', email: 'test@ledgr.dev', baseCurrency: 'USD' };
const token = jwt.sign({ id: mockUser._id }, process.env.JWT_SECRET);

beforeEach(() => {
  User.findById = jest.fn().mockResolvedValue(mockUser);
});

afterEach(() => jest.clearAllMocks());

describe('POST /api/transactions', () => {
  it('creates a transaction and returns 201', async () => {
    Account.findOne.mockResolvedValue({ _id: 'acc1', currency: 'USD' });
    Account.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    Transaction.create.mockResolvedValue({ _id: 'tx1', amount: 100, type: 'expense' });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: 'acc1', type: 'expense', amount: 100, currency: 'USD', category: 'Food' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 if account not found', async () => {
    Account.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: 'bad', type: 'expense', amount: 50, currency: 'USD' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/transactions', () => {
  it('returns paginated transaction list', async () => {
    Transaction.find.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ populate: () => [{ _id: 'tx1' }] }) }) }),
    });
    Transaction.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });
});
