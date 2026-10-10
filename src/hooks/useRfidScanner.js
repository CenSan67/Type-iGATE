import { useEffect, useRef, useState } from 'react'
import { listenToScannerLastScan } from '../services/firebase'

// Waits for the next raw RFID tap to arrive in Firebase after the button is pressed, so
// staff can register/pay for a card by tapping it instead of typing its ID. Reads
// devices/scanner/lastScan, not gateLogs - a brand-new, not-yet-registered card can never
// appear in gateLogs, since that collection now only ever receives AUTHORIZED scans
// (see sketch_scanner.ino's loop()) - a card being registered for the first time has no
// way to be "authorized" yet by definition.
const CLOCK_SKEW_BUFFER_MS = 3000

export default function useRfidScanner(){
  const [scanning, setScanning] = useState(false)
  const unsubRef = useRef(null)

  const stopScan = () => {
    setScanning(false)
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
  }

  const startScan = (onScanned) => {
    stopScan()
    setScanning(true)
    const startedAt = Date.now() - CLOCK_SKEW_BUFFER_MS

    unsubRef.current = listenToScannerLastScan((lastScan) => {
      if (lastScan?.timestamp && lastScan.timestamp > startedAt) {
        const rfid = (lastScan.cardId ?? lastScan.cardHex ?? '').toString()
        stopScan()
        onScanned(rfid)
      }
    })
  }

  useEffect(() => () => stopScan(), [])

  return { scanning, startScan, stopScan }
}
