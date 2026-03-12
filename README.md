# ledgr

> A developer-first double-entry bookkeeping API. Multi-currency, recurring transactions, spending analytics, and a clean REST interface. Think Plaid without the enterprise contract.

## Features

- **Multi-currency support** — live exchange rates with 1-hour cache
- **Recurring transactions** — cron-scheduled income/expense rules (daily, weekly, monthly, yearly)
- **Spending analytics** — MongoDB aggregation pipelines for category breakdowns, monthly trends, and savings rate
- **Budget tracking** — per-category spending status for any given month
- **JWT authentication** — secure, stateless auth with bcrypt password hashing
- **Docker-ready** — multi-stage Dockerfile + docker-compose with MongoDB

## Quick Start

```bash
cp .env.example .env
# fill in your MONGODB_URI, JWT_SECRET, EXCHANGE_RATE_API_KEY

npm install
npm run dev
```

Or with Docker:

```bash
docker-compose up
```

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user profile |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Create a transaction |
| GET | `/api/transactions` | List with filters (account, category, type, from, to) |
| GET | `/api/transactions/:id` | Get a single transaction |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Income, expenses, savings rate |
| GET | `/api/analytics/by-category` | Breakdown by category |
| GET | `/api/analytics/trend` | Monthly income/expense trend |
| GET | `/api/analytics/budget` | Category spending for a given month |

## Tech Stack

Node.js · Express · MongoDB (Mongoose) · JWT · node-cron · Winston · Docker
