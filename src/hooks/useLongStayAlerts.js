import { useEffect, useMemo, useState } from 'react'
import { listenToLongStayAlerts } from '../services/firebase'

// Long-stay warnings for every active staff role (rules: Active profile; pass `enabled` = a staff
// role so nothing subscribes before the profile is known). Split into what still needs someone,
// what was acknowledged but has no exit yet, and the last 7 days of resolved history.
export default function useLongStayAlerts(enabled) {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    if (!enabled) { setAlerts([]); return undefined }
    return listenToLongStayAlerts(setAlerts)
  }, [enabled])

  return useMemo(() => ({
    needsAttention: alerts.filter((a) => a.status === 'active' && !a.acknowledgedAt),
    acknowledged: alerts.filter((a) => a.status === 'active' && a.acknowledgedAt),
    resolved: alerts.filter((a) => a.status === 'resolved'),
  }), [alerts])
}
