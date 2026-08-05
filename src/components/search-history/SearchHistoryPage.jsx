import React, { useEffect, useMemo, useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import { RemarkTick } from '../shared/RemarkBadge'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToRfidUsers } from '../../services/firebase'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'

const searchTypes = ['Plate No.', 'RFID-ID', 'Name']

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5z" fill="currentColor" /><path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor" /></svg>
)
const CameraIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function SearchHistoryPage(){
  const [now, setNow] = useState(new Date())
  const [searchType, setSearchType] = useState('Plate No.')
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const { remarks, saveRemark } = useRemarks()
  const [showRemarkModal, setShowRemarkModal] = useState(false)
  const [users, setUsers] = useState([])
  const entries = useEnrichedGateLogs()

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
