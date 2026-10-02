import React, { useMemo, useState } from 'react'
import Modal from './Modal'
import useRfidUsers from '../../hooks/useRfidUsers'
import { logGateEntry } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Dev/testing aid, same write path as SimulateScanModal (logGateEntry -> validateGateLog),
// but scoped to picking an existing registered user instead of typing/picking a raw RFID -
// lets a guard simulate an already-registered vehicle's entry/exit without a physical
// scanner. Visitors are excluded here on purpose: they already have their own check-in/out
// flows (GuestClearancePanel, VisitorPassesPanel) that keep their pass status in sync.
export default function SimulateUserScanModal({ direction, onClose }){
  const users = useRfidUsers()
  const { showError, showInfo } = useToast()
  const [query, setQuery] = useState('')
  const [submittingId, setSubmittingId] = useState(null)

  const label = direction === 'IN' ? 'Entry' : 'Exit'

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => u.role !== 'Visitor' && u.status !== 'Inactive')
      .filter((u) => !q || [u.name, u.rfidId, u.plateNumber].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [users, query])

  const handlePick = async (user) => {
    setSubmittingId(user.id)
    try {
      await logGateEntry({ cardId: user.rfidId, direction, source: 'simulated' })
      showInfo(`Simulated ${label.toLowerCase()} for ${user.name || user.rfidId}.`)
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to simulate that scan right now.'))
      setSubmittingId(null)
    }
  }

  return (
    <Modal title={`Simulate ${label} (dev/testing)`} onClose={onClose}>
      <p className="form-hint">
        Pick a registered vehicle/owner to push a fake {label.toLowerCase()} gateLogs scan for them - the same
        code path the ESP32 scanner uses. Visitors aren't listed here; use the pass panels below instead.
      </p>

      <input
        className="simulate-user-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, RFID, or plate number..."
      />

      <div className="simulate-user-list">
        {candidates.length === 0 ? (
          <p className="empty-state">No matching registered users.</p>
        ) : candidates.map((u) => (
          <div key={u.id} className="simulate-user-row">
            <div className="simulate-user-info">
              <strong>{u.name || 'Unnamed'}</strong>
              <span>{u.rfidId}{u.plateNumber ? ` · ${u.plateNumber}` : ''}</span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={submittingId === u.id}
              onClick={() => handlePick(u)}
            >
              {submittingId === u.id ? 'Sending...' : `Simulate ${label}`}
            </button>
          </div>
        ))}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
