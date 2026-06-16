/**
 * Shared hook — fetches the logged-in customer's attached accounts from DB.
 * Used by AccountsPage, TransferPage, PaymentsPage.
 */
import { useQuery } from '@tanstack/react-query'
import api from './api'

export function useAccounts() {
  return useQuery({
    queryKey: ['ib-accounts'],
    queryFn:  () => api.get('/accounts').then(r => r.data.accounts || []),
    staleTime: 5 * 60 * 1000,
  })
}
