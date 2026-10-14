import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import useConnectionStatus from '../../hooks/useConnectionStatus'

export default function RequireAuth(){
  const { user, loading, status } = useAuth()
  const location = useLocation()
  const online = useConnectionStatus()

  // Used to render nothing here - a reload with no internet (and no saved profile on this
  // device) left a blank white page.
  if (loading) {
    return (
      <div className="auth-loading-screen" role="status">
        {online ? 'Loading iGATE…' : 'No internet connection - iGATE will load when the connection is back. The gate keeps working by itself.'}
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // Signed up but not approved (or declined), or a login whose profile was removed (status
  // null) - nothing behind this guard is available yet. /pending handles all three.
  if (!status || status === 'Pending' || status === 'Inactive') return <Navigate to="/pending" replace />

  return <Outlet />
}
