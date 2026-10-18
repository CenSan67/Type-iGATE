import { useCallback, useEffect, useMemo, useState } from 'react'
import { listenToVisitRemarks, saveVisitRemark } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

// Visit-scoped remarks, shared by the Dashboard (RecentActivityTable) and Search History.
//
// A remark belongs to a PERSON (their rfidUsers record id - so a pooled visitor card's next
// holder never inherits it), not to one scan row, and lasts for that person's current
// visit: it stays through their OUT and is cleared automatically by their NEXT IN. So a
// remark written on the Dashboard shows on that person in Search History too, and both
// pages agree on when it disappears.
//
// Stored in the Realtime Database (visitRemarks/{personKey}, models/visitRemark.js), so every
// staff member and device sees the same remark. It used to live in each browser's
// localStorage (igate_visit_remarks), which is no longer read.

// Who a scan row is for remark purposes: the rfidUsers record it's attributed to, else the
// card number (a scan whose holder is unknown). For an rfidUsers record itself (Search
// History's person) the key is simply its own id.
export function remarkKeyOf(entry){
  if (!entry) return ''
  if (entry.rfidUserId) return entry.rfidUserId
  return `card:${(entry.rfidId ?? '').toString().toLowerCase()}`
}

// `entries` = enriched gate logs (useEnrichedGateLogs) - needed to know each person's IN times.
export function useRemarks(entries = []){
  const [remarks, setRemarks] = useState({}) // { [personKey]: { text, at, by, byName } }
  const { user, profile } = useAuth()

  useEffect(() => {
    const unsub = listenToVisitRemarks(setRemarks)
    return () => unsub && unsub()
  }, [])

  // Every IN timestamp per person, ascending.
  const insByPerson = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      if (e.direction !== 'IN' || !e.timestamp) continue
      const key = remarkKeyOf(e)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e.timestamp)
    }
    for (const list of map.values()) list.sort((a, b) => a - b)
    return map
  }, [entries])

  // The remark still in force for this person: none of their INs happened after it.
  // Returns { text, at, by, byName, visitStart } - visitStart = the IN that began the remarked visit.
  const remarkFor = useCallback((key) => {
    const remark = remarks[key]
    if (!remark?.text) return null
    const ins = insByPerson.get(key) || []
    if (ins.some((t) => t > remark.at)) return null // they came back in - cleared
    const visitStart = ins.filter((t) => t <= remark.at).pop() ?? 0
    return { ...remark, visitStart }
  }, [remarks, insByPerson])

  // True for scan rows that belong to the remarked visit (its IN and everything after).
  const entryHasRemark = useCallback((entry) => {
    const active = remarkFor(remarkKeyOf(entry))
    return !!active && (entry.timestamp || 0) >= active.visitStart
  }, [remarkFor])

  // Saves the remark (empty text removes it). Throws on failure so the caller can show it.
  const saveRemark = useCallback((key, text) => (
    saveVisitRemark(key, text, { name: profile?.fullName || profile?.displayName || user?.email || '' })
  ), [profile, user])

  return { remarkFor, entryHasRemark, saveRemark }
}
