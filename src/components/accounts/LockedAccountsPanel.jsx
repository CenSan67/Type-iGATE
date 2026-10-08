import React, { useState } from 'react'
import ConfirmModal from '../modals/ConfirmModal'
import useLockedProfiles from '../../hooks/useLockedProfiles'
import { unlockAdminAccount } from '../../services/firebase'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

// Staff accounts locked out after 5 failed sign-in attempts (see functions/index.js). Any
// active Administrator or Super Admin can unlock one here - the Function itself checks the
// caller's own role server-side, this page's ADMIN_ROLES route guard is just the UX gate.
// A lock also auto-expires on its own (LOCK_DURATION_MS), so this list clears itself over
// time even with nobody watching it.
export default function LockedAccountsPanel(){
  const locked = useLockedProfiles()
  const [target, setTarget] = useState(null) // profile being unlocked
  const [unlocking, setUnlocking] = useState(false)
  const { showError } = useToast()

  const displayName = (p) => p.fullName || p.displayName || p.email

  const runUnlock = async () => {
    if (!target) return
    setUnlocking(true)
    try {
      await unlockAdminAccount(target.id)
      setTarget(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to unlock that account right now.'))
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>Locked Accounts{locked.length > 0 ? ` (${locked.length})` : ''}</h3>
        <p>Locked automatically after 5 failed sign-in attempts - clears on its own after a while, or unlock it now below</p>
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Locked At</th>
            <th>Auto-Unlocks At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locked.length === 0 ? (
            <tr><td colSpan={5} className="accounts-empty">No accounts are currently locked.</td></tr>
          ) : locked.map((p) => (
            <tr key={p.id} className="activity-row">
              <td>{displayName(p)}</td>
              <td>{p.email || '—'}</td>
              <td>{p.lockedAt ? new Date(p.lockedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td>{p.lockExpiresAt ? new Date(p.lockExpiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td>
                <button type="button" className="btn-primary" onClick={() => setTarget(p)}>Unlock</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {target && (
        <ConfirmModal
          title="Unlock this account?"
          message={`Unlock ${displayName(target)} (${target.email})? They'll be able to sign in again immediately, and their failed-attempt count resets.`}
          confirmLabel={unlocking ? 'Unlocking...' : 'Unlock'}
          onConfirm={runUnlock}
          onClose={() => !unlocking && setTarget(null)}
        />
      )}
    </div>
  )
}
