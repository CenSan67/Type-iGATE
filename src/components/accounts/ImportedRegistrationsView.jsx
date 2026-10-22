import React, { useMemo, useState } from 'react'
import { accountBadge, paymentBadge, processingBadge, rfidBadge } from './RegistrationStatusBadges'
import { checkRegistration, deriveRegistrationStatus, REGISTRATION_STATUSES } from '../../models/registration'
import { formatVehicleBrand } from '../../constants/vehicleBrands'
import { toLocalISODate } from '../../utils/dateRange'

const PROCESSING_FILTERS = ['All', ...REGISTRATION_STATUSES, 'Incomplete']
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

// Account Management's "Imported" tab: Google Forms registrations with their four statuses,
// search and filters (processing / payment / account / RFID / import date).
export default function ImportedRegistrationsView({ registrations, users, payments, onProcess, onImport }){
  const [query, setQuery] = useState('')
  const [processing, setProcessing] = useState('All')
  const [payment, setPayment] = useState('All')
  const [account, setAccount] = useState('All')
  const [rfid, setRfid] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(() => registrations.map((r) => {
    const status = deriveRegistrationStatus(r, users, payments)
    const incomplete = r.status !== 'Active' && r.status !== 'Rejected' && checkRegistration(r).missing.length > 0
    return { r, status, incomplete }
  }), [registrations, users, payments])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(({ r, status, incomplete }) => {
      if (processing === 'Incomplete' ? !incomplete : processing !== 'All' && r.status !== processing) return false
      if (payment !== 'All' && status.payment !== payment) return false
      if (account !== 'All' && status.account !== account) return false
      if (rfid !== 'All' && status.rfid !== rfid) return false
      const day = toLocalISODate(r.importedAt)
      if (from && day < from) return false
      if (to && day > to) return false
      return !q || [r.fullName, r.studentId, r.email, r.phone, r.plateNumber, r.course, r.department, status.rfidId, r.vehicleBrand]
        .some((v) => (v || '').toString().toLowerCase().includes(q))
    })
  }, [rows, query, processing, payment, account, rfid, from, to])

  return (
    <>
      <div className="accounts-toolbar">
        <div className="accounts-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <input type="text" placeholder="Search name, email, plate, RFID..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="filter-group">
          {PROCESSING_FILTERS.map((f) => (
            <button key={f} type="button" className={`filter-btn ${processing === f ? 'active' : ''}`} onClick={() => setProcessing(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="registration-filters">
        <label>Payment<select value={payment} onChange={(e) => setPayment(e.target.value)}><option>All</option><option>Pending</option><option>Paid</option></select></label>
        <label>Account<select value={account} onChange={(e) => setAccount(e.target.value)}><option>All</option><option>Pending Activation</option><option>Active</option><option>Inactive</option><option>Owner deleted</option></select></label>
        <label>RFID<select value={rfid} onChange={(e) => setRfid(e.target.value)}><option>All</option><option>Unassigned</option><option>Assigned</option></select></label>
        <label>Imported from<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>to<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>Imported</th>
            <th>Name</th>
            <th>RFID-ID</th>
            <th>Vehicle</th>
            <th>Processing</th>
            <th>Payment</th>
            <th>Account</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ r, status, incomplete }) => (
            <tr key={r.id} className="activity-row">
              <td>{fmtDate(r.importedAt)}</td>
              <td>{r.fullName}<span className="cell-sub">{[r.department, incomplete && 'Incomplete'].filter(Boolean).join(' · ') || '—'}</span></td>
              <td><span className={`status-badge ${rfidBadge(status.rfid)}`}>{status.rfid === 'Assigned' ? status.rfidId : 'Unassigned'}</span></td>
              <td>{r.vehicleType || '—'}<span className="cell-sub">{r.plateNumber || '—'} · {formatVehicleBrand(r.vehicleBrand)}</span></td>
              <td><span className={`status-badge ${processingBadge(status.processing)}`}>{status.processing}</span></td>
              <td><span className={`status-badge ${paymentBadge(status.payment)}`}>{status.payment}</span></td>
              <td><span className={`status-badge ${accountBadge(status.account)}`}>{status.account}</span></td>
              <td><button type="button" className="btn-secondary" onClick={() => onProcess(r)}>{(r.status === 'Active' && !status.ownerDeleted) || r.status === 'Rejected' ? 'View' : 'Process'}</button></td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="accounts-empty">
                {registrations.length === 0
                  ? <>No imported registrations yet. <button type="button" className="link-btn" onClick={onImport}>Add people from Google Forms</button></>
                  : 'No imported registrations match your search or filters.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
