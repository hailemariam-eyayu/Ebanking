import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, Shield, Ban, CheckCircle, X, Plus } from 'lucide-react'
import api from '../lib/api'

const IB_MENUS = [
  { key: 'dashboard',  label: 'Dashboard' },
  { key: 'accounts',   label: 'Accounts' },
  { key: 'transfer',   label: 'Transfer' },
  { key: 'payment',    label: 'Payments' },
  { key: 'statement',  label: 'Statement' },
  { key: 'beneficiary',label: 'Beneficiaries' },
  { key: 'settings',   label: 'Settings' },
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

export default function IBManagePage() {
  const qc = useQueryClient()
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['ib-customers'],
    queryFn: () => api.get('/ib/customers').then(r => r.data),
  })

  const [selected, setSelected] = useState(null)
  const [tab, setTab]           = useState('settings')
  const [userModal, setUserModal] = useState(false)
  const [userForm, setUserForm]   = useState({})
  const [err, setErr]             = useState('')

  const block = useMutation({
    mutationFn: id => api.post(`/ib/customers/${id}/block`),
    onSuccess: () => qc.invalidateQueries(['ib-customers']),
  })
  const unblock = useMutation({
    mutationFn: id => api.post(`/ib/customers/${id}/unblock`),
    onSuccess: () => qc.invalidateQueries(['ib-customers']),
  })
  const updateSettings = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ib/customers/${id}/settings`, data),
    onSuccess: () => qc.invalidateQueries(['ib-customers']),
  })

  const { data: subUsers = [] } = useQuery({
    queryKey: ['ib-users', selected?.id],
    queryFn: () => api.get(`/ib/customers/${selected.id}/users`).then(r => r.data),
    enabled: !!selected,
  })

  const addUser = useMutation({
    mutationFn: data => api.post(`/ib/customers/${selected.id}/users`, data),
    onSuccess: () => { qc.invalidateQueries(['ib-users', selected?.id]); setUserModal(false) },
    onError: e => setErr(e.response?.data?.message || 'Error'),
  })

  return (
    <div className="flex gap-5 h-full">
      {/* Left list */}
      <div className="w-72 flex-shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Internet Banking</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No IB customers yet.</div>
          ) : customers.map(c => (
            <div key={c.id}
              onClick={() => setSelected(c)}
              className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 ${selected?.id === c.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800">{c.fullName}</div>
                  <div className="text-xs text-gray-400">CIF: {c.custNo}</div>
                </div>
                <Badge status={c.status} />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Level {c.activationLevel} · {c.accountType}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right detail */}
      {selected ? (
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{selected.fullName}</h3>
              <div className="text-xs text-gray-400">CIF {selected.custNo} · {selected.accountType}</div>
            </div>
            <div className="flex gap-2">
              {selected.status === 'ACTIVE' ? (
                <button onClick={() => block.mutate(selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50">
                  <Ban size={13} />Block
                </button>
              ) : (
                <button onClick={() => unblock.mutate(selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-600 hover:bg-green-50">
                  <CheckCircle size={13} />Unblock
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {[{ key:'settings', label:'Settings', icon:Settings }, { key:'users', label:'Sub-Users', icon:Users }, { key:'menus', label:'Menu Rights', icon:Shield }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <t.icon size={14} />{t.label}
              </button>
            ))}
          </div>

          {tab === 'settings' && (
            <div className="bg-white rounded-xl shadow-sm p-6 max-w-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Activation Level</label>
                  <select
                    defaultValue={selected.activationLevel}
                    onChange={e => updateSettings.mutate({ id: selected.id, data: { activationLevel: parseInt(e.target.value) } })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value={1}>Level 1 — Self approve (Individual)</option>
                    <option value={2}>Level 2 — Maker + Checker</option>
                    <option value={3}>Level 3 — Maker + Checker + Approver</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Auto-approval Limit (ETB)</label>
                  <input type="number" defaultValue={selected.approvalLimit || ''}
                    onBlur={e => updateSettings.mutate({ id: selected.id, data: { approvalLimit: parseFloat(e.target.value) || null } })}
                    placeholder="e.g. 50000"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <p className="text-xs text-gray-400 mt-1">Transactions below this amount bypass the workflow.</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setUserForm({}); setErr(''); setUserModal(true) }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm"
                  style={{ background: 'var(--brand-primary)' }}>
                  <Plus size={14} />Add Sub-User
                </button>
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Full Name','Username','Role','View Only','Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subUsers.map(u => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{u.fullName}</td>
                        <td className="px-4 py-3 text-gray-600">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{u.userRole}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.viewOnly ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.viewOnly ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={u.isActive ? 'ACTIVE' : 'BLOCKED'} />
                        </td>
                      </tr>
                    ))}
                    {subUsers.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-xs">No sub-users</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'menus' && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-600 mb-4">
                Menu rights are assigned per sub-user. Select a sub-user from the Sub-Users tab and edit their rights individually.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {IB_MENUS.map(m => (
                  <div key={m.key} className="border rounded-lg px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{m.label}</span>
                    <span className="text-xs text-gray-400">{m.key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add sub-user modal */}
          {userModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Add Sub-User</h3>
                  <button onClick={() => setUserModal(false)}><X size={18} className="text-gray-400" /></button>
                </div>
                {err && <div className="text-red-500 text-xs mb-3">{err}</div>}
                <div className="space-y-3">
                  {[['Full Name','fullName','text'],['Username','username','text'],['Email','email','email'],['Password','password','password']].map(([label,key,type]) => (
                    <input key={key} type={type} placeholder={label}
                      value={userForm[key] || ''}
                      onChange={e => setUserForm(f=>({...f,[key]:e.target.value}))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  ))}
                  <select value={userForm.userRole || 'MAKER'}
                    onChange={e => setUserForm(f=>({...f,userRole:e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {['MAKER','CHECKER','APPROVER','VIEWER'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={userForm.viewOnly || false}
                      onChange={e => setUserForm(f=>({...f,viewOnly:e.target.checked}))} />
                    View Only
                  </label>
                  <div className="text-xs font-medium text-gray-500 mt-1">Menu Rights</div>
                  {IB_MENUS.map(m => {
                    const mr = (userForm.menuRights || [])
                    const checked = mr.some(x => x.menuKey === m.key)
                    const toggle = () => setUserForm(f => {
                      const prev = f.menuRights || []
                      const next = checked ? prev.filter(x=>x.menuKey!==m.key) : [...prev,{menuKey:m.key,canView:true,canAct:!f.viewOnly}]
                      return {...f, menuRights:next}
                    })
                    return (
                      <label key={m.key} className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={checked} onChange={toggle} className="accent-blue-600" />
                        {m.label}
                      </label>
                    )
                  })}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setUserModal(false)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
                  <button onClick={() => addUser.mutate(userForm)}
                    className="flex-1 py-2 rounded-lg text-white text-sm"
                    style={{ background: 'var(--brand-primary)' }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a customer to manage their Internet Banking settings.
        </div>
      )}
    </div>
  )
}
