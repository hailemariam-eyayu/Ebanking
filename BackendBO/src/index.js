process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const authRoutes          = require('./routes/auth');
const customerRoutes      = require('./routes/customer');
const userRoutes          = require('./routes/users');
const roleRoutes          = require('./routes/roles');
const internetBankingRoutes = require('./routes/internetBanking');

const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5002;

app.use(cors({
  origin: [
    'http://localhost:5173',  // Backoffice dev
    'http://localhost:4173',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// ── Back-Office routes  /api/bo/* ─────────────────────────────────────────────
app.use('/api/bo/auth',      authRoutes);
app.use('/api/bo/customers', customerRoutes);
app.use('/api/bo/users',     userRoutes);
app.use('/api/bo/roles',     roleRoutes);
app.use('/api/bo/ib',        internetBankingRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backoffice', ts: new Date() }));

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  Back-Office API running on port ${PORT}`);
});
