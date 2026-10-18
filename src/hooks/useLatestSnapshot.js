import { useEffect, useMemo, useRef, useState } from 'react'
import { listenToGateLogs, listenToRfidUsers } from '../services/firebase'
import { holderAtTime } from '../utils/cardHolder'
import { snapshotSource } from '../utils/snapshotUrl'
import useDeviceStatus from './useDeviceStatus'

// After an IN scan, the ESP32-CAM needs a few seconds to capture, upload and PATCH imageUrl
// onto that gateLogs entry. Within this window a scan with no photo yet is shown as "capturing".
export const SNAPSHOT_CAPTURE_WAIT_MS = 45000

const isIn = (entry) => (entry.direction || 'IN').toString().trim().toUpperCase() !== 'OUT'

// Latest vehicle snapshot for the Dashboard. No polling: the photo arrives through the same
// live gateLogs listener the rest of the Dashboard already holds (the SDK shares one
// subscription per path, so this adds no extra download), the moment the camera PATCHes
// imageUrl. Only IN scans count - the camera fires on entry only, and an OUT entry's photo is a
// server-side copy of that vehicle's entry photo (functions/index.js#backfillExitSnapshot).
//
// status: 'loading' | 'capturing' (newest IN scan still waiting for its photo, camera online)
//         | 'ready' (a snapshot to show) | 'empty' (no snapshot recorded yet)
export default function useLatestSnapshot() {
  const [logs, setLogs] = useState(null) // null = first snapshot of gateLogs not received yet
  const [users, setUsers] = useState([])
  const { camera, cameraConnection } = useDeviceStatus() // re-renders every 5 s, which also ends the capture window

  useEffect(() => {
    const unsub = listenToGateLogs(setLogs)
    return () => unsub && unsub()
  }, [])

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  const latest = useMemo(() => {
    if (!logs) return null
    // logs are newest first; skip values that aren't one of our two known image hosts.
    const entry = logs.find((e) => isIn(e) && e.imageUrl)
    if (!entry) return null
    const holder = holderAtTime(users, entry.cardId, entry.cardHex, entry.timestamp)
    return {
      logId: entry.id,
      imageUrl: entry.imageUrl,
      source: snapshotSource(entry.imageUrl), // null = invalid URL, never loaded
      timestamp: entry.timestamp,
      rfidId: holder?.rfidId || entry.cardId?.toString() || entry.cardHex || '',
      name: holder?.name || '',
      plateNumber: holder?.plateNumber || '',
      vehicleType: holder?.vehicleType || '',
    }
  }, [logs, users])

  const newestIn = logs ? logs.find(isIn) : null
  const waitingForPhoto = Boolean(
    newestIn && !newestIn.imageUrl && newestIn.id !== latest?.logId
    && Date.now() - (newestIn.timestamp || 0) < SNAPSHOT_CAPTURE_WAIT_MS
    && cameraConnection === 'online',
  )
  // The newest IN scan finished its capture window without a photo (camera off, or the
  // simulated scan's trigger couldn't reach the camera) - shown as a note, not an error.
  const latestScanMissedPhoto = Boolean(newestIn && !newestIn.imageUrl && newestIn.id !== latest?.logId && !waitingForPhoto)

  let status = 'loading'
  if (logs) status = waitingForPhoto ? 'capturing' : latest ? 'ready' : 'empty'

  // Bumps when a snapshot newer than the one present at load arrives (for "New" / auto pop-up).
  const firstSeenId = useRef(undefined)
  const [freshId, setFreshId] = useState(null)
  useEffect(() => {
    if (!logs) return
    if (firstSeenId.current === undefined) { firstSeenId.current = latest?.logId || null; return }
    if (latest?.logId && latest.logId !== firstSeenId.current) setFreshId(latest.logId)
  }, [logs, latest?.logId])

  return { status, latest, freshId, latestScanMissedPhoto, camera, cameraConnection }
}
