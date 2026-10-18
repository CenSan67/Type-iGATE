import { useEffect, useState } from 'react'
import { listenToGateLogs, listenToRfidUsers } from '../services/firebase'
import { holderAtTime } from '../utils/cardHolder'

// gateLogs entries only ever carry cardId/cardHex/direction/timestamp (that's all
// the RFID scanner hardware knows). This joins each scan against the registered
// rfidUsers so pages can show a name, plate, department, etc. for it.
export default function useEnrichedGateLogs(){
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

  return logs.map((entry) => {
    // Attributed to whoever held the card AT THIS SCAN's time - not whoever holds it now,
    // and nobody if the pass had already been returned (a pooled visitor card between
    // holders). See utils/cardHolder.js.
    const user = holderAtTime(users, entry.cardId, entry.cardHex, entry.timestamp)

    const rawDirection = entry.direction || entry.dir || 'IN'
    const direction = rawDirection.toString().trim().toUpperCase() === 'OUT' ? 'OUT' : 'IN'

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      direction,
      rfidId: user?.rfidId || entry.cardId?.toString() || entry.cardHex || 'N/A',
      name: user?.name || 'Unknown',
      plateNumber: user?.plateNumber || '—',
      vehicleType: user?.vehicleType || '—',
      vehicleBrand: user?.vehicleBrand || '',
      department: user?.department || '—',
      role: user?.role || '—',
      // The scan's own snapshot (this specific entry/exit moment) takes priority;
      // fall back to the vehicle's on-file reference photo if this scan has none.
      imageUrl: entry.imageUrl || user?.imageUrl || null,
      rfidUserId: user?.id || null,
    }
  })
}
