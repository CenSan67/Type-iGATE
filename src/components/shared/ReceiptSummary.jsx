import React from 'react'
import { formatVehicleBrand } from '../../constants/vehicleBrands'

const peso = (n) => `₱${(Number(n) || 0).toFixed(2)}`

// The receipt body: rendered live inside the registration modal's "Payment Summary" panel and
// again, final, in ReceiptModal after the payment is saved. `receipt` shape comes from
// hooks/usePaymentRegistration (or the live form in RegistrationModal).
export default function ReceiptSummary({ receipt }){
  const rows = [
    receipt.receiptNo ? ['Receipt No', receipt.receiptNo] : null,
    ['Owner', receipt.name || '—'],
    ['Plate Number', receipt.plate || '—'],
    ['Department', receipt.department || '—'],
    ['RFID-ID', receipt.rfid || '—'],
    ['Vehicle Type', receipt.vehicle || '—'],
    ['Vehicle Brand', formatVehicleBrand(receipt.vehicleBrand)],
    ['Payment Type', receipt.paymentType === 'Renewal' ? 'Renewal' : 'New Registration'],
    ['Amount Due', peso(receipt.amountDue)],
    ['Amount Paid', peso(receipt.amountPaid)],
    ['Change', peso(receipt.change)],
    receipt.validUntil ? ['Valid Until', new Date(receipt.validUntil).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })] : null,
    receipt.receivedBy ? ['Received By', receipt.receivedBy] : null,
    receipt.paidAt ? ['Date & Time', new Date(receipt.paidAt).toLocaleString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })] : null,
  ].filter(Boolean)

  return (
    <div className="receipt-summary">
      <h3 className="receipt-title">Receipt</h3>
      {rows.map(([label, value]) => (
        <div key={label} className="receipt-row">
          <span>{label}:</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="receipt-row receipt-total">
        <span>Total Amount:</span>
        <strong>{peso(receipt.amountDue)}</strong>
      </div>
    </div>
  )
}
