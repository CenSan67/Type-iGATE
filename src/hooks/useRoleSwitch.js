import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getErrorMessage } from '../utils/errors'

// Long enough to read "Changing to ..." and to hide the page re-rendering for the new role
// underneath; a switch is otherwise instant (it's a client-side view change).
const MIN_VISIBLE_MS = 900

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Runs a "view as" role switch behind the RoleSwitchOverlay. `switchingTo` is the destination
// role while a switch is in progress (null otherwise). Repeat requests are ignored until the
// current one finishes, and the overlay always clears - on success or failure.
export default function useRoleSwitch() {
  const { role, switchRole } = useAuth()
  const { showError } = useToast()
  const [switchingTo, setSwitchingTo] = useState(null)
  const busy = useRef(false)
  // Set in the effect body too: React's dev StrictMode mounts, unmounts and re-mounts once, and
  // a ref that only ever goes false would leave the overlay stuck on screen.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const requestSwitch = async (nextRole) => {
    if (busy.current || !nextRole || nextRole === role) return
    busy.current = true
    setSwitchingTo(nextRole)
    try {
      await Promise.all([wait(MIN_VISIBLE_MS), Promise.resolve().then(() => switchRole(nextRole))])
    } catch (err) {
      showError(getErrorMessage(err, `Couldn't change to ${nextRole}. Please try again.`))
    } finally {
      busy.current = false
      if (mounted.current) setSwitchingTo(null)
    }
  }

  return { switchingTo, requestSwitch }
}
