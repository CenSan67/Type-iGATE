import React, { useState } from 'react'
import Modal from './Modal'
import {
  EMERGENCY_TYPES, EMERGENCY_CLASSIFICATIONS, EMERGENCY_ACTION_LABELS, EMERGENCY_LIMITS,
  NOT_AVAILABLE, emergencyActionsOf,
} from '../../models/emergencyLog'
import { acknowledgeEmergency, markEmergencyInProgress, saveEmergencyDetails, addEmergencyRemark, resolveEmergency } from '../../services/firebase'
import { capsInputValue, plateInputValue } from '../../utils/textCase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import EmergencyStatusBadge from '../shared/EmergencyStatusBadge'

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString() : NOT_AVAILABLE)

const InfoRow = ({ label, value, fallback = NOT_AVAILABLE }) => (
  <div className="info-row">
    <span>{label}</span>
    <span className={value ? '' : 'emergency-missing'}>{value || fallback}</span>
  </div>
)

// Everything about one emergency card scan, live (the parent passes the current record from
// useEmergencyLogs, so a change made on another screen shows here at once). Every Active
// staff role can do everything here - it's an emergency: acknowledge, mark in progress, record
// incident details, add remarks and resolve (= classify the alert: confirmed / false alarm /
// test). Original scan fields are display-only - nothing here can change them.
export default function EmergencyEventModal({ log, onClose }){
  const { showError, showInfo } = useToast()
  const { user, profile } = useAuth()
  const actor = { name: profile?.fullName || profile?.displayName || user?.email || '' }
  const resolved = log.status === 'Resolved'
  const details = log.details

  const [busy, setBusy] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({ type: details?.type || '', agency: details?.agency || '', plateNumber: details?.plateNumber || '', destination: details?.destination || '' })
  const [remark, setRemark] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolution, setResolution] = useState({ classification: '', summary: '' })

  const run = async (action, done) => {
    setBusy(true)
    try {
      await action()
      if (done) showInfo(done)
      return true
    } catch (err) {
      showError(getErrorMessage(err, 'That could not be saved. Please try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const changeDetail = (field) => (e) => {
    const value = field === 'plateNumber' ? plateInputValue(e) : field === 'agency' ? capsInputValue(e) : e.target.value
    setDetailsForm((f) => ({ ...f, [field]: value }))
  }

  const submitDetails = async (e) => {
    e.preventDefault()
    if (await run(() => saveEmergencyDetails(log.id, detailsForm, actor), 'Incident details saved.')) setEditingDetails(false)
  }

  const submitRemark = async (e) => {
    e.preventDefault()
    if (await run(() => addEmergencyRemark(log.id, remark, actor), 'Remark added.')) setRemark('')
  }

  const submitResolution = async (e) => {
    e.preventDefault()
    if (await run(() => resolveEmergency(log.id, resolution, actor), 'Emergency resolved. Close the barriers from Gate Control if they are still open.')) setResolving(false)
  }

  const actions = emergencyActionsOf(log)

  return (
    <Modal title="Emergency Event" onClose={onClose} className="emergency-modal">
      <div className="emergency-modal-banner" role="status">
        <span className="emergency-siren" aria-hidden="true">!</span>
        <strong>EMERGENCY RFID SCAN</strong>
        <EmergencyStatusBadge status={log.status} />
      </div>
      <p className="form-hint">A scan of the emergency card is an alert, not a confirmed emergency - check it, then record what happened.</p>

      <div className="info-rows emergency-info">
        <InfoRow label="Event ID" value={log.eventId || log.id} />
        <InfoRow label="RFID card" value={log.cardId} />
        <InfoRow label="Time in" value={log.timestamp ? `${formatDateTime(log.timestamp)}${log.timeApprox ? ' (approx. - scanned offline)' : ''}` : ''} />
        <InfoRow label="Time out" value={log.exitAt ? `${formatDateTime(log.exitAt)}${log.exitTimeApprox ? ' (approx. - scanned offline)' : ''}` : ''} fallback="Not yet - tap the card again when the vehicle leaves" />
        <InfoRow label="Reader / device" value={log.device ? `${log.device}${log.bits ? ` (${log.bits}-bit)` : ''}` : ''} />
        <InfoRow label="Barriers" value={log.gatesOpened === true ? 'Opened and held open' : log.gatesOpened === false ? 'Not moved (alert only)' : ''} />
        <InfoRow label="Acknowledged" value={log.acknowledgedAt ? `${log.acknowledgedByName || 'Staff'} · ${formatDateTime(log.acknowledgedAt)}` : ''} fallback="Not yet" />
        <InfoRow label="Resolved" value={log.resolvedAt ? `${log.resolvedByName || 'Staff'} · ${formatDateTime(log.resolvedAt)}` : ''} fallback="Not yet" />
        {log.resolution && <InfoRow label="Outcome" value={[log.resolution.classification, log.resolution.summary].filter(Boolean).join(' - ')} />}
      </div>

      {!resolved && (
        <div className="modal-actions emergency-workflow">
          {log.status === 'New' && <button type="button" className="btn-primary emergency-primary" onClick={() => run(() => acknowledgeEmergency(log.id, actor), 'Alert acknowledged.')} disabled={busy}>Acknowledge</button>}
          {log.status === 'Acknowledged' && <button type="button" className="btn-secondary" onClick={() => run(() => markEmergencyInProgress(log.id, actor), 'Marked in progress.')} disabled={busy}>Mark in progress</button>}
          {log.status !== 'New' && !resolving && <button type="button" className="btn-primary" onClick={() => setResolving(true)} disabled={busy}>Resolve…</button>}
        </div>
      )}

      {resolving && (
        <form className="registration-form emergency-subform" onSubmit={submitResolution}>
          <h4>Resolve alert</h4>
          <label>
            Outcome
            <select value={resolution.classification} onChange={(e) => setResolution((r) => ({ ...r, classification: e.target.value }))} required>
              <option value="" disabled>Select outcome</option>
              {EMERGENCY_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Resolution details (optional)
            <textarea rows={3} value={resolution.summary} maxLength={EMERGENCY_LIMITS.text} onChange={(e) => setResolution((r) => ({ ...r, summary: e.target.value }))} placeholder="What was done, when the vehicle left..." />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setResolving(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !resolution.classification}>{busy ? 'Saving…' : 'Resolve'}</button>
          </div>
        </form>
      )}

      <div className="emergency-section">
        <div className="emergency-section-head">
          <h4>Incident details</h4>
          {!resolved && !editingDetails && <button type="button" className="btn-secondary" onClick={() => setEditingDetails(true)}>{details ? 'Edit' : 'Add details'}</button>}
        </div>
        {editingDetails ? (
          <form className="registration-form emergency-subform" onSubmit={submitDetails}>
            <label>
              Type of emergency
              <select value={detailsForm.type} onChange={changeDetail('type')} required>
                <option value="" disabled>Select type</option>
                {EMERGENCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              Responding unit / agency
              <input value={detailsForm.agency} onChange={changeDetail('agency')} maxLength={EMERGENCY_LIMITS.agency} placeholder="e.g. BUSTOS BFP" />
            </label>
            <label>
              Vehicle plate number
              <input value={detailsForm.plateNumber} onChange={changeDetail('plateNumber')} maxLength={20} placeholder="If visible, e.g. ABC1234" />
            </label>
            <label>
              Destination on campus
              <input value={detailsForm.destination} onChange={changeDetail('destination')} maxLength={EMERGENCY_LIMITS.destination} placeholder="e.g. Clinic, Building A" />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditingDetails(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy || !detailsForm.type}>{busy ? 'Saving…' : 'Save details'}</button>
            </div>
          </form>
        ) : details ? (
          <div className="info-rows">
            <InfoRow label="Type" value={details.type} />
            <InfoRow label="Unit / agency" value={details.agency} />
            <InfoRow label="Plate" value={details.plateNumber} />
            <InfoRow label="Destination" value={details.destination} />
            <InfoRow label="Recorded by" value={`${details.recordedByName || 'Staff'} · ${formatDateTime(details.recordedAt)}`} />
          </div>
        ) : (
          <p className="emergency-missing">Emergency details have not been provided yet.</p>
        )}
      </div>

      <div className="emergency-section">
        <h4>Remarks &amp; actions</h4>
        {actions.length === 0 ? <p className="emergency-missing">No actions recorded yet.</p> : (
          <ol className="emergency-timeline">
            {actions.map((a) => (
              <li key={a.id}>
                <span className="emergency-timeline-when">{formatDateTime(a.at)}</span>
                <strong>{EMERGENCY_ACTION_LABELS[a.type] || a.type}</strong> by {a.byName || 'staff'}
                {a.text && <div className="emergency-timeline-text">{a.text}</div>}
              </li>
            ))}
          </ol>
        )}
        <form className="registration-form emergency-subform" onSubmit={submitRemark}>
          <label>
            Add a remark / action taken
            <textarea rows={2} value={remark} maxLength={EMERGENCY_LIMITS.text} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Ambulance escorted to the clinic, left 10:42 AM" />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={busy || !remark.trim()}>{busy ? 'Saving…' : 'Add remark'}</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
