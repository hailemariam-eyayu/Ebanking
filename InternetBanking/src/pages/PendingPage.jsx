import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Info, AlertTriangle, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { useState } from 'react'

const ROLE_LABEL = {
  CHECKER:  'Checker',
  APPROVER: 'Approver',
  OWNER:    'Owner',
  MAKER:    'Maker',
  VIEWER:   'Viewer',
}

export default function PendingPage() {
  const { user } = useAuth()
  const qc  = useQueryClient()
  const role = user?.userRole

  const { data, isLoading, error } = useQuery({
    queryKey: ['ib-pending'],
    queryFn:  () => api.get('/transactions/pending').then(r => r.data),
    retry: false,
  })

  // Per-transaction error state  { [txnId]: string }
  const [txnErrors,    setTxnErrors]    = useState({})
  const [rejectModal,  setRejectModal]  = useState(null)   // txn id
  const [reason,       setReason]       = useState('')

  function clearTxnError(id) {
    setTxnErrors(e => { const n = { ...e }; delete n[id]; return n })
  }

  const approve = useMutation({
    mutationFn: id => api.post(`/transactions/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries(['ib-pending'])
      qc.invalidateQueries(['ib-dashboard'])
      qc.invalidateQueries(['ib-transactions'])
    },
    onError: (err, id) => {
      const data = err?.response?.data
      const msg  = data?.message || 'Could not approve this transaction'
      const required = data?.requiredRole ? ` This action requires a ${ROLE_LABEL[data.requiredRole] ?? data.requiredRole}.` : ''
      setTxnErrors(e => ({ ...e, [id]: msg + required }))
    },
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/transactions/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries(['ib-pending'])
      qc.invalidateQueries(['ib-dashboard'])
      qc.invalidateQueries(['ib-transactions'])
    },
    onError: (err, { id }) => {
      const msg = err?.response?.data?.message || 'Could not reject this transaction'
      setTxnErrors(e => ({ ...e, [id]: msg }))
    },
  })

  const txns = data?.transactions || []

  // ── Access guard ──────────────────────────────────────────────────────────
  if (role !== 'CHECKER' && role !== 'APPROVER' && role !== 'OWNER') {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
        <ShieldAlert size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">Access restricted</p>
        <p className="text-xs text-gray-400 mt-1">
          This section is for <strong>Checkers</strong> and <strong>Approvers</strong> only.
          {role && ` Your current role is ${ROLE_LABEL[role] ?? role}.`}
        </p>
      </div>
    )
  }

  // ── Role context banner ───────────────────────────────────────────────────
  const roleInfo = {
    CHECKER:  'You can approve transactions that are waiting for checker review (PENDING CHECKER).',
    APPROVER: 'You can approve transactions that have passed checker review (PENDING APPROVAL).',
    OWNER:    'You can view all pending transactions across all stages.',
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-800">Pending Approvals</h2>
        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
          {txns.length}
        </span>
      </div>

      {/* Role context */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-blue-700 flex items-start gap-2">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong>{ROLE_LABEL[role]}:</strong> {roleInfo[role]}
        </span>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-red-600 font-medium">Failed to load pending transactions</p>
          <p className="text-xs text-red-400 mt-1">
            {error?.response?.data?.message || error?.message}
          </p>
        </div>
      ) : txns.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <Clock size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No pending transactions to review.</p>
          <p className="text-xs text-gray-400 mt-1">
            {role === 'CHECKER'  && 'Transactions become visible here once a Maker submits them.'}
            {role === 'APPROVER' && 'Transactions appear here after a Checker approves them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {txns.map(t => {
            const txnErr = txnErrors[t.id]
            // Determine if this role can act on this specific transaction
            const canApprove =
              (role === 'CHECKER'  && t.status === 'PENDING_CHECKER') ||
              (role === 'APPROVER' && t.status === 'PENDING_APPROVAL') ||
              role === 'OWNER'

            const requiredRoleForStatus =
              t.status === 'PENDING_CHECKER'  ? 'Checker' :
              t.status === 'PENDING_APPROVAL' ? 'Approver' : null

            return (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between gap-4">
                  {/* Transaction info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 capitalize">
                        {t.type.replace(/_/g,' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${t.status === 'PENDING_CHECKER'  ? 'bg-orange-100 text-orange-700' :
                          t.status === 'PENDING_APPROVAL' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {t.status.replace(/_/g,' ')}
                      </span>
                      {!canApprove && requiredRoleForStatus && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
                          <ShieldAlert size={10} />
                          Requires {requiredRoleForStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div>From: <span className="font-mono text-gray-700">{t.fromAccount}</span></div>
                      {t.toAccount   && <div>To: <span className="font-mono text-gray-700">{t.toAccount}</span></div>}
                      {t.description && <div>Note: {t.description}</div>}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right mr-4 flex-shrink-0">
                    <div className="font-bold text-gray-800 text-lg">
                      {Number(t.amount).toLocaleString('en-ET', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400">{t.currency}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {canApprove ? (
                      <>
                        <button
                          onClick={() => { clearTxnError(t.id); approve.mutate(t.id) }}
                          disabled={approve.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle size={15} />Approve
                        </button>
                        <button
                          onClick={() => { clearTxnError(t.id); setRejectModal(t.id); setReason('') }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50">
                          <XCircle size={15} />Reject
                        </button>
                      </>
                    ) : (
                      // Role mismatch — show why buttons are unavailable
                      <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-gray-400 bg-gray-50 border border-gray-200">
                        <ShieldAlert size={13} className="text-gray-400" />
                        <span>
                          Needs <strong>{requiredRoleForStatus}</strong> to approve
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-transaction error */}
                {txnErr && (
                  <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{txnErr}</span>
                    <button onClick={() => clearTxnError(t.id)} className="ml-auto text-red-400 hover:text-red-600">
                      <XCircle size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-3">Reject Transaction</h3>
            <p className="text-xs text-gray-400 mb-3">
              Provide a reason so the Maker understands why this was rejected.
            </p>
            <textarea
              placeholder="Reason for rejection…"
              value={reason} rows={3}
              onChange={e => setReason(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => { reject.mutate({ id: rejectModal, reason }); setRejectModal(null) }}
                disabled={!reason.trim()}
                className="flex-1 py-2 rounded-xl text-white text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
