import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function RequireAuth(){
  const { user, loading, status } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // Signed up but not approved (or declined) - nothing behind this guard is available yet.
  if (status === 'Pending' || status === 'Inactive') return <Navigate to="/pending" replace />

  return <Outlet />
}
