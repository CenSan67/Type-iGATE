import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import LogoutConfirmModal from '../modals/LogoutConfirmModal'
import LogoutIcon from '../shared/LogoutIcon'
import dashboardIcon from '../../assets/Rectangle 10.png'
import accountIcon from '../../assets/Rectangle 12.png'
import searchIcon from '../../assets/Rectangle 13.png'
import reportIcon from '../../assets/Rectangle 14.png'
// Rectangle 15.png is a gear graphic and image 20.png is a card graphic - these were
// previously assigned backwards (Payment showed the gear, Settings showed the card).
import settingsIcon from '../../assets/Rectangle 15.png'
import paymentIcon from '../../assets/image 20.png'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_ROLES } from '../../constants/roles'

// Phase 12: System Settings is reachable by every staff role now (Security Guard
// included) - the barrier gate override moved there, off its own sidebar quick-access
// item, since a Guard has a real entry point to the page now instead of needing a
// workaround. Account Management stays admin-only.
const navItems = [
  { label: 'Dashboard', icon: dashboardIcon, path: '/dashboard' },
  { label: 'Account Management', icon: accountIcon, path: '/account-management', roles: ADMIN_ROLES },
  { label: 'Search History', icon: searchIcon, path: '/search-history' },
  { label: 'Reports', icon: reportIcon, path: '/reports' },
  { label: 'Payment', icon: paymentIcon, path: '/payment' },
  { label: 'System Settings', icon: settingsIcon, path: '/settings' },
]

// Same breakpoint as index.css's drawer layout: there, picking a page should also close the
// drawer (on desktop the rail just stays as it was).
const isDrawerLayout = () => window.matchMedia('(max-width: 768px)').matches

export default function Sidebar({ open, onToggle, onOpen, onClose }){
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role))
  const [showLogout, setShowLogout] = useState(false)

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`} onClick={() => !open && onOpen()}>
      <button type="button" className="sidebar-toggle" onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="sidebar-items">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
          <button
            key={item.label}
            type="button"
            title={item.label}
            className={`sidebar-item ${isActive ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              // Clicking the page you're already on is a no-op navigation-wise, so
              // while the sidebar is open it collapses instead - lets the same nav
              // button act as a toggle once you've arrived where you're going,
              // without having to reach for the separate arrow button.
              if (isActive && open) {
                onToggle()
                return
              }
              if (isDrawerLayout()) onClose()
              else if (!open) onOpen()
              if (item.path) navigate(item.path)
            }}
          >
            <span className="sidebar-icon">
              <img src={item.icon} alt={item.label} />
            </span>
            <span className="sidebar-label">{item.label}</span>
          </button>
          )
        })}
      </div>

      {/* Anchored to the bottom of the rail/drawer. Same confirmation + sign-out path as the
          top-bar menu and System Settings (LogoutConfirmModal -> services/auth.js#logOut). */}
      <div className="sidebar-footer">
        <button
          type="button"
          title="Logout"
          className="sidebar-item sidebar-logout"
          onClick={(e) => {
            e.stopPropagation() // don't let the collapsed rail's click-to-open fire
            if (isDrawerLayout()) onClose()
            setShowLogout(true)
          }}
        >
          <span className="sidebar-icon"><LogoutIcon size={22} /></span>
          <span className="sidebar-label">Logout</span>
        </button>
      </div>

      {/* Rendered at <body>: on phones the drawer slides off-screen (a CSS transform) when it
          closes, and a dialog inside it would slide away with it. */}
      {showLogout && createPortal(<LogoutConfirmModal onClose={() => setShowLogout(false)} />, document.body)}
    </aside>
  )
}
