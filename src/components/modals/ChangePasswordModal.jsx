import React, { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import Modal from './Modal'
import { auth } from '../../services/firebase'

// Firebase treats password changes as a sensitive operation: it requires a recent
// sign-in, so we reauthenticate with the current password before calling
// updatePassword rather than assuming the existing session is fresh enough.
const AUTH_ERROR_MESSAGES = {
  'auth/wrong-password': 'Current password is incorrect.',
  'auth/invalid-credential': 'Current password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/weak-password': 'New password must be at least 6 characters.',
  'auth/requires-recent-login': 'Please log out and back in, then try again.',
}

export default function ChangePasswordModal({ onClose }){
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
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

    const user = auth.currentUser
    if (!user) {
      setError('You must be signed in with a real account to change your password.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, form.current))
      await updatePassword(user, form.next)
      setSuccess(true)
    } catch (err) {
      setError(AUTH_ERROR_MESSAGES[err.code] || err.message || 'Unable to update password right now.')
    } finally {
      setSubmitting(false)
    }
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
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
