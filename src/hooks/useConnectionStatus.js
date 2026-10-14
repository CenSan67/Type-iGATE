import { useEffect, useState } from 'react'
import { listenToConnection } from '../services/firebase'

// Grace period before calling the app offline: .info/connected is false for a moment on every
// page load, and a brief Wi-Fi blip shouldn't flash a banner.
const OFFLINE_AFTER_MS = 4000

// true while this browser is connected to Firebase. Starts true so nothing flashes on load.
export default function useConnectionStatus(){
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let timer = null
    const unsub = listenToConnection((isConnected) => {
      clearTimeout(timer)
      if (isConnected) setConnected(true)
      else timer = setTimeout(() => setConnected(false), OFFLINE_AFTER_MS)
    })
    return () => { clearTimeout(timer); unsub && unsub() }
  }, [])

  return connected
}
