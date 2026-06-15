import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const TRANSFER_TYPES = [
  { value: 'OWN_ACCOUNT_TRANSFER', label: 'Own Account Transfer' },
  { value: 'INTERNAL_TRANSFER',    label: 'Internal Transfer' },
  { value: 'EXTERNAL_TRANSFER',    label: 'External Transfer' },
]

export default function TransferPage() {
  const { user, canAct } = useAuth()
  const customer = user?.customer
  const level    = customer?.activationLevel

  const [form, setForm] = useState({
    type: 'INTERNAL_TRANSFER', fromAccount: '', toAccount: '',
    amount: '', currency: 'ETB', description: '',
  })
  const [result, setResult] = useState(null)

  const submit = useMutation({
    mutationFn: data => api.post('/transactions', data),
    onSuccess: r => { setResult(r.data); setForm(f => ({ ...f, fromAccount:'',toAccount:'',amount:'',description:'' })) },
  })

  if (!canAct('transfer') && user?.userRole !== 'OWNER') {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
        <Info size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">You don't have permission to initiate transfers.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Transfer Funds</h2>
      {level > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-blue-700 flex items-center gap-2">
          <Info size={13} />
          {level === 2 && 'Transfer will require checker approval.'}
          {level === 3 && 'Transfer will require checker and approver confirmation.'}
          {customer?.approvalLimit && ` Auto-approved up to ${Number(customer.approvalLimit).toLocaleString()} ETB.`}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 text-sm text-green-700">
          ✓ Transfer submitted. Status: <strong>{result.status.replace(/_/g,' ')}</strong>
          {result.status !== 'APPROVED' && ' — awaiting approval.'}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Transfer Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {TRANSFER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Account</label>
          <input type="text" placeholder="Account number" value={form.fromAccount}
            onChange={e => setForm(f => ({ ...f, fromAccount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Account</label>
          <input type="text" placeholder="Beneficiary account number" value={form.toAccount}
            onChange={e => setForm(f => ({ ...f, toAccount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
            <input type="number" min="1" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option>ETB</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
          <textarea placeholder="Transfer reason…" value={form.description} rows={2}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>
        <button
          onClick={() => submit.mutate(form)}
          disabled={submit.isPending || !form.fromAccount || !form.toAccount || !form.amount}
          className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--ib-primary)' }}>
          {submit.isPending ? 'Submitting…' : <><ArrowRight size={16} />Submit Transfer</>}
        </button>
        {submit.isError && (
          <p className="text-red-500 text-xs text-center">{submit.error?.response?.data?.message || 'Error'}</p>
        )}
      </div>
    </div>
  )
}
