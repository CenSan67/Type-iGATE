import React, { useState } from 'react'
import Modal from './Modal'

// Password-confirmed "start over" for a wrong/declined/removed signup (see useCancelSignup).
export default function CancelSignupModal({ busy, onConfirm, onClose }){
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(password)
  }

  return (
    <Modal title="Cancel signup and start over?" onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <p className="form-hint">
          This deletes your account request and login so you can sign up again - for example with a corrected email.
          Enter your password to confirm.
        </p>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Back</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Cancelling...' : 'Cancel signup'}</button>
        </div>
      </form>
    </Modal>
  )
}
