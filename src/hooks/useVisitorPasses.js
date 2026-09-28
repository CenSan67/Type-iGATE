import { useMemo } from 'react'
import useRfidUsers from './useRfidUsers'

// Active walk-in visitor passes (role 'Visitor', status 'Active') - the ones a guard issued
// directly from the Dashboard's Register Visitor form. VIP guest passes are the same
// rfidUsers shape but are returned through GuestClearancePanel's Check Out instead, so
// `linkedRfidIds` (expectedGuests entries' own rfidId) excludes them from this list.
export default function useVisitorPasses(linkedRfidIds = []) {
  const users = useRfidUsers()

  return useMemo(() => {
    const linked = new Set(linkedRfidIds.filter(Boolean).map((id) => id.toString().toLowerCase()))
    return users.filter((u) => u.role === 'Visitor' && u.status === 'Active' && !linked.has((u.rfidId || '').toString().toLowerCase()))
  }, [users, linkedRfidIds])
}
