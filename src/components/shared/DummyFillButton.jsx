import React from 'react'

const DiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    <circle cx="16" cy="8" r="1.4" fill="currentColor" />
    <circle cx="8" cy="16" r="1.4" fill="currentColor" />
    <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
)

// Small, deliberately unobtrusive testing aid next to a "Scan RFID" button - fills the
// field with a fresh dummy card ID (generateDummyRfid, src/utils/validators.js) so staff
// can exercise a registration flow without physical scanner hardware.
export default function DummyFillButton({ onClick }){
  return (
    <button type="button" className="dev-fill-btn" title="Fill a dummy RFID (testing only)" onClick={onClick}>
      <DiceIcon />
    </button>
  )
}
