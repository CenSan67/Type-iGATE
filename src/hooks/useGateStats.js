import { useEffect, useMemo, useState } from 'react'
import { listenToGateLogs, listenToRfidUsers } from '../services/firebase'
import { holderAtTime } from '../utils/cardHolder'

function cardKey(entry) {
  return (entry.cardId ?? entry.cardHex ?? '').toString().trim().toLowerCase()
}

// "Inside campus" is only knowable by finding each card's single most recent scan
// across the whole gateLogs history - no individual entry carries that on its own,
// so this can't be computed from a single onChildAdded callback, only the full list.
export default function useGateStats(){
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    const unsub = listenToGateLogs(setLogs)
    return () => unsub && unsub()
  }, [])

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  return useMemo(() => {
    const today = new Date().toDateString()
    let todaysEntries = 0
    let todaysExits = 0
    const latestByCard = new Map()

    for (const entry of logs) {
      const key = cardKey(entry)
      if (!key) continue

      const prev = latestByCard.get(key)
      if (!prev || (entry.timestamp || 0) > (prev.timestamp || 0)) latestByCard.set(key, entry)

      const direction = (entry.direction || 'IN').toString().trim().toUpperCase()
      if (entry.timestamp && new Date(entry.timestamp).toDateString() === today) {
        if (direction === 'OUT') todaysExits += 1
        else todaysEntries += 1
      }
    }

    // A card counts as inside only if its latest scan is an IN AND that scan belongs to a
    // registered holder (utils/cardHolder.js - the same attribution the activity tables
    // use). Without the holder check, every unregistered/garbage card id ever logged with
    // a lone IN stayed "inside" forever - 38 junk reads from scanner testing on 10-09/10-10
    // made the count 38 when no registered vehicle was actually inside.
    let vehiclesInsideCampus = 0
    for (const entry of latestByCard.values()) {
      const direction = (entry.direction || 'IN').toString().trim().toUpperCase()
      if (direction === 'OUT') continue
      if (holderAtTime(users, entry.cardId, entry.cardHex, entry.timestamp)) vehiclesInsideCampus += 1
    }

    const totalRegisteredVehicles = users.filter((u) => (u.status || 'Active') === 'Active').length

    return { totalRegisteredVehicles, vehiclesInsideCampus, todaysEntries, todaysExits }
  }, [logs, users])
}
