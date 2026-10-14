import React from 'react'
import Sidebar from '../sidebar/Sidebar'
import ConnectionBanner from '../shared/ConnectionBanner'
import { useAppState } from '../../context/AppStateContext'

export default function AppShell({ children, topbar }){
  const { state, dispatch } = useAppState()
  const sidebarOpen = state.sidebarOpen

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : ''} ${topbar ? 'has-topbar' : ''}`}>
      {topbar}
      <div className="dashboard-body">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          onOpen={() => dispatch({ type: 'OPEN_SIDEBAR' })}
        />
        <main
          className="dashboard-content"
          onClick={() => { if (sidebarOpen) dispatch({ type: 'CLOSE_SIDEBAR' }) }}
        >
          <ConnectionBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
