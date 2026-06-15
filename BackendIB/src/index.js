process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const authRoutes        = require('./routes/auth');
const accountRoutes     = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const userRoutes        = require('./routes/users');
const dashboardRoutes   = require('./routes/dashboard');

const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5003;

app.use(cors({
  origin: [
    'http://localhost:5174',  // Internet Banking dev
    'http://localhost:4174',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// ── Internet Banking routes  /api/ib/* ────────────────────────────────────────
app.use('/api/ib/auth',         authRoutes);
app.use('/api/ib/accounts',     accountRoutes);
app.use('/api/ib/transactions', transactionRoutes);
app.use('/api/ib/users',        userRoutes);
app.use('/api/ib/dashboard',    dashboardRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'internet-banking', ts: new Date() }));

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  Internet Banking API running on port ${PORT}`);
});
