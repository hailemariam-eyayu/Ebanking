/**
 * Transfer Funds
 *
 * Uses POST /api/ib/a2a/transfer for execution.
 * "From Account" dropdown is populated from the customer's attached accounts
 * (same Oracle-backed list as the Accounts page), with live balance shown.
 *
 * Flow:
 *   1. User picks source account (drAcNo) — balance shown next to selection
 *   2. User enters destination account (crAcNo) — validated via POST /a2a/validate
 *   3. On submit → POST /a2a/transfer
 *   4. Level 1 / within approval limit → processed immediately
 *      Level 2/3 → returns 202 Pending, shows workflow status
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Info, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAccounts } from '../lib/useAccounts'
import api from '../lib/api'

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TransferPage() {
  const { user, canAct } = useAuth()
  const customer = user?.customer
  const level    = customer?.activationLevel

  const { data: accounts = [], isLoading: accLoading } = useAccounts()

  const [form, setForm] = useState({
    drAcNo: '', crAcNo: '', amount: '', currency: 'ETB', narrative: '',
  })
  const [crInfo,  setCrInfo]  = useState(null)   // validated credit account info
  const [validating, setValidating] = useState(false)
  const [validateErr, setValidateErr] = useState('')
  const [result, setResult] = useState(null)

  // The selected source account object (for balance display)
  const selectedAcc = accounts.find(a => a.accountNumber === form.drAcNo)

  // ── Validate credit account when crAcNo is filled and blurred ────────────────
  async function validateCrAccount() {
    if (!form.crAcNo || !form.drAcNo || form.crAcNo === form.drAcNo) {
      setCrInfo(null)
      setValidateErr(form.crAcNo === form.drAcNo ? 'Debit and credit accounts must be different' : '')
      return
    }
    setValidating(true)
    setValidateErr('')
    setCrInfo(null)
    try {
      const { data } = await api.post('/a2a/validate', { drAcNo: form.drAcNo, crAcNo: form.crAcNo })
      if (data.status === 'Success') {
        setCrInfo(data.cr)
      } else {
        setValidateErr(data.message || 'Account validation failed')
      }
    } catch (e) {
      setValidateErr(e.response?.data?.message || 'Could not validate account')
    } finally {
      setValidating(false)
    }
  }

  // ── Submit transfer ───────────────────────────────────────────────────────────
  const submit = useMutation({
    mutationFn: () => api.post('/a2a/transfer', {
      drAcNo:    form.drAcNo,
      crAcNo:    form.crAcNo,
      amount:    Number(form.amount),
      currency:  form.currency,
      narrative: form.narrative || undefined,
    }),
    onSuccess: r => {
      setResult(r.data)
      setForm(f => ({ ...f, crAcNo: '', amount: '', narrative: '' }))
      setCrInfo(null)
    },
  })

  const canSubmit = form.drAcNo && form.crAcNo && form.amount &&
                    Number(form.amount) > 0 && crInfo && !submit.isPending

  // ── Permission check ──────────────────────────────────────────────────────────
  if (!canAct('transfer') && !canAct('a2a_transfer') && user?.userRole !== 'OWNER') {
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

      {/* Workflow info banner */}
      {level > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-blue-700 flex items-center gap-2">
          <Info size={13} />
          {level === 2 && 'Transfers require checker approval.'}
          {level === 3 && 'Transfers require checker and approver confirmation.'}
          {customer?.approvalLimit && ` Auto-approved up to ${fmt(customer.approvalLimit)} ETB.`}
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div className={`rounded-xl px-4 py-3 mb-5 text-sm flex items-start gap-2
          ${result.status === 'Success' || result.status === 'PROCESSED'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          {result.status === 'Pending'
            ? <Clock size={16} className="mt-0.5 flex-shrink-0" />
            : <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />}
          <div>
            <div className="font-medium">
              {result.status === 'Pending' ? 'Transfer submitted — awaiting approval' : 'Transfer completed successfully'}
            </div>
            {result.cbsRefNo && <div className="text-xs mt-0.5 opacity-70">CBS Ref: {result.cbsRefNo}</div>}
            {result.transaction?.id && <div className="text-xs mt-0.5 opacity-70">Txn ID: {result.transaction.id}</div>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

        {/* From Account */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            From Account <span className="text-red-500">*</span>
          </label>
          {accLoading ? (
            <div className={`${INP} text-gray-400`}>Loading accounts…</div>
          ) : accounts.length === 0 ? (
            <div className="text-xs text-red-400 py-2">No accounts attached. Contact your branch.</div>
          ) : (
            <select
              value={form.drAcNo}
              onChange={e => {
                setForm(f => ({ ...f, drAcNo: e.target.value, crAcNo: '', amount: '' }))
                setCrInfo(null)
                setValidateErr('')
                setResult(null)
              }}
              className={`${INP} font-mono`}>
              <option value="">— Select source account —</option>
              {accounts.map(acc => (
                <option key={acc.accountNumber} value={acc.accountNumber}>
                  {acc.accountNumber}
                  {acc.accountClass ? ` · ${acc.accountClass}` : ''}
                  {acc.currency ? ` (${acc.currency})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Selected account balance */}
          {selectedAcc && (
            <div className="mt-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
              <div>
                <div className="text-xs text-gray-400">{selectedAcc.fullName}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{selectedAcc.accountClass} · {selectedAcc.currency}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-800">
                  {selectedAcc.currentBalance != null
                    ? fmt(selectedAcc.currentBalance)
                    : '—'}
                </div>
                <div className="text-[10px] text-gray-400">{selectedAcc.currency} Balance</div>
              </div>
            </div>
          )}
        </div>

        {/* To Account */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            To Account <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Beneficiary account number"
            value={form.crAcNo}
            onChange={e => {
              setForm(f => ({ ...f, crAcNo: e.target.value }))
              setCrInfo(null)
              setValidateErr('')
            }}
            onBlur={validateCrAccount}
            className={`${INP} font-mono`} />

          {/* Validation states */}
          {validating && (
            <p className="text-[11px] text-blue-500 mt-1">Validating account…</p>
          )}
          {validateErr && (
            <p className="text-[11px] text-red-500 mt-1">{validateErr}</p>
          )}
          {crInfo && (
            <div className="mt-2 flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
              <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-green-800">{crInfo.name || 'Account verified'}</div>
                <div className="text-[10px] text-green-600">{crInfo.acNo} · {crInfo.currency}</div>
              </div>
            </div>
          )}
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount <span className="text-red-500">*</span></label>
            <input
              type="number" min="1" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className={INP} />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className={INP}>
              <option>ETB</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
        </div>

        {/* Narrative */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Narrative (optional)</label>
          <textarea
            placeholder="Transfer reason…"
            value={form.narrative} rows={2}
            onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))}
            className={`${INP} resize-none`} />
        </div>

        {/* Submit */}
        <button
          onClick={() => submit.mutate()}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--ib-primary)' }}>
          {submit.isPending
            ? 'Submitting…'
            : <><ArrowRight size={16} /> Submit Transfer</>}
        </button>

        {submit.isError && (
          <p className="text-red-500 text-xs text-center">
            {submit.error?.response?.data?.message || 'Submission failed'}
          </p>
        )}
      </div>
    </div>
  )
}

const INP = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
