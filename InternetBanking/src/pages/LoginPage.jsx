import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Lock, User, Shield } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm]   = useState({ username: '', password: '' })
  const [show, setShow]   = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--ib-gradient)' }}>
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 text-white">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-6">
            <span className="text-3xl font-black text-white">EB</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">ENAT BANK</h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Secure, fast and reliable internet banking for individuals and businesses.
          </p>
        </div>
        <div className="space-y-3">
          {['256-bit encrypted transactions','Maker-Checker-Approval workflow','Multi-user corporate access'].map(f => (
            <div key={f} className="flex items-center gap-3 text-white/80 text-sm">
              <Shield size={16} className="text-white/60" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'var(--ib-primary)' }}>
              <span className="text-white font-black text-lg">EB</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Welcome back</h2>
            <p className="text-sm text-gray-400 mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Enter your username" required
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={show ? 'text' : 'password'} placeholder="Enter your password" required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" className="accent-blue-600" />
                Remember me
              </label>
              <button type="button" className="text-xs text-blue-600 hover:underline">Forgot password?</button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl text-white font-medium text-sm transition-opacity disabled:opacity-60"
              style={{ background: 'var(--ib-primary)' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Not registered? Contact your branch to activate Internet Banking.
          </p>
        </div>
      </div>
    </div>
  )
}
