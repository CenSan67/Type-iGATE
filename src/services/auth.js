import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode } from 'firebase/auth'
import { auth, saveAdminProfile, deleteAdminProfile } from './firebase'
import { DEFAULT_SIGNUP_ROLE } from '../constants/roles'
import { normalizePhone } from '../utils/validators'

// Repeated wrong passwords are throttled by Firebase Auth itself (auth/too-many-requests,
// enforced server-side for every caller) plus LoginForm's escalating cooldown. There is no
// app-level account lock: anyone can type someone else's email, so a lock that strangers
// can trigger only helps them keep real staff out.
export async function signIn(email,password){
  const res = await signInWithEmailAndPassword(auth,email,password)
  return res.user
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
