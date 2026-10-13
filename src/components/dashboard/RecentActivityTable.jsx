import React, { useEffect, useState } from 'react'
import { useRemarks, remarkKeyOf } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import RegisterRfidModal from '../modals/RegisterRfidModal'
import SimulateUserScanModal from '../modals/SimulateUserScanModal'
import ImagePreviewModal from '../modals/ImagePreviewModal'
import { RemarkAddButton, RemarkTick } from '../shared/RemarkBadge'
import { listenToNewGateLogs } from '../../services/firebase'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'

const FLASH_DURATION_MS = 4000

const CameraPlaceholderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
)

export default function RecentActivityTable(){
  const [activeRow, setActiveRow] = useState(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [simulateDirection, setSimulateDirection] = useState(null)
  const [justArrivedId, setJustArrivedId] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const entries = useEnrichedGateLogs()
  // Remarks are per person and per visit (see hooks/useRemarks.js) - shared with Search History.
  const { remarkFor, entryHasRemark, saveRemark } = useRemarks(entries)

  const logs = entries
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 5)
    .map((entry) => ({
      ...entry,
      time: entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Pending',
    }))

  // Hardware-ready: onChildAdded fires the instant the ESP32 scanner posts a new
  // gateLogs entry, independent of the full-history listener useEnrichedGateLogs uses
  // for the table contents - this just drives the "just scanned" highlight.
  useEffect(() => {
    const unsub = listenToNewGateLogs((entry) => {
      setJustArrivedId(entry.id)
      const timer = setTimeout(() => setJustArrivedId((cur) => (cur === entry.id ? null : cur)), FLASH_DURATION_MS)
      return () => clearTimeout(timer)
    })
    return () => unsub && unsub()
  }, [])

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div>
          <h3>Recent Vehicle Activity</h3>
          <p>Real-time entry and exit logs</p>
        </div>
        <div className="activity-header-actions">
          <button
            type="button"
            className="icon-btn-round icon-btn-entry"
            title="Simulate entry for a registered user"
            aria-label="Simulate entry for a registered user"
            onClick={() => setSimulateDirection('IN')}
          >
            +
          </button>
          <button
            type="button"
            className="icon-btn-round icon-btn-exit"
            title="Simulate exit for a registered user"
            aria-label="Simulate exit for a registered user"
            onClick={() => setSimulateDirection('OUT')}
          >
            &minus;
          </button>
          <button className="primary-btn" type="button" onClick={() => setShowRegisterModal(true)}>
            Register Visitor
          </button>
        </div>
      </div>
      <table className="activity-table">
        <thead>
          <tr>
            <th>Snapshot</th>
            <th>Time</th>
            <th>RFID-ID</th>
            <th>Plate Number</th>
            <th>Name</th>
            <th>Vehicle</th>
            <th>Department</th>
            <th>Role</th>
            <th>Direction</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan="9" className="empty-state">No RFID activity yet.</td>
            </tr>
          ) : logs.map((row) => (
            <tr key={row.id} className={`activity-row ${row.id === justArrivedId ? 'just-scanned' : ''}`}>
              <td>
                {row.imageUrl ? (
                  <button type="button" className="snapshot-thumb-btn" onClick={() => setPreviewImage(row.imageUrl)} title="View snapshot">
                    <img src={row.imageUrl} alt="Vehicle snapshot" className="snapshot-thumb" />
                  </button>
                ) : (
                  <span className="snapshot-thumb-placeholder" title="No snapshot"><CameraPlaceholderIcon /></span>
                )}
              </td>
              <td>{row.time}</td>
              <td>{row.rfidId || 'N/A'}</td>
              <td>{row.plateNumber || '—'}</td>
              <td>
                <span className="name-with-remark">
                  {row.name || 'Unknown'}
                  <RemarkAddButton onClick={() => setActiveRow(row)} />
                  {entryHasRemark(row) && <RemarkTick onClick={() => setActiveRow(row)} />}
                </span>
              </td>
              <td>{row.vehicleType || '—'}</td>
              <td>{row.department || '—'}</td>
              <td>{row.role || '—'}</td>
              <td>{row.direction === 'OUT' ? <span className="direction-out">- OUT</span> : <span className="direction-in">+ IN</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      {activeRow && (
        <RemarkModal
          name={activeRow.name || activeRow.rfidId || 'Unknown'}
          rfid={activeRow.id}
          initialRemark={remarkFor(remarkKeyOf(activeRow))?.text}
          onClose={() => setActiveRow(null)}
          onSave={(text) => saveRemark(remarkKeyOf(activeRow), text)}
        />
      )}

      {showRegisterModal ? (
        <RegisterRfidModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => setShowRegisterModal(false)}
        />
      ) : null}

      {simulateDirection && (
        <SimulateUserScanModal
          direction={simulateDirection}
          onClose={() => setSimulateDirection(null)}
        />
      )}
    </div>
  )
}
