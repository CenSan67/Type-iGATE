import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import dashboardIcon from '../../assets/Rectangle 10.png'
import accountIcon from '../../assets/Rectangle 12.png'
import searchIcon from '../../assets/Rectangle 13.png'
import reportIcon from '../../assets/Rectangle 14.png'
import paymentIcon from '../../assets/Rectangle 15.png'
import settingsIcon from '../../assets/image 20.png'

const navItems = [
  { label: 'Dashboard', icon: dashboardIcon, path: '/dashboard' },
  { label: 'Account Management', icon: accountIcon, path: '/account-management' },
  { label: 'Search History', icon: searchIcon, path: '/search-history' },
  { label: 'Reports', icon: reportIcon, path: '/reports' },
  { label: 'Payment', icon: paymentIcon, path: '/payment' },
  { label: 'System Settings', icon: settingsIcon, path: '/settings' },
]

export default function Sidebar({ open, onToggle, onOpen }){
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`} onClick={() => !open && onOpen()}>
      <button type="button" className="sidebar-toggle" onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <span />
        <span />
        <span />
      </button>

      <div className="sidebar-items">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!open) onOpen()
              if (item.path) navigate(item.path)
            }}
          >
            <span className="sidebar-icon">
              <img src={item.icon} alt={item.label} />
            </span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
