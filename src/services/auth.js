import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, saveAdminProfile } from './firebase'
import { DEFAULT_SIGNUP_ROLE } from '../constants/roles'
import { normalizePhone } from '../utils/validators'

export async function signIn(email,password){
  const res = await signInWithEmailAndPassword(auth,email,password)
  return res.user
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

export async function logOut(){
  await signOut(auth)
}

export default { signIn, signUp, logOut }
