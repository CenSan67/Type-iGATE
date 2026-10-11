import React, { useEffect, useState } from 'react'
import GateButton from '../settings/GateButton'
import ConfirmModal from '../modals/ConfirmModal'
import { listenToGateStatus, sendScannerCommand, listenToScannerCommandAck } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import { GATE_IDS, GATE_LABELS, GATE_ACTIONS, GATE_BUTTON_LOCK_MS, GATE_CLOSE_BUTTON_LOCK_MS } from '../../models/appSettings'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// How long to wait for the scanner to acknowledge before telling staff it didn't respond
// (it polls every ~1.5 s, longer only while busy with a scan or a motor run).
const GATE_COMMAND_TIMEOUT_MS = 10000

// Manual override for both physical barriers (Entrance and Exit are separate hardware -
// Phase 12). Lives on System Settings, reachable by any staff role (Security Guard
// included - they're exactly who needs to raise/lower a barrier from the gatehouse).
//
// Each button sends a scanner command (OPEN_/CLOSE_ + ENTRY | EXIT | BOTH - "Both" runs the
// two motors at the same time) that the ESP32 runs within ~1.5 s: Open drives the motor
// forward, Close drives it in reverse. Closing is manual only - an opened barrier (by card
// scan, Return Pass or this card) stays open until someone presses Close. The badges come
// only from the ESP32, which remembers each barrier's state - this card never marks a gate
// itself (it used to, and the badge stuck whenever the scanner didn't run the command); it
// waits for the scanner's acknowledgement (commandAck) and says so if none arrives. Every
// button is locked while waiting, then for the motor run + 1 s (open: GATE_BUTTON_LOCK_MS,
// close: GATE_CLOSE_BUTTON_LOCK_MS - the reverse run is 200 ms shorter).
export default function GateStatusCard(){
  const { user, role } = useAuth()
  const [statusByGate, setStatusByGate] = useState({})
  const [pending, setPending] = useState(null) // { target: 'entrance' | 'exit' | 'both', open: bool }
  const [submitting, setSubmitting] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [lastMove, setLastMove] = useState(null) // { open } - for the "Opening…/Closing…" label
  const [awaiting, setAwaiting] = useState(null) // { id, target, open } - sent, scanner hasn't answered yet
  const [ack, setAck] = useState(null)
  const locked = lockedUntil > 0
  const busy = locked || !!awaiting
  const { showError, showInfo } = useToast()

  useEffect(() => {
    const unsubs = GATE_IDS.map((gateId) =>
      listenToGateStatus(gateId, (status) => setStatusByGate((prev) => ({ ...prev, [gateId]: status })))
    )
    return () => unsubs.forEach((unsub) => unsub && unsub())
  }, [])

  useEffect(() => listenToScannerCommandAck(setAck), [])

  const targetName = (target) => (target === 'both' ? 'Both gates' : GATE_LABELS[target])

  // The scanner answered our command: start the motor-run + 1 s lock, or report why not.
  useEffect(() => {
    if (!awaiting || ack?.id !== awaiting.id) return
    if (ack.result === 'ok') {
      showInfo(`${targetName(awaiting.target)} ${awaiting.open ? 'opening' : 'closing'}.`)
      setLastMove({ open: awaiting.open })
      setLockedUntil(Date.now() + (awaiting.open ? GATE_BUTTON_LOCK_MS : GATE_CLOSE_BUTTON_LOCK_MS))
    } else if (ack.result === 'already open' || ack.result === 'already closed') {
      showInfo(`${targetName(awaiting.target)}: ${ack.result} - motor not run.`)
    } else {
      showError(`The gate controller did not move the gate: ${ack.result}.`)
    }
    setAwaiting(null)
  }, [ack, awaiting, showError, showInfo])

  // No answer at all: the scanner is off, offline, or running older firmware.
  useEffect(() => {
    if (!awaiting) return undefined
    const timer = setTimeout(() => {
      showError('The gate controller did not respond - check that the scanner is powered, online and running the latest firmware.')
      setAwaiting(null)
    }, GATE_COMMAND_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [awaiting, showError])

  useEffect(() => {
    if (!lockedUntil) return undefined
    const timer = setTimeout(() => setLockedUntil(0), Math.max(0, lockedUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [lockedUntil])

  const canOverride = ROLES.includes(role)
  const gateStates = GATE_IDS.map((gateId) => statusByGate[gateId]?.state)
  const bothOpen = gateStates.every((st) => st === 'OPEN')
  const bothBadge = bothOpen ? { label: 'OPEN', className: 'badge-positive' }
    : gateStates.every((st) => st === 'CLOSED') ? { label: 'CLOSED', className: 'badge-negative' }
    : gateStates.some((st) => st === 'OPEN') ? { label: 'PARTLY OPEN', className: 'badge-neutral' }
    : { label: 'UNKNOWN', className: 'badge-neutral' }

  const buttonLabel = (open) => {
    if (awaiting) return 'Sending…'
    if (locked) return lastMove?.open ? 'Opening…' : 'Closing…'
    return open ? 'Open' : 'Close'
  }

  const closeConfirm = () => { if (!submitting) setPending(null) }

  const handleConfirm = async () => {
    if (!pending) return
    setSubmitting(true)
    try {
      const action = GATE_ACTIONS[pending.open ? 'open' : 'close'][pending.target]
      const id = await sendScannerCommand(action, { actor: { name: user?.email } })
      setAwaiting({ id, ...pending })
      setPending(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to update that gate right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmText = (() => {
    if (!pending) return null
    const both = pending.target === 'both'
    const subject = both ? 'both gates' : `the ${GATE_LABELS[pending.target].toLowerCase()}`
    const motors = both ? 'entrance and exit barrier motors at the same time' : `${GATE_LABELS[pending.target].toLowerCase()} barrier motor`
    return pending.open
      ? {
        title: `Open ${subject}?`,
        message: `This runs the ${motors} forward right now, overriding the RFID scanner. The barrier stays open until someone presses Close. Make sure nothing is in its path.`,
        label: both ? 'Open Both Gates' : 'Open Gate',
      }
      : {
        title: `Close ${subject}?`,
        message: `This runs the ${motors} in reverse to lower the barrier${both ? 's' : ''}. Make sure no vehicle or person is under ${both ? 'either barrier' : 'it'}.`,
        label: both ? 'Close Both Gates' : 'Close Gate',
      }
  })()

  return (
    <div className="gate-control-card">
      <div className="gate-status-header-row">
        <div>
          <h3>Gate Control</h3>
          <p>Select a gate & open or close it remotely - live status from each relay controller</p>
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
                  actionLabel={buttonLabel(!isOpen)}
                  disabled={busy}
                  onToggle={() => setPending({ target: gateId, open: !isOpen })}
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

        <div className="gate-unit">
          <div className="gate-unit-header">
            <span>Both Gates</span>
            <span className={`status-badge ${bothBadge.className}`}>{bothBadge.label}</span>
          </div>
          {canOverride && (
            <GateButton
              label="ENTRANCE + EXIT"
              isOpen={bothOpen}
              actionLabel={buttonLabel(!bothOpen)}
              disabled={busy}
              onToggle={() => setPending({ target: 'both', open: !bothOpen })}
            />
          )}
          <p className="gate-meta">{bothOpen ? 'Closes' : 'Opens'} the entrance and exit barriers at the same time.</p>
        </div>
      </div>

      {confirmText && (
        <ConfirmModal
          title={confirmText.title}
          message={confirmText.message}
          confirmLabel={submitting ? 'Sending…' : confirmText.label}
          danger
          onConfirm={handleConfirm}
          onClose={closeConfirm}
        />
      )}
    </div>
  )
}
