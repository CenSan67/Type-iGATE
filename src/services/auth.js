import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword, signOut, verifyBeforeUpdateEmail, verifyPasswordResetCode } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions, saveAdminProfile, deleteAdminProfile } from './firebase'
import { DEFAULT_SIGNUP_ROLE } from '../constants/roles'
import { normalizePhone, normalizeUsername, isValidUsername } from '../utils/validators'

const signInWithUsernameFn = httpsCallable(functions, 'signInWithUsername')
const setUsernameFn = httpsCallable(functions, 'setUsername')

// Callable failures re-coded as the auth/* codes the login form already handles, so username
// and email logins show the same messages ("Incorrect email/username or password", ...).
const USERNAME_LOGIN_CODES = {
  'functions/unauthenticated': 'auth/invalid-credential',
  'functions/resource-exhausted': 'auth/too-many-requests',
  'functions/permission-denied': 'auth/user-disabled',
}

function authError(code) {
  const err = new Error(code)
  err.code = code
  return err
}

// Repeated wrong passwords are throttled by Firebase Auth itself (auth/too-many-requests,
// enforced server-side for every caller) plus LoginForm's escalating cooldown. There is no
// app-level account lock: anyone can type someone else's email, so a lock that strangers
// can trigger only helps them keep real staff out.
//
// `identifier` is an email (contains "@") or a username. Usernames are resolved by the
// signInWithUsername Cloud Function, which checks the password and returns a one-time token
// for that account - the email behind a username never reaches the browser.
export async function signIn(identifier, password){
  const id = (identifier || '').trim()
  if (id.includes('@')) {
    const res = await signInWithEmailAndPassword(auth, id, password)
    return res.user
  }
  // A malformed username can't exist - same answer as a wrong password, without a server call.
  if (!isValidUsername(id)) throw authError('auth/invalid-credential')
  let result
  try {
    result = await signInWithUsernameFn({ username: normalizeUsername(id), password })
  } catch (err) {
    throw USERNAME_LOGIN_CODES[err.code] ? authError(USERNAME_LOGIN_CODES[err.code]) : err
  }
  const cred = await signInWithCustomToken(auth, result.data.token)
  return cred.user
}

// Claims or changes the signed-in user's own username (server-side, unique, transactional).
export async function claimUsername(username){
  const result = await setUsernameFn({ username: normalizeUsername(username) })
  return result.data.username
}

// Self-service "forgot password" - sends Firebase's own reset-link email. Doesn't reveal
// whether the address has an account (the caller shows the same message either way).
export async function resetPassword(email){
  await sendPasswordResetEmail(auth, email.trim()).catch((err) => {
    if (err.code === 'auth/user-not-found') return // swallow - avoid confirming the email doesn't exist
    throw err
  })
}

// The reset/verify link in Firebase's email opens /auth/action?mode=...&oobCode=... (the
// action URL set in Firebase console -> Authentication -> Templates). The code itself, its
// one-time use and its expiry are all Firebase's; these only hand it back to Firebase.
// verifyPasswordResetCode returns the account's email without changing anything.
export async function checkPasswordResetCode(code){
  return verifyPasswordResetCode(auth, code)
}

export async function completePasswordReset(code, newPassword){
  await confirmPasswordReset(auth, code, newPassword)
}

export async function applyEmailVerificationCode(code){
  await applyActionCode(auth, code)
}

// Self-service signup. The account is created Pending: the stored role is the harmless
// DEFAULT_SIGNUP_ROLE, the role the user picked goes in `requestedRole`, and nothing works
// until they verify their email and an admin approves them. database.rules.json enforces
// all of this server-side - a client can't self-create as Active or with a higher role.
export async function signUp({ email, password, fullName, phone, requestedRole, username }){
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  let profileSaved = false
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
    profileSaved = true
    if (username) await claimUsername(username)
  } catch (err) {
    // Don't leave a half-made account behind (no profile, or a username that was taken) - the
    // person can simply sign up again with the same email.
    if (profileSaved) await deleteAdminProfile(cred.user.uid).catch(() => {})
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

// Change of login email, Firebase's "verify before update" way: after re-checking the current
// password, Firebase emails a confirmation link to the NEW address and only switches the
// account once that link is opened (a typo or someone else's address can't take it over).
// Firebase also notifies the old address, with a link to undo it. The adminProfiles copy of the
// email is brought in line on the next sign-in (AuthContext -> syncProfileEmail).
export async function requestEmailChange(newEmail, currentPassword){
  const user = auth.currentUser
  if (!user) throw authError('auth/requires-recent-login')
  await reauthenticate(currentPassword)
  await verifyBeforeUpdateEmail(user, newEmail.trim())
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
