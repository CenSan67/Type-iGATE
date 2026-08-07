import React, { useMemo, useState } from 'react'
import Modal from './Modal'
import useRfidScanner from '../../hooks/useRfidScanner'
import { isValidRfid, isValidPlate, isValidEmail } from '../../utils/validators'

const defaultAmounts = { Registration: 250, Renewal: 250 }
const VALIDITY_MONTHS = 5

export default function RegistrationModal({ initialType = 'Registration', onClose, onSubmit }){
  const [form, setForm] = useState({
    paymentType: initialType,
    rfid: '',
    name: '',
    department: 'BSIT',
    plate: '',
    vehicle: 'Car',
    role: 'Student',
    email: '',
    amount: defaultAmounts[initialType] ?? 250,
  })
  const [error, setError] = useState('')
  const { scanning, startScan, stopScan } = useRfidScanner()

  const validUntilPreview = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + VALIDITY_MONTHS)
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  }, [])

  const handleScan = () => {
    setError('')
    startScan((rfid) => setForm((f) => ({ ...f, rfid })))
  }

  const update = (field) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [field]: value,
      amount: field === 'paymentType' ? (defaultAmounts[value] ?? f.amount) : f.amount,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.rfid.trim() || !form.name.trim() || !form.plate.trim()) {
      setError('RFID, Name and Plate Number are required.')
      return
    }
    if (!isValidRfid(form.rfid)) {
      setError('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (!isValidPlate(form.plate)) {
      setError('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }
    if (!isValidEmail(form.email)) {
      setError('Email format looks invalid.')
      return
    }
    onSubmit(form)
  }

  return (
    <Modal title={`${form.paymentType === 'Renewal' ? 'Renewal' : 'New Registration'} Payment`} onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <label>
          Payment Type
          <select value={form.paymentType} onChange={update('paymentType')}>
            <option value="Registration">New Registration</option>
            <option value="Renewal">Renewal</option>
          </select>
        </label>
        <label>
          RFID-ID
          <div className="rfid-scan-row">
            <input value={form.rfid} readOnly placeholder="Tap Scan RFID and present the card" />
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
          Full Name
          <input value={form.name} onChange={update('name')} placeholder="Juan Dela Cruz" />
        </label>
        <label>
          Department
          <input value={form.department} onChange={update('department')} placeholder="BSIT" />
        </label>
        <label>
          Plate Number
          <input value={form.plate} onChange={update('plate')} placeholder="ABC-1234" />
        </label>
        <label>
          Vehicle Type
          <select value={form.vehicle} onChange={update('vehicle')}>
            <option>Car</option>
            <option>Motorcycle</option>
            <option>E-Bike</option>
          </select>
        </label>
        <label>
          Role
          <select value={form.role} onChange={update('role')}>
            <option>Student</option>
            <option>Faculty</option>
            <option>Staff</option>
            <option>Visitor</option>
          </select>
        </label>
        <label>
          Email (optional)
          <input type="email" value={form.email} onChange={update('email')} placeholder="name@example.com" />
        </label>
        <label>
          Amount (₱)
          <input type="number" min="0" step="1" value={form.amount} onChange={update('amount')} />
        </label>

        <p className="form-hint">Valid until {validUntilPreview}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Confirm Payment</button>
        </div>
      </form>
    </Modal>
  )
}
