import React from 'react'
import useDeviceStatus from '../../hooks/useDeviceStatus'

const formatTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Right after the RFID scanner boots, every scan is denied until its local authorization
// cache has synced at least once (a few minutes on a fresh boot) - see sketch_scanner.ino's
// publishScannerReady(). Without this, that startup window looked identical to the scanner
// being broken, with no way for staff to tell "still warming up" from "something's wrong".
//
// Online/Offline comes from each board's heartbeat (useDeviceStatus). "Ready" is only shown
// while the scanner is online - it used to stay "Ready" after the board was unplugged.
export default function ScannerStatusBadge(){
  const { scanner: status, camera, scannerConnection, cameraConnection } = useDeviceStatus()

  let scannerClass = 'badge-neutral'
  let scannerLabel = 'Scanner: Unknown'
  if (scannerConnection === 'offline') {
    scannerClass = 'badge-negative'
    scannerLabel = 'Scanner: Offline'
  } else if (scannerConnection === 'online') {
    scannerClass = status?.ready ? 'badge-positive' : 'badge-neutral'
    scannerLabel = status?.ready ? 'Scanner: Ready' : 'Scanner: Warming Up'
  }

  const cameraClass = cameraConnection === 'online' ? 'badge-positive' : cameraConnection === 'offline' ? 'badge-negative' : 'badge-neutral'
  const cameraLabel = cameraConnection === 'online' ? 'Camera: Online' : cameraConnection === 'offline' ? 'Camera: Offline' : 'Camera: Unknown'

  return (
    <div className="scanner-status-row">
      <span className={`status-badge ${scannerClass}`}>{scannerLabel}</span>
      <span className={`status-badge ${cameraClass}`}>{cameraLabel}</span>
      {scannerConnection === 'online' && status && !status.ready && <span className="form-hint">Authorization cache syncing - real cards will be denied until this finishes</span>}
      {scannerConnection === 'offline' && <span className="form-hint">Scanner last seen {formatTime(status.lastSeen)} - check its power and Wi-Fi</span>}
      {scannerConnection === 'unknown' && <span className="form-hint">No heartbeat from the scanner yet - is it on and running the latest firmware?</span>}
      {cameraConnection === 'offline' && <span className="form-hint">Camera last seen {formatTime(camera.lastSeen)}</span>}
      {scannerConnection === 'online' && status?.lastSeen && <span className="form-hint">Scanner reported {formatTime(status.lastSeen)}</span>}
    </div>
  )
}
