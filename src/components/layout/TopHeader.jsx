import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_ROLES } from '../../constants/roles'
import LogoutConfirmModal from '../modals/LogoutConfirmModal'

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

const RECENT_COUNT = 5

function timeAgo(timestamp) {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function TopHeader(){
  const navigate = useNavigate()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const { role, availableRoles, switchRole } = useAuth()
  const canSwitchRole = availableRoles.length > 1
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const entries = useEnrichedGateLogs()
  const recent = entries.slice(0, RECENT_COUNT)

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
        <div className="app-topbar-notifications">
          <button
            type="button"
            className="app-topbar-bell"
            title="Notifications"
            onClick={() => setShowNotifications((v) => !v)}
          >
            <BellIcon />
            {recent.length > 0 && <span className="app-topbar-bell-dot" />}
          </button>

          {showNotifications && (
            <>
              <div className="notification-backdrop" onClick={() => setShowNotifications(false)} />
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">Recent Gate Activity</div>
                {recent.length === 0 ? (
                  <div className="notification-empty">No recent activity yet.</div>
                ) : (
                  <ul className="notification-list">
                    {recent.map((entry) => (
                      <li key={entry.id} className="notification-item">
                        <span className={`notification-dot ${entry.direction === 'OUT' ? 'warn' : 'success'}`} />
                        <div className="notification-item-body">
                          <div className="notification-item-title">
                            {entry.name || 'Unknown'} <strong>{entry.direction === 'OUT' ? 'exited' : 'entered'}</strong>
                            {entry.plateNumber && entry.plateNumber !== '—' ? ` · ${entry.plateNumber}` : ''}
                          </div>
                          <div className="notification-item-time">{timeAgo(entry.timestamp)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="notification-view-all"
                  onClick={() => { setShowNotifications(false); navigate('/search-history') }}
                >
                  View all in Search History
                </button>
              </div>
            </>
          )}
        </div>

        <div className="app-topbar-role">
          <button
            type="button"
            className="app-topbar-role-button"
            title="Account menu"
            onClick={() => setShowRoleMenu((v) => !v)}
          >
            <span className="app-topbar-admin">{role || 'Admin'}</span>
            <span className="app-topbar-avatar"><PersonIcon /></span>
          </button>

          {showRoleMenu && (
            <>
              <div className="notification-backdrop" onClick={() => setShowRoleMenu(false)} />
              <div className="notification-dropdown role-dropdown">
                {canSwitchRole && (
                  <>
                    <div className="notification-dropdown-header">Switch Role View</div>
                    <ul className="notification-list">
                      {availableRoles.map((r) => (
                        <li key={r}>
                          <button
                            type="button"
                            className={`role-option ${r === role ? 'active' : ''}`}
                            onClick={() => { switchRole(r); setShowRoleMenu(false) }}
                          >
                            {r}
                            {r === role && <span className="role-option-check">✓</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="role-menu-actions">
                  {ADMIN_ROLES.includes(role) && (
                    <button
                      type="button"
                      className="role-option"
                      onClick={() => { setShowRoleMenu(false); navigate('/settings') }}
                    >
                      System Settings
                    </button>
                  )}
                  <button
                    type="button"
                    className="role-option role-option-logout"
                    onClick={() => { setShowRoleMenu(false); setShowLogoutConfirm(true) }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showLogoutConfirm && <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />}
    </header>
  )
}
