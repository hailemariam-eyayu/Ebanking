# BackendIB — Internet Banking API

Express.js API for the Internet Banking portal. Runs on **port 5003**.

## Setup

```bash
cd BackendIB
npm install
```

Copy `.env.example` to `.env` and fill in your values.

## Database

Connects to the `internet_banking` PostgreSQL database.

```bash
npm run db:push     # push schema to DB (no migration history)
npm run db:migrate  # run migrations
npm run db:seed     # seed IB customers and users
npm run db:studio   # open Prisma Studio
```

## Run

```bash
npm run dev    # development (nodemon)
npm start      # production
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/ib/auth/login | Login |
| GET  | /api/ib/auth/me | Current user |
| GET  | /api/ib/dashboard | Dashboard stats |
| GET  | /api/ib/accounts | Customer accounts |
| POST | /api/ib/transactions | Submit transaction |
| GET  | /api/ib/transactions | List transactions |
| GET  | /api/ib/transactions/pending | Checker/approver queue |
| POST | /api/ib/transactions/:id/approve | Approve transaction |
| POST | /api/ib/transactions/:id/reject | Reject transaction |

## Sample Logins (after seed, password: IB@1234)

| Username | Role | Level |
|----------|------|-------|
| abenezer.desta | OWNER | 1 (Individual) |
| selam.maker | MAKER | 2 (Corporate) |
| selam.checker | CHECKER | 2 (Corporate) |
| selam.viewer | VIEWER | 2 (Corporate) |
| aaca.maker | MAKER | 3 (Government) |
| aaca.checker | CHECKER | 3 (Government) |
| aaca.approver | APPROVER | 3 (Government) |
