import React, { useEffect, useMemo, useState } from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'

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
  const entries = useEnrichedGateLogs()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const records = useMemo(() => entries.map((entry) => ({
    id: entry.id,
    date: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric' }) : '—',
    time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
    name: entry.name,
    plate: entry.plateNumber,
    department: entry.department,
    userType: entry.role,
    vehicle: entry.vehicleType,
    direction: entry.direction,
  })), [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      const matchesQuery = !q || [r.name, r.plate, r.department, r.userType, r.vehicle].some((f) => (f || '').toLowerCase().includes(q))
      const matchesStatus = status === 'All' || r.direction === status
      const matchesUserType = userType === 'All' || r.userType === userType
      const matchesVehicle = vehicleType === 'All' || r.vehicle === vehicleType
      return matchesQuery && matchesStatus && matchesUserType && matchesVehicle
    })
  }, [records, query, status, userType, vehicleType])

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
                    <tr key={r.id} className="activity-row">
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
