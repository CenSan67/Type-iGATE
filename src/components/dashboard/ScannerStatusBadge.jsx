import React, { useEffect, useState } from 'react'
import { listenToScannerStatus } from '../../services/firebase'

// Right after the RFID scanner boots, every scan is denied until its local authorization
// cache has synced at least once (a few minutes on a fresh boot) - see sketch_scanner.ino's
// publishScannerReady(). Without this, that startup window looked identical to the scanner
// being broken, with no way for staff to tell "still warming up" from "something's wrong".
export default function ScannerStatusBadge(){
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const unsub = listenToScannerStatus(setStatus)
    return () => unsub && unsub()
  }, [])

  const badgeClass = status?.ready ? 'badge-positive' : 'badge-neutral'
  const badgeLabel = !status ? 'Scanner: Unknown' : status.ready ? 'Scanner: Ready' : 'Scanner: Warming Up'

  return (
    <div className="scanner-status-row">
      <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
      {status && !status.ready && <span className="form-hint">Authorization cache syncing - real cards will be denied until this finishes</span>}
      {status?.updatedAt && <span className="form-hint">Reported {new Date(status.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
    </div>
  )
}
