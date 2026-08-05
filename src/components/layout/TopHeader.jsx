import React from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 3a5 5 0 00-5 5v3.2c0 .6-.2 1.2-.6 1.7L5 15.5c-.6.8 0 2 1 2h12c1 0 1.6-1.2 1-2l-1.4-2.6a2.7 2.7 0 01-.6-1.7V8a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.6" fill="currentColor" />
    <path d="M4.5 20c1.3-3.6 4.3-5.4 7.5-5.4s6.2 1.8 7.5 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function TopHeader(){
  return (
    <header className="app-topbar">
      <div className="app-topbar-branding">
        <img src={bsuLogo} alt="Bulacan State University Seal" className="app-topbar-logo" />
        <div>
          <h1>Bulacan State University</h1>
          <p>Intelligent Gate Access &amp; Tracking - BulSU Bustos Campus</p>
        </div>
      </div>

      <div className="app-topbar-actions">
        <button type="button" className="app-topbar-bell" title="Notifications">
          <BellIcon />
        </button>
        <span className="app-topbar-admin">Admin</span>
        <span className="app-topbar-avatar">
          <PersonIcon />
        </span>
      </div>
    </header>
  )
}
