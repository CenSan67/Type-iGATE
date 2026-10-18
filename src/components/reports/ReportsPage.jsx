import React, { useEffect, useMemo, useState } from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import { buildPageList } from '../../utils/pagination'
import PrintReportModal from '../shared/PrintReportModal'
import { buildGateLogReport, dayStartMs, dayEndMs } from '../../utils/reportBuilders'
import { QUICK_SELECTS, toLocalISODate } from '../../utils/dateRange'
import useDateRangeFilter from '../../hooks/useDateRangeFilter'
import { VEHICLE_TYPES } from '../../models/rfidUser'

const PAGE_SIZE = 10

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const PdfIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)

export default function ReportsPage(){
  const [now, setNow] = useState(new Date())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [userType, setUserType] = useState('All')
  const [vehicleType, setVehicleType] = useState('All')
  const { dateFrom, dateTo, activeQuick, maxDate, changeFrom, changeTo, applyQuick } = useDateRangeFilter({ defaultQuick: 'Today' })
  const [page, setPage] = useState(1)
  const [showPrintReport, setShowPrintReport] = useState(false)
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
    brand: entry.vehicleBrand,
    direction: entry.direction,
    entry,
  })), [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      const matchesQuery = !q || [r.name, r.plate, r.department, r.userType, r.vehicle, r.brand].some((f) => (f || '').toLowerCase().includes(q))
      const matchesStatus = status === 'All' || r.direction === status
      const matchesUserType = userType === 'All' || r.userType === userType
      const matchesVehicle = vehicleType === 'All' || r.vehicle === vehicleType
      const entryDate = toLocalISODate(r.entry.timestamp)
      const matchesFrom = !dateFrom || (entryDate && entryDate >= dateFrom)
      const matchesTo = !dateTo || (entryDate && entryDate <= dateTo)
      return matchesQuery && matchesStatus && matchesUserType && matchesVehicle && matchesFrom && matchesTo
    })
  }, [records, query, status, userType, vehicleType, dateFrom, dateTo])

  useEffect(() => { setPage(1) }, [query, status, userType, vehicleType, dateFrom, dateTo])

  // Previously the table rendered every row in `filtered` unpaginated (hundreds of
  // entries at once) while showing a decorative, non-functional 1-5 page control -
  // this is what actually paginates it now.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
                  {pageItems.map((r) => (
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
                  <input type="date" value={dateFrom} max={dateTo || maxDate} onChange={(e) => changeFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={dateTo} min={dateFrom || undefined} max={maxDate} onChange={(e) => changeTo(e.target.value)} />
                </div>

                <label className="filter-label">Quick Select:</label>
                <div className="quick-select-row">
                  {QUICK_SELECTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`quick-select-btn ${activeQuick === q ? 'active' : ''}`}
                      onClick={() => applyQuick(q)}
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
                  {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                <button type="button" className="export-btn" onClick={() => setShowPrintReport(true)}>
                  <PdfIcon /> Print / Save as PDF
                </button>
              </div>

              <div className="meta-card">
                <div>Date Generated: {now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div>Generated by: Admin</div>
              </div>

              <div className="pagination-row card-style">
                <span>Showing {pageItems.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {(page - 1) * PAGE_SIZE + pageItems.length} of {filtered.length} entries</span>
                <div className="pagination-controls">
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  {buildPageList(page, totalPages).map((n, i) => (
                    n === '…'
                      ? <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                      : <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPrintReport && (
        <PrintReportModal
          title="Vehicle Access Report"
          {...buildGateLogReport(filtered.map((r) => r.entry), { from: dayStartMs(dateFrom), to: dayEndMs(dateTo) })}
          onClose={() => setShowPrintReport(false)}
        />
      )}
    </div>
  )
}
