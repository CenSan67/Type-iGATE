import { useEffect, useState } from 'react'
import { listenToPendingProfiles } from '../services/firebase'

// Signups awaiting admin approval (admin roles only - enforced by database.rules.json).
export default function usePendingProfiles() {
  const [pending, setPending] = useState([])

  useEffect(() => {
    const unsub = listenToPendingProfiles(setPending)
    return () => unsub && unsub()
  }, [])

  return pending
}
