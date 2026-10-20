import { useEffect, useState } from 'react'
import { listenToLongStaySettings, saveLongStaySettings } from '../services/firebase'
import { LONG_STAY_DEFAULTS } from '../models/longStay'
import { useAuth } from '../context/AuthContext'

// System Settings' long-stay card: the saved settings (or the defaults while none are saved,
// with isDefault = true) and save(). Admin-only - rules refuse anyone else.
export default function useLongStaySettings() {
  const { user, profile } = useAuth()
  const [saved, setSaved] = useState(undefined) // undefined = loading, null = never saved

  useEffect(() => listenToLongStaySettings(setSaved), [])

  const save = (values) => saveLongStaySettings(values, { name: profile?.fullName || profile?.displayName || user?.email || '' })

  return {
    loading: saved === undefined,
    isDefault: !saved,
    settings: saved || LONG_STAY_DEFAULTS,
    updatedAt: saved?.updatedAt || null,
    updatedByName: saved?.updatedByName || '',
    save,
  }
}
