import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, ShieldCheck, Settings,
  ChevronDown, LogOut, Wallet, User2, MonitorSmartphone
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: User2,           label: 'Customer',       sub: true },
  {
    label: 'Administration', icon: Settings, sub: true,
    children: [
      { to: '/users', label: 'User Management', icon: Users },
      { to: '/roles', label: 'Role Management',  icon: ShieldCheck },
    ],
  },
  { to: '/ib',        icon: MonitorSmartphone, label: 'Internet Banking' },
  { to: '/wallet',    icon: Wallet,           label: 'Wallet Management', sub: true },
]

function NavItem({ item }) {
  const [open, setOpen] = useState(false)
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <item.icon size={18} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="bg-black/20">
            {item.children.map(c => (
              <NavLink key={c.to} to={c.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 pl-10 pr-5 py-2 text-sm transition-colors ${
                    isActive ? 'nav-active text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
              >
                <c.icon size={16} />{c.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }
  return (
    <NavLink to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
          isActive ? 'nav-active text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
    >
      <item.icon size={18} />{item.label}
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--brand-primary)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <span className="text-xs font-black" style={{ color: 'var(--brand-primary)' }}>EB</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">ENAT BANK</div>
              <div className="text-white/50 text-[10px]">Back Office v3.0</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item, i) => <NavItem key={i} item={item} />)}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-white/40 text-[10px] text-center">
          © ENAT BANK · v3.0.0
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-700">Back Office</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'var(--brand-primary)' }}>
                {user?.fullName?.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">{user?.fullName}</div>
                <div className="text-xs text-gray-400">{user?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
