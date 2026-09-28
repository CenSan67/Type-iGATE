import React, { useEffect, useState } from 'react'
import GateButton from '../settings/GateButton'
import ConfirmModal from '../modals/ConfirmModal'
import { listenToGateStatus, setGateStatus } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Visual indicator + manual override for the physical barrier gate (Phase 6).
// Lives on the Dashboard rather than System Settings because Security Guards need
// to reach it too, and /settings is Super Admin/Administrator-only (see CLAUDE.md).
export default function GateStatusCard(){
  const { user, role } = useAuth()
  const [status, setStatus] = useState(null)
  const [pendingState, setPendingState] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { showError } = useToast()

  useEffect(() => {
    const unsub = listenToGateStatus(setStatus)
    return () => unsub && unsub()
  }, [])

  const canOverride = ROLES.includes(role)
  const isOpen = status?.state === 'OPEN'
  const badgeClass = status?.state === 'OPEN' ? 'badge-positive' : status?.state === 'CLOSED' ? 'badge-negative' : 'badge-neutral'
  const badgeLabel = status?.state || 'UNKNOWN'

  const closeConfirm = () => { if (!submitting) { setPendingState(null) } }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await setGateStatus(pendingState, { uid: user?.uid, email: user?.email })
      setPendingState(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to update the barrier gate right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gate-control-card">
      <div className="gate-status-header-row">
        <div>
          <h3>Barrier Gate</h3>
          <p>Live status reported by the gate relay controller</p>
        </div>
        <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
      </div>
      <hr />

      {status ? (
        <p className="meta-card">
          Last updated {new Date(status.updatedAt).toLocaleString()} by {status.updatedByName || 'Unknown'}
        </p>
      ) : (
        <p className="form-hint">No status reported yet — the relay controller hasn't written to this gate's status.</p>
      )}

      {canOverride && (
        <div className="gate-buttons-row">
          <GateButton
            label="MANUAL OVERRIDE"
            isOpen={isOpen}
            onToggle={() => setPendingState(isOpen ? 'CLOSED' : 'OPEN')}
          />
        </div>
      )}

      {pendingState && (
        <ConfirmModal
          title={`${pendingState === 'OPEN' ? 'Open' : 'Close'} the barrier gate?`}
          message={`This sends an emergency ${pendingState} command straight to the physical gate hardware, overriding its current state. Confirm to proceed.`}
          confirmLabel={submitting ? 'Sending…' : (pendingState === 'OPEN' ? 'Open Gate' : 'Close Gate')}
          danger={pendingState === 'OPEN'}
          onConfirm={handleConfirm}
          onClose={closeConfirm}
        />
      )}
    </div>
  )
}
