import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from './firebase'

export async function signIn(email,password){
  const res = await signInWithEmailAndPassword(auth,email,password)
  return res.user
}

export async function logOut(){
  await signOut(auth)
}

export default { signIn, logOut }
