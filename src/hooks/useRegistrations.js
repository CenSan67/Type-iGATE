import { useEffect, useState } from 'react'
import { listenToRegistrations } from '../services/firebase'

// Imported Google Forms registrations (registrations/), newest import first. Admin-only (rules).
export default function useRegistrations() {
  const [registrations, setRegistrations] = useState([])
  useEffect(() => {
    const unsub = listenToRegistrations(setRegistrations)
    return () => unsub && unsub()
  }, [])
  return registrations
}
