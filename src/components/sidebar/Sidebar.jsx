import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import dashboardIcon from '../../assets/Rectangle 10.png'
import accountIcon from '../../assets/Rectangle 12.png'
import searchIcon from '../../assets/Rectangle 13.png'
import reportIcon from '../../assets/Rectangle 14.png'
// Rectangle 15.png is a gear graphic and image 20.png is a card graphic - these were
// previously assigned backwards (Payment showed the gear, Settings showed the card).
import settingsIcon from '../../assets/Rectangle 15.png'
import paymentIcon from '../../assets/image 20.png'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_ROLES, ROLES } from '../../constants/roles'
import { listenToGateStatus } from '../../services/firebase'
import Modal from '../modals/Modal'
import GateStatusCard from '../dashboard/GateStatusCard'

const navItems = [
  { label: 'Dashboard', icon: dashboardIcon, path: '/dashboard' },
  { label: 'Account Management', icon: accountIcon, path: '/account-management', roles: ADMIN_ROLES },
  { label: 'Search History', icon: searchIcon, path: '/search-history' },
  { label: 'Reports', icon: reportIcon, path: '/reports' },
  { label: 'Payment', icon: paymentIcon, path: '/payment' },
  { label: 'System Settings', icon: settingsIcon, path: '/settings', roles: ADMIN_ROLES },
]

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" /><path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)

// Full control lives on System Settings (admin-only), but a Security Guard can't
// reach that page - this compact quick-access button/modal, reusing the same
// GateStatusCard used there, is how a Guard still triggers the emergency override
// from wherever they are, without duplicating any of that logic.
export default function Sidebar({ open, onToggle, onOpen }){
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const [showGateModal, setShowGateModal] = useState(false)
  const [gateStatus, setGateStatus] = useState(null)
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role))

  useEffect(() => {
    const unsub = listenToGateStatus(setGateStatus)
    return () => unsub && unsub()
  }, [])

  const gateStateClass = gateStatus?.state === 'OPEN' ? 'is-open' : gateStatus?.state === 'CLOSED' ? 'is-closed' : 'is-unknown'

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
              if (!open) onOpen()
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

        {ROLES.includes(role) && (
          <button
            type="button"
            title="Barrier Gate"
            className="sidebar-item sidebar-gate-item"
            onClick={(e) => {
              e.stopPropagation()
              if (!open) onOpen()
              setShowGateModal(true)
            }}
          >
            <span className="sidebar-icon">
              <LockIcon />
              <span className={`sidebar-gate-dot ${gateStateClass}`} />
            </span>
            <span className="sidebar-label">Barrier Gate</span>
          </button>
        )}
      </div>

      {showGateModal && (
        <Modal title="Barrier Gate" onClose={() => setShowGateModal(false)}>
          <GateStatusCard />
        </Modal>
      )}
    </aside>
  )
}
