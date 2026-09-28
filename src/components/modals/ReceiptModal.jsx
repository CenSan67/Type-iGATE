import React from 'react'
import PrintPreviewFrame from '../shared/PrintPreviewFrame'
import ReceiptSummary from '../shared/ReceiptSummary'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'

// Shown right after a payment is saved: the final receipt (with its system-issued number),
// printable / savable as PDF through the same print frame the reports use.
export default function ReceiptModal({ receipt, onClose }){
  return (
    <PrintPreviewFrame onClose={onClose}>
      <div className="receipt-sheet">
        <header className="print-report-letterhead">
          <img src={bsuLogo} alt="Bulacan State University Seal" />
          <div>
            <h1>Bulacan State University</h1>
            <p>Intelligent Gate Access &amp; Tracking - BulSU Bustos Campus</p>
          </div>
        </header>
        <ReceiptSummary receipt={receipt} />
        <p className="print-report-footer">This is a system-generated receipt.</p>
      </div>
    </PrintPreviewFrame>
  )
}
