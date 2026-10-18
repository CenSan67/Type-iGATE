import React from 'react'

// The four separate statuses of an imported registration (models/registration.js#deriveRegistrationStatus).
const PROCESSING_BADGE = { 'Pending Review': 'badge-neutral', 'Under Processing': 'badge-warn', Approved: 'badge-info', Active: 'badge-positive', Rejected: 'badge-negative' }

export const processingBadge = (status) => PROCESSING_BADGE[status] || 'badge-neutral'
export const accountBadge = (status) => (status === 'Active' ? 'badge-positive' : status === 'Inactive' ? 'badge-negative' : 'badge-neutral')
export const paymentBadge = (status) => (status === 'Paid' ? 'badge-positive' : 'badge-neutral')
export const rfidBadge = (status) => (status === 'Assigned' ? 'badge-positive' : 'badge-neutral')

export default function RegistrationStatusBadges({ status }){
  return (
    <div className="registration-badges">
      <span className={`status-badge ${processingBadge(status.processing)}`} title="Processing status">{status.processing}</span>
      <span className={`status-badge ${accountBadge(status.account)}`} title="Account status">Account: {status.account}</span>
      <span className={`status-badge ${paymentBadge(status.payment)}`} title="Payment status">Payment: {status.payment}</span>
      <span className={`status-badge ${rfidBadge(status.rfid)}`} title="RFID status">RFID: {status.rfid === 'Assigned' ? status.rfidId : 'Unassigned'}</span>
    </div>
  )
}
