import React, { useState } from 'react'
import Modal from './Modal'

const defaultAmounts = { Registration: 250, Renewal: 250 }

export default function RegistrationModal({ initialType = 'Registration', onClose, onSubmit }){
  const [form, setForm] = useState({
    paymentType: initialType,
    rfid: '',
    name: '',
    department: 'BSIT',
    plate: '',
    vehicle: 'Car',
    amount: defaultAmounts[initialType] ?? 250,
  })
  const [error, setError] = useState('')

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
          <input value={form.rfid} onChange={update('rfid')} placeholder="RFID-XXXXXXX" />
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
          Amount (₱)
          <input type="number" min="0" step="1" value={form.amount} onChange={update('amount')} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Confirm Payment</button>
        </div>
      </form>
    </Modal>
  )
}
