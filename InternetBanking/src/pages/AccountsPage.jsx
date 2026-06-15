import { useQuery } from '@tanstack/react-query'
import { CreditCard, Eye } from 'lucide-react'
import api from '../lib/api'

export default function AccountsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ib-accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Accounts</h2>
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading accounts…</div>
      ) : (
        <>
          {(data?.accounts || []).length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">
              <CreditCard size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Account list endpoint is pending.</p>
              <p className="text-xs text-gray-300 mt-1">{data?.note}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.accounts.map(acc => (
                <div key={acc.ACC} className="rounded-2xl p-5 text-white shadow-lg"
                  style={{ background: 'var(--ib-gradient)' }}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="text-xs text-white/60">Account</div>
                    <CreditCard size={20} className="text-white/60" />
                  </div>
                  <div className="font-mono text-lg tracking-widest mb-4">{acc.ACC}</div>
                  <div className="flex justify-between text-sm">
                    <div>
                      <div className="text-white/50 text-xs">Currency</div>
                      <div className="font-semibold">{acc.CCY}</div>
                    </div>
                    <div>
                      <div className="text-white/50 text-xs">Balance</div>
                      <div className="font-semibold">{acc.ACBAL || '–'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
