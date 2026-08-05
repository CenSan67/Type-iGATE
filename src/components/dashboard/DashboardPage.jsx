import React, { useEffect, useState } from 'react'
import StatsCards from './StatsCards'
import RecentActivityTable from './RecentActivityTable'
import { listenToGateLogs } from '../../services/firebase'

export default function DashboardPage(){
  const [now, setNow] = useState(new Date())
  const [gateLogs, setGateLogs] = useState([])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsub = listenToGateLogs((entries) => setGateLogs(entries))
    return () => unsub && unsub()
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const today = new Date().toDateString()
  const entriesToday = gateLogs.filter((entry) => entry.direction === 'IN' && entry.timestamp && new Date(entry.timestamp).toDateString() === today).length
  const exitsToday = gateLogs.filter((entry) => entry.direction === 'OUT' && entry.timestamp && new Date(entry.timestamp).toDateString() === today).length

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
            <p>RFID entries and exits are tracked in real time.</p>
          </div>
          <div className="overview-card">
            <h4>Today</h4>
            <div className="overview-row"><span>Entries</span><strong>{entriesToday}</strong></div>
            <div className="overview-row"><span>Exits</span><strong>{exitsToday}</strong></div>
          </div>
        </div>

        <RecentActivityTable />
      </div>
    </div>
  )
}
