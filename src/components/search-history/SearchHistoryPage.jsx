import React, { useEffect, useMemo, useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import PaginationRow from '../shared/PaginationRow'
import RemarkModal from '../modals/RemarkModal'
import { RemarkTick } from '../shared/RemarkBadge'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToRfidUsers } from '../../services/firebase'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { downloadCsv } from '../../utils/csv'
import { buildPageList } from '../../utils/pagination'
import PrintReportModal from '../shared/PrintReportModal'
import { buildGateLogReport, dayStartMs, dayEndMs } from '../../utils/reportBuilders'
import { toLocalISODate } from '../../utils/dateRange'
import useDateRangeFilter from '../../hooks/useDateRangeFilter'

const searchTypes = ['Plate No.', 'RFID-ID', 'Name']
const PAGE_SIZE = 10
// The searched person's own IN/OUT history: 4 scans per page.
const PERSON_LOG_PAGE_SIZE = 4

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

const toDateInputValue = toLocalISODate

export default function SearchHistoryPage(){
  const [now, setNow] = useState(new Date())
  const [searchType, setSearchType] = useState('Plate No.')
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [showRemarkModal, setShowRemarkModal] = useState(false)
  const [users, setUsers] = useState([])
  const entries = useEnrichedGateLogs()

  // All Entry & Exit Logs section state
  const { dateFrom, dateTo, maxDate, changeFrom, changeTo } = useDateRangeFilter()
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All')
  const [directionFilter, setDirectionFilter] = useState('All') // 'All' | 'IN' | 'OUT'
  const [rfidFilter, setRfidFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [sortKey, setSortKey] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [showPrintReport, setShowPrintReport] = useState(false)

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

  // A person (especially a repeat visitor) can have more than one rfidUsers record under the
  // same name - a new physical card is issued every visit, each as its own record/rfidId. A
  // name/plate/RFID search that only kept the first match silently dropped every other visit's
  // gate activity, which looked like "the search can't find their IN/OUT" even though the logs
  // were there all along, just under a sibling record.
  const matches = useMemo(() => {
    const q = submittedQuery.trim().toLowerCase()
    if (!q) return []
    return users.filter((u) => {
      if (searchType === 'Plate No.') return (u.plateNumber || '').toLowerCase().includes(q)
      if (searchType === 'RFID-ID') return (u.rfidId || '').toLowerCase().includes(q)
      return (u.name || '').toLowerCase().includes(q)
    })
  }, [users, submittedQuery, searchType])

  // The most recent matching record drives the summary header (current plate/role/etc.).
  const person = useMemo(
    () => matches.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null,
    [matches],
  )

  // Every distinct past record (one per card/visit ever issued to this name) - "vehicles used".
  const vehiclesUsed = useMemo(
    () => matches.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [matches],
  )

  const logs = useMemo(() => {
    // By record, not by card number: a pooled visitor card is shared by many visitors over
    // time, and each scan is already attributed to whoever held the card then
    // (useEnrichedGateLogs -> rfidUserId), so matching on rfidId listed every other visitor's
    // scans on that card under this person.
    const recordIds = new Set(matches.map((u) => u.id).filter(Boolean))
    if (recordIds.size === 0) return []
    return entries
      .filter((entry) => entry.rfidUserId && recordIds.has(entry.rfidUserId))
      .slice()
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .map((entry) => ({
        id: entry.id,
        time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        date: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
        role: entry.role || person?.role || '—',
        direction: entry.direction,
        imageUrl: entry.imageUrl,
      }))
  }, [entries, matches, person])

  const hasMatch = matches.length > 0

  // Which row's snapshot is showing in the camera-card panel - defaults to the newest log
  // (below) and resets to that default whenever a new person is looked up, rather than
  // sticking on a row that belongs to whoever was searched before.
  const [selectedLogId, setSelectedLogId] = useState(null)
  useEffect(() => { setSelectedLogId(null) }, [person?.id])
  const selectedLog = logs.find((l) => l.id === selectedLogId) || logs[0] || null

  // This person's history, PERSON_LOG_PAGE_SIZE rows per page (back to page 1 on a new search).
  const [personPage, setPersonPage] = useState(1)
  useEffect(() => { setPersonPage(1) }, [person?.id])
  const personPageLogs = logs.slice((personPage - 1) * PERSON_LOG_PAGE_SIZE, personPage * PERSON_LOG_PAGE_SIZE)

  // Visit-scoped remark (hooks/useRemarks.js): the same one the Dashboard writes for this
  // person, shown until their next IN.
  const { remarkFor, saveRemark } = useRemarks(entries)
  const personRemark = person ? remarkFor(person.id) : null

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
      const matchesDirection = directionFilter === 'All' || entry.direction === directionFilter
      return matchesFrom && matchesTo && matchesVehicle && matchesRfid && matchesDriver && matchesDirection
    })

    const sorted = filtered.slice().sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '')
      else cmp = (a.timestamp || 0) - (b.timestamp || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [entries, dateFrom, dateTo, vehicleTypeFilter, rfidFilter, driverFilter, directionFilter, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [dateFrom, dateTo, vehicleTypeFilter, rfidFilter, driverFilter, directionFilter])

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
                    {personRemark && <RemarkTick onClick={() => setShowRemarkModal(true)} title="View remark" />}
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
                  ) : personPageLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`activity-row selectable-row ${log.id === selectedLog?.id ? 'selected' : ''}`}
                      onClick={() => setSelectedLogId(log.id)}
                      title="View this scan's snapshot"
                    >
                      <td>{log.time}</td>
                      <td>{log.date}</td>
                      <td>{log.role}</td>
                      <td>{log.direction === 'IN' ? <span className="direction-in">+ IN</span> : <span className="direction-out">- OUT</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PaginationRow page={personPage} pageSize={PERSON_LOG_PAGE_SIZE} total={logs.length} onPageChange={setPersonPage} />

              <h4 className="vehicles-used-title">Vehicles Used</h4>
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>RFID-ID</th>
                    <th>Plate Number</th>
                    <th>Vehicle Type</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiclesUsed.map((u) => (
                    <tr key={u.id} className="activity-row">
                      <td>{u.rfidId}</td>
                      <td>{u.plateNumber || '—'}</td>
                      <td>{u.vehicleType || '—'}</td>
                      <td>{u.role || '—'}</td>
                      <td><span className={`status-badge ${u.status === 'Inactive' ? 'badge-neutral' : 'badge-positive'}`}>{u.status || 'Active'}</span></td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="search-side-column">
              <div className="camera-card">
                <div className="camera-feed">
                  {selectedLog?.imageUrl ? (
                    <img src={selectedLog.imageUrl} alt="Vehicle snapshot" className="camera-feed-img" />
                  ) : (
                    <div className="camera-feed-empty">
                      <CameraIcon />
                      <span>No image available</span>
                    </div>
                  )}
                  {selectedLog && (
                    <div className="camera-caption">
                      <span className="rec-dot" /> {selectedLog.direction === 'OUT' ? 'CAM-OUT' : 'CAM-IN'} | {selectedLog.time}
                    </div>
                  )}
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
            <input type="date" value={dateFrom} max={dateTo || maxDate} onChange={(e) => changeFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} max={maxDate} onChange={(e) => changeTo(e.target.value)} />
          </div>

          <label className="filter-label">Vehicle Type</label>
          <select value={vehicleTypeFilter} onChange={(e) => setVehicleTypeFilter(e.target.value)}>
            <option value="All">All</option>
            {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="filter-label">Direction</label>
          <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
            <option value="All">All (IN and OUT)</option>
            <option value="IN">IN only (entries)</option>
            <option value="OUT">OUT only (exits)</option>
          </select>

          <label className="filter-label">RFID Tag</label>
          <input type="text" value={rfidFilter} onChange={(e) => setRfidFilter(e.target.value)} placeholder="Search RFID-ID" />

          <label className="filter-label">Driver / Name</label>
          <input type="text" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} placeholder="Search driver name" />

          <button type="button" className="export-btn" onClick={exportCsv} style={{ marginTop: 12 }}>
            <CsvIcon /> Export as CSV
          </button>
          <button type="button" className="export-btn" onClick={() => setShowPrintReport(true)}>
            <PdfIcon /> Print / Save as PDF
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
            {buildPageList(page, totalPages).map((n, i) => (
              n === '…'
                ? <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                : <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
          </div>
        </div>
      </div>

      {showPrintReport && (
        <PrintReportModal
          title={directionFilter === 'IN' ? 'Vehicle Access Report - Entries Only' : directionFilter === 'OUT' ? 'Vehicle Access Report - Exits Only' : 'Vehicle Access Report'}
          {...buildGateLogReport(filteredLogs, { from: dayStartMs(dateFrom), to: dayEndMs(dateTo) })}
          onClose={() => setShowPrintReport(false)}
        />
      )}

      {showRemarkModal && (
        <RemarkModal
          name={person.name}
          rfid={person.rfidId}
          initialRemark={personRemark?.text}
          onClose={() => setShowRemarkModal(false)}
          onSave={(text) => saveRemark(person.id, text)}
        />
      )}
    </div>
  )
}
