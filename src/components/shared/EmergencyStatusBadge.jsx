import React from 'react'

// Status of an emergency scan as text + icon, never color alone (Dashboard alert, event modal,
// Search History). Unknown values show as New, same as models/emergencyLog.js#emergencyStatusOf.
const STYLES = {
  New: { className: 'badge-negative', icon: '!' },
  Acknowledged: { className: 'badge-warn', icon: '✓' },
  'In Progress': { className: 'badge-warn', icon: '…' },
  Resolved: { className: 'badge-positive', icon: '✔' },
}

export default function EmergencyStatusBadge({ status }){
  const label = STYLES[status] ? status : 'New'
  const { className, icon } = STYLES[label]
  return (
    <span className={`status-badge ${className} emergency-status`}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  )
}
