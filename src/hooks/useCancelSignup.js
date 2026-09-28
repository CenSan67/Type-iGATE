import { useState } from 'react'
import { reauthenticate, deleteOwnAccount } from '../services/auth'
import { getErrorMessage } from '../utils/errors'
import { useToast } from '../context/ToastContext'

const REAUTH_ERRORS = {
  'auth/wrong-password': 'Password is incorrect.',
  'auth/invalid-credential': 'Password is incorrect.',
  'auth/invalid-login-credentials': 'Password is incorrect.',
}

// Drives "cancel signup & start over" on the pending/declined/removed page: confirm the
// password, then delete the person's own profile + login so they can sign up again. Resolves
// true on success (the auth listener then bounces them to /login), false if anything failed.
export default function useCancelSignup() {
  const [busy, setBusy] = useState(false)
  const { showError, showInfo } = useToast()

  const cancelSignup = async (password) => {
    if (!password) {
      showError('Enter your password to confirm.')
      return false
    }
    setBusy(true)
    try {
      await reauthenticate(password)
      await deleteOwnAccount()
      showInfo('Your signup was cancelled. You can sign up again.')
      return true
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to cancel the signup right now.', REAUTH_ERRORS))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, cancelSignup }
}
