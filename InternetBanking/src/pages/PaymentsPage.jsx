import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Banknote, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function PaymentsPage() {
  const { user, canAct } = useAuth()
  const [form, setForm] = useState({
    fromAccount: '', toAccount: '', amount: '', currency: 'ETB', description: '',
  })
  const [result, setResult] = useState(null)

  const submit = useMutation({
    mutationFn: data => api.post('/transactions', { ...data, type: 'BILL_PAYMENT' }),
    onSuccess: r => { setResult(r.data) },
  })

  if (!canAct('payment') && user?.userRole !== 'OWNER') {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
        <Info size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">You don't have permission to make payments.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-5">Bill Payments</h2>
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 text-sm text-green-700">
          ✓ Payment submitted. Status: <strong>{result.status.replace(/_/g,' ')}</strong>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Account</label>
          <input type="text" placeholder="Your account number" value={form.fromAccount}
            onChange={e => setForm(f => ({ ...f, fromAccount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Biller Account / Reference</label>
          <input type="text" placeholder="Biller reference" value={form.toAccount}
            onChange={e => setForm(f => ({ ...f, toAccount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
            <input type="number" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option>ETB</option>
              <option>USD</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <input type="text" placeholder="Payment description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <button onClick={() => submit.mutate(form)} disabled={submit.isPending || !form.fromAccount || !form.amount}
          className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--ib-primary)' }}>
          <Banknote size={16} />{submit.isPending ? 'Processing…' : 'Pay Now'}
        </button>
      </div>
    </div>
  )
}
