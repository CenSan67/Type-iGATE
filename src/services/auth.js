import { createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions, saveAdminProfile, deleteAdminProfile } from './firebase'
import { DEFAULT_SIGNUP_ROLE } from '../constants/roles'
import { normalizePhone } from '../utils/validators'

const checkLoginLockFn = httpsCallable(functions, 'checkLoginLock')
const recordFailedLoginFn = httpsCallable(functions, 'recordFailedLogin')
const resetLoginAttemptsFn = httpsCallable(functions, 'resetLoginAttempts')

const WRONG_CREDENTIAL_CODES = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found']

// Thrown when a sign-in is blocked by the 5-failed-attempts lock (see functions/index.js).
// Not a Firebase error, so it gets its own code - getErrorMessage/LoginForm special-case it
// to show the actual unlock time rather than a generic string.
function accountLockedError(retryAt) {
  const err = new Error('Account temporarily locked')
  err.code = 'app/account-locked'
  err.retryAt = retryAt
  return err
}

export async function signIn(email,password){
  // Checked before every attempt, not just after 5 failures land, so a locked account
  // never even reaches signInWithEmailAndPassword - and so an expired lock (see
  // LOCK_DURATION_MS server-side) clears itself right here on the next attempt.
  const precheck = await checkLoginLockFn({ email }).catch(() => ({ data: { locked: false } }))
  if (precheck.data?.locked) throw accountLockedError(precheck.data.retryAt)

  try {
    const res = await signInWithEmailAndPassword(auth,email,password)
    // Best-effort - a failure here shouldn't block a successful sign-in.
    resetLoginAttemptsFn().catch(() => {})
    return res.user
  } catch (err) {
    if (WRONG_CREDENTIAL_CODES.includes(err.code)) {
      const record = await recordFailedLoginFn({ email }).catch(() => null)
      if (record?.data?.locked) throw accountLockedError(record.data.retryAt)
      if (typeof record?.data?.attemptsRemaining === 'number') {
        err.attemptsRemaining = record.data.attemptsRemaining
      }
    }
    throw err
  }
}

// Self-service "forgot password" - sends Firebase's own reset-link email. Doesn't reveal
// whether the address has an account (the caller shows the same message either way); if it
// does, wrong-password lockout is irrelevant here since this doesn't touch failedLoginAttempts.
export async function resetPassword(email){
  await sendPasswordResetEmail(auth, email).catch((err) => {
    if (err.code === 'auth/user-not-found') return // swallow - avoid confirming the email doesn't exist
    throw err
  })
}

// Self-service signup. The account is created Pending: the stored role is the harmless
// DEFAULT_SIGNUP_ROLE, the role the user picked goes in `requestedRole`, and nothing works
// until they verify their email and an admin approves them. database.rules.json enforces
// all of this server-side - a client can't self-create as Active or with a higher role.
export async function signUp({ email, password, fullName, phone, requestedRole }){
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  try {
    await saveAdminProfile(cred.user.uid, {
      fullName,
      displayName: fullName.split(/\s+/)[0],
      email,
      phone: normalizePhone(phone),
      role: DEFAULT_SIGNUP_ROLE,
      requestedRole,
      status: 'Pending',
      emailVerified: false,
      joinedDate: new Date().toISOString().slice(0, 10),
    })
  } catch (err) {
    // Don't leave a login with no profile behind (it could never reach any role-gated page).
    await deleteUser(cred.user).catch(() => {})
    throw err
  }
  // A failed send isn't fatal - the pending page has a "Resend" button.
  await sendEmailVerification(cred.user).catch(() => {})
  return cred.user
}

export async function resendVerificationEmail(){
  await sendEmailVerification(auth.currentUser)
}

// Firebase doesn't push "email verified" to an open session - reload the user, and force a
// fresh ID token so database.rules.json's auth.token.email_verified check sees it too.
export async function refreshEmailVerified(){
  await auth.currentUser.reload()
  await auth.currentUser.getIdToken(true)
  return auth.currentUser.emailVerified
}

// Firebase only lets a user delete their own login shortly after signing in, so the caller
// reauthenticates with the password first (this also confirms it's really them).
export async function reauthenticate(password){
  const user = auth.currentUser
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
}

// Lets someone whose signup was wrong/declined/removed clear their own login so they can sign
// up again (e.g. with a corrected email). Profile first: rules need the still-valid session.
export async function deleteOwnAccount(){
  const user = auth.currentUser
  await deleteAdminProfile(user.uid)
  await deleteUser(user)
}

export async function logOut(){
  await signOut(auth)
}

export default { signIn, signUp, logOut, resetPassword }
