import React, { useState } from 'react'
import Modal from './Modal'
import useRfidScanner from '../../hooks/useRfidScanner'
import { useAuth } from '../../context/AuthContext'
import { checkInGuest } from '../../services/firebase'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { isValidRfid, isValidPlate } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Any staff role, from the Dashboard's GuestClearancePanel: issues the pre-cleared guest a
// temporary pass at the gate. Plate/vehicle are pre-filled from the pre-clearance record but
// editable, since a convoy's actual plate is often only known when it arrives.
export default function CheckInGuestModal({ guest, onClose, onCheckedIn }){
  const { user, profile } = useAuth()
  const staffName = profile?.fullName || profile?.displayName || user?.email || ''
  const { showError } = useToast()
  const { scanning, startScan, stopScan } = useRfidScanner()
  const [rfidId, setRfidId] = useState('')
  const [plateNumber, setPlateNumber] = useState(guest.plateNumber || '')
  const [vehicleType, setVehicleType] = useState(guest.vehicleType || 'Car')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rfidId.trim()) {
      showError('Scan or enter the temporary pass card first.')
      return
    }
    if (!isValidRfid(rfidId)) {
      showError('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (plateNumber.trim() && !isValidPlate(plateNumber)) {
      showError('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }

    setSubmitting(true)
    try {
      // The IN (and its photo) is logged when the guest scans the card at the gate.
      await checkInGuest(
        guest.id,
        { rfidId: rfidId.trim(), plateNumber: plateNumber.trim(), vehicleType },
        { name: staffName },
        (msg) => showError(msg),
      )
      onCheckedIn?.()
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to check this guest in right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Check In: ${guest.name}`} onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <p className="form-hint">{guest.category} - hosted by {guest.hostName}</p>
        <label>
          Temporary Pass (RFID)
          <div className="rfid-scan-row">
            <input value={rfidId} onChange={(e) => setRfidId(e.target.value)} readOnly placeholder="Tap Scan and present the card" />
            <button
              type="button"
              className={`scan-btn ${scanning ? 'scanning' : ''}`}
              onClick={scanning ? stopScan : () => startScan(setRfidId)}
            >
              {scanning ? 'Waiting for card…' : 'Scan RFID'}
            </button>
          </div>
        </label>
        <label>
          Plate Number
          <input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ABC-1234" />
        </label>
        <label>
          Vehicle Type
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Checking In…' : 'Check In'}</button>
        </div>
      </form>
    </Modal>
  )
}
