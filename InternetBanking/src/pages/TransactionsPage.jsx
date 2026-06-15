import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import api from '../lib/api'

const STATUS_COLORS = {
  PENDING:          'bg-amber-100 text-amber-700',
  PENDING_CHECKER:  'bg-orange-100 text-orange-700',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
  PROCESSED:        'bg-blue-100 text-blue-700',
  FAILED:           'bg-gray-100 text-gray-500',
}

export default function TransactionsPage() {
  const [page, setPage]       = useState(1)
  const [statusF, setStatusF] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ib-transactions', page, statusF],
    queryFn: () => api.get('/transactions', { params: { page, limit: 20, status: statusF || undefined } }).then(r => r.data),
    keepPreviousData: true,
  })

  const txns  = data?.transactions || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Type','From','To','Amount','Status','Workflow','Date'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No transactions found.</td></tr>
            ) : txns.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight size={14} className="text-blue-500" />
                    <span className="text-xs capitalize">{t.type.replace(/_/g,' ')}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs font-mono text-gray-600">{t.fromAccount}</td>
                <td className="px-5 py-3 text-xs font-mono text-gray-600">{t.toAccount || '–'}</td>
                <td className="px-5 py-3 font-semibold text-gray-800">
                  {Number(t.amount).toLocaleString()} <span className="text-xs text-gray-400">{t.currency}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-500'}`}>
                    {t.status.replace(/_/g,' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">Level {t.workflowLevel}</td>
                <td className="px-5 py-3 text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm">
            <span className="text-gray-400 text-xs">Page {page} of {pages} · {total} total</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
