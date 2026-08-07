import { useEffect, useState } from 'react'
import { listenToGateLogs, listenToRfidUsers } from '../services/firebase'

function normalizeId(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

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
    const cardId = normalizeId(entry.cardId)
    const cardHex = normalizeId(entry.cardHex)
    const user = users.find((u) => {
      const rfid = normalizeId(u.rfidId)
      return rfid && (rfid === cardId || rfid === cardHex)
    })

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
      department: user?.department || '—',
      role: user?.role || '—',
      // The scan's own snapshot (this specific entry/exit moment) takes priority;
      // fall back to the vehicle's on-file reference photo if this scan has none.
      imageUrl: entry.imageUrl || user?.imageUrl || null,
      rfidUserId: user?.id || null,
    }
  })
}
