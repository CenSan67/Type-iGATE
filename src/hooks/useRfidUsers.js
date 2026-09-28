import { useEffect, useState } from 'react'
import { listenToRfidUsers } from '../services/firebase'

// Live list of registered vehicles/owners (rfidUsers).
export default function useRfidUsers() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  return users
}
