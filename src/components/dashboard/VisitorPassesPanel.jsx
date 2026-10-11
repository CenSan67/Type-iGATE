import React, { useMemo, useState } from 'react'
import useExpectedGuests from '../../hooks/useExpectedGuests'
import useVisitorPasses from '../../hooks/useVisitorPasses'
import ConfirmModal from '../modals/ConfirmModal'
import { returnTemporaryPass } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

// Any staff role - walk-in visitor passes only (see useVisitorPasses for why VIP guest
// passes are excluded; those return via GuestClearancePanel's Check Out instead). A guard
// returns the pass once the visitor's ID is handed back at the guardhouse; database.rules.json
// allows any active staff role to deactivate (never reactivate) a Visitor record for this.
export default function VisitorPassesPanel(){
  const guests = useExpectedGuests()
  // Only a guest currently on campus claims their card - a Departed guest's old card is back
  // in the pool, and excluding it forever would hide every later walk-in visitor issued it.
  const linkedRfidIds = useMemo(() => guests.filter((g) => g.status === 'Arrived' && g.rfidId).map((g) => g.rfidId), [guests])
  const passes = useVisitorPasses(linkedRfidIds)
  const { showError } = useToast()
  const { user, profile } = useAuth()
  const staffName = profile?.fullName || profile?.displayName || user?.email || ''
  const [pendingReturn, setPendingReturn] = useState(null)

  const runReturn = async () => {
    if (!pendingReturn) return
    try {
      // Logs the OUT (if they're inside), deactivates the pass with returnedAt - wiping this
      // visitor from the card for its next holder - and opens the exit barrier.
      await returnTemporaryPass(pendingReturn, { source: 'visitor-return', actor: { name: staffName }, onWarning: showError })
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to return this pass right now.'))
    }
    setPendingReturn(null)
  }

  if (passes.length === 0) return null

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div>
          <h3>Active Visitor Passes</h3>
          <p>Return the pass once the visitor's ID is handed back at the guardhouse</p>
        </div>
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>RFID-ID</th>
            <th>Plate</th>
            <th>Visiting</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {passes.map((p) => (
            <tr key={p.id} className="activity-row">
              <td>{p.name || 'Unknown'}</td>
              <td>{p.rfidId}</td>
              <td>{p.plateNumber || '—'}</td>
              <td>{p.hostName || '—'}</td>
              <td>{p.expiresAt ? new Date(p.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td>
                <button type="button" className="btn-secondary" onClick={() => setPendingReturn(p)}>Return Pass</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendingReturn && (
        <ConfirmModal
          title="Return this visitor pass?"
          message={`Return ${pendingReturn.name || pendingReturn.rfidId}'s temporary pass now that their ID has been handed back? The exit barrier will open and card ${pendingReturn.rfidId} will be cleared for the next visitor.`}
          confirmLabel="Return Pass"
          onConfirm={runReturn}
          onClose={() => setPendingReturn(null)}
        />
      )}
    </div>
  )
}
