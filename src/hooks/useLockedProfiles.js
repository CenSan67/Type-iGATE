import { useEffect, useState } from 'react'
import { listenToLockedProfiles } from '../services/firebase'

// Staff accounts currently locked out after 5 failed sign-in attempts (admin roles only -
// enforced by database.rules.json, same query-scoped pattern as usePendingProfiles).
export default function useLockedProfiles() {
  const [locked, setLocked] = useState([])

  useEffect(() => {
    const unsub = listenToLockedProfiles(setLocked)
    return () => unsub && unsub()
  }, [])

  return locked
}
