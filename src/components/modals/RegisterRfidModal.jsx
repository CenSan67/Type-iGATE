import React, { useState } from 'react'
import { registerRfidUser } from '../../services/firebase'
import useRfidScanner from '../../hooks/useRfidScanner'
import { isValidRfid, isValidPlate, isValidEmail } from '../../utils/validators'

const initialForm = {
  name: '',
  rfidId: '',
  plateNumber: '',
  vehicleType: 'Car',
  department: '',
  role: 'Student',
  email: '',
}

export default function RegisterRfidModal({ onClose, onRegistered }) {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const { scanning, startScan, stopScan } = useRfidScanner()

  const handleScan = () => {
    setMessage('')
    startScan((rfidId) => setForm((f) => ({ ...f, rfidId })))
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.rfidId.trim()) {
      setMessage('Please enter an RFID code.')
      return
    }
    if (!isValidRfid(form.rfidId)) {
      setMessage('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (form.plateNumber.trim() && !isValidPlate(form.plateNumber)) {
      setMessage('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }
    if (!isValidEmail(form.email)) {
      setMessage('Email format looks invalid.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      await registerRfidUser({
        name: form.name.trim(),
        rfidId: form.rfidId.trim(),
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        department: form.department.trim(),
        role: form.role,
        email: form.email.trim(),
      })

      onRegistered?.()
      onClose()
    } catch (error) {
      setMessage(error.message || 'Unable to register RFID user right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Register New RFID User</h3>
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
              <option value="Car">Car</option>
              <option value="Motorcycle">Motorcycle</option>
              <option value="E-Bike">E-Bike</option>
              <option value="Truck">Truck</option>
            </select>
          </label>

          <label>
            Department
            <input name="department" value={form.department} onChange={handleChange} placeholder="BSIT" />
          </label>

          <label>
            Role
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="Student">Student</option>
              <option value="Faculty">Faculty</option>
              <option value="Staff">Staff</option>
              <option value="Visitor">Visitor</option>
            </select>
          </label>

          <label>
            Email (optional)
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
          </label>

          {message ? <p className="form-message">{message}</p> : null}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Register RFID'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
