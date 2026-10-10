import React, { useMemo, useState } from 'react'
import useExpectedGuests from '../../hooks/useExpectedGuests'
import useVisitorPasses from '../../hooks/useVisitorPasses'
import ConfirmModal from '../modals/ConfirmModal'
import { setRfidUserStatus, logGateEntry } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Any staff role - walk-in visitor passes only (see useVisitorPasses for why VIP guest
// passes are excluded; those return via GuestClearancePanel's Check Out instead). A guard
// returns the pass once the visitor's ID is handed back at the guardhouse; database.rules.json
// allows any active staff role to deactivate (never reactivate) a Visitor record for this.
export default function VisitorPassesPanel(){
  const guests = useExpectedGuests()
  const linkedRfidIds = useMemo(() => guests.filter((g) => g.rfidId).map((g) => g.rfidId), [guests])
  const passes = useVisitorPasses(linkedRfidIds)
  const { showError } = useToast()
  const [pendingReturn, setPendingReturn] = useState(null)

  const runReturn = async () => {
    if (!pendingReturn) return
    try {
      await setRfidUserStatus(pendingReturn.id, 'Inactive')
      // Best-effort - the pass is already returned even if this OUT scan fails to log.
      // functions/index.js#backfillExitSnapshot picks this up automatically and reuses
      // this same visitor's IN photo, the same as any other OUT scan.
      try {
        await logGateEntry({ cardId: pendingReturn.rfidId, direction: 'OUT', source: 'visitor-return' })
      } catch (scanError) {
        showError(`Pass returned, but the exit could not be recorded: ${getErrorMessage(scanError, 'please log it manually.')}`)
      }
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
          message={`Deactivate ${pendingReturn.name || pendingReturn.rfidId}'s temporary pass now that their ID has been returned?`}
          confirmLabel="Return Pass"
          onConfirm={runReturn}
          onClose={() => setPendingReturn(null)}
        />
      )}
    </div>
  )
}
