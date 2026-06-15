import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AccountsPage from './pages/AccountsPage'
import TransferPage from './pages/TransferPage'
import PaymentsPage from './pages/PaymentsPage'
import TransactionsPage from './pages/TransactionsPage'
import PendingPage from './pages/PendingPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--ib-gradient)' }}>
      <div className="text-white text-sm">Loading…</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts"     element={<AccountsPage />} />
        <Route path="transfer"     element={<TransferPage />} />
        <Route path="payments"     element={<PaymentsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="pending"      element={<PendingPage />} />
        <Route path="profile"      element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
