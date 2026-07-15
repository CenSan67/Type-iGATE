import React, { useEffect, useMemo, useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import { RemarkTick } from '../shared/RemarkBadge'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

const searchTypes = ['Plate No.', 'RFID-ID', 'Name']

const person = {
  name: 'Jims Rid',
  rfid: 'RFID-XZNXH03Q',
  plate: 'ABC-3570',
  role: 'Student',
  vehicle: 'Car',
  section: 'BSIT-3CG1',
  dateRegistered: 'January 16, 2025',
}

const logs = [
  { time: '10:45 AM', date: 'March 23, 2026', role: 'Student', direction: 'IN' },
  { time: '4:00 PM', date: 'March 22, 2026', role: 'Student', direction: 'OUT' },
  { time: '6:45 AM', date: 'March 22, 2026', role: 'Student', direction: 'IN' },
  { time: '1:00 PM', date: 'March 21, 2026', role: 'Student', direction: 'OUT' },
  { time: '6:30 AM', date: 'March 21, 2026', role: 'Student', direction: 'IN' },
  { time: '3:00 PM', date: 'March 20, 2026', role: 'Student', direction: 'OUT' },
  { time: '6:00 AM', date: 'March 19, 2026', role: 'Student', direction: 'IN' },
  { time: '5:00 PM', date: 'March 19, 2026', role: 'Student', direction: 'OUT' },
  { time: '7:45 AM', date: 'March 18, 2026', role: 'Student', direction: 'IN' },
  { time: '5:00 PM', date: 'March 17, 2026', role: 'Student', direction: 'OUT' },
]

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
  const [query, setQuery] = useState(person.plate)
  const [submittedQuery, setSubmittedQuery] = useState(person.plate)
  const { remarks, saveRemark } = useRemarks()
  const [showRemarkModal, setShowRemarkModal] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const hasMatch = useMemo(() => {
    const q = submittedQuery.trim().toLowerCase()
    if (!q) return false
    return [person.plate, person.rfid, person.name].some((field) => field.toLowerCase().includes(q))
  }, [submittedQuery])

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
                    <strong>{person.name}</strong>
                    {remarks[person.rfid] && <RemarkTick onClick={() => setShowRemarkModal(true)} title="View remark" />}
                  </span>
                  <div className="result-rfid">{person.rfid}</div>
                </div>
                <span className="plate-pill">{person.plate}</span>
                <span className="tag-pill">{person.role}</span>
                <span className="tag-pill">{person.vehicle}</span>
                <span className="tag-pill">{person.section}</span>
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
                  {logs.map((log, i) => (
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
                  <div className="camera-caption"><span className="rec-dot" /> CAM-IN | {logs[0].time}</div>
                </div>
              </div>

              <div className="info-card">
                <h4>Information</h4>
                <div className="info-person">
                  <span className="result-avatar"><PersonIcon /></span>
                  <div>
                    <strong>{person.name}</strong>
                    <div><span className="tag-pill role-pill">{person.role}</span></div>
                  </div>
                </div>
                <div className="info-rows">
                  <div className="info-row"><span>RFID-ID:</span><span>{person.rfid}</span></div>
                  <div className="info-row"><span>Plate No:</span><span className="plate-pill">{person.plate}</span></div>
                  <div className="info-row"><span>Vehicle Type:</span><span>{person.vehicle}</span></div>
                  <div className="info-row"><span>Section:</span><span>{person.section}</span></div>
                  <div className="info-row"><span>Date Registered:</span><span>{person.dateRegistered}</span></div>
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
          rfid={person.rfid}
          initialRemark={remarks[person.rfid]}
          onClose={() => setShowRemarkModal(false)}
          onSave={(text) => saveRemark(person.rfid, text)}
        />
      )}
    </div>
  )
}
