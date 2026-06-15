import { useState } from 'react'
import { Phone, CreditCard, Hash, Search, X, ChevronRight } from 'lucide-react'
import api from '../lib/api'

const TABS = [
  { key: 'phone',   label: 'Search by Phone',   icon: Phone },
  { key: 'account', label: 'Search by Account', icon: CreditCard },
  { key: 'cif',     label: 'Search by CIF',     icon: Hash },
]

function Badge({ status }) {
  const map = {
    ACTIVE: 'bg-green-100 text-green-700',
    BLOCKED: 'bg-red-100 text-red-700',
    PENDING: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function CustomerPage() {
  const [tab,    setTab]    = useState('phone')
  const [value,  setValue]  = useState('')
  const [result, setResult] = useState(null)
  const [error,  setError]  = useState('')
  const [loading,setLoading]= useState(false)

  async function search() {
    if (!value.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.get('/customers/search', { params: { by: tab, value } })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Customers</h2>
        <div className="flex gap-2 text-sm text-gray-500">
          <span className="px-3 py-1 bg-white rounded-lg border text-blue-600 font-medium cursor-pointer">Customers</span>
          <span className="px-3 py-1 bg-white rounded-lg border cursor-pointer">Users</span>
        </div>
      </div>

      {/* Search card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setValue(''); setResult(null); setError('') }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </div>

        <div className="p-5 flex gap-3">
          <div className="flex-1 relative">
            <label className="block text-xs text-gray-500 mb-1">
              {tab === 'phone' ? 'Phone Number' : tab === 'account' ? 'Account Number' : 'CIF Number'}
            </label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder={tab === 'phone' ? '251XXXXXXXXX' : tab === 'account' ? 'Account number' : 'CIF number'}
                className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {value && (
                <button onClick={() => { setValue(''); setResult(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={search} disabled={loading || !value.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--brand-primary)' }}>
              <Search size={15} />{loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {result && <CustomerResult customer={result} />}
    </div>
  )
}

function CustomerResult({ customer }) {
  const [ibStatus, setIbStatus] = useState(null)
  const [ibLoading, setIbLoading] = useState(false)

  async function loadIB() {
    setIbLoading(true)
    try {
      const { data } = await api.get('/ib/customers', { params: { custNo: customer.custNo } })
      setIbStatus(data.find?.(c => c.custNo === customer.custNo) || null)
    } catch { /* ignore */ }
    finally { setIbLoading(false) }
  }

  useState(() => { loadIB() }, [customer.custNo])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left — customer info */}
      <div className="lg:col-span-3 space-y-4">
        {/* Customer Info */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-xs">👤</span>
            </div>
            <span className="font-semibold text-gray-700 text-sm">Customer Info</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Full Name</div>
              <div className="font-medium text-gray-800">{customer.fullName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Phone Number</div>
              <div className="font-medium text-gray-800 flex items-center gap-1">
                <Phone size={13} className="text-gray-400" />
                {customer.personal?.mobile || '–'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Status</div>
              <Badge status={customer.frozen ? 'BLOCKED' : 'ACTIVE'} />
            </div>
          </div>
        </div>

        {/* Customer Products */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Customer Products</div>
          <div className="grid grid-cols-3 gap-3">
            {['Digital Banking (USSD)', 'Mobile Banking', 'Internet Banking'].map(p => (
              <div key={p} className="border border-blue-900 rounded-lg px-3 py-2 text-center text-xs text-blue-900 font-medium cursor-pointer hover:bg-blue-50">
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* Customer Accounts */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🏦 Customer Accounts
            </div>
            <button className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded hover:bg-red-50">
              DETACH DBS
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b">
                <th className="text-left py-2">Account Number</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Currency</th>
                <th className="text-left py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(customer.accounts || []).length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-400 py-6 text-xs">
                  No accounts loaded yet. Account list endpoint pending.
                </td></tr>
              ) : customer.accounts.map(acc => (
                <tr key={acc.ACC} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{acc.ACC}</td>
                  <td className="py-2"><Badge status="ACTIVE" /></td>
                  <td className="py-2">{acc.CCY}</td>
                  <td className="py-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" className="accent-blue-600" defaultChecked />
                      <span className="text-xs">Active</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right — services */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-500">⚙️</span>
            <span className="font-semibold text-gray-700 text-sm">Services</span>
          </div>

          {['Digital Banking (USSD)', 'Mobile Banking', 'Internet Banking'].map(svc => (
            <div key={svc} className="mb-5 last:mb-0 border-b last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{svc}</span>
                <Badge status="ACTIVE" />
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-blue-900 text-blue-900 hover:bg-blue-50">
                  BLOCK
                </button>
                <button className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                  RESET PIN
                </button>
                {svc === 'Internet Banking' && (
                  <button className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    EDIT EMAIL
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* IB Activation */}
        {!ibLoading && !ibStatus && (
          <IBActivateCard custNo={customer.custNo} fullName={customer.fullName}
            phone={customer.personal?.mobile} onDone={loadIB} />
        )}
        {ibStatus && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm font-semibold text-gray-700 mb-2">IB Activation</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Level</span>
              <span className="font-medium">{ibStatus.activationLevel}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-500">Status</span>
              <Badge status={ibStatus.status} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IBActivateCard({ custNo, fullName, phone, onDone }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    email: '', username: '', userPassword: '', accountType: 'INDIVIDUAL', activationLevel: 1,
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function activate() {
    setLoading(true); setErr('')
    try {
      await api.post('/ib/activate', { custNo, fullName, phone, ...form })
      setOpen(false)
      onDone?.()
    } catch (e) { setErr(e.response?.data?.message || 'Activation failed') }
    finally { setLoading(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full py-2.5 rounded-lg text-white text-sm font-medium"
      style={{ background: 'var(--brand-primary)' }}>
      Activate Internet Banking
    </button>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="text-sm font-semibold text-gray-700 mb-4">Activate IB — {fullName}</div>
      {err && <div className="text-red-500 text-xs mb-3">{err}</div>}
      <div className="space-y-3">
        <input type="email" placeholder="Customer email" required value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="text" placeholder="IB username" required value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="password" placeholder="Temporary password" required value={form.userPassword}
          onChange={e => setForm(f => ({ ...f, userPassword: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={form.accountType}
          onChange={e => setForm(f => ({ ...f, accountType: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="INDIVIDUAL">Individual</option>
          <option value="CORPORATE">Corporate</option>
          <option value="GOVERNMENT">Government</option>
        </select>
        {form.accountType !== 'INDIVIDUAL' && (
          <select value={form.activationLevel}
            onChange={e => setForm(f => ({ ...f, activationLevel: parseInt(e.target.value) }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value={2}>Level 2 — Maker + Checker</option>
            <option value={3}>Level 3 — Maker + Checker + Approver</option>
          </select>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => setOpen(false)}
          className="flex-1 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={activate} disabled={loading}
          className="flex-1 py-2 text-sm rounded-lg text-white disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}>
          {loading ? 'Activating…' : 'Activate'}
        </button>
      </div>
    </div>
  )
}
