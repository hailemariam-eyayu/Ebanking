import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, Users, Ban, CheckCircle, X, Plus,
  Pencil, KeyRound, Shield, ChevronRight, Save,
} from 'lucide-react'
import api from '../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const IB_MENUS = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'accounts',    label: 'Accounts' },
  { key: 'transfer',    label: 'Transfer' },
  { key: 'payment',     label: 'Payments' },
  { key: 'statement',   label: 'Statement' },
  { key: 'beneficiary', label: 'Beneficiaries' },
  { key: 'settings',    label: 'Settings' },
]

const ROLES = ['OWNER', 'MAKER', 'CHECKER', 'APPROVER', 'VIEWER']

const ROLE_COLORS = {
  OWNER:    'bg-purple-100 text-purple-700',
  MAKER:    'bg-blue-100 text-blue-700',
  CHECKER:  'bg-indigo-100 text-indigo-700',
  APPROVER: 'bg-green-100 text-green-700',
  VIEWER:   'bg-gray-100 text-gray-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

function StatusBadge({ active }) {
  return active
    ? <Badge label="ACTIVE"  color="bg-green-100 text-green-700" />
    : <Badge label="BLOCKED" color="bg-red-100 text-red-700" />
}

function CustomerBadge({ status }) {
  const colors = {
    ACTIVE:    'bg-green-100 text-green-700',
    BLOCKED:   'bg-red-100 text-red-700',
    PENDING:   'bg-amber-100 text-amber-700',
    SUSPENDED: 'bg-orange-100 text-orange-700',
  }
  return <Badge label={status} color={colors[status] || 'bg-gray-100 text-gray-600'} />
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IBManagePage() {
  const qc = useQueryClient()
  const [selected, setSelected]   = useState(null)
  const [tab, setTab]             = useState('users')
  const [modal, setModal]         = useState(null)   // null | 'add' | 'edit' | 'menus' | 'password'
  const [editUser, setEditUser]   = useState(null)   // the user being acted on

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['ib-customers'],
    queryFn:  () => api.get('/ib/customers').then(r => r.data),
  })

  const { data: subUsers = [], refetch: refetchUsers } = useQuery({
    queryKey: ['ib-users', selected?.id],
    queryFn:  () => api.get(`/ib/customers/${selected.id}/users`).then(r => r.data),
    enabled:  !!selected,
  })

  const block   = useMutation({ mutationFn: id => api.post(`/ib/customers/${id}/block`),   onSuccess: () => qc.invalidateQueries(['ib-customers']) })
  const unblock = useMutation({ mutationFn: id => api.post(`/ib/customers/${id}/unblock`), onSuccess: () => qc.invalidateQueries(['ib-customers']) })
  const updateSettings = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ib/customers/${id}/settings`, data),
    onSuccess:  () => qc.invalidateQueries(['ib-customers']),
  })

  function openAdd()        { setEditUser(null);  setModal('add') }
  function openEdit(u)      { setEditUser(u);     setModal('edit') }
  function openMenus(u)     { setEditUser(u);     setModal('menus') }
  function openPassword(u)  { setEditUser(u);     setModal('password') }
  function closeModal()     { setModal(null); setEditUser(null) }

  return (
    <div className="flex gap-5 h-full">
      {/* ── Customer list ── */}
      <div className="w-72 flex-shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Internet Banking</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No IB customers yet.</div>
          ) : customers.map(c => (
            <div key={c.id} onClick={() => { setSelected(c); setTab('users') }}
              className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors
                ${selected?.id === c.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{c.fullName}</div>
                  <div className="text-xs text-gray-400">CIF: {c.custNo}</div>
                </div>
                <CustomerBadge status={c.status} />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Level {c.activationLevel} · {c.accountType}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selected ? (
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{selected.fullName}</h3>
              <div className="text-xs text-gray-400">CIF {selected.custNo} · {selected.accountType} · Level {selected.activationLevel}</div>
            </div>
            <div className="flex gap-2">
              {selected.status === 'ACTIVE' ? (
                <button onClick={() => block.mutate(selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50">
                  <Ban size={13} />Block Customer
                </button>
              ) : (
                <button onClick={() => unblock.mutate(selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-600 hover:bg-green-50">
                  <CheckCircle size={13} />Unblock Customer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
            {[
              { key: 'users',    label: 'Sub-Users', icon: Users },
              { key: 'settings', label: 'Settings',  icon: Settings },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                <t.icon size={14} />{t.label}
              </button>
            ))}
          </div>

          {/* ── Sub-Users tab ── */}
          {tab === 'users' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={openAdd}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium"
                  style={{ background: 'var(--brand-primary)' }}>
                  <Plus size={14} />Add Sub-User
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Full Name', 'Username', 'Role', 'Status', 'View Only', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subUsers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-xs">No sub-users yet</td></tr>
                    ) : subUsers.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.fullName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.username}</td>
                        <td className="px-4 py-3">
                          <Badge label={u.userRole} color={ROLE_COLORS[u.userRole]} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge active={u.isActive} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.viewOnly ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.viewOnly ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <UserActions
                            user={u}
                            customerId={selected.id}
                            onEdit={() => openEdit(u)}
                            onMenus={() => openMenus(u)}
                            onPassword={() => openPassword(u)}
                            onRefresh={refetchUsers}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Settings tab ── */}
          {tab === 'settings' && (
            <div className="bg-white rounded-xl shadow-sm p-6 max-w-sm space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Workflow Level</label>
                <select key={selected.id} defaultValue={selected.activationLevel}
                  onChange={e => updateSettings.mutate({ id: selected.id, data: { activationLevel: parseInt(e.target.value) } })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value={1}>Level 1 — Self approve (Individual)</option>
                  <option value={2}>Level 2 — Maker + Checker</option>
                  <option value={3}>Level 3 — Maker + Checker + Approver</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Auto-Approval Limit (ETB)</label>
                <input type="number" key={selected.id} defaultValue={selected.approvalLimit || ''}
                  onBlur={e => updateSettings.mutate({ id: selected.id, data: { approvalLimit: parseFloat(e.target.value) || null } })}
                  placeholder="e.g. 50000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Transactions below this amount skip the workflow.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <ChevronRight size={32} className="mx-auto mb-2 opacity-30" />
            Select a customer to manage their Internet Banking
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal === 'add' && (
        <UserFormModal
          title="Add Sub-User"
          customerId={selected.id}
          onClose={closeModal}
          onSaved={() => { refetchUsers(); closeModal() }}
        />
      )}
      {modal === 'edit' && editUser && (
        <UserFormModal
          title={`Edit — ${editUser.fullName}`}
          customerId={selected.id}
          user={editUser}
          onClose={closeModal}
          onSaved={() => { refetchUsers(); closeModal() }}
        />
      )}
      {modal === 'menus' && editUser && (
        <MenuRightsModal
          user={editUser}
          customerId={selected.id}
          onClose={closeModal}
          onSaved={() => { refetchUsers(); closeModal() }}
        />
      )}
      {modal === 'password' && editUser && (
        <ResetPasswordModal
          user={editUser}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

// ── User action buttons (inline) ─────────────────────────────────────────────
function UserActions({ user, customerId, onEdit, onMenus, onPassword, onRefresh }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  async function toggleBlock() {
    setBusy(true)
    try {
      const endpoint = user.isActive ? `/ib/users/${user.id}/block` : `/ib/users/${user.id}/unblock`
      await api.post(endpoint)
      onRefresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <ActionBtn icon={Pencil}  label="Edit"          onClick={onEdit}     color="text-blue-600 hover:bg-blue-50" />
      <ActionBtn icon={Shield}  label="Menu Rights"   onClick={onMenus}    color="text-indigo-600 hover:bg-indigo-50" />
      <ActionBtn icon={KeyRound}label="Reset Password" onClick={onPassword} color="text-amber-600 hover:bg-amber-50" />
      <ActionBtn
        icon={user.isActive ? Ban : CheckCircle}
        label={user.isActive ? 'Block' : 'Unblock'}
        onClick={toggleBlock}
        color={user.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
        disabled={busy}
      />
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, color, disabled }) {
  return (
    <button title={label} onClick={onClick} disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${color}`}>
      <Icon size={14} />
    </button>
  )
}

// ── Add / Edit user modal ─────────────────────────────────────────────────────
function UserFormModal({ title, customerId, user, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    fullName:   user?.fullName  || '',
    username:   user?.username  || '',
    email:      user?.email     || '',
    password:   '',
    userRole:   user?.userRole  || 'MAKER',
    viewOnly:   user?.viewOnly  || false,
  })
  const [err, setErr]       = useState('')
  const [saving, setSaving] = useState(false)

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save() {
    setSaving(true); setErr('')
    try {
      if (isEdit) {
        const payload = { fullName: form.fullName, email: form.email, userRole: form.userRole, viewOnly: form.viewOnly }
        await api.put(`/ib/users/${user.id}`, payload)
      } else {
        await api.post(`/ib/customers/${customerId}/users`, {
          fullName: form.fullName, username: form.username,
          email: form.email, password: form.password,
          userRole: form.userRole, viewOnly: form.viewOnly,
          menuRights: [],
        })
      }
      onSaved()
    } catch (e) { setErr(e.response?.data?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={title} onClose={onClose}>
      {err && <ErrBox msg={err} />}
      <div className="space-y-3">
        <Field label="Full Name">
          <input value={form.fullName} onChange={f('fullName')} placeholder="Full Name"
            className={INPUT} />
        </Field>
        {!isEdit && (
          <Field label="Username">
            <input value={form.username} onChange={f('username')} placeholder="username"
              className={INPUT} />
          </Field>
        )}
        <Field label="Email">
          <input type="email" value={form.email} onChange={f('email')} placeholder="email@example.com"
            className={INPUT} />
        </Field>
        {!isEdit && (
          <Field label="Password">
            <input type="password" value={form.password} onChange={f('password')} placeholder="••••••••"
              className={INPUT} />
          </Field>
        )}
        <Field label="Role">
          <select value={form.userRole} onChange={f('userRole')} className={INPUT}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={form.viewOnly} onChange={f('viewOnly')}
            className="accent-blue-600 w-4 h-4" />
          View Only (cannot initiate transactions)
        </label>
      </div>
      <ModalFooter onCancel={onClose} onSave={save} saving={saving} />
    </Modal>
  )
}

// ── Menu rights modal ─────────────────────────────────────────────────────────
function MenuRightsModal({ user, customerId, onClose, onSaved }) {
  // Build initial state from existing rights
  const init = {}
  IB_MENUS.forEach(m => {
    const existing = user.menuRights?.find(r => r.menuKey === m.key)
    init[m.key] = { canView: existing?.canView ?? false, canAct: existing?.canAct ?? false }
  })
  const [rights, setRights] = useState(init)
  const [err, setErr]       = useState('')
  const [saving, setSaving] = useState(false)

  function toggleView(key) {
    setRights(r => {
      const next = { ...r, [key]: { ...r[key], canView: !r[key].canView } }
      // if removing view, also remove act
      if (!next[key].canView) next[key].canAct = false
      return next
    })
  }
  function toggleAct(key) {
    setRights(r => {
      const next = { ...r, [key]: { ...r[key], canAct: !r[key].canAct } }
      // if granting act, also grant view
      if (next[key].canAct) next[key].canView = true
      return next
    })
  }
  function grantAll()  { const s={}; IB_MENUS.forEach(m=>{s[m.key]={canView:true,canAct:true}}); setRights(s) }
  function revokeAll() { const s={}; IB_MENUS.forEach(m=>{s[m.key]={canView:false,canAct:false}}); setRights(s) }

  async function save() {
    setSaving(true); setErr('')
    try {
      const payload = IB_MENUS
        .filter(m => rights[m.key].canView || rights[m.key].canAct)
        .map(m => ({ menuKey: m.key, canView: rights[m.key].canView, canAct: rights[m.key].canAct }))
      await api.put(`/ib/customers/${customerId}/users/${user.id}/menus`, { menuRights: payload })
      onSaved()
    } catch (e) { setErr(e.response?.data?.message || 'Failed to update') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Menu Rights — ${user.fullName}`} onClose={onClose} wide>
      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 mb-3">
        <button onClick={grantAll}  className="text-xs px-3 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50">Grant All</button>
        <button onClick={revokeAll} className="text-xs px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">Revoke All</button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Menu</th>
              <th className="text-center px-4 py-2 text-xs text-gray-500 font-medium">Can View</th>
              <th className="text-center px-4 py-2 text-xs text-gray-500 font-medium">Can Act</th>
            </tr>
          </thead>
          <tbody>
            {IB_MENUS.map(m => (
              <tr key={m.key} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                <td className="px-4 py-2.5 text-center">
                  <input type="checkbox" checked={rights[m.key].canView} onChange={() => toggleView(m.key)}
                    className="accent-blue-600 w-4 h-4 cursor-pointer" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <input type="checkbox" checked={rights[m.key].canAct} onChange={() => toggleAct(m.key)}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        <strong>Can View</strong> — user sees the menu. &nbsp;
        <strong>Can Act</strong> — user can initiate transactions / make changes.
      </p>
      <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Save Rights" />
    </Modal>
  )
}

// ── Reset password modal ──────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [pw, setPw]           = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr]         = useState('')
  const [done, setDone]       = useState(false)
  const [saving, setSaving]   = useState(false)

  async function save() {
    if (!pw || pw.length < 6) return setErr('Password must be at least 6 characters')
    if (pw !== confirm)       return setErr('Passwords do not match')
    setSaving(true); setErr('')
    try {
      await api.post(`/ib/users/${user.id}/reset-pin`, { newPassword: pw })
      setDone(true)
    } catch (e) { setErr(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Reset Password — ${user.fullName}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
          <p className="text-sm text-gray-700 font-medium">Password reset successfully</p>
          <button onClick={onClose} className="mt-4 px-6 py-2 rounded-lg text-white text-sm" style={{ background: 'var(--brand-primary)' }}>Close</button>
        </div>
      ) : (
        <>
          {err && <ErrBox msg={err} />}
          <div className="space-y-3">
            <Field label="New Password">
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Min 6 characters" className={INPUT} />
            </Field>
            <Field label="Confirm Password">
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password" className={INPUT} />
            </Field>
          </div>
          <ModalFooter onCancel={onClose} onSave={save} saving={saving} saveLabel="Reset Password" />
        </>
      )}
    </Modal>
  )
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, saving, saveLabel = 'Save' }) {
  return (
    <div className="flex gap-2 mt-5 pt-4 border-t">
      <button onClick={onCancel} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      <button onClick={onSave} disabled={saving}
        className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'var(--brand-primary)' }}>
        {saving ? 'Saving…' : <><Save size={14} />{saveLabel}</>}
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ErrBox({ msg }) {
  return <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-3">{msg}</div>
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
