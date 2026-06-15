# E-Banking Backend

Express.js API serving both **Back Office** and **Internet Banking** frontends.

## Stack
- Express 4, Node.js
- Prisma ORM → PostgreSQL (Neon)
- JWT authentication (separate tokens for BO and IB)
- SOAP → CBS (Oracle FLEXCUBE) via raw XML + axios + xml2js

## Running

```bash
npm install
npm run db:generate   # generate Prisma client
npm run db:migrate    # push schema to Neon
npm run dev           # nodemon, port 5001
```

## Environment Variables

| Key | Description |
|-----|-------------|
| `BO_DATABASE_URL` | Neon PostgreSQL for Back Office |
| `IB_DATABASE_URL` | Neon PostgreSQL for Internet Banking |
| `JWT_SECRET` | Secret for signing JWTs |
| `CBS_SOAP_URL` | FLEXCUBE Customer Service WSDL URL |
| `CBS_ACC_SOAP_URL` | FLEXCUBE Account Service WSDL URL |
| `CBS_SOURCE` | CBS source identifier (default: ADC) |
| `CBS_USER` | CBS user (default: ADCUSER) |
| `CBS_BRANCH` | Default branch code |

## API Namespaces

| Prefix | Description |
|--------|-------------|
| `/api/bo/auth` | Back Office login / me |
| `/api/bo/customers` | CBS customer search (proxy) |
| `/api/bo/users` | BO staff management |
| `/api/bo/roles` | Roles & menu rights |
| `/api/bo/ib` | IB customer activation & sub-user management |
| `/api/ib/auth` | IB login / me |
| `/api/ib/accounts` | CBS account proxy |
| `/api/ib/transactions` | Maker-Checker-Approval transactions |
| `/api/ib/users` | IB sub-user self-service |
| `/api/ib/dashboard` | IB stats |

## CBS SOAP Endpoints Integrated
- `QueryCustomer` — by CIF or phone
- `QueryCustAcc` — by account number

> New CBS endpoints will be added as they are provided. Drop the envelope XML in `src/lib/cbsSoap.js`.
