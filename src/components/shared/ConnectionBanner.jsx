import React from 'react'
import useConnectionStatus from '../../hooks/useConnectionStatus'

// Shown on every page while this browser has lost its connection to Firebase. The gate keeps
// working on its own (the scanner checks cards from its saved list and uploads the scans
// later), so this is about what the web app can't do until the connection is back.
export default function ConnectionBanner(){
  const connected = useConnectionStatus()
  if (connected) return null
  return (
    <div className="connection-banner" role="status">
      <strong>No internet connection.</strong> The gate still works by itself and uploads its scans when it reconnects.
      Gate Control, registration, Return Pass and guest check-in/out are paused, and the logs on this page may be out of date.
    </div>
  )
}
