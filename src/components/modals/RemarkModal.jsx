import React, { useState } from 'react'
import Modal from './Modal'
import { REMARK_MAX_LENGTH, normalizeRemarkText } from '../../models/visitRemark'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errors'

// View / write / edit / remove the remark of ONE visit (an IN and its OUT). `remark` = the current one
// ({ text, at, byName }) or null. `scan` = which row it was opened from, e.g. "IN · 10/18/2026, 9:02 PM".
// `onSave(text)` returns a promise ('' removes the remark).
export default function RemarkModal({ name, rfid, scan, remark, onClose, onSave }){
  const { showError, showInfo } = useToast()
  const [text, setText] = useState(remark?.text || '')
  const [saving, setSaving] = useState(false)
  const clean = normalizeRemarkText(text)
  const unchanged = clean === (remark?.text || '')

  const save = async (value) => {
    setSaving(true)
    try {
      await onSave(value)
      showInfo(value ? 'Remark saved.' : 'Remark removed.')
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'The remark could not be saved. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Remark - ${name}`} onClose={onClose}>
      <form className="registration-form" onSubmit={(e) => { e.preventDefault(); save(clean) }}>
        <label>
          RFID-ID
          <input value={rfid} readOnly />
        </label>
        {scan && (
          <label>
            Scan
            <input value={scan} readOnly />
          </label>
        )}
        <label>
          Remark
          <textarea
            rows={5}
            value={text}
            maxLength={REMARK_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Not the registered owner, vehicle borrowed by a relative..."
            autoFocus
          />
          <span className="form-hint remark-counter">
            {remark?.at ? `Last saved by ${remark.byName || 'staff'} on ${new Date(remark.at).toLocaleString()} · ` : ''}
            {text.length}/{REMARK_MAX_LENGTH}
          </span>
        </label>
        <p className="form-hint">Shared with all staff. Saved with this visit only - its entry and exit. Their next entry starts without a remark; this one stays in Search History on this visit.</p>

        <div className="modal-actions">
          {remark?.text && <button type="button" className="btn-secondary" onClick={() => save('')} disabled={saving}>Remove</button>}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving || !clean || unchanged}>{saving ? 'Saving…' : 'Save Remark'}</button>
        </div>
      </form>
    </Modal>
  )
}
