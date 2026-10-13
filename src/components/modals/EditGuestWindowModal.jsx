import React, { useState } from 'react'
import Modal from './Modal'
import { updateExpectedGuestWindow } from '../../services/firebase'
import { toLocalInputDateTime, fromLocalInputDateTime } from '../../utils/dateRange'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Admin-only: reschedule an expected (not yet arrived) VIP guest's arrival window.
export default function EditGuestWindowModal({ guest, onClose }){
  const { showError, showInfo } = useToast()
  const [validFrom, setValidFrom] = useState(toLocalInputDateTime(guest.validFrom))
  const [validUntil, setValidUntil] = useState(toLocalInputDateTime(guest.validUntil))
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const from = fromLocalInputDateTime(validFrom)
    const until = fromLocalInputDateTime(validUntil)
    if (!from || !until || until <= from) {
      showError('The arrival window end must be after its start.')
      return
    }
    setSubmitting(true)
    try {
      await updateExpectedGuestWindow(guest.id, { validFrom: from, validUntil: until })
      showInfo(`${guest.name}'s arrival window was updated.`)
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to update the arrival window right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Edit Arrival Window - ${guest.name}`} onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <label>
          Arrival Window - From
          <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </label>
        <label>
          Arrival Window - Until
          <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}
