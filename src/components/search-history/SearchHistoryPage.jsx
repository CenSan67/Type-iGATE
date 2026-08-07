import React, { useEffect, useMemo, useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import { RemarkTick } from '../shared/RemarkBadge'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToRfidUsers } from '../../services/firebase'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { downloadCsv } from '../../utils/csv'

const searchTypes = ['Plate No.', 'RFID-ID', 'Name']
const PAGE_SIZE = 10

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5z" fill="currentColor" /><path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor" /></svg>
)
const CameraIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const PdfIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)
const CsvIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 3h10l6 6v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 14h2M7 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)
const SortIcon = ({ active, dir }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ opacity: active ? 1 : 0.35, transform: active && dir === 'desc' ? 'rotate(180deg)' : 'none' }}>
    <path d="M6 9l6-6 6 6M6 15l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function toDateInputValue(timestamp) {
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : ''
}

export default function SearchHistoryPage(){
  const [now, setNow] = useState(new Date())
  const [searchType, setSearchType] = useState('Plate No.')
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const { remarks, saveRemark } = useRemarks()
  const [showRemarkModal, setShowRemarkModal] = useState(false)
  const [users, setUsers] = useState([])
  const entries = useEnrichedGateLogs()

  // All Entry & Exit Logs section state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All')
  const [rfidFilter, setRfidFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [sortKey, setSortKey] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const person = useMemo(() => {
    const q = submittedQuery.trim().toLowerCase()
    if (!q) return null
    return users.find((u) => {
      if (searchType === 'Plate No.') return (u.plateNumber || '').toLowerCase().includes(q)
      if (searchType === 'RFID-ID') return (u.rfidId || '').toLowerCase().includes(q)
      return (u.name || '').toLowerCase().includes(q)
    }) || null
  }, [users, submittedQuery, searchType])

  const logs = useMemo(() => {
    if (!person?.rfidId) return []
    const rfid = person.rfidId.toString().toLowerCase()
    return entries
      .filter((entry) => (entry.rfidId || '').toString().toLowerCase() === rfid)
      .map((entry) => ({
        time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        date: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
        role: person.role || '—',
        direction: entry.direction,
      }))
  }, [entries, person])

  const hasMatch = Boolean(person)

  // --- All Entry & Exit Logs: filter -> sort -> paginate ---
  const filteredLogs = useMemo(() => {
    const rfidQ = rfidFilter.trim().toLowerCase()
    const driverQ = driverFilter.trim().toLowerCase()

    const filtered = entries.filter((entry) => {
      const entryDate = toDateInputValue(entry.timestamp)
      const matchesFrom = !dateFrom || (entryDate && entryDate >= dateFrom)
      const matchesTo = !dateTo || (entryDate && entryDate <= dateTo)
      const matchesVehicle = vehicleTypeFilter === 'All' || entry.vehicleType === vehicleTypeFilter
      const matchesRfid = !rfidQ || (entry.rfidId || '').toLowerCase().includes(rfidQ)
      const matchesDriver = !driverQ || (entry.name || '').toLowerCase().includes(driverQ)
      return matchesFrom && matchesTo && matchesVehicle && matchesRfid && matchesDriver
    })

    const sorted = filtered.slice().sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '')
      else cmp = (a.timestamp || 0) - (b.timestamp || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [entries, dateFrom, dateTo, vehicleTypeFilter, rfidFilter, driverFilter, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [dateFrom, dateTo, vehicleTypeFilter, rfidFilter, driverFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const pageItems = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const exportCsv = () => {
    const headers = ['Date', 'Time', 'RFID-ID', 'Name', 'Plate Number', 'Vehicle Type', 'Department', 'Role', 'Direction']
    const rows = filteredLogs.map((entry) => [
      entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '',
      entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '',
      entry.rfidId || '',
      entry.name || '',
      entry.plateNumber || '',
      entry.vehicleType || '',
      entry.department || '',
      entry.role || '',
      entry.direction || '',
    ])
    downloadCsv(`igate-entry-exit-logs-${toDateInputValue(Date.now())}.csv`, headers, rows)
  }

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

      <div className="search-history-panel">
        <h2>Search History</h2>

        <div className="search-tabs">
          {searchTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`search-tab ${searchType === type ? 'active' : ''}`}
              onClick={() => setSearchType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <form
          className="search-bar-row"
          onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(query) }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Enter ${searchType}`}
          />
          <button type="submit" className="search-submit">Search</button>
        </form>

        {submittedQuery && (
          <p className="search-result-label">
            Search result for {searchType}: <strong>{submittedQuery}</strong> <SearchIcon />
          </p>
        )}

        {hasMatch ? (
          <div className="search-results-grid">
            <div className="result-card">
              <div className="result-person-bar">
                <span className="result-avatar"><PersonIcon /></span>
                <div>
                  <span className="name-with-remark">
                    <strong>{person.name || 'Unknown'}</strong>
                    {remarks[person.rfidId] && <RemarkTick onClick={() => setShowRemarkModal(true)} title="View remark" />}
                  </span>
                  <div className="result-rfid">{person.rfidId}</div>
                </div>
                <span className="plate-pill">{person.plateNumber || '—'}</span>
                <span className="tag-pill">{person.role || '—'}</span>
                <span className="tag-pill">{person.vehicleType || '—'}</span>
                <span className="tag-pill">{person.department || '—'}</span>
              </div>

              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Date</th>
                    <th>Role</th>
                    <th>Entry Type</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={4} className="empty-state">No gate activity recorded for this RFID yet.</td></tr>
                  ) : logs.map((log, i) => (
                    <tr key={i} className="activity-row">
                      <td>{log.time}</td>
                      <td>{log.date}</td>
                      <td>{log.role}</td>
                      <td>{log.direction === 'IN' ? <span className="direction-in">+ IN</span> : <span className="direction-out">- OUT</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination-row">
                <span>Showing 1 to {logs.length} of {logs.length} entries</span>
                <div className="pagination-controls">
                  <button type="button" disabled>‹</button>
                  <button type="button" className="active">1</button>
                  <button type="button" disabled>›</button>
                </div>
              </div>
            </div>

            <div className="search-side-column">
              <div className="camera-card">
                <div className="camera-feed">
                  <CameraIcon />
                  <div className="camera-caption"><span className="rec-dot" /> CAM-IN | {logs[0]?.time || '—'}</div>
                </div>
              </div>

              <div className="info-card">
                <h4>Information</h4>
                <div className="info-person">
                  <span className="result-avatar"><PersonIcon /></span>
                  <div>
                    <strong>{person.name || 'Unknown'}</strong>
                    <div><span className="tag-pill role-pill">{person.role || '—'}</span></div>
                  </div>
                </div>
                <div className="info-rows">
                  <div className="info-row"><span>RFID-ID:</span><span>{person.rfidId}</span></div>
                  <div className="info-row"><span>Plate No:</span><span className="plate-pill">{person.plateNumber || '—'}</span></div>
                  <div className="info-row"><span>Vehicle Type:</span><span>{person.vehicleType || '—'}</span></div>
                  <div className="info-row"><span>Department:</span><span>{person.department || '—'}</span></div>
                  <div className="info-row"><span>Date Registered:</span><span>{person.createdAt ? new Date(person.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
                </div>
              </div>

              <div className="pagination-row card-style">
                <span>Showing 1 to {logs.length} of {logs.length} entries</span>
                <div className="pagination-controls">
                  <button type="button" disabled>‹</button>
                  <button type="button" className="active">1</button>
                  <button type="button" disabled>›</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="search-empty">No records found for that {searchType.toLowerCase()}.</div>
        )}
      </div>

      <div className="search-history-panel">
        <h2>All Entry & Exit Logs</h2>

        <div className="filter-card" style={{ marginBottom: 16 }}>
          <label className="filter-label">Date Range</label>
          <div className="date-range-row">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <label className="filter-label">Vehicle Type</label>
          <select value={vehicleTypeFilter} onChange={(e) => setVehicleTypeFilter(e.target.value)}>
            <option value="All">All</option>
            {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="filter-label">RFID Tag</label>
          <input type="text" value={rfidFilter} onChange={(e) => setRfidFilter(e.target.value)} placeholder="Search RFID-ID" />

          <label className="filter-label">Driver / Name</label>
          <input type="text" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} placeholder="Search driver name" />

          <button type="button" className="export-btn" onClick={exportCsv} style={{ marginTop: 12 }}>
            <CsvIcon /> Export as CSV
          </button>
          <button type="button" className="export-btn" onClick={() => window.print()}>
            <PdfIcon /> Export as PDF
          </button>
        </div>

        <table className="activity-table">
          <thead>
            <tr>
              <th className="sortable-th" onClick={() => toggleSort('timestamp')}>
                Time <SortIcon active={sortKey === 'timestamp'} dir={sortDir} />
              </th>
              <th>RFID-ID</th>
              <th className="sortable-th" onClick={() => toggleSort('name')}>
                Name <SortIcon active={sortKey === 'name'} dir={sortDir} />
              </th>
              <th>Plate Number</th>
              <th>Vehicle</th>
              <th>Department</th>
              <th>Role</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr><td colSpan={8} className="accounts-empty">No logs match your filters.</td></tr>
            ) : pageItems.map((entry) => (
              <tr key={entry.id} className="activity-row">
                <td>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</td>
                <td>{entry.rfidId || 'N/A'}</td>
                <td>{entry.name || 'Unknown'}</td>
                <td>{entry.plateNumber || '—'}</td>
                <td>{entry.vehicleType || '—'}</td>
                <td>{entry.department || '—'}</td>
                <td>{entry.role || '—'}</td>
                <td>{entry.direction === 'OUT' ? <span className="direction-out">- OUT</span> : <span className="direction-in">+ IN</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination-row centered">
          <span>Showing {pageItems.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {(page - 1) * PAGE_SIZE + pageItems.length} of {filteredLogs.length} entries</span>
          <div className="pagination-controls">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
          </div>
        </div>
      </div>

      {showRemarkModal && (
        <RemarkModal
          name={person.name}
          rfid={person.rfidId}
          initialRemark={remarks[person.rfidId]}
          onClose={() => setShowRemarkModal(false)}
          onSave={(text) => saveRemark(person.rfidId, text)}
        />
      )}
    </div>
  )
}
