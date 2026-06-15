# E-Banking Platform

Full-stack e-banking system built for **Enat Bank**, consisting of three applications:

| App | Stack | Port | Description |
|-----|-------|------|-------------|
| `Backend` | Node.js · Express · Prisma · PostgreSQL | 5002 | REST API — serves both BO and IB |
| `Backoffice` | Vite · React · Tailwind | 5173 | Back-office staff portal |
| `InternetBanking` | Vite · React · Tailwind | 5174 | Customer internet banking portal |

---

## Prerequisites

- Node.js 20+
- PostgreSQL (local: `10.1.12.120` — databases: `backoffice`, `internet_banking`)
- CBS (Oracle FLEXCUBE) SOAP endpoint access

---

## Setup

### 1. Backend

```bash
cd Backend
cp .env.example .env        # fill in real values
npm install
npx prisma generate
npx prisma db push          # creates tables in backoffice DB
node prisma/seed.js         # creates admin user + menus
npm run dev                 # starts on port 5002
```

### 2. Backoffice

```bash
cd Backoffice
npm install
npm run dev                 # starts on port 5173
```

### 3. Internet Banking

```bash
cd InternetBanking
npm install
npm run dev                 # starts on port 5174
```

---

## Default Back-Office Login

| Field    | Value           |
|----------|-----------------|
| Username | `admin`         |
| Password | `Admin@1234`    |
| Role     | Super Admin     |
| Branch   | 001             |

> Change the password immediately after first login.

---

## Architecture

```
Browser (BO)       Browser (IB)
     │                   │
     └──── Vite proxy ───┘
                │
          Express API (:5002)
                │
        ┌───────┴───────┐
        │               │
  Prisma (BO DB)   Prisma (IB DB)
  backoffice       internet_banking
        │               │
        └───────┬───────┘
           PostgreSQL
         10.1.12.120

          + CBS SOAP
     (Oracle FLEXCUBE)
```

## Maker-Checker-Approval Workflow

| Level | Type | Flow |
|-------|------|------|
| 1 | Individual | Maker → auto approved |
| 2 | Corporate (Type 1) | Maker → Checker → approved |
| 3 | Corporate (Type 2) | Maker → Checker → Approver → approved |

Transactions below the `approvalLimit` set by BO skip the workflow entirely.

---

## CBS SOAP Integration

SOAP envelopes are in `Backend/src/lib/cbsSoap.js`.  
Currently integrated:
- `QueryCustomer` — by CIF or phone
- `QueryCustAcc` — by account number

New endpoints will be added as they are provided by CBS team.
"# Ebanking" 
