import React, { useState } from 'react'
import ConfirmModal from '../modals/ConfirmModal'
import usePendingProfiles from '../../hooks/usePendingProfiles'
import { useAuth } from '../../context/AuthContext'
import { canApproveRole } from '../../constants/roles'
import { approveAdminProfile, rejectAdminProfile } from '../../services/firebase'

// New signups waiting on an admin. Shows the role each person asked for so the approver
// can see exactly what access they'd be granting. A Super Admin can approve any role; an
// Administrator only Security Guard requests (same rule database.rules.json enforces).
export default function PendingApprovalsPanel(){
  const { role } = useAuth()
  const pending = usePendingProfiles()
  const [action, setAction] = useState(null) // { type: 'approve'|'reject', profile }
  const [error, setError] = useState('')

  const displayName = (p) => p.fullName || p.displayName || p.email

  const blockedReason = (p) => {
    if (!p.emailVerified) return 'Waiting for this person to verify their email'
    if (!canApproveRole(role, p.requestedRole)) return `Only a Super Admin can approve ${p.requestedRole} requests`
    return ''
  }

  const closeAction = () => { setAction(null); setError('') }

  const runAction = async () => {
    if (!action) return
    setError('')
    try {
      if (action.type === 'approve') await approveAdminProfile(action.profile.id, action.profile.requestedRole)
      else await rejectAdminProfile(action.profile.id)
      setAction(null)
    } catch (err) {
      setError(err.message || 'Unable to complete that right now.')
    }
  }

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>Pending Approvals{pending.length > 0 ? ` (${pending.length})` : ''}</h3>
        <p>New signups can't sign in until approved - check the requested role before approving</p>
      </div>

      {error && !action && <p className="form-error" style={{ margin: '0 24px 16px' }}>{error}</p>}

      <table className="activity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Email Verified</th>
            <th>Requested Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pending.length === 0 ? (
            <tr><td colSpan={5} className="accounts-empty">No accounts are waiting for approval.</td></tr>
          ) : pending.map((p) => {
            const reason = blockedReason(p)
            return (
              <tr key={p.id} className="activity-row">
                <td>{displayName(p)}</td>
                <td>{p.email || '—'}</td>
                <td>
                  <span className={`status-badge ${p.emailVerified ? 'badge-positive' : 'badge-neutral'}`}>{p.emailVerified ? 'Verified' : 'Not yet'}</span>
                </td>
                <td><span className="tag-pill">{p.requestedRole || p.role}</span></td>
                <td>
                  <div className="pending-actions-cell">
                    <button type="button" className="btn-primary" disabled={Boolean(reason)} title={reason || undefined} onClick={() => setAction({ type: 'approve', profile: p })}>Approve</button>
                    <button type="button" className="btn-secondary" onClick={() => setAction({ type: 'reject', profile: p })}>Decline</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {action && (
        <ConfirmModal
          title={action.type === 'approve' ? 'Approve this account?' : 'Decline this request?'}
          message={
            action.type === 'approve'
              ? `Approve ${displayName(action.profile)} (${action.profile.email}) as ${action.profile.requestedRole}? They will get ${action.profile.requestedRole} access immediately.${error ? ` (${error})` : ''}`
              : `Decline ${displayName(action.profile)}'s request for the ${action.profile.requestedRole} role? They won't be able to use the system.${error ? ` (${error})` : ''}`
          }
          confirmLabel={action.type === 'approve' ? 'Approve' : 'Decline'}
          danger={action.type === 'reject' || action.profile.requestedRole !== 'Security Guard'}
          onConfirm={runAction}
          onClose={closeAction}
        />
      )}
    </div>
  )
}
