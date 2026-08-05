import React, { useEffect, useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import RegisterRfidModal from '../modals/RegisterRfidModal'
import { RemarkAddButton, RemarkTick } from '../shared/RemarkBadge'
import { listenToGateLogs } from '../../services/firebase'

export default function RecentActivityTable(){
  const { remarks, saveRemark } = useRemarks()
  const [activeRow, setActiveRow] = useState(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const unsub = listenToGateLogs((entries) => {
      const nextLogs = entries
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 5)
        .map((entry) => {
          const rawDirection = entry.direction || entry.dir || 'IN'
          const normalizedDirection = rawDirection.toString().trim().toUpperCase()

          return {
            ...entry,
            name: entry.name || entry.userName || 'Unknown',
            plateNumber: entry.plateNumber || entry.plate || '—',
            vehicleType: entry.vehicleType || entry.vehicle || '—',
            department: entry.department || '—',
            role: entry.role || '—',
            direction: normalizedDirection === 'OUT' ? 'OUT' : 'IN',
            time: entry.timestamp && typeof entry.timestamp === 'number'
              ? new Date(entry.timestamp).toLocaleString()
              : 'Pending'
          }
        })
      setLogs(nextLogs)
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
        <button className="primary-btn" type="button" onClick={() => setShowRegisterModal(true)}>
          Register RFID
        </button>
      </div>
      <table className="activity-table">
        <thead>
          <tr>
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
              <td colSpan="8" className="empty-state">No RFID activity yet.</td>
            </tr>
          ) : logs.map((row) => (
            <tr key={row.id} className="activity-row">
              <td>{row.time}</td>
              <td>{row.cardId || row.rfidId || 'N/A'}</td>
              <td>{row.plateNumber || '—'}</td>
              <td>
                <span className="name-with-remark">
                  {row.name || 'Unknown'}
                  <RemarkAddButton onClick={() => setActiveRow(row)} />
                  {remarks[row.id] && <RemarkTick onClick={() => setActiveRow(row)} />}
                </span>
              </td>
              <td>{row.vehicleType || row.vehicle || '—'}</td>
              <td>{row.department || '—'}</td>
              <td>{row.role || '—'}</td>
              <td>{row.direction === 'OUT' ? <span className="direction-out">- OUT</span> : <span className="direction-in">+ IN</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeRow && (
        <RemarkModal
          name={activeRow.name || activeRow.cardId || 'Unknown'}
          rfid={activeRow.id}
          initialRemark={remarks[activeRow.id]}
          onClose={() => setActiveRow(null)}
          onSave={(text) => saveRemark(activeRow.id, text)}
        />
      )}

      {showRegisterModal ? (
        <RegisterRfidModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => setShowRegisterModal(false)}
        />
      ) : null}
    </div>
  )
}
