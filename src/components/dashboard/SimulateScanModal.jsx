import React, { useEffect, useState } from 'react'
import Modal from '../modals/Modal'
import { listenToRfidUsers, logGateEntry } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Dev/testing aid only: lets staff push a fake gateLogs entry through the exact same
// write path (logGateEntry -> validateGateLog) the ESP32 scanner uses, so the live
// dashboard/table/stats can be exercised without physical hardware present.
export default function SimulateScanModal({ onClose }){
  const [users, setUsers] = useState([])
  const [rfidId, setRfidId] = useState('')
  const [direction, setDirection] = useState('IN')
  const [submitting, setSubmitting] = useState(false)
  const { showError } = useToast()

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rfidId.trim()) {
      showError('Pick a registered RFID or type one to simulate.')
      return
    }
    setSubmitting(true)
    try {
      await logGateEntry({ cardId: rfidId.trim(), direction, source: 'simulated' })
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to simulate that scan right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Simulate Hardware Scan (dev/testing)" onClose={onClose}>
      <form className="register-form" onSubmit={handleSubmit}>
        <p className="form-hint">Pushes a fake gateLogs entry through the same code path the ESP32 scanner uses — for testing the live dashboard without hardware present.</p>

        <label>
          Registered RFID
          <select value={rfidId} onChange={(e) => setRfidId(e.target.value)}>
            <option value="">-- pick a registered card --</option>
            {users.map((u) => (
              <option key={u.id} value={u.rfidId}>{u.rfidId} ({u.name || 'Unnamed'})</option>
            ))}
          </select>
        </label>

        <label>
          Or type a custom RFID/card ID
          <input value={rfidId} onChange={(e) => setRfidId(e.target.value)} placeholder="e.g. TEST-1234" />
        </label>

        <label>
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Sending...' : 'Simulate Scan'}</button>
        </div>
      </form>
    </Modal>
  )
}
