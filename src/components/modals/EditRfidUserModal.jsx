import React, { useState } from 'react'
import Modal from './Modal'
import { updateRfidUser } from '../../services/firebase'
import useRfidScanner from '../../hooks/useRfidScanner'
import DummyFillButton from '../shared/DummyFillButton'
import { isValidRfid, isValidPlate, isValidEmail, isValidPhone, generateDummyRfid } from '../../utils/validators'
import { VEHICLE_OWNER_ROLES, VEHICLE_TYPES } from '../../models/rfidUser'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { fieldInputValue } from '../../utils/textCase'

export default function EditRfidUserModal({ user, onClose, onSaved }){
  const [form, setForm] = useState({
    name: user.name || '',
    rfidId: user.rfidId || '',
    plateNumber: user.plateNumber || '',
    vehicleType: user.vehicleType || 'Car',
    vehicleColor: user.vehicleColor || '',
    department: user.department || '',
    role: user.role || 'Student',
    email: user.email || '',
    phone: user.phone || '',
  })
  const { showError } = useToast()
  const [saving, setSaving] = useState(false)
  const { scanning, startScan, stopScan } = useRfidScanner()

  const handleChange = (e) => {
    const { name } = e.target
    const value = fieldInputValue(name, e) // name/plate/color/department in ALL CAPS
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Lost-card reissue: tap the replacement card instead of typing its ID by hand - this is
  // the same rfidId reassignment database.rules.json already allows an admin to make on an
  // existing record (Phase 9's RBAC audit), just exposed here as a scan instead of free text.
  const handleScan = () => {
    startScan((rfidId) => setForm((f) => ({ ...f, rfidId })))
  }

  const handleDummyFill = () => setForm((f) => ({ ...f, rfidId: generateDummyRfid() }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim() || !form.rfidId.trim()) {
      showError('Name and RFID are required.')
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

    setSaving(true)
    try {
      await updateRfidUser(user.id, {
        name: form.name.trim(),
        rfidId: form.rfidId.trim(),
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        vehicleColor: form.vehicleColor.trim(),
        department: form.department.trim(),
        role: form.role,
        email: form.email.trim(),
        phone: form.phone.trim(),
      })
      onSaved?.()
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to save changes right now.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit RFID User" onClose={onClose}>
      <form className="register-form" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>

        <label>
          RFID ID
          <div className="rfid-scan-row">
            <input name="rfidId" value={form.rfidId} onChange={handleChange} required />
            <button
              type="button"
              className={`scan-btn ${scanning ? 'scanning' : ''}`}
              onClick={scanning ? stopScan : handleScan}
            >
              {scanning ? 'Waiting for card…' : 'Scan New Card'}
            </button>
            <DummyFillButton onClick={handleDummyFill} />
          </div>
          <span className="registration-note">Lost their card? Scan the replacement here to reassign this record to it.</span>
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
          Vehicle Color
          <input name="vehicleColor" value={form.vehicleColor} onChange={handleChange} placeholder="White" />
        </label>

        <label>
          Department
          <input name="department" value={form.department} onChange={handleChange} placeholder="BSIT" />
        </label>

        <label>
          Role
          <select name="role" value={form.role} onChange={handleChange}>
            {VEHICLE_OWNER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}
