import React, { useEffect, useState } from 'react'
import GateButton from '../settings/GateButton'
import ConfirmModal from '../modals/ConfirmModal'
import { listenToGateStatus, setGateStatus } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import { GATE_IDS, GATE_LABELS } from '../../models/appSettings'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Manual override for both physical barriers (Entrance and Exit are separate hardware -
// Phase 12). Lives on System Settings, reachable by any staff role (Security Guard
// included - they're exactly who needs to raise/lower a barrier from the gatehouse).
export default function GateStatusCard(){
  const { user, role } = useAuth()
  const [statusByGate, setStatusByGate] = useState({})
  const [pending, setPending] = useState(null) // { gateId, state }
  const [submitting, setSubmitting] = useState(false)
  const { showError } = useToast()

  useEffect(() => {
    const unsubs = GATE_IDS.map((gateId) =>
      listenToGateStatus(gateId, (status) => setStatusByGate((prev) => ({ ...prev, [gateId]: status })))
    )
    return () => unsubs.forEach((unsub) => unsub && unsub())
  }, [])

  const canOverride = ROLES.includes(role)

  const closeConfirm = () => { if (!submitting) setPending(null) }

  const handleConfirm = async () => {
    if (!pending) return
    setSubmitting(true)
    try {
      await setGateStatus(pending.gateId, pending.state, { uid: user?.uid, email: user?.email })
      setPending(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to update that gate right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gate-control-card">
      <div className="gate-status-header-row">
        <div>
          <h3>Gate Control</h3>
          <p>Select a gate & open it remotely - live status from each relay controller</p>
        </div>
      </div>
      <hr />

      <div className="gate-buttons-row">
        {GATE_IDS.map((gateId) => {
          const status = statusByGate[gateId]
          const isOpen = status?.state === 'OPEN'
          const badgeClass = status?.state === 'OPEN' ? 'badge-positive' : status?.state === 'CLOSED' ? 'badge-negative' : 'badge-neutral'
          const badgeLabel = status?.state || 'UNKNOWN'

          return (
            <div key={gateId} className="gate-unit">
              <div className="gate-unit-header">
                <span>{GATE_LABELS[gateId]}</span>
                <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
              </div>

              {canOverride && (
                <GateButton
                  label={GATE_LABELS[gateId].toUpperCase()}
                  isOpen={isOpen}
                  onToggle={() => setPending({ gateId, state: isOpen ? 'CLOSED' : 'OPEN' })}
                />
              )}

              {status ? (
                <p className="gate-meta">Last updated {new Date(status.updatedAt).toLocaleString()} by {status.updatedByName || 'Unknown'}</p>
              ) : (
                <p className="gate-meta form-hint">No status reported yet.</p>
              )}
            </div>
          )
        })}
      </div>

      {pending && (
        <ConfirmModal
          title={`${pending.state === 'OPEN' ? 'Open' : 'Close'} the ${GATE_LABELS[pending.gateId].toLowerCase()}?`}
          message={`This sends an emergency ${pending.state} command straight to the physical gate hardware, overriding its current state. Confirm to proceed.`}
          confirmLabel={submitting ? 'Sending…' : (pending.state === 'OPEN' ? 'Open Gate' : 'Close Gate')}
          danger={pending.state === 'OPEN'}
          onConfirm={handleConfirm}
          onClose={closeConfirm}
        />
      )}
    </div>
  )
}
