import { useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { useAccounts } from '../lib/useAccounts'
import api from '../lib/api'

function fmt(val, currency = '') {
  if (val == null) return '—'
  return Number(val).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    (currency ? ` ${currency}` : '')
}

const STATUS_STYLE = {
  ACTIVE:    'bg-green-100 text-green-700',
  DORMANT:   'bg-amber-100 text-amber-700',
  FROZEN:    'bg-blue-100 text-blue-700',
  BLOCKED:   'bg-red-100 text-red-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CLOSED:    'bg-gray-100 text-gray-500',
}

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1e3a5f,#2563eb)',
  'linear-gradient(135deg,#064e3b,#059669)',
  'linear-gradient(135deg,#4c1d95,#7c3aed)',
  'linear-gradient(135deg,#7f1d1d,#dc2626)',
  'linear-gradient(135deg,#1e3a5f,#0891b2)',
]

export default function AccountsPage() {
  const { data: accounts = [], isLoading, refetch } = useAccounts()
  const [selected, setSelected] = useState(null)
  const [detail,   setDetail]   = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  function toggleDetail(acc) {
    if (selected === acc.accountNumber) {
      setSelected(null)
      setDetail(null)
      return
    }

    setSelected(acc.accountNumber)

    // If we already have balance from the list, use it directly — no extra call
    if (acc.currentBalance != null) {
      setDetail({
        accountNumber: acc.accountNumber,
        accountClass:  acc.accountClass,
        currency:      acc.currency,
        custName:      acc.fullName,
        accountStatus: acc.status,
        frozen:        acc.isFrozen,
        noDebit:       acc.noDebit,
        noCredit:      acc.noCredit,
        dormant:       acc.isDormant,
        balances: {
          currentBalance:   acc.currentBalance,
          availableBalance: acc.currentBalance,
        },
      })
      return
    }

    // Balance not in list (Oracle was down at list time) — try individual call
    setDetail(null)
    setDetailLoading(true)
    api.get(`/accounts/${acc.accountNumber}`)
      .then(r => setDetail(r.data))
      .catch(() => {
        // Still failed — show DB-only info from the list data
        setDetail({
          accountNumber: acc.accountNumber,
          accountClass:  acc.accountClass,
          currency:      acc.currency,
          custName:      acc.fullName,
          accountStatus: acc.status ?? 'ACTIVE',
          frozen:        false,
          noDebit:       false,
          noCredit:      false,
          dormant:       false,
          balances: { currentBalance: null, availableBalance: null },
          _source: 'db_only',
        })
      })
      .finally(() => setDetailLoading(false))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">My Accounts</h2>
        <button onClick={() => refetch()}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No accounts attached to your profile.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.map((acc, i) => (
              <button key={acc.accountNumber}
                onClick={() => toggleDetail(acc)}
                className={`rounded-2xl p-5 text-white shadow-lg text-left transition-transform hover:scale-[1.02] active:scale-100
                  ${selected === acc.accountNumber ? 'ring-2 ring-white ring-offset-2' : ''}`}
                style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>

                {/* Header row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xs text-white/60 uppercase tracking-wide">
                    {acc.accountClass || 'Account'}
                  </div>
                  <CreditCard size={18} className="text-white/50" />
                </div>

                {/* Account number */}
                <div className="font-mono text-base tracking-wider mb-3 opacity-90">
                  {acc.accountNumber}
                </div>

                {/* Balance — shown directly from list response */}
                <div className="text-lg font-bold mb-2">
                  {acc.currentBalance != null
                    ? fmt(acc.currentBalance)
                    : <span className="text-sm font-normal opacity-60">Tap for balance</span>}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-end">
                  <div className="text-white/60 text-xs">{acc.fullName}</div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                    ${acc.status === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-red-400/80 text-white'}`}>
                    {acc.status ?? 'ACTIVE'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel — opens on tap */}
          {selected && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              {detailLoading ? (
                <div className="text-center text-gray-400 text-sm py-4">Loading details…</div>
              ) : detail ? (
                <div>
                  {/* Detail header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="font-mono text-sm font-semibold text-gray-800">
                        {detail.accountNumber}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {detail.accountClass} · {detail.currency}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                      ${STATUS_STYLE[detail.accountStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {detail.accountStatus}
                    </span>
                  </div>

                  {/* Balance cards */}
                  {detail._source === 'db_only' ? (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3 mb-4">
                      ⚠ Balance unavailable — CBS is currently unreachable. Account info shown from local records.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                      <BalanceCard
                        label="Current Balance"
                        value={detail.balances?.currentBalance}
                        currency={detail.currency}
                        primary />
                      <BalanceCard
                        label="Available Balance"
                        value={detail.balances?.availableBalance}
                        currency={detail.currency} />
                    </div>
                  )}

                  {/* Flags */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {detail.dormant  && <Flag color="amber">⚠ Dormant</Flag>}
                    {detail.frozen   && <Flag color="blue">❄ Frozen</Flag>}
                    {detail.noDebit  && <Flag color="red">⛔ No Debit</Flag>}
                    {detail.noCredit && <Flag color="red">⛔ No Credit</Flag>}
                    {detail.custName && (
                      <span className="text-xs text-gray-500 ml-auto">{detail.custName}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-4">Loading…</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BalanceCard({ label, value, currency, primary }) {
  return (
    <div className={`rounded-xl p-4 ${primary ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className={`text-xs mb-1 ${primary ? 'text-blue-500' : 'text-gray-400'}`}>{label}</div>
      <div className={`font-bold ${primary ? 'text-blue-700 text-xl' : 'text-gray-700 text-base'}`}>
        {value != null
          ? Number(value).toLocaleString('en-ET', { minimumFractionDigits: 2 })
          : '—'}
        {value != null && <span className="text-xs font-normal ml-1 opacity-60">{currency}</span>}
      </div>
    </div>
  )
}

function Flag({ color, children }) {
  const styles = {
    amber: 'bg-amber-50 text-amber-700',
    blue:  'bg-blue-50 text-blue-700',
    red:   'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[color] ?? 'bg-gray-100 text-gray-600'}`}>
      {children}
    </span>
  )
}
