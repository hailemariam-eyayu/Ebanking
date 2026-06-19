import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { useState } from 'react'

export default function PendingPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const role = user?.userRole

  const { data, isLoading, error } = useQuery({
    queryKey: ['ib-pending'],
    queryFn: () => api.get('/transactions/pending').then(r => r.data),
    retry: false,
  })

  const approve = useMutation({
    mutationFn: id => api.post(`/transactions/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries(['ib-pending'])
      qc.invalidateQueries(['ib-dashboard'])
      qc.invalidateQueries(['ib-transactions'])
    },
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/transactions/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries(['ib-pending'])
      qc.invalidateQueries(['ib-dashboard'])
      qc.invalidateQueries(['ib-transactions'])
    },
  })

  const [rejectModal, setRejectModal] = useState(null)
  const [reason, setReason] = useState('')

  const txns = data?.transactions || []

  if (role !== 'CHECKER' && role !== 'APPROVER' && role !== 'OWNER') {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
        <Info size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">This section is for checkers and approvers only.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-gray-800">Pending Approvals</h2>
        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
          {txns.length}
        </span>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-red-500 font-medium">Failed to load pending transactions</p>
          <p className="text-xs text-red-400 mt-1">{error?.response?.data?.message || error?.message}</p>
        </div>
      ) : txns.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <Clock size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No pending transactions to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {txns.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800 capitalize">{t.type.replace(/_/g,' ')}</span>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {t.status.replace(/_/g,' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>From: <span className="font-mono text-gray-700">{t.fromAccount}</span></div>
                  {t.toAccount && <div>To: <span className="font-mono text-gray-700">{t.toAccount}</span></div>}
                  {t.description && <div>Note: {t.description}</div>}
                </div>
              </div>
              <div className="text-right mr-4">
                <div className="font-bold text-gray-800 text-lg">{Number(t.amount).toLocaleString()}</div>
                <div className="text-xs text-gray-400">{t.currency}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve.mutate(t.id)} disabled={approve.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                  <CheckCircle size={15} />Approve
                </button>
                <button onClick={() => { setRejectModal(t.id); setReason('') }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50">
                  <XCircle size={15} />Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-3">Reject Transaction</h3>
            <textarea placeholder="Reason for rejection…" value={reason} rows={3}
              onChange={e => setReason(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 border rounded-xl text-sm">Cancel</button>
              <button onClick={() => { reject.mutate({ id: rejectModal, reason }); setRejectModal(null) }}
                className="flex-1 py-2 rounded-xl text-white text-sm bg-red-600 hover:bg-red-700">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
