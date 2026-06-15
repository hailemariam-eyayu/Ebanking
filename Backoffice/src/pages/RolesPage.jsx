import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ShieldCheck } from 'lucide-react'
import api from '../lib/api'

export default function RolesPage() {
  const qc = useQueryClient()
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['bo-roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })
  const { data: allMenus = [] } = useQuery({
    queryKey: ['bo-menus'],
    queryFn: () => api.get('/roles/menus').then(r => r.data),
  })

  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({ name: '', description: '', menuRights: [] })
  const [err, setErr]     = useState('')

  const create = useMutation({
    mutationFn: d => api.post('/roles', d),
    onSuccess: () => { qc.invalidateQueries(['bo-roles']); setModal(null) },
    onError: e => setErr(e.response?.data?.message || 'Error'),
  })

  function toggleMenu(menuId) {
    setForm(f => {
      const exists = f.menuRights.find(m => m.menuId === menuId)
      if (exists) return { ...f, menuRights: f.menuRights.filter(m => m.menuId !== menuId) }
      return { ...f, menuRights: [...f.menuRights, { menuId, canView: true, canEdit: false }] }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Role Management</h2>
        <button onClick={() => { setForm({ name:'',description:'',menuRights:[] }); setErr(''); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ background: 'var(--brand-primary)' }}>
          <Plus size={16} />Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <ShieldCheck size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{role.name}</div>
                <div className="text-xs text-gray-400">{role.description}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {role.menus?.length || 0} menu rights assigned
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(role.menus || []).slice(0, 5).map(m => (
                <span key={m.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {m.menu?.label}
                </span>
              ))}
              {(role.menus || []).length > 5 && (
                <span className="text-xs text-gray-400">+{role.menus.length - 5} more</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Create Role</h3>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {err && <div className="text-red-500 text-xs mb-3">{err}</div>}
            <div className="space-y-3 mb-4">
              <input placeholder="Role Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              <input placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-2">Menu Permissions</div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {allMenus.map(m => {
                const checked = form.menuRights.some(r => r.menuId === m.id)
                return (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleMenu(m.id)} className="accent-blue-600" />
                    <span className="text-sm text-gray-700">{m.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{m.key}</span>
                  </label>
                )
              })}
              {allMenus.length === 0 && <div className="text-xs text-gray-400 px-3">No menus configured yet.</div>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={() => create.mutate(form)}
                className="flex-1 py-2 rounded-lg text-white text-sm"
                style={{ background: 'var(--brand-primary)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
