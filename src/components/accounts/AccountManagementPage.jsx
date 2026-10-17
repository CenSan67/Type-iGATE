import React, { useEffect, useMemo, useState } from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToRfidUsers, listenToPayments, deleteRfidUser, setRfidUserStatus, listenToAllAdminProfiles, setAdminRole, setAdminStatus, deleteAdminProfile } from '../../services/firebase'
import EditRfidUserModal from '../modals/EditRfidUserModal'
import ConfirmModal from '../modals/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import { ASSIGNABLE_ROLES } from '../../constants/roles'
import AuditLogPanel from './AuditLogPanel'
import PendingApprovalsPanel from './PendingApprovalsPanel'
import VipGuestsPanel from './VipGuestsPanel'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const filters = ['All', 'Paid', 'Unpaid', 'Active', 'Expired']
// A visitor gets a brand-new rfidUsers record every single visit (temporary pass, new card
// each time), so they build up fast and used to flood this table shoulder-to-shoulder with
// permanent Student/Faculty/Staff registrations - "Registered" is the default scope so the
// list a Super Admin/Administrator actually manages day-to-day stays readable; "Visitors" is
// still one click away for cleanup/lookup.
const ACCOUNT_SCOPES = ['Registered', 'Visitors', 'All']

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.6 3.5l-9 15.6A1.5 1.5 0 003 21.5h18a1.5 1.5 0 001.4-2.4l-9-15.6a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const PowerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M18.4 6.6a9 9 0 11-12.8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function AccountManagementPage(){
  const { user, role } = useAuth()
  const isSuperAdmin = role === 'Super Admin'
  const [now, setNow] = useState(new Date())
  const [activeFilter, setActiveFilter] = useState('All')
  const [scope, setScope] = useState('Registered')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // { type: 'delete'|'deactivate'|'activate', user }
  const { showError } = useToast()

  // Staff/role management - Super Admin only (task: role assignment must only be
  // manageable here, by a Super Admin; enforced server-side too, see database.rules.json).
  const [staffProfiles, setStaffProfiles] = useState([])
  const [pendingRoleChange, setPendingRoleChange] = useState(null) // { uid, profile, newRole }
  const [pendingStatusChange, setPendingStatusChange] = useState(null) // { profile, nextStatus }
  const [pendingRemoval, setPendingRemoval] = useState(null) // profile of a declined/deactivated account

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsub = listenToRfidUsers(setUsers)
    return () => unsub && unsub()
  }, [])

  useEffect(() => {
    const unsub = listenToPayments(setPayments)
    return () => unsub && unsub()
  }, [])

  // Record id -> display name, so the Audit Log shows people instead of database keys.
  const auditNames = useMemo(() => {
    const map = {}
    users.forEach((u) => { map[u.id] = u.name })
    payments.forEach((p) => { map[p.id] = [p.receiptNo, p.name].filter(Boolean).join(' · ') })
    staffProfiles.forEach((p) => { map[p.id] = p.fullName || p.displayName || p.email })
    return map
  }, [users, payments, staffProfiles])

  useEffect(() => {
    if (!isSuperAdmin) return
    // Pending signups are handled in PendingApprovalsPanel, not by the role dropdown below.
    const unsub = listenToAllAdminProfiles((all) => setStaffProfiles(all.filter((p) => p.status !== 'Pending')))
    return () => unsub && unsub()
  }, [isSuperAdmin])

  const runRoleChange = async () => {
    if (!pendingRoleChange) return
    try {
      await setAdminRole(pendingRoleChange.uid, pendingRoleChange.newRole, pendingRoleChange.profile)
      setPendingRoleChange(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to change that role right now.'))
    }
  }

  const runStatusChange = async () => {
    if (!pendingStatusChange) return
    try {
      await setAdminStatus(pendingStatusChange.profile.id, pendingStatusChange.nextStatus)
      setPendingStatusChange(null)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to change that status right now.'))
      setPendingStatusChange(null)
    }
  }

  const runRemoval = async () => {
    if (!pendingRemoval) return
    try {
      await deleteAdminProfile(pendingRemoval.id)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to remove that account right now.'))
    }
    setPendingRemoval(null)
  }

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const accounts = useMemo(() => users.map((user) => {
    const userPayments = payments.filter((p) => (p.rfidId || '').toLowerCase() === (user.rfidId || '').toLowerCase())
    // "Paid" reflects whether a payment was ever made; "Status" reflects whether the
    // most recent payment's 5-month validity window hasn't lapsed yet. Neither of these
    // is the account's enable/disable state below (accountStatus) - that's admin-controlled.
    const latestPayment = userPayments.reduce((latest, p) => (!latest || (p.timestamp || 0) > (latest.timestamp || 0) ? p : latest), null)
    const isActive = Boolean(latestPayment?.validUntil) && now.getTime() <= latestPayment.validUntil

    return {
      id: user.id,
      raw: user,
      date: user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
      name: user.name || 'Unknown',
      rfid: user.rfidId || 'N/A',
      role: user.role || '—',
      vehicle: user.vehicleType || '—',
      payment: userPayments.length > 0 ? 'Paid' : 'Unpaid',
      status: isActive ? 'Active' : 'Expired',
      validUntil: latestPayment?.validUntil ? new Date(latestPayment.validUntil).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
      accountStatus: user.status || 'Active',
    }
  }), [users, payments, now])

  // Registered = Student/Faculty/Staff (permanent). Visitors = temporary passes (role
  // 'Visitor', one record per visit). "All" is the old unscoped behavior.
  const scopeCounts = useMemo(() => ({
    Registered: accounts.filter((a) => a.role !== 'Visitor').length,
    Visitors: accounts.filter((a) => a.role === 'Visitor').length,
    All: accounts.length,
  }), [accounts])

  const scopedAccounts = useMemo(() => {
    if (scope === 'Registered') return accounts.filter((a) => a.role !== 'Visitor')
    if (scope === 'Visitors') return accounts.filter((a) => a.role === 'Visitor')
    return accounts
  }, [accounts, scope])

  // Scoped to whatever's currently on screen, so the stat cards match the table below them
  // instead of always reflecting the full (Registered + Visitors) set.
  const summary = useMemo(() => ({
    total: scopedAccounts.length,
    paid: scopedAccounts.filter((a) => a.payment === 'Paid').length,
    unpaid: scopedAccounts.filter((a) => a.payment === 'Unpaid').length,
    active: scopedAccounts.filter((a) => a.status === 'Active').length,
    expired: scopedAccounts.filter((a) => a.status === 'Expired').length,
  }), [scopedAccounts])

  const filteredAccounts = useMemo(() => {
    return scopedAccounts.filter((a) => {
      const matchesFilter = activeFilter === 'All' || a.payment === activeFilter || a.status === activeFilter
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || [a.name, a.rfid, a.role, a.vehicle].some((field) => (field || '').toLowerCase().includes(q))
      return matchesFilter && matchesQuery
    })
  }, [scopedAccounts, activeFilter, query])

  const runAction = async () => {
    if (!pendingAction) return
    try {
      if (pendingAction.type === 'delete') {
        await deleteRfidUser(pendingAction.user.id)
      } else if (pendingAction.type === 'deactivate') {
        await setRfidUserStatus(pendingAction.user.id, 'Inactive')
      } else if (pendingAction.type === 'activate') {
        await setRfidUserStatus(pendingAction.user.id, 'Active')
      }
      setPendingAction(null)
    } catch (err) {
      showError(getErrorMessage(err, 'That action could not be completed.'))
    }
  }

  return (
    <div className="dashboard-main">
      <section className="dashboard-header">
        <div>
          <div className="dashboard-branding">
            <img src={bsuLogo} alt="Bulacan State University Seal" className="dashboard-logo" />
            <div>
              <h1>Bulacan State University</h1>
              <p>Intelligent Gate Access & Tracking - BulSU Bustos Campus</p>
            </div>
          </div>
        </div>
        <div className="dashboard-clock">
          <div>{timeString}</div>
          <div>{dateString}</div>
        </div>
      </section>

      <div className="dashboard-panels">
        <div className="accounts-summary">
          <div className="summary-pill">
            <span className="summary-icon neutral"><ListIcon /></span>
            <div>
              <div className="summary-value">{summary.total}</div>
              <div className="summary-label">Total Registration</div>
            </div>
          </div>
          <div className="summary-pill">
            <span className="summary-icon positive"><CheckIcon /></span>
            <div>
              <div className="summary-value">{summary.paid}</div>
              <div className="summary-label">Paid Accounts</div>
            </div>
          </div>
          <div className="summary-pill">
            <span className="summary-icon negative"><AlertIcon /></span>
            <div>
              <div className="summary-value">{summary.unpaid}</div>
              <div className="summary-label">Unpaid</div>
            </div>
          </div>
          <div className="summary-pill">
            <span className="summary-icon positive"><CheckIcon /></span>
            <div>
              <div className="summary-value">{summary.active}</div>
              <div className="summary-label">Active</div>
            </div>
          </div>
          <div className="summary-pill">
            <span className="summary-icon negative"><AlertIcon /></span>
            <div>
              <div className="summary-value">{summary.expired}</div>
              <div className="summary-label">Expired Account</div>
            </div>
          </div>
        </div>

        <div className="activity-panel">
          <div className="activity-header">
            <h3>Account Management</h3>
            <p>
              {scope === 'Registered' && 'Permanent Student/Faculty/Staff registrations - visitor passes are kept separate below'}
              {scope === 'Visitors' && 'Temporary visitor passes - one record per visit'}
              {scope === 'All' && 'Every registration and visitor pass, unfiltered'}
            </p>
          </div>

          <div className="filter-group scope-toggle">
            {ACCOUNT_SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                className={`filter-btn ${scope === s ? 'active' : ''}`}
                onClick={() => setScope(s)}
              >
                {s} ({scopeCounts[s]})
              </button>
            ))}
          </div>

          <div className="accounts-toolbar">
            <div className="accounts-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <input
                type="text"
                placeholder="Search name, RFID, role, vehicle..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <table className="activity-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>RFID-ID</th>
                <th>Role</th>
                <th>Vehicle</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Account</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((row) => (
                <tr key={row.id} className="activity-row">
                  <td>{row.date}</td>
                  <td>{row.name}</td>
                  <td>{row.rfid}</td>
                  <td>{row.role}</td>
                  <td>{row.vehicle}</td>
                  <td>
                    <span className={`status-badge ${row.payment === 'Paid' ? 'badge-positive' : 'badge-negative'}`}>
                      {row.payment === 'Paid' ? <CheckIcon /> : <AlertIcon />} {row.payment}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${row.status === 'Active' ? 'badge-positive' : 'badge-neutral'}`}>
                      {row.status === 'Active' ? <CheckIcon /> : <AlertIcon />} {row.status}
                    </span>
                  </td>
                  <td>{row.validUntil}</td>
                  <td>
                    <span className={`status-badge ${row.accountStatus === 'Active' ? 'badge-positive' : 'badge-negative'}`}>
                      {row.accountStatus === 'Active' ? <CheckIcon /> : <AlertIcon />} {row.accountStatus}
                    </span>
                  </td>
                  <td>
                    <span className="row-actions">
                      <button type="button" className="row-action-btn" title="Edit" onClick={() => setEditingUser(row.raw)}>
                        <EditIcon />
                      </button>
                      {row.accountStatus === 'Active' ? (
                        <button
                          type="button"
                          className="row-action-btn warn"
                          title="Deactivate"
                          onClick={() => setPendingAction({ type: 'deactivate', user: row.raw })}
                        >
                          <PowerIcon />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="row-action-btn"
                          title="Activate"
                          onClick={() => setPendingAction({ type: 'activate', user: row.raw })}
                        >
                          <PowerIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        className="row-action-btn danger"
                        title="Delete"
                        onClick={() => setPendingAction({ type: 'delete', user: row.raw })}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={10} className="accounts-empty">No accounts match your search or filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PendingApprovalsPanel />

        <VipGuestsPanel />

        {isSuperAdmin && (
          <div className="activity-panel">
            <div className="activity-header">
              <h3>Staff Accounts</h3>
              <p>Assign staff roles - only visible to, and editable by, a Super Admin</p>
            </div>

            <table className="activity-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Status</th>
                  <th>Change Role</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {staffProfiles.length === 0 ? (
                  <tr><td colSpan={6} className="accounts-empty">No staff accounts found.</td></tr>
                ) : staffProfiles.map((profile) => (
                  <tr key={profile.id} className="activity-row">
                    <td>{profile.fullName || profile.displayName || '—'}</td>
                    <td>{profile.email || '—'}</td>
                    <td><span className="tag-pill">{profile.role}</span></td>
                    <td>
                      <span className={`status-badge ${profile.status === 'Active' ? 'badge-positive' : 'badge-neutral'}`}>{profile.status || 'Active'}</span>
                    </td>
                    <td>
                      {profile.role === 'Super Admin' ? (
                        <span className="form-hint">Fixed - managed in the Firebase console</span>
                      ) : (
                        <select
                          value={profile.role}
                          disabled={profile.id === user?.uid}
                          title={profile.id === user?.uid ? "Use My Profile to view your own role - it can't be changed from here to avoid locking yourself out" : undefined}
                          onChange={(e) => {
                            const newRole = e.target.value
                            if (newRole === profile.role) return
                            setPendingRoleChange({ uid: profile.id, profile, newRole })
                          }}
                        >
                          {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {/* 'Locked' only exists on records left over from the removed lockout feature. */}
                      {profile.role === 'Super Admin' ? (
                        <span className="form-hint">—</span>
                      ) : profile.status === 'Inactive' || profile.status === 'Locked' ? (
                        <div className="pending-actions-cell">
                          <button type="button" className="btn-primary" onClick={() => setPendingStatusChange({ profile, nextStatus: 'Active' })}>Reactivate</button>
                          <button type="button" className="btn-secondary" disabled={profile.id === user?.uid} onClick={() => setPendingRemoval(profile)}>Remove</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={profile.id === user?.uid}
                          title={profile.id === user?.uid ? "You can't deactivate your own account" : undefined}
                          onClick={() => setPendingStatusChange({ profile, nextStatus: 'Inactive' })}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuperAdmin && <AuditLogPanel names={auditNames} />}
      </div>

      {pendingRoleChange && (
        <ConfirmModal
          title="Change staff role?"
          message={`Change ${pendingRoleChange.profile.fullName || pendingRoleChange.profile.email}'s role from ${pendingRoleChange.profile.role} to ${pendingRoleChange.newRole}? This changes what they can access immediately.`}
          confirmLabel="Change Role"
          danger={pendingRoleChange.newRole === 'Super Admin'}
          onConfirm={runRoleChange}
          onClose={() => setPendingRoleChange(null)}
        />
      )}

      {pendingStatusChange && (
        <ConfirmModal
          title={pendingStatusChange.nextStatus === 'Inactive' ? 'Deactivate this account?' : 'Reactivate this account?'}
          message={
            pendingStatusChange.nextStatus === 'Inactive'
              ? `Deactivate ${pendingStatusChange.profile.fullName || pendingStatusChange.profile.email}? They will be signed out of access immediately and can't use iGate until you reactivate them.`
              : `Reactivate ${pendingStatusChange.profile.fullName || pendingStatusChange.profile.email}? They will get their ${pendingStatusChange.profile.role} access back immediately.`
          }
          confirmLabel={pendingStatusChange.nextStatus === 'Inactive' ? 'Deactivate' : 'Reactivate'}
          danger={pendingStatusChange.nextStatus === 'Inactive'}
          onConfirm={runStatusChange}
          onClose={() => setPendingStatusChange(null)}
        />
      )}

      {pendingRemoval && (
        <ConfirmModal
          title="Remove this account?"
          message={`Remove ${pendingRemoval.fullName || pendingRemoval.email}'s account record? They lose all access. Their sign-in itself isn't deleted - when they next sign in they can choose "Start over" to clear it and sign up again.`}
          confirmLabel="Remove"
          danger
          onConfirm={runRemoval}
          onClose={() => setPendingRemoval(null)}
        />
      )}

      {editingUser && (
        <EditRfidUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => setEditingUser(null)}
        />
      )}

      {pendingAction && (
        <ConfirmModal
          title={pendingAction.type === 'delete' ? 'Delete RFID User' : pendingAction.type === 'deactivate' ? 'Deactivate Account' : 'Activate Account'}
          message={
            pendingAction.type === 'delete'
              ? `Permanently delete ${pendingAction.user.name || pendingAction.user.rfidId}? This removes the RFID record entirely and cannot be undone.`
              : pendingAction.type === 'deactivate'
                ? `Deactivate ${pendingAction.user.name || pendingAction.user.rfidId}? The record and payment history are kept, but the account is marked inactive.`
                : `Reactivate ${pendingAction.user.name || pendingAction.user.rfidId}?`
          }
          confirmLabel={pendingAction.type === 'delete' ? 'Delete' : pendingAction.type === 'deactivate' ? 'Deactivate' : 'Activate'}
          danger={pendingAction.type === 'delete'}
          onConfirm={runAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}
