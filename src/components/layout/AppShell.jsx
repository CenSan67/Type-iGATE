import React from 'react'
import Sidebar from '../sidebar/Sidebar'
import ConnectionBanner from '../shared/ConnectionBanner'
import MobileMenuButton from './MobileMenuButton'
import { useAppState } from '../../context/AppStateContext'

export default function AppShell({ children, topbar }){
  const { state, dispatch } = useAppState()
  const sidebarOpen = state.sidebarOpen
  const closeSidebar = () => dispatch({ type: 'CLOSE_SIDEBAR' })

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : ''} ${topbar ? 'has-topbar' : ''}`}>
      {topbar}
      <div className="dashboard-body">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          onOpen={() => dispatch({ type: 'OPEN_SIDEBAR' })}
          onClose={closeSidebar}
        />
        {/* Phones/tablets only (CSS): dims the page behind the open drawer; tap to close */}
        {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} aria-hidden />}
        <main
          className="dashboard-content"
          onClick={() => { if (sidebarOpen) closeSidebar() }}
        >
          {/* Phones/tablets only (CSS): pages without the dashboard top bar get a menu bar */}
          {!topbar && (
            <div className="mobile-nav-bar">
              <MobileMenuButton />
              <span className="mobile-nav-title">iGATE</span>
            </div>
          )}
          <ConnectionBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
