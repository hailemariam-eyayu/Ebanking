// Must be set before any TLS connections are made
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const boAuthRoutes     = require('./routes/bo/auth');
const boCustomerRoutes = require('./routes/bo/customer');
const boUserRoutes     = require('./routes/bo/users');
const boRoleRoutes     = require('./routes/bo/roles');
const boIBRoutes       = require('./routes/bo/internetBanking');

const ibAuthRoutes    = require('./routes/ib/auth');
const ibAccountRoutes = require('./routes/ib/accounts');
const ibTxnRoutes     = require('./routes/ib/transactions');
const ibUserRoutes    = require('./routes/ib/users');
const ibDashRoutes    = require('./routes/ib/dashboard');

const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',  // Backoffice dev
    'http://localhost:5174',  // IB dev
    'http://localhost:4173',
    'http://localhost:4174',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// ── Back-Office routes  /api/bo/* ─────────────────────────────────────────────
app.use('/api/bo/auth',     boAuthRoutes);
app.use('/api/bo/customers',boCustomerRoutes);
app.use('/api/bo/users',    boUserRoutes);
app.use('/api/bo/roles',    boRoleRoutes);
app.use('/api/bo/ib',       boIBRoutes);

// ── Internet Banking routes  /api/ib/* ────────────────────────────────────────
app.use('/api/ib/auth',        ibAuthRoutes);
app.use('/api/ib/accounts',    ibAccountRoutes);
app.use('/api/ib/transactions',ibTxnRoutes);
app.use('/api/ib/users',       ibUserRoutes);
app.use('/api/ib/dashboard',   ibDashRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅  E-Banking API running on port ${PORT}`);
});
