import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

// Shared shell for anything printable (reports, receipts): a modal with a Print button that,
// on print, hides the whole app (#root) so only `children` come out. Rendered in a portal on
// <body> for exactly that reason - see the print rules at the end of index.css.
export default function PrintPreviewFrame({ onClose, children }){
  // Pages pass a fresh inline onClose every render (they re-render each second for the clock),
  // so read it through a ref instead of re-subscribing this effect every tick.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    document.body.classList.add('print-report-open')
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('print-report-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return createPortal(
    <div className="print-report-overlay" onClick={onClose}>
      <div className="print-report-card" onClick={(e) => e.stopPropagation()}>
        <div className="print-report-toolbar">
          <span>Print Preview</span>
          <div className="print-report-toolbar-actions">
            <button type="button" className="btn-primary print-report-print-btn" onClick={() => window.print()}>
              <PrinterIcon /> Print
            </button>
            <button type="button" className="print-report-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
