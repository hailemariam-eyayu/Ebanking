import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import api from '../lib/api'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`${bg} rounded-2xl p-3`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

const TXN_COLORS = {
  PENDING: 'text-amber-600 bg-amber-50',
  PENDING_CHECKER: 'text-orange-600 bg-orange-50',
  PENDING_APPROVAL: 'text-purple-600 bg-purple-50',
  APPROVED: 'text-green-600 bg-green-50',
  REJECTED: 'text-red-600 bg-red-50',
  PROCESSED: 'text-blue-600 bg-blue-50',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['ib-dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  })

  const customer = user?.customer
  const level = customer?.activationLevel

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Good day, {user?.fullName?.split(' ')[0]} 👋</h2>
          <p className="text-sm text-gray-400 mt-1">
            {customer?.accountType} account · Level {level}
            {level === 2 && ' (Maker/Checker)'}
            {level === 3 && ' (Maker/Checker/Approver)'}
          </p>
        </div>
        {(level === 2 || level === 3) && data?.stats?.pending > 0 && (
          <Link to="/pending"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--ib-primary)' }}>
            <Clock size={15} />
            {data.stats.pending} Pending
          </Link>
        )}
      </div>

      {/* Stats */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Transactions" value={data.stats.total}   icon={TrendingUp}   color="text-blue-600"   bg="bg-blue-50" />
          <StatCard label="Pending Approval"   value={data.stats.pending} icon={Clock}         color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Approved"           value={data.stats.approved}icon={CheckCircle}  color="text-green-600" bg="bg-green-50" />
          <StatCard label="Rejected"           value={data.stats.rejected}icon={XCircle}      color="text-red-600"   bg="bg-red-50" />
        </div>
      )}

      {/* Workflow info banner */}
      {level > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
          <strong>Workflow Active:</strong>{' '}
          {level === 2 && 'This account uses Maker → Checker workflow. Transactions require checker approval.'}
          {level === 3 && 'This account uses Maker → Checker → Approver workflow. Transactions require two-level approval.'}
          {customer?.approvalLimit && ` Transactions ≤ ${Number(customer.approvalLimit).toLocaleString()} ETB are auto-approved.`}
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-700">Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {isLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : (data?.recentTransactions || []).length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No transactions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Type','From','To','Amount','Status','Date'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map(t => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {t.type.includes('TRANSFER') ? <ArrowUpRight size={14} className="text-blue-500" /> : <ArrowDownLeft size={14} className="text-green-500" />}
                      <span className="capitalize text-xs">{t.type.replace(/_/g,' ')}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-gray-600">{t.fromAccount}</td>
                  <td className="px-5 py-3 text-xs font-mono text-gray-600">{t.toAccount || '–'}</td>
                  <td className="px-5 py-3 font-semibold text-gray-800">
                    {Number(t.amount).toLocaleString()} <span className="text-xs text-gray-400">{t.currency}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TXN_COLORS[t.status] || 'bg-gray-100 text-gray-500'}`}>
                      {t.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
