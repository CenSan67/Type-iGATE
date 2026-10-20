import React, { useEffect, useState } from 'react'
import useLongStaySettings from '../../hooks/useLongStaySettings'
import useConnectionStatus from '../../hooks/useConnectionStatus'
import { LONG_STAY_DEFAULTS, LONG_STAY_LIMITS, LONG_STAY_THRESHOLD_FIELDS } from '../../models/longStay'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const REPEAT_OPTIONS = [
  { value: 0, label: 'Off - one text per warning' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 720, label: 'Every 12 hours' },
]

const toForm = (s) => ({
  enabled: s.enabled !== false,
  registeredHours: String(s.registeredHours),
  visitorHours: String(s.visitorHours),
  vipHours: String(s.vipHours),
  repeatMinutes: Number(s.repeatMinutes) || 0,
  smsEnabled: s.smsEnabled === true,
  smsRecipients: (s.smsRecipients || '').split(',').filter(Boolean).join('\n'),
})

// Admin-only (System Settings): how long each kind of person may stay before a long-stay
// warning appears on the Dashboard, and the optional SMS to management. The check itself runs
// server-side every 5 minutes (functions/longStay.js), so these apply within 5 minutes.
export default function LongStaySettingsCard(){
  const { loading, isDefault, settings, updatedAt, updatedByName, save } = useLongStaySettings()
  const online = useConnectionStatus()
  const { showError, showInfo } = useToast()
  const [form, setForm] = useState(() => toForm(LONG_STAY_DEFAULTS))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!dirty) setForm(toForm(settings)) }, [settings, dirty])

  const change = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await save(form)
      setDirty(false)
      showInfo('Long-stay settings saved. They apply from the next check (within 5 minutes).')
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to save the long-stay settings.'))
    }
    setSaving(false)
  }

  return (
    <div className="gate-control-card">
      <div className="gate-status-header-row">
        <div>
          <h3>Long-Stay Warnings</h3>
          <p>Warn admins on the Dashboard when someone's entry has no exit recorded after the allowed stay. Checked every 5 minutes from the recorded gate scans.</p>
        </div>
      </div>
      <hr />

      {loading ? <p className="form-hint-plain">Loading…</p> : (
        <form className="registration-form long-stay-form" onSubmit={handleSubmit}>
          <p className="form-hint-plain">
            {isDefault
              ? 'Using the default values below - no campus policy has been saved yet. Change them to match campus rules and press Save.'
              : `Last saved${updatedByName ? ` by ${updatedByName}` : ''}${updatedAt ? ` on ${new Date(updatedAt).toLocaleString()}` : ''}.`}
          </p>

          <label className="check-row">
            <input type="checkbox" checked={form.enabled} onChange={(e) => change('enabled', e.target.checked)} />
            Create long-stay warnings
          </label>

          <div className="long-stay-thresholds">
            {LONG_STAY_THRESHOLD_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label} (hours)
                <input
                  type="number"
                  min={LONG_STAY_LIMITS.minHours}
                  max={LONG_STAY_LIMITS.maxHours}
                  step="0.5"
                  value={form[f.key]}
                  onChange={(e) => change(f.key, e.target.value)}
                  disabled={!form.enabled}
                  required
                />
                <span className="form-hint-plain">Default: {LONG_STAY_DEFAULTS[f.key]} h</span>
              </label>
            ))}
          </div>

          <label className="check-row">
            <input type="checkbox" checked={form.smsEnabled} onChange={(e) => change('smsEnabled', e.target.checked)} />
            Also text these management numbers (SMS) - off by default
          </label>

          {form.smsEnabled && (
            <>
              <label>
                Mobile numbers (up to {LONG_STAY_LIMITS.maxRecipients}, one per line)
                <textarea rows="3" value={form.smsRecipients} onChange={(e) => change('smsRecipients', e.target.value)} placeholder="09XXXXXXXXX" />
              </label>
              <label>
                Repeat the text while a warning is not acknowledged
                <select value={form.repeatMinutes} onChange={(e) => change('repeatMinutes', Number(e.target.value))}>
                  {REPEAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <p className="form-hint-plain">
                Uses the gate SMS provider and its limits (1 text per number per 30 s, 20 per day; at most 3 texts per warning).
                "Accepted" means the provider took the message - delivery is not confirmed. Dashboard warnings work even if SMS fails.
              </p>
            </>
          )}

          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" className="btn-primary" disabled={saving || !online}>{saving ? 'Saving…' : 'Save'}</button>
            {dirty && <button type="button" className="btn-secondary" onClick={() => { setForm(toForm(settings)); setDirty(false) }} disabled={saving}>Discard changes</button>}
          </div>
        </form>
      )}
    </div>
  )
}
