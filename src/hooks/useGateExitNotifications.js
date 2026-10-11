import { useEffect, useRef } from 'react'
import { listenToNewGateLogs, listenToRfidUsers } from '../services/firebase'
import { useToast } from '../context/ToastContext'
import { holderAtTime } from '../utils/cardHolder'

// App-wide toast the instant a vehicle scans OUT, wherever the guard currently is (not just
// while the Dashboard is open) - a quick "who just left" summary. Both RTDB subscriptions are
// gated behind `enabled` (pass `!loading && !!user`): App.jsx mounts this around every route,
// including the public /login, /signup, /pending ones, and gateLogs/rfidUsers both require
// `auth != null` (database.rules.json) - subscribing before that would just be a permission-
// denied console error on every logged-out screen.
export default function useGateExitNotifications(enabled) {
  const { showInfo } = useToast()
  const usersRef = useRef([])

  useEffect(() => {
    if (!enabled) return undefined

    const unsubUsers = listenToRfidUsers((list) => { usersRef.current = list })
    const unsubLogs = listenToNewGateLogs((entry) => {
      const direction = (entry.direction || 'IN').toString().trim().toUpperCase()
      if (direction !== 'OUT') return

      // Who held the card at this OUT - first-match on a pooled visitor card named whichever
      // past visitor happened to be registered on it first.
      const user = holderAtTime(usersRef.current, entry.cardId, entry.cardHex, entry.timestamp)
      const name = user?.name || 'Unknown vehicle'
      const details = [user?.plateNumber, user?.vehicleType].filter(Boolean).join(' · ')
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

      showInfo(`Exited campus: ${name}${details ? ` (${details})` : ''}${time ? ` at ${time}` : ''}.`)
    })

    return () => {
      unsubUsers && unsubUsers()
      unsubLogs && unsubLogs()
    }
  }, [enabled, showInfo])
}
