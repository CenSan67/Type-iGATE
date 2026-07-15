import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GateButton from './GateButton'
import ChangePasswordModal from '../modals/ChangePasswordModal'
import { logOut } from '../../services/auth'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

const initialLogs = [
  { id: 1, text: 'RFID Detected - Car (ABC-3983)', tone: 'warn' },
  { id: 2, text: 'Gate Opened - 10:23 AM', tone: 'success' },
  { id: 3, text: 'Login Success - Admin', tone: 'success' },
]

const olderLogs = [
  { id: 4, text: 'Gate Closed - 10:26 AM', tone: 'warn' },
  { id: 5, text: 'RFID Detected - Motorcycle (ABC-3570)', tone: 'warn' },
  { id: 6, text: 'Gate Opened - 09:50 AM', tone: 'success' },
  { id: 7, text: 'Login Success - Admin', tone: 'success' },
]

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
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function SettingsPage(){
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [entranceOpen, setEntranceOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [logs, setLogs] = useState(initialLogs)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [modal, setModal] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const toggleGate = (gate) => {
    const willOpen = gate === 'entrance' ? !entranceOpen : !exitOpen
    if (gate === 'entrance') setEntranceOpen(willOpen)
    else setExitOpen(willOpen)

    const label = gate === 'entrance' ? 'Entrance Gate' : 'Exit Gate'
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    setLogs((list) => [
      { id: Date.now(), text: `${label} ${willOpen ? 'Opened' : 'Closed'} - ${time}`, tone: willOpen ? 'success' : 'warn' },
      ...list,
    ])
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logOut()
    } finally {
      navigate('/login')
    }
  }

  const visibleLogs = showAllLogs ? [...logs, ...olderLogs] : logs

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

        <div className="gate-control-card">
          <h3>Gate Control</h3>
          <p>Select Gate & Open Remotely</p>
          <hr />
          <div className="gate-buttons-row">
            <GateButton label="ENTRANCE GATE" isOpen={entranceOpen} onToggle={() => toggleGate('entrance')} />
            <GateButton label="EXIT GATE" isOpen={exitOpen} onToggle={() => toggleGate('exit')} />
          </div>
        </div>

        <div className="settings-bottom-grid">
          <div>
            <div className="settings-card-header">Recent Logs</div>
            <div className="logs-list-card">
              {visibleLogs.map((log) => (
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
              <button type="button" className="action-btn logout" onClick={handleLogout} disabled={loggingOut}>
                <LogoutIcon /> {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} />}
    </div>
  )
}
