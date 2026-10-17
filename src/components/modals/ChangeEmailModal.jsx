import React, { useState } from 'react'
import Modal from './Modal'
import { requestEmailChange } from '../../services/auth'
import { isValidEmail } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const AUTH_ERROR_MESSAGES = {
  'auth/wrong-password': 'Current password is incorrect.',
  'auth/invalid-credential': 'Current password is incorrect.',
  'auth/email-already-in-use': 'That email is already used by another account.',
  'auth/requires-recent-login': 'Please log out and back in, then try again.',
}

// My Profile -> Email -> Change. The account switches only after the link sent to the new
// address is opened (services/auth.js#requestEmailChange).
export default function ChangeEmailModal({ currentEmail, onClose }){
  const [form, setForm] = useState({ email: '', password: '' })
  const [sentTo, setSentTo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { showError } = useToast()

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const email = form.email.trim()
    if (!email || !form.password) { showError('Please fill in all fields.'); return }
    if (!isValidEmail(email)) { showError('Enter a valid email address, e.g. name@bulsu.edu.ph.'); return }
    if (email.toLowerCase() === (currentEmail || '').toLowerCase()) { showError('That is already your email.'); return }

    setSubmitting(true)
    try {
      await requestEmailChange(email, form.password)
      setSentTo(email)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to change the email right now.', AUTH_ERROR_MESSAGES))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Change Email" onClose={submitting ? () => {} : onClose}>
      {sentTo ? (
        <div className="password-success">
          <p>We sent a confirmation link to <strong>{sentTo}</strong>.</p>
          <p className="form-hint-plain">
            Open it to finish the change - until then keep signing in with {currentEmail}. After it's confirmed,
            sign in with the new email (your username, if you have one, keeps working). The old address gets a
            notice with a link to undo the change if it wasn't you.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <p className="form-hint-plain">Current email: <strong>{currentEmail}</strong></p>
          <label>
            New Email
            <input type="email" value={form.email} onChange={update('email')} autoComplete="email" autoCapitalize="none" spellCheck={false} />
          </label>
          <label>
            Current Password
            <input type="password" value={form.password} onChange={update('password')} autoComplete="current-password" />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Confirmation Link'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
