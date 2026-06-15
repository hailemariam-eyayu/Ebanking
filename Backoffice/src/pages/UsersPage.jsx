import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Key, X } from 'lucide-react'
import api from '../lib/api'

export default function UsersPage() {
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['bo-users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['bo-roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const [modal, setModal] = useState(null) // null | { mode, user? }
  const [form, setForm] = useState({})
  const [err, setErr]   = useState('')

  const create = useMutation({
    mutationFn: data => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries(['bo-users']); setModal(null) },
    onError: e => setErr(e.response?.data?.message || 'Error'),
  })
  const update = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['bo-users']); setModal(null) },
    onError: e => setErr(e.response?.data?.message || 'Error'),
  })
  const remove = useMutation({
    mutationFn: id => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries(['bo-users']),
  })

  function openCreate() { setForm({}); setErr(''); setModal({ mode: 'create' }) }
  function openEdit(u)  { setForm({ fullName: u.fullName, email: u.email, roleId: u.roleId, branch: u.branch, isActive: u.isActive }); setErr(''); setModal({ mode: 'edit', user: u }) }

  function save() {
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ id: modal.user.id, data: form })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ background: 'var(--brand-primary)' }}>
          <Plus size={16} />Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Full Name','Username','Email','Role','Branch','Status','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{u.role?.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.branch}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800"><Pencil size={15} /></button>
                    <button onClick={() => remove.mutate(u.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{modal.mode === 'create' ? 'Add User' : 'Edit User'}</h3>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {err && <div className="text-red-500 text-xs mb-3">{err}</div>}
            <div className="space-y-3">
              {modal.mode === 'create' && <>
                <input placeholder="Full Name" value={form.fullName || ''} onChange={e => setForm(f=>({...f,fullName:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Username" value={form.username || ''} onChange={e => setForm(f=>({...f,username:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Email" type="email" value={form.email || ''} onChange={e => setForm(f=>({...f,email:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Password" type="password" value={form.password || ''} onChange={e => setForm(f=>({...f,password:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Branch (e.g. 001)" value={form.branch || ''} onChange={e => setForm(f=>({...f,branch:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <select value={form.roleId || ''} onChange={e => setForm(f=>({...f,roleId:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>}
              {modal.mode === 'edit' && <>
                <input placeholder="Full Name" value={form.fullName || ''} onChange={e => setForm(f=>({...f,fullName:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Email" type="email" value={form.email || ''} onChange={e => setForm(f=>({...f,email:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <input placeholder="Branch" value={form.branch || ''} onChange={e => setForm(f=>({...f,branch:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                <select value={form.roleId || ''} onChange={e => setForm(f=>({...f,roleId:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(f=>({...f,isActive:e.target.checked}))} />
                  Active
                </label>
              </>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save}
                className="flex-1 py-2 rounded-lg text-white text-sm disabled:opacity-50"
                style={{ background: 'var(--brand-primary)' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
