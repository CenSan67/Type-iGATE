import React, { useEffect, useMemo, useState } from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

const records = [
  { date: 'April 22', time: '10:45 AM', name: 'Michael Jordan', plate: 'DEF-5678', department: 'BSIT', userType: 'Faculty', vehicle: 'Car', direction: 'IN' },
  { date: 'April 23', time: '09:50 AM', name: 'Stephen Curry', plate: 'GHI-1234', department: 'BSIT', userType: 'Student', vehicle: 'Motorcycle', direction: 'OUT' },
  { date: 'April 1', time: '09:13 AM', name: 'Kobe Bryant', plate: 'JKL-5678', department: 'BSIT', userType: 'Faculty', vehicle: 'Car', direction: 'IN' },
  { date: 'April 10', time: '08:30 AM', name: 'Magic Johnson', plate: 'MNO-1234', department: 'BSIT', userType: 'Faculty', vehicle: 'Car', direction: 'IN' },
  { date: 'April 14', time: '06:29 AM', name: 'Justin Brownlee', plate: 'PQRS-5678', department: 'BSIT', userType: 'Visitor', vehicle: 'Motorcycle', direction: 'OUT' },
  { date: 'April 6', time: '07:29 AM', name: 'Lebron James', plate: 'WXY-1234', department: 'BSIT', userType: 'Student', vehicle: 'Motorcycle', direction: 'IN' },
  { date: 'April 9', time: '11:29 AM', name: 'Larry Bird', plate: 'ZAB-5678', department: 'BSIT', userType: 'Faculty', vehicle: 'Car', direction: 'OUT' },
  { date: 'April 20', time: '05:29 PM', name: 'Kevin Durant', plate: 'CDE-1234', department: 'BSIT', userType: 'Student', vehicle: 'Motorcycle', direction: 'IN' },
]

const quickSelects = ['Today', 'This week', 'This month']

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const PdfIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)

export default function ReportsPage(){
  const [now, setNow] = useState(new Date())
  const [query, setQuery] = useState('')
  const [quickSelect, setQuickSelect] = useState(null)
  const [status, setStatus] = useState('All')
  const [userType, setUserType] = useState('All')
  const [vehicleType, setVehicleType] = useState('All')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      const matchesQuery = !q || [r.name, r.plate, r.department, r.userType, r.vehicle].some((f) => f.toLowerCase().includes(q))
      const matchesStatus = status === 'All' || r.direction === status
      const matchesUserType = userType === 'All' || r.userType === userType
      const matchesVehicle = vehicleType === 'All' || r.vehicle === vehicleType
      return matchesQuery && matchesStatus && matchesUserType && matchesVehicle
    })
  }, [query, status, userType, vehicleType])

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

      <div className="reports-panel">
        <h2>Report & Printing Module</h2>

        <div className="reports-card">
          <div className="reports-card-title">Report & Printing Module</div>

          <div className="reports-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Report, entry, user type, status or more"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="reports-grid">
            <div className="reports-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Name</th>
                    <th>Plate Number</th>
                    <th>Department</th>
                    <th>User Type</th>
                    <th>Vehicles</th>
                    <th>IN/OUT</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.plate} className="activity-row">
                      <td>{r.date}</td>
                      <td>{r.time}</td>
                      <td className="report-link">{r.name}</td>
                      <td className="report-link">{r.plate}</td>
                      <td>{r.department}</td>
                      <td>{r.userType}</td>
                      <td>{r.vehicle}</td>
                      <td>{r.direction === 'IN' ? <span className="direction-in">+ IN</span> : <span className="direction-out">- OUT</span>}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="accounts-empty">No records match your search or filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="reports-filter-col">
              <div className="filter-card">
                <h4>Filter Reports</h4>

                <label className="filter-label">Date Range</label>
                <div className="date-range-row">
                  <input type="date" defaultValue="2026-04-01" />
                  <span>to</span>
                  <input type="date" defaultValue="2026-04-30" />
                </div>

                <label className="filter-label">Quick Select:</label>
                <div className="quick-select-row">
                  {quickSelects.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`quick-select-btn ${quickSelect === q ? 'active' : ''}`}
                      onClick={() => setQuickSelect(quickSelect === q ? null : q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <label className="filter-label">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="All">All</option>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>

                <label className="filter-label">User Type</label>
                <select value={userType} onChange={(e) => setUserType(e.target.value)}>
                  <option value="All">All</option>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                  <option value="Visitor">Visitor</option>
                </select>

                <label className="filter-label">Vehicle Type</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option value="All">All</option>
                  <option value="Car">Car</option>
                  <option value="Motorcycle">Motorcycle</option>
                </select>

                <button type="button" className="export-btn" onClick={() => window.print()}>
                  <PdfIcon /> Export as PDF
                </button>
              </div>

              <div className="meta-card">
                <div>Date Generated: {now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div>Generated by: Admin</div>
              </div>

              <div className="pagination-row card-style">
                <span>Showing 1 to {filtered.length} of {filtered.length} entries</span>
                <div className="pagination-controls">
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button type="button" onClick={() => setPage((p) => Math.min(5, p + 1))}>Next</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
