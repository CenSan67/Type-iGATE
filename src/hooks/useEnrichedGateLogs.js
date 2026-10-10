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
    const candidates = users.filter((u) => {
      const rfid = normalizeId(u.rfidId)
      return rfid && (rfid === cardId || rfid === cardHex)
    })
    // The university lends from a limited pool of physical cards, so more than one
    // rfidUsers record can share the same rfidId over time (one per past/current holder -
    // see services/firebase.js#registerRfidUser). A scan must stay attributed to whoever
    // actually held the card AT THAT TIME, not whoever holds it now - otherwise every past
    // visitor's history on this card silently relabels itself to the newest one the moment
    // the card gets reissued (confirmed: all of a reused card's rows, including ones from
    // before the latest registration, were showing the newest visitor's name). So this
    // picks whichever record was the most recently created one that still existed at or
    // before this scan's own timestamp - the registration actually in effect then. Falls
    // back to the earliest record if the scan is somehow older than all of them (e.g. a
    // clock-skew edge case), rather than showing nothing.
    const user = candidates
      .filter((u) => (u.createdAt || 0) <= (entry.timestamp || Infinity))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
      || candidates.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0]

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
