import { useState } from 'react'
import { Phone, CreditCard, Hash, Search, X, ChevronDown } from 'lucide-react'
import api from '../lib/api'

const TABS = [
  { key: 'phone',   label: 'By Phone',   icon: Phone },
  { key: 'account', label: 'By Account', icon: CreditCard },
  { key: 'cif',     label: 'By CIF',     icon: Hash },
]

const ACCOUNT_STATUS_COLORS = {
  ACTIVE:    'bg-green-100 text-green-700',
  DORMANT:   'bg-amber-100 text-amber-700',
  BLOCKED:   'bg-red-100 text-red-700',
  FROZEN:    'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  CLOSED:    'bg-gray-100 text-gray-500',
}

function Badge({ label, color }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

function AccountStatusBadge({ status }) {
  return <Badge label={status} color={ACCOUNT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'} />
}

function formatAmount(val) {
  if (val === null || val === undefined) return '—'
  return Number(val).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
      const { data } = await api.get('/customers/search', { params: { by: tab, value: value.trim() } })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Customer Search</h2>

      {/* Search card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
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
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {tab === 'phone' ? 'Mobile Number (e.g. 0938169557)' : tab === 'account' ? 'Account Number' : 'CIF Number'}
            </label>
            <div className="relative">
              <input
                type="text" value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder={tab === 'phone' ? '0938XXXXXXX' : tab === 'account' ? '00XXXXXXXXXXXXXXX' : '1234567'}
                className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
  const [ibLoaded, setIbLoaded] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState(customer.personal?.phones?.[0] || customer.personal?.mobile || '')
  const [expandedAcc, setExpandedAcc] = useState(null)
  const [accDetail, setAccDetail] = useState({})
  const [accLoading, setAccLoading] = useState({})

  // Load IB status once
  useState(() => {
    api.get('/ib/customers')
      .then(r => {
        const match = r.data.find(c => c.custNo === customer.custNo)
        setIbStatus(match || null)
        setIbLoaded(true)
      })
      .catch(() => setIbLoaded(true))
  }, [customer.custNo])

  async function loadAccountDetail(accountNumber) {
    if (accDetail[accountNumber]) {
      setExpandedAcc(expandedAcc === accountNumber ? null : accountNumber)
      return
    }
    setExpandedAcc(accountNumber)
    setAccLoading(l => ({ ...l, [accountNumber]: true }))
    try {
      const { data } = await api.get(`/customers/${customer.custNo}/account/${accountNumber}`)
      setAccDetail(d => ({ ...d, [accountNumber]: data }))
    } catch {
      setAccDetail(d => ({ ...d, [accountNumber]: null }))
    } finally {
      setAccLoading(l => ({ ...l, [accountNumber]: false }))
    }
  }

  const phones = customer.personal?.phones?.length > 0
    ? customer.personal.phones
    : customer.personal?.mobile ? [customer.personal.mobile] : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left */}
      <div className="lg:col-span-3 space-y-4">

        {/* Customer Info */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-gray-700">Customer Info</span>
            {customer.frozen && <Badge label="FROZEN" color="bg-blue-100 text-blue-700" />}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Field label="CIF" value={customer.custNo} mono />
            <Field label="Full Name" value={customer.fullName} />
            <Field label="First Name" value={customer.personal?.firstName} />
            <Field label="Middle Name" value={customer.personal?.midName} />
            <Field label="Last Name" value={customer.personal?.lastName} />
            <Field label="Date of Birth" value={customer.personal?.dob} />
            <Field label="Gender" value={customer.personal?.gender === 'M' ? 'Male' : customer.personal?.gender === 'F' ? 'Female' : customer.personal?.gender} />
            <Field label="National ID" value={customer.personal?.nationalId} />
            <Field label="Branch" value={customer.branch} />
            <Field label="Customer Type" value={customer.type === 'I' ? 'Individual' : customer.type === 'C' ? 'Corporate' : customer.type} />
            <Field label="Category" value={customer.category} />
            <Field label="CIF Created" value={customer.cifCreatedAt} />

            {/* Phone — show selector if multiple */}
            <div className="col-span-2">
              <div className="text-xs text-gray-400 mb-1">Mobile Number{phones.length > 1 ? 's' : ''}</div>
              {phones.length <= 1 ? (
                <div className="font-medium text-gray-800">{phones[0] || '—'}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {phones.map(p => (
                    <button key={p} onClick={() => setSelectedPhone(p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedPhone === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}>
                      <Phone size={11} className="inline mr-1" />{p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* UDF fields */}
            {customer.udf?.['MOTHER NAME'] && <Field label="Mother's Name" value={customer.udf['MOTHER NAME']} />}
            {customer.udf?.['AVERAGE MONTHLY INCOME'] && <Field label="Monthly Income" value={customer.udf['AVERAGE MONTHLY INCOME']} />}
            {customer.udf?.['SUBCITY'] && <Field label="Subcity" value={customer.udf['SUBCITY']} />}
            {customer.udf?.['WOREDA'] && <Field label="Woreda" value={customer.udf['WOREDA']} />}
            {customer.udf?.['EMPLOYER'] && <Field label="Employer" value={customer.udf['EMPLOYER']} />}
            {customer.udf?.['ID TYPE'] && <Field label="ID Type" value={customer.udf['ID TYPE']} />}
            {customer.udf?.['ID NO'] && <Field label="ID Number" value={customer.udf['ID NO']} />}
          </div>
        </div>

        {/* Accounts */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-700">
              Accounts &amp; Balances
              <span className="ml-2 text-xs text-gray-400 font-normal">({customer.accounts?.length || 0} accounts)</span>
            </span>
          </div>

          {(!customer.accounts || customer.accounts.length === 0) ? (
            <div className="text-center text-gray-400 text-xs py-6">No accounts found</div>
          ) : (
            <div className="space-y-2">
              {customer.accounts.map(acc => (
                <div key={acc.accountNumber} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* Account row */}
                  <button
                    onClick={() => loadAccountDetail(acc.accountNumber)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-mono text-sm font-medium text-gray-800">{acc.accountNumber}</div>
                        <div className="text-xs text-gray-400">{acc.accountClass} · {acc.currency}</div>
                      </div>
                      <AccountStatusBadge status={acc.status} />
                      {acc.isDormant && <Badge label="DORMANT" color="bg-amber-100 text-amber-700" />}
                      {acc.noDebit && <Badge label="NO DR" color="bg-red-100 text-red-600" />}
                      {acc.noCredit && <Badge label="NO CR" color="bg-red-100 text-red-600" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">
                          {formatAmount(acc.currentBalance)} <span className="text-xs font-normal text-gray-400">{acc.currency}</span>
                        </div>
                        <div className="text-xs text-gray-400">{acc.fullName}</div>
                      </div>
                      <ChevronDown size={15} className={`text-gray-400 transition-transform ${expandedAcc === acc.accountNumber ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expandedAcc === acc.accountNumber && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      {accLoading[acc.accountNumber] ? (
                        <div className="text-xs text-gray-400 py-2">Loading account details…</div>
                      ) : accDetail[acc.accountNumber] ? (
                        <AccountDetailPanel detail={accDetail[acc.accountNumber]} />
                      ) : (
                        <div className="text-xs text-red-400 py-2">Failed to load account details</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — IB activation */}
      <div className="lg:col-span-2 space-y-4">
        {ibLoaded && !ibStatus && (
          <IBActivateCard
            custNo={customer.custNo}
            fullName={customer.fullName}
            phone={selectedPhone}
            phones={phones}
            onPhoneChange={setSelectedPhone}
            onDone={() => {
              api.get('/ib/customers')
                .then(r => setIbStatus(r.data.find(c => c.custNo === customer.custNo) || null))
                .catch(() => {})
            }}
          />
        )}
        {ibStatus && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">Internet Banking</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <AccountStatusBadge status={ibStatus.status} />
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Account Type</span>
                <span className="font-medium">{ibStatus.accountType}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Workflow Level</span>
                <span className="font-medium">Level {ibStatus.activationLevel}</span>
              </div>
              {ibStatus.approvalLimit && (
                <div className="flex justify-between"><span className="text-gray-500">Auto-Approval Limit</span>
                  <span className="font-medium">{formatAmount(ibStatus.approvalLimit)} ETB</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountDetailPanel({ detail }) {
  const b = detail.balances || {}
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
      <Field label="Account Class" value={detail.accountClassDesc || detail.accountClass} small />
      <Field label="Open Date" value={detail.openDate} small />
      <Field label="Account Status" value={detail.accountStatus} small />
      <Field label="Auth Status" value={detail.authStatus} small />
      <Field label="Current Balance" value={`${formatAmount(b.currentBalance)} ${detail.currency}`} small />
      <Field label="Available Balance" value={`${formatAmount(b.availableBalance)} ${detail.currency}`} small />
      <Field label="Blocked Amount" value={`${formatAmount(b.blockedAmount)} ${detail.currency}`} small />
      <Field label="Last CR Date" value={b.lastCrDate} small />
      <Field label="Last DR Date" value={b.lastDrDate} small />
      <Field label="Dormant" value={detail.dormant ? 'Yes' : 'No'} small />
      <Field label="No Debit" value={detail.noDebit ? 'Yes' : 'No'} small />
      <Field label="No Credit" value={detail.noCredit ? 'Yes' : 'No'} small />
    </div>
  )
}

function Field({ label, value, mono, small }) {
  return (
    <div>
      <div className={`text-gray-400 mb-0.5 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</div>
      <div className={`font-medium text-gray-800 ${small ? 'text-xs' : 'text-sm'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </div>
    </div>
  )
}

function IBActivateCard({ custNo, fullName, phone, phones, onPhoneChange, onDone }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    email: '', username: '', userPassword: '',
    accountType: 'INDIVIDUAL', activationLevel: 1, approvalLimit: '',
  })
  const [cbsAccounts, setCbsAccounts]       = useState([])     // fetched from CBS
  const [selectedAccNos, setSelectedAccNos] = useState([])     // checked account numbers
  const [accLoading, setAccLoading]         = useState(false)
  const [loading, setLoading]               = useState(false)
  const [err, setErr]                       = useState('')

  // Fetch CBS accounts when card opens
  async function loadCBSAccounts() {
    setAccLoading(true)
    try {
      const { data } = await api.get(`/ib/cbs-accounts/${custNo}`)
      setCbsAccounts(data)
      // pre-select all active accounts
      setSelectedAccNos(data.filter(a => a.status === 'ACTIVE').map(a => a.accountNumber))
    } catch {
      setCbsAccounts([])
    } finally { setAccLoading(false) }
  }

  function toggleAcc(accNo) {
    setSelectedAccNos(prev =>
      prev.includes(accNo) ? prev.filter(x => x !== accNo) : [...prev, accNo]
    )
  }

  async function activate() {
    if (!selectedAccNos.length) return setErr('Select at least one account')
    setLoading(true); setErr('')
    try {
      const selectedAccounts = cbsAccounts
        .filter(a => selectedAccNos.includes(a.accountNumber))
        .map(a => ({
          accountNumber: a.accountNumber,
          accountClass:  a.accountClass,
          currency:      a.currency,
          fullName:      a.fullName,
        }))

      await api.post('/ib/activate', {
        custNo, fullName,
        phone: phone || phones?.[0] || '',
        email: form.email,
        branch: '001',
        username: form.username,
        userPassword: form.userPassword,
        accountType: form.accountType,
        activationLevel: form.activationLevel,
        approvalLimit: form.approvalLimit ? parseFloat(form.approvalLimit) : null,
        selectedAccounts,
      })
      setOpen(false)
      onDone?.()
    } catch (e) {
      setErr(e.response?.data?.message || 'Activation failed')
    } finally { setLoading(false) }
  }

  if (!open) return (
    <button onClick={() => { setOpen(true); loadCBSAccounts() }}
      className="w-full py-2.5 rounded-lg text-white text-sm font-medium"
      style={{ background: 'var(--brand-primary)' }}>
      Activate Internet Banking
    </button>
  )

  const canActivate = form.email && form.username && form.userPassword && selectedAccNos.length > 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="text-sm font-semibold text-gray-700 mb-4">Activate IB — {fullName}</div>
      {err && <div className="text-red-500 text-xs mb-3 bg-red-50 rounded p-2">{err}</div>}
      <div className="space-y-3">

        {phones && phones.length > 1 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
            <select value={phone} onChange={e => onPhoneChange(e.target.value)} className={INP}>
              {phones.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Customer Email</label>
          <input type="email" placeholder="customer@email.com" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INP} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">IB Username</label>
          <input type="text" placeholder="username" value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={INP} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Temporary Password</label>
          <input type="password" placeholder="••••••••" value={form.userPassword}
            onChange={e => setForm(f => ({ ...f, userPassword: e.target.value }))} className={INP} />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Account Type</label>
          <select value={form.accountType}
            onChange={e => setForm(f => ({ ...f, accountType: e.target.value, activationLevel: e.target.value === 'INDIVIDUAL' ? 1 : 2 }))}
            className={INP}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="CORPORATE">Corporate</option>
            <option value="GOVERNMENT">Government</option>
          </select>
        </div>

        {form.accountType !== 'INDIVIDUAL' && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Workflow Level</label>
              <select value={form.activationLevel}
                onChange={e => setForm(f => ({ ...f, activationLevel: parseInt(e.target.value) }))}
                className={INP}>
                <option value={2}>Level 2 — Maker + Checker</option>
                <option value={3}>Level 3 — Maker + Checker + Approver</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Auto-Approval Limit (ETB) — optional</label>
              <input type="number" placeholder="e.g. 50000" value={form.approvalLimit}
                onChange={e => setForm(f => ({ ...f, approvalLimit: e.target.value }))} className={INP} />
              <p className="text-[10px] text-gray-400 mt-1">Transactions below this skip the workflow.</p>
            </div>
          </>
        )}

        {/* Account selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">
              Attach Accounts <span className="text-red-500">*</span>
            </label>
            {cbsAccounts.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => setSelectedAccNos(cbsAccounts.map(a => a.accountNumber))}
                  className="text-[10px] text-blue-600 hover:underline">All</button>
                <button onClick={() => setSelectedAccNos([])}
                  className="text-[10px] text-gray-400 hover:underline">None</button>
              </div>
            )}
          </div>

          {accLoading ? (
            <div className="text-xs text-gray-400 py-2 text-center">Loading accounts…</div>
          ) : cbsAccounts.length === 0 ? (
            <div className="text-xs text-red-400 py-2 text-center">No accounts found for this customer</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {cbsAccounts.map(acc => (
                <label key={acc.accountNumber}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0">
                  <input type="checkbox"
                    checked={selectedAccNos.includes(acc.accountNumber)}
                    onChange={() => toggleAcc(acc.accountNumber)}
                    className="accent-blue-600 w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-medium text-gray-800">{acc.accountNumber}</div>
                    <div className="text-[10px] text-gray-400">{acc.accountClass} · {acc.currency}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-medium text-gray-700">{formatAmount(acc.currentBalance)}</div>
                    <AccountStatusBadge status={acc.status} />
                  </div>
                </label>
              ))}
            </div>
          )}
          {selectedAccNos.length === 0 && cbsAccounts.length > 0 && (
            <p className="text-[10px] text-red-500 mt-1">Select at least one account</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setOpen(false)}
          className="flex-1 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={activate} disabled={loading || !canActivate}
          className="flex-1 py-2 text-sm rounded-lg text-white disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}>
          {loading ? 'Activating…' : `Activate (${selectedAccNos.length} account${selectedAccNos.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}

const INP = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
