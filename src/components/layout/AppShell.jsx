import React from 'react'
import Sidebar from '../sidebar/Sidebar'
import { useAppState } from '../../context/AppStateContext'

export default function AppShell({ children }){
  const { state, dispatch } = useAppState()
  const sidebarOpen = state.sidebarOpen

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        onOpen={() => dispatch({ type: 'OPEN_SIDEBAR' })}
      />
      <main
        className="dashboard-content"
        onClick={() => { if (sidebarOpen) dispatch({ type: 'CLOSE_SIDEBAR' }) }}
      >
        {children}
      </main>
    </div>
  )
}
