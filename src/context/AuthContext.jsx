import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, listenToAdminProfile } from '../services/firebase'

const AuthContext = createContext()

export function AuthProvider({children}){
  const [user,setUser] = useState(null)
  const [role,setRole] = useState(null)
  const [authLoading,setAuthLoading] = useState(true)
  const [roleLoading,setRoleLoading] = useState(true)

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth,u=>{
      setUser(u)
      setAuthLoading(false)
      if (!u) {
        setRole(null)
        setRoleLoading(false)
      } else {
        setRoleLoading(true)
      }
    })
    return unsub
  },[])

  useEffect(() => {
    if (!user?.uid) return
    const unsub = listenToAdminProfile(user.uid, (profile) => {
      setRole(profile?.role || null)
      setRoleLoading(false)
    })
    return () => unsub && unsub()
  }, [user?.uid])

  const loading = authLoading || roleLoading

  return <AuthContext.Provider value={{user,role,loading}}>{children}</AuthContext.Provider>
}
export const useAuth = ()=> useContext(AuthContext)
