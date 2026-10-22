import { useEffect, useMemo, useState } from 'react'
import { listenToEmergencyLogs } from '../services/firebase'
import { emergencyStatusOf } from '../models/emergencyLog'

// Every emergency card scan, newest first, each with its `status` ('New' when the scanner's
// record has none yet). One live listener = one source for the Dashboard alert, the event
// modal and Search History; the SDK re-syncs it after a dropped connection, so an alert
// raised while this browser was offline appears once it reconnects. `active` = not resolved.
// Pass `enabled` = a staff role so nothing subscribes before the profile is known.
export default function useEmergencyLogs(enabled = true) {
  const [logs, setLogs] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled) { setLogs([]); return undefined }
    return listenToEmergencyLogs((rows) => { setLogs(rows); setLoaded(true) })
  }, [enabled])

  return useMemo(() => {
    // A record without an IN time is only an exit PATCHed onto a deleted event - not a scan.
    const all = logs
      .filter((log) => typeof log.timestamp === 'number')
      .map((log) => ({ ...log, status: emergencyStatusOf(log) }))
    return { all, active: all.filter((log) => log.status !== 'Resolved'), loaded }
  }, [logs, loaded])
}
