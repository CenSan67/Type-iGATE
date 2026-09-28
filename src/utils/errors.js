import { MIN_PASSWORD_LENGTH } from './validators'

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'

// Firebase error codes -> plain-language text. Firebase's own `err.message` ("Firebase: Error
// (auth/invalid-login-credentials).") names the vendor and the internal code, which is noise
// to staff and tells an attacker which check failed, so it is never shown as-is.
const CODE_MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/user-disabled': 'This account is unavailable. Please contact an administrator.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'auth/requires-recent-login': 'Please log out and back in, then try again.',
  'PERMISSION_DENIED': "You don't have permission to do that.",
  'permission-denied': "You don't have permission to do that.",
}

// Anything that still smells like a vendor/internal message after the code lookup is
// replaced by the fallback rather than leaked.
const LEAKY_MESSAGE = /firebase|auth\/|permission[_ -]denied|googleapis|https?:\/\//i

// Messages thrown by our own validators (src/models/*) are already user-facing and pass
// through; `overrides` lets a caller give a code context-specific wording (e.g. the change
// password form, where invalid-credential means "current password is wrong").
export function getErrorMessage(err, fallback = DEFAULT_MESSAGE, overrides = {}) {
  const code = err?.code
  if (code && overrides[code]) return overrides[code]
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]
  const message = err?.message
  if (!message || LEAKY_MESSAGE.test(message)) return fallback
  return message
}
