import React, { useState } from 'react'
import Modal from './Modal'
import { EMERGENCY_CLASSIFICATIONS, EMERGENCY_LIMITS } from '../../models/emergencyLog'
import { resolveEmergencies } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

// Search History -> Emergency Records: resolve every open alert with one outcome (e.g. a batch
// of test taps). Each one is still acknowledged + resolved individually, with its own history.
export default function ResolveEmergenciesModal({ logs, onClose }){
  const { showError, showInfo } = useToast()
  const { user, profile } = useAuth()
  const [classification, setClassification] = useState('')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { resolved, failed } = await resolveEmergencies(logs, { classification, summary }, { name: profile?.fullName || profile?.displayName || user?.email || '' })
      if (failed.length) {
        showError(`${resolved} resolved, ${failed.length} could not be: ${failed.map((f) => `${f.id} (${f.error})`).join('; ')}`)
      } else {
        showInfo(`${resolved} emergency alert${resolved === 1 ? '' : 's'} resolved.`)
        onClose()
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Not every alert could be resolved. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Resolve ${logs.length} open emergency alerts`} onClose={onClose}>
      <form className="registration-form" onSubmit={submit}>
        <label>
          Outcome
          <select value={classification} onChange={(e) => setClassification(e.target.value)} required autoFocus>
            <option value="" disabled>Select outcome</option>
            {EMERGENCY_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Resolution details (optional)
          <textarea rows={3} value={summary} maxLength={EMERGENCY_LIMITS.text} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Test taps while setting up the emergency card" />
        </label>
        <p className="form-hint">The records stay in the history; only their status changes. The barriers are not moved.</p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || !classification}>{saving ? 'Resolving…' : `Resolve ${logs.length}`}</button>
        </div>
      </form>
    </Modal>
  )
}
