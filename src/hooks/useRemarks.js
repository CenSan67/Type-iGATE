import { useCallback, useEffect, useMemo, useState } from 'react'
import { listenToVisitRemarks, saveVisitRemark } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { buildVisitIndex, remarksByVisit } from '../utils/visitRemarks'

export { remarkKeyOf } from '../utils/visitRemarks'

// Visit remarks, shared by the Dashboard (RecentActivityTable) and Search History.
//
// A remark belongs to ONE VISIT of one person: their IN scan and the OUT that follows it. It is
// stored under that IN's gateLogs id (visitRemarks/{inLogId}, models/visitRemark.js), so:
//   - it shows on that visit's IN row and on its OUT row (still there after they exit)
//   - their next IN is a new visit with no remark, and the old remark stays with the old visit
//     (Search History shows it when that visit's IN or OUT row is selected)
// "Person" = the rfidUsers record the scan is attributed to (so a pooled visitor card's next
// holder never inherits a remark), else the card number for an unknown holder.
//
// Older remarks were stored one per person (visitRemarks/{personKey}, no personKey field) and
// overwritten every visit; each is shown on the visit it was written during until someone edits
// it, which moves it to the per-visit key (utils/visitRemarks.js).

// `entries` = ALL enriched gate logs (useEnrichedGateLogs) - visits need each person's full history.
export function useRemarks(entries = []){
  const [remarks, setRemarks] = useState({})
  const { user, profile } = useAuth()

  useEffect(() => {
    const unsub = listenToVisitRemarks(setRemarks)
    return () => unsub && unsub()
  }, [])

  const { visits, insByPerson } = useMemo(() => buildVisitIndex(entries), [entries])
  const byVisit = useMemo(() => remarksByVisit(remarks, insByPerson), [remarks, insByPerson])

  // The remark of the visit this scan row belongs to, or null.
  const remarkFor = useCallback((entryId) => {
    const visit = visits.get(entryId)
    return (visit && byVisit.get(visit.visitId)) || null
  }, [visits, byVisit])

  // Saves (empty text removes) the remark of the visit this scan row belongs to. Throws on
  // failure so the caller can show it.
  const saveRemark = useCallback((entryId, text) => {
    const visit = visits.get(entryId)
    if (!visit) return Promise.reject(new Error('This scan could not be matched to a visit.'))
    const legacyKey = byVisit.get(visit.visitId)?.legacyKey || null
    return saveVisitRemark(visit.visitId, text, { name: profile?.fullName || profile?.displayName || user?.email || '' }, { personKey: visit.personKey, legacyKey })
  }, [visits, byVisit, profile, user])

  return { remarkFor, saveRemark }
}
