import { useCallback, useMemo, useState } from 'react'

// Visit-scoped remarks, shared by the Dashboard (RecentActivityTable) and Search History.
//
// A remark belongs to a PERSON (their rfidUsers record id - so a pooled visitor card's next
// holder never inherits it), not to one scan row, and lasts for that person's current
// visit: it stays through their OUT and is cleared automatically by their NEXT IN. So a
// remark written on the Dashboard shows on that person in Search History too, and both
// pages agree on when it disappears.
//
// Stored in this browser's localStorage, like the previous per-row/per-card remarks (which
// lived under a different key and are no longer read).
const STORAGE_KEY = 'igate_visit_remarks'

function loadRemarks(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

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
  const [remarks, setRemarks] = useState(loadRemarks) // { [personKey]: { text, at } }

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
  // Returns { text, at, visitStart } - visitStart = the IN that began the remarked visit.
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

  const saveRemark = useCallback((key, text) => {
    setRemarks((prev) => {
      const next = { ...prev }
      if (text && text.trim()) next[key] = { text: text.trim(), at: Date.now() }
      else delete next[key]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage unavailable - kept in memory */ }
      return next
    })
  }, [])

  return { remarkFor, entryHasRemark, saveRemark }
}
