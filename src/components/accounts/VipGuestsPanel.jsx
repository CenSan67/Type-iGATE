import React, { useState } from 'react'
import useExpectedGuests from '../../hooks/useExpectedGuests'
import AddExpectedGuestModal from '../modals/AddExpectedGuestModal'
import ConfirmModal from '../modals/ConfirmModal'
import { cancelExpectedGuest } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const formatWindow = (guest) => {
  const from = new Date(guest.validFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const to = new Date(guest.validUntil).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `${from} - ${to}`
}

const STATUS_BADGE = {
  Expected: 'badge-neutral',
  Arrived: 'badge-positive',
  Departed: 'badge-neutral',
  Cancelled: 'badge-negative',
}

// Admin-only (Account Management): pre-clear VIP guests ahead of time and withdraw a
// pre-clearance that's no longer happening. Check-in/out at the gate is a guard action, done
// from the Dashboard's GuestClearancePanel instead - see CLAUDE.md's Phase 11 note.
export default function VipGuestsPanel(){
  const guests = useExpectedGuests()
  const { showError } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [pendingCancel, setPendingCancel] = useState(null)

  const runCancel = async () => {
    if (!pendingCancel) return
    try {
      await cancelExpectedGuest(pendingCancel.id)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to cancel this guest right now.'))
    }
    setPendingCancel(null)
  }

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div>
          <h3>VIP Pre-Clearance</h3>
          <p>Expected guests skip the queue - a guard checks them in/out from the Dashboard</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Expected Guest</button>
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
          {guests.length === 0 ? (
            <tr><td colSpan={6} className="accounts-empty">No guests pre-cleared yet.</td></tr>
          ) : guests.map((g) => (
            <tr key={g.id} className="activity-row">
              <td>{g.name}</td>
              <td><span className="tag-pill">{g.category}</span></td>
              <td>{g.hostName}</td>
              <td>{formatWindow(g)}</td>
              <td><span className={`status-badge ${STATUS_BADGE[g.status] || 'badge-neutral'}`}>{g.status}</span></td>
              <td>
                {g.status === 'Expected' && (
                  <button type="button" className="btn-secondary" onClick={() => setPendingCancel(g)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd && <AddExpectedGuestModal onClose={() => setShowAdd(false)} />}

      {pendingCancel && (
        <ConfirmModal
          title="Cancel this pre-clearance?"
          message={`Withdraw ${pendingCancel.name}'s pre-clearance? A guard will no longer be able to check them in.`}
          confirmLabel="Cancel Guest"
          danger
          onConfirm={runCancel}
          onClose={() => setPendingCancel(null)}
        />
      )}
    </div>
  )
}
