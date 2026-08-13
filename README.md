# ledgr

A personal-finance REST API: accounts, transactions, multi-currency conversion, recurring
rules and spending analytics. Every transaction posts against an account balance inside a
MongoDB session, so a write either updates both the ledger and the balance or neither.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20%2B-green)

## Features

- Accounts of five kinds (checking, savings, credit, investment, cash), each with its own
  currency. Deletion is a soft deactivation, so historical transactions keep their context.
- Income, expense and transfer transactions. A transfer requires a destination account and
  moves the amount across both balances.
- Balance updates are wrapped in a `mongoose` session transaction alongside the write, and
  deleting a transaction reverses its balance effect.
- Multi-currency: amounts in a foreign currency are converted to the user's base currency
  at write time and stored as `amountInBase`, so analytics never has to re-convert.
- Exchange rates are cached for one hour; on a provider failure the last known rate is
  reused and logged as stale, and if there is no cached rate at all the call throws rather
  than silently defaulting to 1.
- Recurring income and expense rules (daily, weekly, monthly, yearly), materialised into
  real transactions by a nightly cron job.
- Analytics built on MongoDB aggregation pipelines: totals and savings rate, category
  breakdown, monthly trend, and per-category spend for a given month.
- JWT authentication with bcrypt hashing (cost 12) and `select: false` on the password
  field. The process refuses to start if `JWT_SECRET` is shorter than 32 characters.
- Per-route rate limiting, request-body size cap, `express-validator` on every input, and
  field whitelists on updates rather than spreading the request body into the model.

## Architecture

```
                 express-rate-limit ─► express-validator ─► authenticate (JWT)
                                                                   │
  ┌────────────────────────────────────────────────────────────────┘
  │
  ├─ /api/auth        authController        ──► User
  ├─ /api/accounts    accountController     ──► Account
  ├─ /api/transactions transactionController ──► services/currency ──► exchangerate-api
  │                            │                                             (1h cache)
  │                            └── withTransaction: Transaction.create + Account.$inc
  ├─ /api/recurring   recurringController   ──► RecurringRule
  └─ /api/analytics   analyticsController   ──► Transaction.aggregate

  node-cron 00:00 daily ─► services/scheduler ─► RecurringRule(nextRunAt <= now)
                                                 └─► Transaction + balance + advance nextRunAt
```

The scheduler advances `nextRunAt` even when processing a rule fails. Without that, one
broken rule would re-fire on every tick forever; the cost is a skipped occurrence, which
is recoverable, instead of an unbounded retry loop, which is not.

| Directory | Contents |
|---|---|
| `src/models/` | `User`, `Account`, `Transaction`, `RecurringRule` |
| `src/routes/` | Route definitions and validation chains |
| `src/controllers/` | Request handling and aggregation pipelines |
| `src/services/` | `currency` (rates + cache), `scheduler` (cron) |
| `src/middleware/` | JWT bearer-token authentication |
| `src/config/` | Mongo connection, Winston logger |

## Quickstart

```bash
cp .env.example .env
npm install
npm run dev          # nodemon on src/index.js
```

Or with Docker, which brings up MongoDB alongside the API:

```bash
docker-compose up
```

The Dockerfile is multi-stage and runs as a non-root user, installing production
dependencies only.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `MONGODB_URI` | `mongodb://localhost:27017/ledgr` | |
| `JWT_SECRET` | — | required, minimum 32 characters or the process exits |
| `JWT_EXPIRES_IN` | `7d` | |
| `EXCHANGE_RATE_API_KEY` | — | exchangerate-api.com v6 key |
| `BASE_CURRENCY` | `USD` | |
| `CLIENT_URL` | — | CORS origin; CORS is disabled if unset |

Note that balance updates use `session.withTransaction`, which requires a replica set. A
standalone `mongod` will reject those writes.

## API

`GET /health` is open. Everything below requires `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a user, returns a JWT |
| `POST` | `/api/auth/login` | Exchange credentials for a JWT |
| `GET` | `/api/auth/me` | Current user |

### Accounts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/accounts` | Create an account |
| `GET` | `/api/accounts` | List active accounts |
| `GET` | `/api/accounts/:id` | Fetch one |
| `PUT` | `/api/accounts/:id` | Update name, institution, currency, isActive |
| `DELETE` | `/api/accounts/:id` | Deactivate |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transactions` | Create; `toAccountId` required when `type` is `transfer` |
| `GET` | `/api/transactions` | Filter by `account`, `category`, `type`, `from`, `to`; `page`, `limit` (max 100) |
| `GET` | `/api/transactions/:id` | Fetch one |
| `PUT` | `/api/transactions/:id` | Update whitelisted fields |
| `DELETE` | `/api/transactions/:id` | Delete and reverse the balance effect |

### Recurring rules

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/recurring` | Create a rule (`frequency`, `nextRunAt`) |
| `GET` | `/api/recurring` | List rules |
| `GET` | `/api/recurring/:id` | Fetch one |
| `PUT` | `/api/recurring/:id` | Update, including `isActive` |
| `DELETE` | `/api/recurring/:id` | Delete |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/summary` | Income, expenses, net savings, savings rate; `from`, `to` |
| `GET` | `/api/analytics/by-category` | Totals per category; `type` (default `expense`), `from`, `to` |
| `GET` | `/api/analytics/trend` | Monthly totals by type; `months` (1–24, default 6) |
| `GET` | `/api/analytics/budget` | Per-category spend for a month; `month`, `year` |

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"correcthorse","name":"Me"}' | jq -r .token)

curl -X POST localhost:3000/api/transactions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"accountId":"<id>","type":"expense","amount":42.5,"currency":"EUR","category":"Groceries"}'
```

Responses follow `{ success, ... }`, with `{ success: false, error }` or
`{ success: false, errors: [...] }` on failure.

## Tech stack

Node.js 20 · Express 4 · MongoDB / Mongoose 8 · JWT + bcryptjs · node-cron · Winston ·
express-validator · Docker · Jest + Supertest

## Testing

```bash
npm test
```

Jest and Supertest against an in-memory MongoDB replica set
(`mongodb-memory-server`), which is what makes the session-based balance writes testable
without a real cluster. The scheduler and the exchange-rate service are stubbed, so the
suite makes no network calls. Suites cover auth, transactions and analytics. GitHub
Actions runs the same command on push and pull request (`.github/workflows/ci.yml`).

## Known limitations

- `PUT /api/transactions/:id` edits the record but does not re-apply the difference to the
  account balance. Amend by deleting and re-creating.
- Budget endpoints report spend per category; there are no stored budget limits to compare
  against yet.
- The exchange-rate cache is per-process and in memory.

## License

MIT
