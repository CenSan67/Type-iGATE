import React, { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import Modal from './Modal'
import PasswordRules from '../shared/PasswordRules'
import { auth } from '../../services/firebase'
import { isValidPassword } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Firebase treats password changes as a sensitive operation: it requires a recent
// sign-in, so we reauthenticate with the current password before calling
// updatePassword rather than assuming the existing session is fresh enough.
const AUTH_ERROR_MESSAGES = {
  'auth/wrong-password': 'Current password is incorrect.',
  'auth/invalid-credential': 'Current password is incorrect.',
}

export default function ChangePasswordModal({ onClose }){
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const { showError } = useToast()
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.current || !form.next || !form.confirm) {
      showError('Please fill in all fields.')
      return
    }
    if (!isValidPassword(form.next)) {
      showError('New password does not meet all the requirements below.')
      return
    }
    if (form.next !== form.confirm) {
      showError('New password and confirmation do not match.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      showError('You must be signed in with a real account to change your password.')
      return
    }

    setSubmitting(true)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, form.current))
      await updatePassword(user, form.next)
      setSuccess(true)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to update password right now.', AUTH_ERROR_MESSAGES))
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
          <PasswordRules password={form.next} />
          <label>
            Confirm New Password
            <input type="password" value={form.confirm} onChange={update('confirm')} />
          </label>

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
