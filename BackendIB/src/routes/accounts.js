/**
 * IB Accounts
 *
 * GET /api/ib/accounts        — list all active accounts for this customer,
 *                               with balance overlaid from Oracle CBS DB.
 * GET /api/ib/accounts/:accNo — single account full detail from Oracle CBS DB.
 *
 * Balance source: direct Oracle DB query against EBVW_CUST_BAL_ACCOUNT_INFO.
 * This replaces the previous SOAP approach which was unreliable.
 */
const router = require('express').Router();
const { verifyIB } = require('../middleware/auth');
const prisma  = require('../lib/prismaIB');
const oracle  = require('../lib/cbsOracle');

// ── GET /api/ib/accounts ──────────────────────────────────────────────────────
// Returns all active accounts for the customer with live balance from CBS Oracle.
router.get('/', verifyIB, async (req, res, next) => {
  try {
    const dbAccounts = await prisma.iBAccount.findMany({
      where:   { customerId: req.user.customerId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!dbAccounts.length) {
      return res.json({ accounts: [] });
    }

    // Fetch balances for all accounts in a single Oracle query
    let balanceMap = new Map();
    try {
      balanceMap = await oracle.getAccountBalances(dbAccounts.map(a => a.accountNumber));
    } catch (oracleErr) {
      // Oracle unavailable — return accounts from DB without live balance
      console.error('[accounts] Oracle balance fetch failed:', oracleErr.message);
    }

    const accounts = dbAccounts.map(acc => {
      const live = balanceMap.get(acc.accountNumber);
      return {
        accountNumber:  acc.accountNumber,
        accountClass:   live?.accountClass  ?? acc.accountClass,
        currency:       live?.currency      ?? acc.currency,
        fullName:       live?.fullName      ?? acc.fullName,
        currentBalance: live?.currentBalance ?? null,
        status:         live?.status        ?? (acc.isActive ? 'ACTIVE' : 'INACTIVE'),
        isDormant:      live?.isDormant     ?? false,
        noDebit:        live?.noDebit       ?? false,
        noCredit:       live?.noCredit      ?? false,
        isBlocked:      live?.isBlocked     ?? false,
        isFrozen:       live?.isFrozen      ?? false,
        // Keep DB fields for reference
        isActive:       acc.isActive,
        customerId:     acc.customerId,
      };
    });

    res.json({ accounts });
  } catch (err) { next(err); }
});

// ── GET /api/ib/accounts/:accountNo ──────────────────────────────────────────
// Returns full detail for a single account.
// Tries Oracle first; falls back to DB record if Oracle is unreachable.
router.get('/:accountNo', verifyIB, async (req, res, next) => {
  try {
    // Verify account belongs to this customer
    const attached = await prisma.iBAccount.findFirst({
      where: { customerId: req.user.customerId, accountNumber: req.params.accountNo },
    });
    if (!attached)
      return res.status(404).json({ message: 'Account not found or not attached to your profile' });

    // Try Oracle — gracefully fall back to DB data if unavailable
    let detail = null;
    try {
      detail = await oracle.getAccountBalance(req.params.accountNo);
    } catch (oracleErr) {
      console.error('[accounts] Oracle detail fetch failed:', oracleErr.message);
      // Fall through to DB fallback below
    }

    if (detail) {
      return res.json({
        accountNumber:  detail.accountNumber,
        accountClass:   detail.accountClass,
        currency:       detail.currency,
        custName:       detail.fullName,
        accountStatus:  detail.status,
        frozen:         detail.isFrozen,
        noDebit:        detail.noDebit,
        noCredit:       detail.noCredit,
        dormant:        detail.isDormant,
        balances: {
          currentBalance:   detail.currentBalance,
          availableBalance: detail.currentBalance,
        },
      });
    }

    // Oracle unavailable or no record — return what we have from DB
    return res.json({
      accountNumber:  attached.accountNumber,
      accountClass:   attached.accountClass,
      currency:       attached.currency,
      custName:       attached.fullName,
      accountStatus:  attached.isActive ? 'ACTIVE' : 'INACTIVE',
      frozen:         false,
      noDebit:        false,
      noCredit:       false,
      dormant:        false,
      balances: {
        currentBalance:   null,
        availableBalance: null,
      },
      _source: 'db_only',  // hint to frontend that CBS data is unavailable
    });
  } catch (err) { next(err); }
});

module.exports = router;
