import { useCallback, useEffect, useState } from 'react'
import { refreshEmailVerified, resendVerificationEmail } from '../services/auth'
import { markProfileEmailVerified } from '../services/firebase'

const RESEND_ERRORS = {
  'auth/too-many-requests': 'Too many requests - wait a few minutes before resending.',
}

// Drives the "verify your email" step of a pending signup. `verified` is the profile's
// mirrored flag (what admins see); Firebase Auth is only re-checked on mount, when the tab
// regains focus (user coming back from their mail tab), or on an explicit button press -
// Firebase never pushes verification into an already-open session.
export default function useEmailVerification(user, profile) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const verified = Boolean(profile?.emailVerified)

  const check = useCallback(async ({ silent = false } = {}) => {
    if (!user?.uid) return
    setChecking(true)
    try {
      const isVerified = await refreshEmailVerified()
      if (isVerified) {
        await markProfileEmailVerified(user.uid)
        setMessage('')
      } else if (!silent) {
        setMessage("We couldn't confirm it yet - click the link in the email we sent, then try again.")
      }
    } catch (err) {
      if (!silent) setMessage(err.message || 'Unable to check right now.')
    } finally {
      setChecking(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (verified || !user?.uid) return
    check({ silent: true })
    const onFocus = () => check({ silent: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [verified, user?.uid, check])

  const resend = async () => {
    setMessage('')
    try {
      await resendVerificationEmail()
      setMessage(`Verification email sent to ${user?.email}. Check your inbox (and spam).`)
    } catch (err) {
      setMessage(RESEND_ERRORS[err?.code] || err.message || 'Unable to send the email right now.')
    }
  }

  return { verified, checking, message, check, resend }
}
