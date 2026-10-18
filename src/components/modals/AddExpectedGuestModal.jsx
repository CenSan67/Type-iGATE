import React, { useState } from 'react'
import Modal from './Modal'
import { useAuth } from '../../context/AuthContext'
import { createExpectedGuest } from '../../services/firebase'
import { GUEST_CATEGORIES } from '../../models/expectedGuest'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { isValidPlate, normalizePlate, PLATE_FORMAT_HINT } from '../../utils/validators'
import { toLocalInputDateTime, fromLocalInputDateTime } from '../../utils/dateRange'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { fieldInputValue } from '../../utils/textCase'

// Default window: from now until 4 hours from now - a reasonable single-event visit, easy
// to widen for a multi-day booking.
const DEFAULT_WINDOW_MS = 4 * 60 * 60 * 1000

function defaultForm() {
  const now = Date.now()
  return {
    name: '',
    category: GUEST_CATEGORIES[0],
    hostName: '',
    purpose: '',
    plateNumber: '',
    vehicleType: 'Car',
    validFrom: toLocalInputDateTime(now),
    validUntil: toLocalInputDateTime(now + DEFAULT_WINDOW_MS),
  }
}

// Admin-only (Account Management): pre-clears a VIP guest so they never queue or hand over
// an ID at the gate - a guard checks them in/out later from the Dashboard's GuestClearancePanel.
export default function AddExpectedGuestModal({ onClose, onCreated }){
  const { user, profile } = useAuth()
  const staffName = profile?.fullName || profile?.displayName || user?.email || ''
  const { showError } = useToast()
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => {
    const value = fieldInputValue(field, e) // name/plate in ALL CAPS
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.hostName.trim()) {
      showError('Guest name and host are required.')
      return
    }
    if (form.plateNumber.trim() && !isValidPlate(form.plateNumber)) {
      showError(`Plate Number: ${PLATE_FORMAT_HINT}.`)
      return
    }
    const validFrom = fromLocalInputDateTime(form.validFrom)
    const validUntil = fromLocalInputDateTime(form.validUntil)
    if (!validFrom || !validUntil || validUntil <= validFrom) {
      showError('The arrival window end must be after its start.')
      return
    }

    setSubmitting(true)
    try {
      await createExpectedGuest({
        name: form.name.trim(),
        category: form.category,
        hostName: form.hostName.trim(),
        purpose: form.purpose.trim(),
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        validFrom,
        validUntil,
      }, { uid: user?.uid, name: staffName })
      onCreated?.()
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to add this guest right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add Expected Guest" onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <label>
          Guest Name
          <input value={form.name} onChange={update('name')} placeholder="Full name" />
        </label>
        <label>
          Category
          <select value={form.category} onChange={update('category')}>
            {GUEST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Host / Inviting Office
          <input value={form.hostName} onChange={update('hostName')} placeholder="Who invited them" />
        </label>
        <label>
          Purpose (optional)
          <input value={form.purpose} onChange={update('purpose')} placeholder="e.g. Commencement speaker" />
        </label>
        <label>
          Plate Number (optional - fill in at the gate if unknown)
          <input value={form.plateNumber} onChange={update('plateNumber')} placeholder="ABC1234" />
        </label>
        <label>
          Vehicle Type
          <select value={form.vehicleType} onChange={update('vehicleType')}>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Arrival Window - From
          <input type="datetime-local" value={form.validFrom} onChange={update('validFrom')} />
        </label>
        <label>
          Arrival Window - Until
          <input type="datetime-local" value={form.validUntil} onChange={update('validUntil')} />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Add Guest'}</button>
        </div>
      </form>
    </Modal>
  )
}
