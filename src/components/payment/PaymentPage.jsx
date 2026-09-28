import React, { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../context/AppStateContext'
import RegistrationModal from '../modals/RegistrationModal'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToPayments } from '../../services/firebase'
import PrintReportModal from '../shared/PrintReportModal'
import { buildPaymentReport, dayStartMs, dayEndMs } from '../../utils/reportBuilders'
import { QUICK_SELECTS, toLocalISODate } from '../../utils/dateRange'
import useDateRangeFilter from '../../hooks/useDateRangeFilter'
import ReceiptModal from '../modals/ReceiptModal'
import usePaymentRegistration from '../../hooks/usePaymentRegistration'

const PAGE_SIZE = 4

const PdfIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)
const RegisterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 9h4M8 13h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)

function formatDate(iso){
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function PaymentPage(){
  const { state, dispatch } = useAppState()
  const [now, setNow] = useState(new Date())
  const [transactions, setTransactions] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('All')
  const { dateFrom, dateTo, activeQuick, maxDate, changeFrom, changeTo, applyQuick } = useDateRangeFilter()
  const [page, setPage] = useState(1)
  const [showPrintReport, setShowPrintReport] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const { register } = usePaymentRegistration()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsub = listenToPayments((payments) => {
      setTransactions(payments.map((p) => ({
        id: p.id,
        date: p.date || toLocalISODate(p.timestamp),
        time: p.time || (p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''),
        rfid: p.rfidId || 'N/A',
        name: p.name || 'Unknown',
        department: p.department || '—',
        plate: p.plateNumber || '—',
        paymentType: p.paymentType || '—',
        amount: Number(p.amount) || 0,
        receiptNo: p.receiptNo || '—',
        receivedBy: p.receivedByName || '—',
        status: p.status || 'Paid',
      })))
    })
    return () => unsub && unsub()
  }, [])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      const matchesQuery = !q || [t.rfid, t.plate, t.name].some((f) => f.toLowerCase().includes(q))
      const matchesStatus = status === 'All' || t.status === status
      const matchesType = paymentTypeFilter === 'All' || t.paymentType === paymentTypeFilter
      const matchesFrom = !dateFrom || t.date >= dateFrom
      const matchesTo = !dateTo || t.date <= dateTo
      return matchesQuery && matchesStatus && matchesType && matchesFrom && matchesTo
    })
  }, [transactions, query, status, paymentTypeFilter, dateFrom, dateTo])

  useEffect(() => { setPage(1) }, [query, status, paymentTypeFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totals = useMemo(() => ({
    count: transactions.length,
    collected: transactions.reduce((sum, t) => sum + t.amount, 0),
  }), [transactions])

  const openRegistration = (type) => dispatch({ type: 'OPEN_MODAL', payload: { type: 'registration', initialType: type } })
  const closeModal = () => dispatch({ type: 'CLOSE_MODAL' })

  const handleRegister = async (form) => {
    const result = await register(form)
    closeModal()
    setReceipt(result)
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

      <div className="payment-grid">
        <div className="payment-card">
          <h2>Payment History</h2>

          <div className="payment-summary-row">
            <div className="payment-summary-box">
              <div className="summary-label">Total Transaction</div>
              <div className="summary-value">{totals.count}</div>
            </div>
            <div className="payment-summary-box">
              <div className="summary-label">Total Collected</div>
              <div className="summary-value">₱{totals.collected.toFixed(2)}</div>
            </div>
          </div>

          <div className="payment-tabs">
            <button type="button" onClick={() => openRegistration('Registration')}>New Registration</button>
            <button type="button" onClick={() => openRegistration('Renewal')}>Renewal</button>
          </div>

          <form className="payment-search-row" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              placeholder="Search RFID, Plate, Name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="payment-search-btn">Search</button>
          </form>

          <div className="payment-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>RFID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Plate Number</th>
                  <th>Payment Type</th>
                  <th>Amount</th>
                  <th>Receipt No.</th>
                  <th>Received By</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id} className="activity-row">
                    <td>{t.id}</td>
                    <td>{formatDate(t.date)}</td>
                    <td>{t.time}</td>
                    <td>{t.rfid}</td>
                    <td>{t.name}</td>
                    <td>{t.department}</td>
                    <td>{t.plate}</td>
                    <td><span className="tag-pill">{t.paymentType}</span></td>
                    <td>₱{t.amount.toFixed(2)}</td>
                    <td>{t.receiptNo}</td>
                    <td>{t.receivedBy}</td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={11} className="accounts-empty">No transactions match your search or filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-row centered">
            <div className="pagination-controls">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            </div>
          </div>
        </div>

        <div className="filter-card">
          <h4>Filter Reports</h4>

          <label className="filter-label">Date Range</label>
          <div className="date-range-row">
            <input type="date" value={dateFrom} max={dateTo || maxDate} onChange={(e) => changeFrom(e.target.value)} />
            <span>&gt;</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} max={maxDate} onChange={(e) => changeTo(e.target.value)} />
          </div>

          <label className="filter-label">Quick Select:</label>
          <div className="quick-select-row">
            {QUICK_SELECTS.map((q) => (
              <button
                key={q}
                type="button"
                className={`quick-select-btn ${activeQuick === q ? 'active' : ''}`}
                onClick={() => applyQuick(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <label className="filter-label">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>

          <label className="filter-label">Payment Type:</label>
          <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="Registration">Registration</option>
            <option value="Renewal">Renewal</option>
          </select>

          <button type="button" className="export-btn" onClick={() => setShowPrintReport(true)}>
            <PdfIcon /> Print / Save as PDF
          </button>
          <button type="button" className="export-btn open-reg-btn" onClick={() => openRegistration('Registration')}>
            <RegisterIcon /> Open Registration
          </button>
        </div>
      </div>

      {showPrintReport && (
        <PrintReportModal
          title="Payment History Report"
          {...buildPaymentReport(filtered, { from: dayStartMs(dateFrom), to: dayEndMs(dateTo) })}
          onClose={() => setShowPrintReport(false)}
        />
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {state.activeModal?.type === 'registration' && (
        <RegistrationModal
          initialType={state.activeModal.initialType}
          onClose={closeModal}
          onSubmit={handleRegister}
        />
      )}
    </div>
  )
}
