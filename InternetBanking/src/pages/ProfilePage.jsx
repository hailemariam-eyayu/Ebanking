import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { Key, User, CheckCircle } from 'lucide-react'
import api from '../lib/api'

export default function ProfilePage() {
  const { user } = useAuth()
  const customer  = user?.customer

  const [pwForm, setPwForm]   = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwMsg, setPwMsg]     = useState(null)

  const changePw = useMutation({
    mutationFn: d => api.put('/users/change-password', d),
    onSuccess: () => { setPwMsg({ ok: true, text: 'Password changed successfully.' }); setPwForm({ currentPassword:'',newPassword:'',confirm:'' }) },
    onError: e => setPwMsg({ ok: false, text: e.response?.data?.message || 'Error' }),
  })

  function submitPw(e) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) { setPwMsg({ ok:false, text:'Passwords do not match' }); return }
    changePw.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Profile & Settings</h2>

      {/* Account info */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--ib-primary)' }}>
            {user?.fullName?.slice(0,2).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">{user?.fullName}</div>
            <div className="text-sm text-gray-400">{user?.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['CIF Number',    customer?.custNo],
            ['Account Type',  customer?.accountType],
            ['Role',          user?.userRole],
            ['Workflow Level',`Level ${customer?.activationLevel}`],
            ['Status',        customer?.status],
            ['View Only',     user?.viewOnly ? 'Yes' : 'No'],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-0.5">{label}</div>
              <div className="font-medium text-gray-800">{value || '–'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-700">Change Password</h3>
        </div>
        {pwMsg && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 mb-4 ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {pwMsg.ok && <CheckCircle size={14} />}
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={submitPw} className="space-y-3">
          <input type="password" placeholder="Current password" required value={pwForm.currentPassword}
            onChange={e => setPwForm(f=>({...f,currentPassword:e.target.value}))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="password" placeholder="New password" required value={pwForm.newPassword}
            onChange={e => setPwForm(f=>({...f,newPassword:e.target.value}))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="password" placeholder="Confirm new password" required value={pwForm.confirm}
            onChange={e => setPwForm(f=>({...f,confirm:e.target.value}))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button type="submit" disabled={changePw.isPending}
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--ib-primary)' }}>
            {changePw.isPending ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
