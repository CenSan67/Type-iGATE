import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, listenToAdminProfile, syncProfileEmail } from '../services/firebase'
import { getViewableRoles } from '../constants/roles'

const AuthContext = createContext()

const VIEW_ROLE_KEY = (uid) => `igate_view_role_${uid}`

function readStoredViewRole(uid) {
  try { return localStorage.getItem(VIEW_ROLE_KEY(uid)) } catch { return null }
}

function writeStoredViewRole(uid, value) {
  try { localStorage.setItem(VIEW_ROLE_KEY(uid), value) } catch { /* storage unavailable - view role just won't persist */ }
}

// Offline reload: the Realtime Database keeps nothing on disk, so the profile listener never
// answers without internet and the app used to stay blank. The last profile seen on this
// device is kept here and used if the live one hasn't arrived after PROFILE_FALLBACK_MS. UI
// only - the database rules still check the real profile on every read/write.
const PROFILE_CACHE_KEY = (uid) => `igate_profile_cache_${uid}`
const PROFILE_FALLBACK_MS = 4000

function readCachedProfile(uid) {
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY(uid)) || 'null') } catch { return null }
}

function writeCachedProfile(uid, value) {
  try { localStorage.setItem(PROFILE_CACHE_KEY(uid), JSON.stringify(value ?? null)) } catch { /* storage unavailable - offline reload just waits for the live profile */ }
}

// On sign-out the cached copy goes too, so a shared guardhouse PC doesn't keep the last
// person's name/role/phone after they log out.
function clearCachedProfile(uid) {
  try { localStorage.removeItem(PROFILE_CACHE_KEY(uid)) } catch { /* storage unavailable - nothing was cached */ }
}

export function AuthProvider({children}){
  const [user,setUser] = useState(null)
  const [realRole,setRealRole] = useState(null)
  const [profile,setProfile] = useState(null)
  const [viewRole,setViewRole] = useState(null)
  const [authLoading,setAuthLoading] = useState(true)
  const [roleLoading,setRoleLoading] = useState(true)

  const signedInUid = useRef(null)

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth,u=>{
      if (!u && signedInUid.current) clearCachedProfile(signedInUid.current)
      signedInUid.current = u?.uid || null
      setUser(u)
      setAuthLoading(false)
      if (!u) {
        setRealRole(null)
        setProfile(null)
        setViewRole(null)
        setRoleLoading(false)
      } else {
        setRoleLoading(true)
      }
    })
    return unsub
  },[])

  useEffect(() => {
    if (!user?.uid) return
    let liveArrived = false
    const applyProfile = (nextProfile) => {
      const nextRealRole = nextProfile?.role || null
      // Restore the last "view as" choice in the same batch as the real role (no flash of
      // the wrong UI), but only if it's still allowed for that role - so a demoted account,
      // or a tampered localStorage value, can't keep a higher view than it's entitled to.
      const stored = readStoredViewRole(user.uid)
      setRealRole(nextRealRole)
      setProfile(nextProfile)
      setViewRole(getViewableRoles(nextRealRole).includes(stored) ? stored : nextRealRole)
      setRoleLoading(false)
    }
    const unsub = listenToAdminProfile(user.uid, (nextProfile) => {
      liveArrived = true
      writeCachedProfile(user.uid, nextProfile)
      applyProfile(nextProfile)
      // A confirmed email change lives in Firebase Auth; mirror it onto the profile once.
      if (nextProfile?.email && user.email && nextProfile.email.toLowerCase() !== user.email.toLowerCase()) {
        syncProfileEmail(user.uid, user.email).catch(() => { /* e.g. Inactive account - rules refuse; harmless */ })
      }
    })
    const fallback = setTimeout(() => {
      const cached = readCachedProfile(user.uid)
      if (!liveArrived && cached) applyProfile(cached)
    }, PROFILE_FALLBACK_MS)
    return () => { clearTimeout(fallback); unsub && unsub() }
  }, [user?.uid])

  const availableRoles = getViewableRoles(realRole)

  // Changes only what the UI shows ("view as"); it can only go DOWN from the real role, and the
  // database rules keep enforcing realRole either way. Throws if the switch isn't allowed, so the
  // caller (hooks/useRoleSwitch.js) can tell the user instead of silently doing nothing.
  const switchRole = (nextRole) => {
    if (!user?.uid) throw new Error('Your session has ended. Please sign in again.')
    if (!availableRoles.includes(nextRole)) throw new Error(`Your account can't switch to ${nextRole}.`)
    setViewRole(nextRole)
    writeStoredViewRole(user.uid, nextRole)
  }

  // `role` is the *active* (possibly lowered) role every existing guard/component reads.
  // `realRole` is what's actually stored in adminProfiles/{uid} - the RTDB rules always
  // enforce this one, so switching view never changes real backend permissions.
  const role = availableRoles.includes(viewRole) ? viewRole : realRole

  const status = profile?.status || null // Pending | Active | Inactive (null = no profile record)
  const loading = authLoading || roleLoading

  return (
    <AuthContext.Provider value={{user,role,realRole,profile,status,availableRoles,switchRole,loading}}>
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth = ()=> useContext(AuthContext)
