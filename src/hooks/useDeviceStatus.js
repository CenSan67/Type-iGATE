import { useEffect, useState } from 'react'
import { listenToScannerStatus, listenToCameraStatus, listenToServerTimeOffset } from '../services/firebase'

// Both boards write a heartbeat (devices/{scanner,camera}/lastSeen, Firebase server time)
// every ~30 s. Missing two in a row = Offline. `ready` alone can't tell: the scanner writes
// it once at boot, so it stayed "Ready" after the board was unplugged.
export const DEVICE_OFFLINE_AFTER_MS = 75000
const RECHECK_MS = 5000

// 'online' | 'offline' | 'unknown' (no heartbeat ever received - e.g. firmware not re-flashed)
function connectionOf(device, serverNow){
  if (!device?.lastSeen) return 'unknown'
  return serverNow - device.lastSeen <= DEVICE_OFFLINE_AFTER_MS ? 'online' : 'offline'
}

export default function useDeviceStatus(){
  const [scanner, setScanner] = useState(null)
  const [camera, setCamera] = useState(null)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const unsubs = [
      listenToScannerStatus(setScanner),
      listenToCameraStatus(setCamera),
      listenToServerTimeOffset(setOffset),
    ]
    return () => unsubs.forEach((unsub) => unsub && unsub())
  }, [])

  // Re-evaluate on a timer: going offline is the ABSENCE of an update, so no listener fires.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS)
    return () => clearInterval(timer)
  }, [])

  const serverNow = now + offset
  return {
    scanner,
    camera,
    scannerConnection: connectionOf(scanner, serverNow),
    cameraConnection: connectionOf(camera, serverNow),
  }
}
