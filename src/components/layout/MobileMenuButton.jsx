import React from 'react'
import { useAppState } from '../../context/AppStateContext'

// Opens the sidebar drawer. Only displayed at phone/tablet widths (index.css, 768px block),
// where the sidebar is hidden off-screen instead of being a permanent icon rail.
export default function MobileMenuButton(){
  const { dispatch } = useAppState()
  return (
    <button type="button" className="mobile-menu-btn" aria-label="Open menu" onClick={() => dispatch({ type: 'OPEN_SIDEBAR' })}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
