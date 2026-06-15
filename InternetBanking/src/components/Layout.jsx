import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Receipt,
  Clock, Settings, LogOut, Bell, User, Banknote
} from 'lucide-react'

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',    key: 'dashboard' },
  { to: '/accounts',    icon: CreditCard,      label: 'Accounts',     key: 'accounts' },
  { to: '/transfer',    icon: ArrowLeftRight,  label: 'Transfer',     key: 'transfer' },
  { to: '/payments',    icon: Banknote,        label: 'Payments',     key: 'payment' },
  { to: '/transactions',icon: Receipt,         label: 'Transactions', key: 'statement' },
  { to: '/pending',     icon: Clock,           label: 'Pending',      key: 'pending' },
  { to: '/profile',     icon: Settings,        label: 'Settings',     key: 'settings' },
]

export default function Layout() {
  const { user, canView, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() { logout(); navigate('/login') }

  const customer = user?.customer

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: 'var(--ib-primary)' }}>
        {/* Bank logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <span className="text-xs font-black" style={{ color: 'var(--ib-primary)' }}>EB</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm">ENAT BANK</div>
              <div className="text-white/40 text-[10px]">Internet Banking</div>
            </div>
          </div>
          {/* User pill */}
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-white text-xs font-semibold">{user?.fullName}</div>
            <div className="text-white/50 text-[10px] mt-0.5">
              {customer?.custNo} · {user?.userRole}
            </div>
            {user?.viewOnly && (
              <span className="mt-1 inline-block bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full">
                View Only
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5">
          {NAV.filter(n => canView(n.key) || n.key === 'dashboard' || n.key === 'settings').map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 border-l-2 border-white text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
              <n.icon size={17} />{n.label}
              {n.key === 'pending' && (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">!</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <LogOut size={16} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">{customer?.fullName}</div>
            <div className="text-xs text-gray-400">
              Level {customer?.activationLevel}
              {customer?.activationLevel === 1 && ' — Individual'}
              {customer?.activationLevel === 2 && ' — Maker/Checker'}
              {customer?.activationLevel === 3 && ' — Maker/Checker/Approver'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-gray-400 hover:text-gray-600 relative">
              <Bell size={18} />
            </button>
            <NavLink to="/profile">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'var(--ib-primary)' }}>
                {user?.fullName?.slice(0, 2).toUpperCase()}
              </div>
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
