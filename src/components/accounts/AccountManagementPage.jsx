import React, { useEffect, useMemo, useState } from 'react'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { listenToRfidUsers, listenToPayments } from '../../services/firebase'

const filters = ['All', 'Paid', 'Unpaid', 'Active', 'Expired']

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.6 3.5l-9 15.6A1.5 1.5 0 003 21.5h18a1.5 1.5 0 001.4-2.4l-9-15.6a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function AccountManagementPage(){
  const [now, setNow] = useState(new Date())
  const [activeFilter, setActiveFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])

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

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const accounts = useMemo(() => users.map((user) => {
    const userPayments = payments.filter((p) => (p.rfidId || '').toLowerCase() === (user.rfidId || '').toLowerCase())
    // "Paid" reflects whether a payment was ever made; "Active" reflects whether the
    // most recent payment's 5-month validity window hasn't lapsed yet.
    const latestPayment = userPayments.reduce((latest, p) => (!latest || (p.timestamp || 0) > (latest.timestamp || 0) ? p : latest), null)
    const isActive = Boolean(latestPayment?.validUntil) && now.getTime() <= latestPayment.validUntil

    return {
      id: user.id,
      date: user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
      name: user.name || 'Unknown',
      rfid: user.rfidId || 'N/A',
      role: user.role || '—',
      vehicle: user.vehicleType || '—',
      payment: userPayments.length > 0 ? 'Paid' : 'Unpaid',
      status: isActive ? 'Active' : 'Expired',
      validUntil: latestPayment?.validUntil ? new Date(latestPayment.validUntil).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
    }
  }), [users, payments, now])

  const summary = useMemo(() => ({
    total: accounts.length,
    paid: accounts.filter((a) => a.payment === 'Paid').length,
    unpaid: accounts.filter((a) => a.payment === 'Unpaid').length,
    active: accounts.filter((a) => a.status === 'Active').length,
    expired: accounts.filter((a) => a.status === 'Expired').length,
  }), [accounts])

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchesFilter = activeFilter === 'All' || a.payment === activeFilter || a.status === activeFilter
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || [a.name, a.rfid, a.role, a.vehicle].some((field) => (field || '').toLowerCase().includes(q))
      return matchesFilter && matchesQuery
    })
  }, [accounts, activeFilter, query])

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
            <p>Manage registrations, payments and access status</p>
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
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="accounts-empty">No accounts match your search or filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
