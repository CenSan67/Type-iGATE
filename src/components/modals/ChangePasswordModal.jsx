import React, { useState } from 'react'
import Modal from './Modal'

export default function ChangePasswordModal({ onClose }){
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.current || !form.next || !form.confirm) {
      setError('Please fill in all fields.')
      return
    }
    if (form.next.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (form.next !== form.confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setError('')
    setSuccess(true)
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      {success ? (
        <div className="password-success">
          <p>Your password has been updated.</p>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="registration-form" onSubmit={handleSubmit}>
          <label>
            Current Password
            <input type="password" value={form.current} onChange={update('current')} />
          </label>
          <label>
            New Password
            <input type="password" value={form.next} onChange={update('next')} />
          </label>
          <label>
            Confirm New Password
            <input type="password" value={form.confirm} onChange={update('confirm')} />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Update Password</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
