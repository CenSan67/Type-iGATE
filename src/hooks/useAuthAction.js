import { useEffect, useRef, useState } from 'react'
import { applyEmailVerificationCode, checkPasswordResetCode, completePasswordReset } from '../services/auth'
import { getErrorMessage } from '../utils/errors'

// Handles the link in Firebase's emails (/auth/action?mode=...&oobCode=...).
// status: 'checking' -> 'ready' (reset form) -> 'saving' -> 'done'
//         'checking' -> 'verified' (email verification)
//         'error' (expired / used / invalid link or request) - terminal
const LINK_ERROR = 'This link is invalid or has already been used. Request a new one.'

export default function useAuthAction(mode, code) {
  const [status, setStatus] = useState('checking')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  // A verify code works once - React's dev double-effect must not spend it twice. Starts as
  // undefined, not null: a link with no oobCode gives code === null, which must still run once.
  const handledCode = useRef(undefined)

  useEffect(() => {
    if (handledCode.current === code) return
    handledCode.current = code
    const fail = (err) => { setError(getErrorMessage(err, LINK_ERROR)); setStatus('error') }

    if (!code || (mode !== 'resetPassword' && mode !== 'verifyEmail')) {
      setError('This link is incomplete or not supported. Open the latest link from your email, or request a new one.')
      setStatus('error')
    } else if (mode === 'resetPassword') {
      checkPasswordResetCode(code).then((accountEmail) => { setEmail(accountEmail); setStatus('ready') }, fail)
    } else {
      applyEmailVerificationCode(code).then(() => setStatus('verified'), fail)
    }
  }, [mode, code])

  const submitNewPassword = async (newPassword) => {
    if (status !== 'ready') return // ignore double clicks / resubmits
    setStatus('saving')
    setFormError('')
    try {
      await completePasswordReset(code, newPassword)
      setStatus('done')
    } catch (err) {
      if (err.code === 'auth/expired-action-code' || err.code === 'auth/invalid-action-code' || err.code === 'auth/user-disabled' || err.code === 'auth/user-not-found') {
        setError(getErrorMessage(err, LINK_ERROR, { 'auth/user-not-found': LINK_ERROR }))
        setStatus('error')
      } else {
        setFormError(getErrorMessage(err, 'Could not change the password. Please try again.'))
        setStatus('ready')
      }
    }
  }

  return { status, email, error, formError, submitNewPassword }
}
