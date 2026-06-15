import { Users, UserCheck, Activity, TrendingUp } from 'lucide-react'

const stats = [
  { label: 'Total Customers',   value: '–', icon: Users,       color: 'bg-blue-500' },
  { label: 'Active IB Users',   value: '–', icon: UserCheck,   color: 'bg-green-500' },
  { label: 'Pending Requests',  value: '–', icon: Activity,    color: 'bg-amber-500' },
  { label: 'Transactions Today',value: '–', icon: TrendingUp,  color: 'bg-purple-500' },
]

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className={`${s.color} rounded-xl p-3 text-white`}>
              <s.icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 py-16">
        Analytics charts will load here once backend data is available.
      </div>
    </div>
  )
}
