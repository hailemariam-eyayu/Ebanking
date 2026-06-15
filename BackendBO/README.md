# BackendBO — Back-Office API

Express.js API for the Backoffice portal. Runs on **port 5002**.

## Setup

```bash
cd BackendBO
npm install
```

Copy `.env.example` to `.env` and fill in your values.

## Database

Connects to the `backoffice` PostgreSQL database. Also needs `IB_DATABASE_URL`
for IB management routes (activate/block customers etc.).

```bash
npm run db:push     # push schema to DB (no migration history)
npm run db:migrate  # run migrations
npm run db:seed     # seed roles, menus, admin users
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
| POST | /api/bo/auth/login | Login |
| GET  | /api/bo/auth/me | Current user |
| GET  | /api/bo/customers/search | Search CBS customer |
| GET  | /api/bo/customers/:custNo | Get customer |
| GET  | /api/bo/users | List BO users |
| POST | /api/bo/users | Create BO user |
| GET  | /api/bo/roles | List roles |
| POST | /api/bo/roles | Create role |
| GET  | /api/bo/ib/customers | List IB customers |
| POST | /api/bo/ib/activate | Activate IB for customer |

## Sample Logins (after seed)

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@1234 | Super Admin |
| hailemariam | Admin@1234 | Super Admin |
| branch_mgr | Admin@1234 | Branch Manager |
| teller01 | Admin@1234 | Teller |
