import { useEffect, useRef, useState } from 'react'
import { listenToGateLogs } from '../services/firebase'

// Waits for the next gate scan to arrive in Firebase after the button is pressed,
// so staff can register/pay for a card by tapping it instead of typing its ID.
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

    unsubRef.current = listenToGateLogs((entries) => {
      const fresh = entries.find((entry) => entry.timestamp && entry.timestamp > startedAt)
      if (fresh) {
        const rfid = (fresh.cardId ?? fresh.cardHex ?? '').toString()
        stopScan()
        onScanned(rfid)
      }
    })
  }

  useEffect(() => () => stopScan(), [])

  return { scanning, startScan, stopScan }
}
