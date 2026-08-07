import React, { useState } from 'react'
import Modal from './Modal'
import { updateRfidUser } from '../../services/firebase'
import { isValidRfid, isValidPlate, isValidEmail } from '../../utils/validators'
import { VEHICLE_OWNER_ROLES, VEHICLE_TYPES } from '../../models/rfidUser'

export default function EditRfidUserModal({ user, onClose, onSaved }){
  const [form, setForm] = useState({
    name: user.name || '',
    rfidId: user.rfidId || '',
    plateNumber: user.plateNumber || '',
    vehicleType: user.vehicleType || 'Car',
    department: user.department || '',
    role: user.role || 'Student',
    email: user.email || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim() || !form.rfidId.trim()) {
      setError('Name and RFID are required.')
      return
    }
    if (!isValidRfid(form.rfidId)) {
      setError('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (form.plateNumber.trim() && !isValidPlate(form.plateNumber)) {
      setError('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }
    if (!isValidEmail(form.email)) {
      setError('Email format looks invalid.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateRfidUser(user.id, {
        name: form.name.trim(),
        rfidId: form.rfidId.trim(),
        plateNumber: form.plateNumber.trim(),
        vehicleType: form.vehicleType,
        department: form.department.trim(),
        role: form.role,
        email: form.email.trim(),
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Unable to save changes right now.')
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
          <input name="rfidId" value={form.rfidId} onChange={handleChange} required />
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

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}
