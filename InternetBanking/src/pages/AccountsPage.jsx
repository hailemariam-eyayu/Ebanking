import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, RefreshCw } from 'lucide-react'
import { useAccounts } from '../lib/useAccounts'
import api from '../lib/api'

function formatAmount(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadDetail(accNo) {
    if (selected === accNo) { setSelected(null); setDetail(null); return }
    setSelected(accNo)
    setDetail(null)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/accounts/${accNo}`)
      setDetail(data)
    } catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">My Accounts</h2>
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <RefreshCw size={13} />Refresh
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
                onClick={() => loadDetail(acc.accountNumber)}
                className={`rounded-2xl p-5 text-white shadow-lg text-left transition-transform hover:scale-[1.02] active:scale-100
                  ${selected === acc.accountNumber ? 'ring-2 ring-white ring-offset-2' : ''}`}
                style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                <div className="flex justify-between items-start mb-5">
                  <div className="text-xs text-white/60">{acc.accountClass || 'Account'}</div>
                  <CreditCard size={18} className="text-white/50" />
                </div>
                <div className="font-mono text-base tracking-wider mb-4 opacity-90">
                  {acc.accountNumber}
                </div>
                <div className="text-xs text-white/50">{acc.fullName}</div>
                <div className="flex justify-between items-end mt-1">
                  <div className="text-white/50 text-xs">{acc.currency}</div>
                  <div className="text-sm font-semibold">Tap for balance</div>
                </div>
              </button>
            ))}
          </div>

          {/* Balance detail panel */}
          {selected && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              {detailLoading ? (
                <div className="text-center text-gray-400 text-sm py-4">Loading balance…</div>
              ) : detail ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-mono text-sm font-semibold text-gray-800">{detail.accountNumber}</div>
                      <div className="text-xs text-gray-400">{detail.accountClassDesc || detail.accountClass} · {detail.currency}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      detail.accountStatus === 'NORM' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{detail.accountStatus}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <BalanceCard label="Current Balance"   value={detail.balances?.currentBalance}   currency={detail.currency} primary />
                    <BalanceCard label="Available Balance" value={detail.balances?.availableBalance} currency={detail.currency} />
                    <BalanceCard label="Blocked Amount"    value={detail.balances?.blockedAmount}    currency={detail.currency} />
                    <BalanceCard label="Opening Balance"   value={detail.balances?.openingBalance}   currency={detail.currency} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-gray-500">
                    <div>Last Credit: <span className="font-medium text-gray-700">{detail.balances?.lastCrDate || '—'}</span></div>
                    <div>Last Debit:  <span className="font-medium text-gray-700">{detail.balances?.lastDrDate || '—'}</span></div>
                    {detail.dormant  && <div className="text-amber-600">⚠ Dormant account</div>}
                    {detail.noDebit  && <div className="text-red-600">⛔ No Debit</div>}
                    {detail.noCredit && <div className="text-red-600">⛔ No Credit</div>}
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-400 text-sm py-4">Failed to load balance from CBS</div>
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
    <div className={`rounded-xl p-3 ${primary ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className={`text-xs mb-1 ${primary ? 'text-blue-500' : 'text-gray-400'}`}>{label}</div>
      <div className={`font-bold ${primary ? 'text-blue-700 text-base' : 'text-gray-700 text-sm'}`}>
        {Number(value || 0).toLocaleString('en-ET', { minimumFractionDigits: 2 })}
        <span className="text-xs font-normal ml-1 opacity-60">{currency}</span>
      </div>
    </div>
  )
}
