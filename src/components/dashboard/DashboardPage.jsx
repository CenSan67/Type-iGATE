import React, { useEffect, useState } from 'react'
import StatsCards from './StatsCards'
import RecentActivityTable from './RecentActivityTable'
import GuestClearancePanel from './GuestClearancePanel'
import VisitorPassesPanel from './VisitorPassesPanel'
import SimulateScanModal from './SimulateScanModal'
import UploadSnapshotModal from './UploadSnapshotModal'
import { listenToNewGateLogs } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_ROLES } from '../../constants/roles'

export default function DashboardPage(){
  const [now, setNow] = useState(new Date())
  const [lastScanAt, setLastScanAt] = useState(null)
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const { role } = useAuth()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Genuinely live: this ticks the moment the ESP32 scanner (or the simulate-scan
  // tool below) posts a new gateLogs entry, independent of the full-history stats.
  useEffect(() => {
    const unsub = listenToNewGateLogs((entry) => setLastScanAt(entry.timestamp || Date.now()))
    return () => unsub && unsub()
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="dashboard-main">
      <div className="dashboard-panels">
        <div className="dashboard-inline-clock">
          <span>{dateString}</span>
          <span className="dashboard-inline-clock-time">{timeString}</span>
        </div>

        <StatsCards />

        <div className="overview-grid">
          <div className="overview-card accent">
            <h4>Campus Status</h4>
            <div className="overview-value">Live</div>
            <p>{lastScanAt ? `Last scan received ${new Date(lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for the first scan of this session…'}</p>
          </div>
          {ADMIN_ROLES.includes(role) && (
            <div className="overview-card">
              <h4>Hardware Testing</h4>
              <p>No physical scanner nearby? Simulate a card tap to exercise the live dashboard.</p>
              <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSimulateModal(true)}>Simulate Scan</button>
                <button type="button" className="btn-secondary" onClick={() => setShowUploadModal(true)}>Attach Vehicle Photo</button>
              </div>
            </div>
          )}
        </div>

        <RecentActivityTable />
        <GuestClearancePanel />
        <VisitorPassesPanel />
      </div>

      {showSimulateModal && <SimulateScanModal onClose={() => setShowSimulateModal(false)} />}
      {showUploadModal && <UploadSnapshotModal onClose={() => setShowUploadModal(false)} />}
    </div>
  )
}
