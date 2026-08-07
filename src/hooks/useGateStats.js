import { useEffect, useMemo, useState } from 'react'
import { listenToGateLogs, listenToRfidUsers } from '../services/firebase'

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

    let vehiclesInsideCampus = 0
    for (const entry of latestByCard.values()) {
      const direction = (entry.direction || 'IN').toString().trim().toUpperCase()
      if (direction !== 'OUT') vehiclesInsideCampus += 1
    }

    const totalRegisteredVehicles = users.filter((u) => (u.status || 'Active') === 'Active').length

    return { totalRegisteredVehicles, vehiclesInsideCampus, todaysEntries, todaysExits }
  }, [logs, users])
}
