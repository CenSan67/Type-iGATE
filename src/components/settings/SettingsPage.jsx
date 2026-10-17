import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GateStatusCard from '../dashboard/GateStatusCard'
import ChangePasswordModal from '../modals/ChangePasswordModal'
import LogoutConfirmModal from '../modals/LogoutConfirmModal'
import LogoutIcon from '../shared/LogoutIcon'
import { useAuth } from '../../context/AuthContext'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

const VISIBLE_LOGS_COLLAPSED = 3
const VISIBLE_LOGS_EXPANDED = 20

// Turns a real RTDB gate scan (from useEnrichedGateLogs) into the same
// {id, text, tone, timestamp} shape as the locally-generated toggle/login entries,
// so both can be merged into one chronological "Recent Logs" list.
function scanEntryToLog(entry){
  const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const vehicle = entry.vehicleType && entry.vehicleType !== '—' ? entry.vehicleType : 'Vehicle'
  const plate = entry.plateNumber && entry.plateNumber !== '—' ? ` (${entry.plateNumber})` : ''
  return {
    id: `scan-${entry.id}`,
    text: `RFID ${entry.direction === 'OUT' ? 'Exit' : 'Entry'} - ${vehicle}${plate} - ${time}`,
    tone: entry.direction === 'OUT' ? 'warn' : 'success',
    timestamp: entry.timestamp || 0,
  }
}

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.6 3.5l-9 15.6A1.5 1.5 0 003 21.5h18a1.5 1.5 0 001.4-2.4l-9-15.6a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5z" fill="currentColor" /><path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor" /></svg>
)
const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.8" /><path d="M11 12l9-9M16 5l3 3M13 8l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
)

export default function SettingsPage(){
  const navigate = useNavigate()
  const { user } = useAuth()
  const [now, setNow] = useState(new Date())
  const [sessionLogs, setSessionLogs] = useState([])
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [modal, setModal] = useState(null)
  const scanEntries = useEnrichedGateLogs()
  const loggedLoginRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Records a real login event the first time an authenticated user shows up in this
  // session (the hardcoded bypass login has no `user`, so it won't produce one).
  useEffect(() => {
    if (user && !loggedLoginRef.current) {
      loggedLoginRef.current = true
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      setSessionLogs((list) => [
        { id: `login-${Date.now()}`, text: `Login Success - ${user.email || 'Admin'} - ${time}`, tone: 'success', timestamp: Date.now() },
        ...list,
      ])
    }
  }, [user])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const visibleLogs = useMemo(() => {
    const combined = [...sessionLogs, ...scanEntries.map(scanEntryToLog)].sort((a, b) => b.timestamp - a.timestamp)
    return combined.slice(0, showAllLogs ? VISIBLE_LOGS_EXPANDED : VISIBLE_LOGS_COLLAPSED)
  }, [sessionLogs, scanEntries, showAllLogs])

  return (
    <div className="dashboard-main">
      <section className="dashboard-header">
        <div>
          <div className="dashboard-branding">
            <img src={bsuLogo} alt="Bulacan State University Seal" className="dashboard-logo" />
            <div>
              <h1>Bulacan State University</h1>
              <p>Intelligent Gate Access & Tracking - BulSU Bustos Campus</p>
            </div>
          </div>
        </div>
        <div className="dashboard-clock">
          <div>{timeString}</div>
          <div>{dateString}</div>
        </div>
      </section>

      <div className="settings-panel">
        <h2>Settings</h2>

        <GateStatusCard />

        <div className="settings-bottom-grid">
          <div>
            <div className="settings-card-header">Recent Logs</div>
            <div className="logs-list-card">
              {visibleLogs.length === 0 ? (
                <div className="log-item empty-state">No activity recorded yet.</div>
              ) : visibleLogs.map((log) => (
                <div key={log.id} className="log-item">
                  <span className={`log-dot ${log.tone}`}>{log.tone === 'success' ? <CheckIcon /> : <AlertIcon />}</span>
                  <span>{log.text}</span>
                </div>
              ))}
              <button type="button" className="view-logs-btn" onClick={() => setShowAllLogs((v) => !v)}>
                {showAllLogs ? 'SHOW LESS' : 'VIEW ALL LOGS'}
              </button>
            </div>
          </div>

          <div>
            <div className="settings-card-header">Others Action</div>
            <div className="action-list">
              <button type="button" className="action-btn" onClick={() => navigate('/profile')}>
                <ProfileIcon /> My Profile
              </button>
              <button type="button" className="action-btn" onClick={() => setModal('password')}>
                <KeyIcon /> Change Password
              </button>
              <button type="button" className="action-btn logout" onClick={() => setModal('logout')}>
                <LogoutIcon /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} />}
      {modal === 'logout' && <LogoutConfirmModal onClose={() => setModal(null)} />}
    </div>
  )
}
