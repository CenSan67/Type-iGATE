import React, { useState } from 'react'
import { registerRfidUser } from '../../services/firebase'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import useRfidScanner from '../../hooks/useRfidScanner'
import { isValidRfid, isValidPlate, isValidEmail, isValidPhone } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const initialForm = {
  name: '',
  rfidId: '',
  plateNumber: '',
  vehicleType: 'Car',
  role: 'Visitor',
  email: '',
  phone: '',
  hostName: '',
  purpose: '',
  visitDuration: '8h',
}

// This Dashboard form is visitor-only: it issues a temporary pass (the visitor leaves a valid
// ID at the guardhouse). Students/Faculty/Staff register through Payment instead, since that
// flow collects the fee and records the document verification + privacy consent - a second
// path here would let registrations skip both.
// Pass durations are converted to an absolute rfidUsers/{id}/expiresAt timestamp at submit
// time - see handleSubmit.
const VISIT_DURATIONS = [
  { value: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { value: '8h', label: '8 hours (single shift)', ms: 8 * 60 * 60 * 1000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '3d', label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
]

export default function RegisterRfidModal({ onClose, onRegistered }) {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const { showError } = useToast()
  const { scanning, startScan, stopScan } = useRfidScanner()

  const handleScan = () => {
    startScan((rfidId) => setForm((f) => ({ ...f, rfidId })))
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.rfidId.trim()) {
      showError('Please enter an RFID code.')
      return
    }
    if (!isValidRfid(form.rfidId)) {
      showError('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (form.plateNumber.trim() && !isValidPlate(form.plateNumber)) {
      showError('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }
    if (!isValidEmail(form.email)) {
      showError('Email format looks invalid.')
      return
    }
    if (!isValidPhone(form.phone)) {
      showError('Phone format looks invalid (expected a PH mobile number, e.g. 09171234567).')
      return
    }

    const isVisitor = form.role === 'Visitor'
    const duration = VISIT_DURATIONS.find((d) => d.value === form.visitDuration)
    const expiresAt = isVisitor ? Date.now() + (duration?.ms ?? VISIT_DURATIONS[1].ms) : null

    setSubmitting(true)

    try {
      await registerRfidUser({
        name: form.name.trim(),
        rfidId: form.rfidId.trim(),
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        department: '',
        role: form.role,
        email: form.email.trim(),
        phone: form.phone.trim(),
        expiresAt,
        hostName: isVisitor ? form.hostName.trim() : '',
        purpose: isVisitor ? form.purpose.trim() : '',
      })

      onRegistered?.()
      onClose()
    } catch (error) {
      showError(getErrorMessage(error, 'Unable to register RFID user right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  const isVisitor = form.role === 'Visitor'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{isVisitor ? 'Register Visitor Pass' : 'Register New RFID User'}</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <label>
            Full Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>

          <label>
            RFID ID
            <div className="rfid-scan-row">
              <input name="rfidId" value={form.rfidId} readOnly placeholder="Tap Scan RFID and present the card" required />
              <button
                type="button"
                className={`scan-btn ${scanning ? 'scanning' : ''}`}
                onClick={scanning ? stopScan : handleScan}
              >
                {scanning ? 'Waiting for card…' : 'Scan RFID'}
              </button>
            </div>
          </label>

          <label>
            Plate Number
            <input name="plateNumber" value={form.plateNumber} onChange={handleChange} placeholder="ABC-1234" />
          </label>

          <label>
            Vehicle Type
            <select name="vehicleType" value={form.vehicleType} onChange={handleChange}>
              {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label>
            Email (optional)
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
          </label>

          <label>
            Phone (optional — enables SMS gate alerts)
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="09171234567" />
          </label>

          {isVisitor ? (
            <>
              <label>
                Visiting / Host Name
                <input name="hostName" value={form.hostName} onChange={handleChange} placeholder="Who they're visiting" />
              </label>

              <label>
                Purpose of Visit
                <input name="purpose" value={form.purpose} onChange={handleChange} placeholder="e.g. Delivery, Meeting, Campus tour" />
              </label>

              <label>
                Pass Valid For
                <select name="visitDuration" value={form.visitDuration} onChange={handleChange}>
                  {VISIT_DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
            </>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Saving...' : isVisitor ? 'Issue Visitor Pass' : 'Register RFID'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
