import React, { useMemo, useState } from 'react'
import useExpectedGuests from '../../hooks/useExpectedGuests'
import CheckInGuestModal from '../modals/CheckInGuestModal'
import ConfirmModal from '../modals/ConfirmModal'
import { checkOutGuest } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const formatWindow = (guest) => {
  const from = new Date(guest.validFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const to = new Date(guest.validUntil).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `${from} - ${to}`
}

// Any staff role - the gate-side half of VIP pre-clearance. Administrators add guests from
// Account Management's VipGuestsPanel; a guard here checks them in (issuing the temporary
// pass) and out (returning it) without needing an admin at the gate. Only Expected/Arrived
// guests show - Departed/Cancelled ones have nothing left to do.
export default function GuestClearancePanel(){
  const guests = useExpectedGuests()
  const { showError } = useToast()
  const [checkingIn, setCheckingIn] = useState(null)
  const [pendingCheckOut, setPendingCheckOut] = useState(null)

  const visible = useMemo(() => guests.filter((g) => g.status === 'Expected' || g.status === 'Arrived'), [guests])

  const runCheckOut = async () => {
    if (!pendingCheckOut) return
    try {
      await checkOutGuest(pendingCheckOut.id, (msg) => showError(msg))
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to check this guest out right now.'))
    }
    setPendingCheckOut(null)
  }

  if (visible.length === 0) return null

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div>
          <h3>VIP Guest Clearance</h3>
          <p>Pre-cleared guests waiting to arrive or already on campus</p>
        </div>
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Host</th>
            <th>Arrival Window</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((g) => (
            <tr key={g.id} className="activity-row">
              <td>{g.name}</td>
              <td><span className="tag-pill">{g.category}</span></td>
              <td>{g.hostName}</td>
              <td>{formatWindow(g)}</td>
              <td><span className={`status-badge ${g.status === 'Arrived' ? 'badge-positive' : 'badge-neutral'}`}>{g.status}</span></td>
              <td>
                {g.status === 'Expected' ? (
                  <button type="button" className="btn-primary" onClick={() => setCheckingIn(g)}>Check In</button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => setPendingCheckOut(g)}>Check Out</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {checkingIn && <CheckInGuestModal guest={checkingIn} onClose={() => setCheckingIn(null)} />}

      {pendingCheckOut && (
        <ConfirmModal
          title="Check out this guest?"
          message={`Mark ${pendingCheckOut.name} as departed and return their temporary pass?`}
          confirmLabel="Check Out"
          onConfirm={runCheckOut}
          onClose={() => setPendingCheckOut(null)}
        />
      )}
    </div>
  )
}
