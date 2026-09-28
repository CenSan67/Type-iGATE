import { useEffect, useState } from 'react'
import { listenToExpectedGuests } from '../services/firebase'

// Live list of VIP pre-clearance entries (expectedGuests), sorted by their arrival window.
export default function useExpectedGuests() {
  const [guests, setGuests] = useState([])

  useEffect(() => {
    const unsub = listenToExpectedGuests(setGuests)
    return () => unsub && unsub()
  }, [])

  return guests
}
