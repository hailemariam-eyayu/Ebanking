/**
 * Shared hook — fetches the logged-in customer's attached accounts from DB.
 * Used by AccountsPage, TransferPage, PaymentsPage.
 *
 * Key includes customerId so switching between users (owner ↔ sub-user)
 * always fetches fresh data rather than serving a stale cache.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from './api'

export function useAccounts() {
  const { user } = useAuth()
  // Use the customer's ID (shared by all sub-users of the same customer) as cache key
  const customerId = user?.customerId ?? user?.customer?.id ?? null

  return useQuery({
    queryKey:  ['ib-accounts', customerId],
    queryFn:   () => api.get('/accounts').then(r => r.data.accounts || []),
    staleTime: 2 * 60 * 1000,
    enabled:   !!customerId,  // don't fetch if not logged in
  })
}
