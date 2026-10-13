import React, { useState } from 'react'
import ConfirmModal from '../modals/ConfirmModal'
import EditGuestWindowModal from '../modals/EditGuestWindowModal'
import { cancelExpectedGuest } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Admin-only actions on a VIP guest who hasn't arrived yet: reschedule the arrival window or
// cancel the pre-clearance. Shared by Account Management's VipGuestsPanel and the
// Dashboard's GuestClearancePanel. Renders nothing for any other status.
export default function GuestAdminActions({ guest }){
  const { showError } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (guest.status !== 'Expected') return null

  const runCancel = async () => {
    try {
      await cancelExpectedGuest(guest.id)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to cancel this guest right now.'))
    }
    setConfirmCancel(false)
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Edit Time</button>
      <button type="button" className="btn-secondary" onClick={() => setConfirmCancel(true)}>Cancel</button>

      {editing && <EditGuestWindowModal guest={guest} onClose={() => setEditing(false)} />}

      {confirmCancel && (
        <ConfirmModal
          title="Cancel this pre-clearance?"
          message={`Withdraw ${guest.name}'s pre-clearance? A guard will no longer be able to check them in.`}
          confirmLabel="Cancel Guest"
          danger
          onConfirm={runCancel}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </>
  )
}
