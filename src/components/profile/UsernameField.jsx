import React, { useState } from 'react'
import { claimUsername } from '../../services/auth'
import { isValidUsername, normalizeUsername, USERNAME_HINT } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// My Profile's "Username" row. Saved through the setUsername Cloud Function (the only writer -
// unique and tied to the signed-in account), so it has its own Save instead of "Edit Profile".
export default function UsernameField({ username }){
  const { showError, showInfo } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const start = () => { setValue(username || ''); setEditing(true) }
  const valid = isValidUsername(value)
  const unchanged = normalizeUsername(value) === (username || '')

  const save = async () => {
    if (!valid || unchanged || saving) return
    setSaving(true)
    try {
      const saved = await claimUsername(value)
      showInfo(`Username set to ${saved}. You can now sign in with it.`)
      setEditing(false)
    } catch (err) {
      showError(getErrorMessage(err, 'Could not save the username. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-field-row">
      <label>Username:</label>
      {editing ? (
        <div className="username-edit">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
            maxLength={30}
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Username"
            disabled={saving}
          />
          <p className={`form-hint-plain ${value && !valid ? 'username-hint-error' : ''}`}>{USERNAME_HINT}</p>
          <div className="username-edit-actions">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className="profile-btn-edit" onClick={save} disabled={!valid || unchanged || saving}>{saving ? 'Saving…' : 'Save Username'}</button>
          </div>
        </div>
      ) : (
        <div className="profile-value-action">
          <div className="profile-field-display">{username || 'Not set - sign in with your email'}</div>
          <button type="button" className="btn-secondary" onClick={start}>{username ? 'Change' : 'Set username'}</button>
        </div>
      )}
    </div>
  )
}
