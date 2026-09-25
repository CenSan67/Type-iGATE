import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, listenToAdminProfile } from '../services/firebase'
import { getViewableRoles } from '../constants/roles'

const AuthContext = createContext()

const VIEW_ROLE_KEY = (uid) => `igate_view_role_${uid}`

function readStoredViewRole(uid) {
  try { return localStorage.getItem(VIEW_ROLE_KEY(uid)) } catch { return null }
}

function writeStoredViewRole(uid, value) {
  try { localStorage.setItem(VIEW_ROLE_KEY(uid), value) } catch { /* storage unavailable - view role just won't persist */ }
}

export function AuthProvider({children}){
  const [user,setUser] = useState(null)
  const [realRole,setRealRole] = useState(null)
  const [profile,setProfile] = useState(null)
  const [viewRole,setViewRole] = useState(null)
  const [authLoading,setAuthLoading] = useState(true)
  const [roleLoading,setRoleLoading] = useState(true)

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth,u=>{
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
    const unsub = listenToAdminProfile(user.uid, (nextProfile) => {
      const nextRealRole = nextProfile?.role || null
      // Restore the last "view as" choice in the same batch as the real role (no flash of
      // the wrong UI), but only if it's still allowed for that role - so a demoted account,
      // or a tampered localStorage value, can't keep a higher view than it's entitled to.
      const stored = readStoredViewRole(user.uid)
      setRealRole(nextRealRole)
      setProfile(nextProfile)
      setViewRole(getViewableRoles(nextRealRole).includes(stored) ? stored : nextRealRole)
      setRoleLoading(false)
    })
    return () => unsub && unsub()
  }, [user?.uid])

  const availableRoles = getViewableRoles(realRole)

  const switchRole = (nextRole) => {
    if (!user?.uid || !availableRoles.includes(nextRole)) return
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
