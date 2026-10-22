import React, { useEffect, useMemo, useRef, useState } from 'react'
import useEmergencyLogs from '../../hooks/useEmergencyLogs'
import useDateRangeFilter from '../../hooks/useDateRangeFilter'
import PaginationRow from '../shared/PaginationRow'
import EmergencyStatusBadge from '../shared/EmergencyStatusBadge'
import EmergencyEventModal from '../modals/EmergencyEventModal'
import ResolveEmergenciesModal from '../modals/ResolveEmergenciesModal'
import { EMERGENCY_TYPES, EMERGENCY_STATUSES, NOT_PROVIDED, emergencyTypeOf } from '../../models/emergencyLog'
import { dayStartMs, dayEndMs } from '../../utils/reportBuilders'
import { toLocalISODate } from '../../utils/dateRange'
import { downloadCsv } from '../../utils/csv'

const PAGE_SIZE = 10

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString() : '—')

// Search History -> Emergency Records: every emergency card scan (emergencyLogs - the same live
// records the Dashboard alert reads), kept after acknowledgment/resolution. Filter by card ID,
// date range, type, status and reader; open one to view/edit it (every staff role); export to
// CSV. Opened from a Dashboard emergency row: `focused` scrolls here, `initialEventId` opens it.
export default function EmergencyRecordsSection({ focused = false, initialEventId = null }){
  const { all, loaded } = useEmergencyLogs(true)
  const { dateFrom, dateTo, maxDate, changeFrom, changeTo } = useDateRangeFilter()
  const [cardFilter, setCardFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [deviceFilter, setDeviceFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(initialEventId)
  const [resolvingAll, setResolvingAll] = useState(false)
  const sectionRef = useRef(null)

  useEffect(() => {
    if (focused) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focused])

  const devices = useMemo(() => [...new Set(all.map((log) => log.device).filter(Boolean))].sort(), [all])

  const filtered = useMemo(() => {
    const from = dayStartMs(dateFrom)
    const to = dayEndMs(dateTo)
    const card = cardFilter.trim().toLowerCase()
    return all.filter((log) => {
      if (from && (log.timestamp || 0) < from) return false
      if (to && (log.timestamp || 0) > to) return false
      if (card && !(log.cardId || '').toString().toLowerCase().includes(card)) return false
      if (typeFilter !== 'All' && emergencyTypeOf(log) !== typeFilter) return false
      if (statusFilter !== 'All' && log.status !== statusFilter) return false
      if (deviceFilter !== 'All' && log.device !== deviceFilter) return false
      return true
    })
  }, [all, dateFrom, dateTo, cardFilter, typeFilter, statusFilter, deviceFilter])

  useEffect(() => { setPage(1) }, [dateFrom, dateTo, cardFilter, typeFilter, statusFilter, deviceFilter])

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openLog = all.find((log) => log.id === openId)
  const openAlerts = all.filter((log) => log.status !== 'Resolved')

  const exportCsv = () => {
    const headers = ['Event ID', 'Date', 'Time In', 'Approx. Time', 'Time Out', 'Card ID', 'Reader', 'Status', 'Type', 'Unit / Agency', 'Plate Number', 'Destination',
      'Acknowledged By', 'Acknowledged At', 'Resolved By', 'Resolved At', 'Outcome', 'Resolution Details']
    const rows = filtered.map((log) => [
      log.eventId || log.id,
      log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '',
      log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '',
      log.timeApprox ? 'Yes' : '',
      log.exitAt ? `${new Date(log.exitAt).toLocaleString()}${log.exitTimeApprox ? ' (approx.)' : ''}` : '',
      log.cardId || '',
      log.device || '',
      log.status,
      emergencyTypeOf(log),
      log.details?.agency || '',
      log.details?.plateNumber || '',
      log.details?.destination || '',
      log.acknowledgedByName || '',
      log.acknowledgedAt ? new Date(log.acknowledgedAt).toLocaleString() : '',
      log.resolvedByName || '',
      log.resolvedAt ? new Date(log.resolvedAt).toLocaleString() : '',
      log.resolution?.classification || '',
      log.resolution?.summary || '',
    ])
    downloadCsv(`igate-emergency-records-${toLocalISODate(Date.now())}.csv`, headers, rows)
  }

  return (
    <div className="search-history-panel emergency-records" ref={sectionRef}>
      <h2><span className="emergency-records-icon" aria-hidden="true">!</span> Emergency Records</h2>
      <p className="form-hint">Every scan of the emergency RFID card, with its acknowledgment, remarks and resolution. Records are never removed or overwritten.</p>

      <div className="filter-card" style={{ marginBottom: 16 }}>
        <label className="filter-label">Date Range</label>
        <div className="date-range-row">
          <input type="date" value={dateFrom} max={dateTo || maxDate} onChange={(e) => changeFrom(e.target.value)} />
          <span>to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} max={maxDate} onChange={(e) => changeTo(e.target.value)} />
        </div>

        <label className="filter-label">Card ID</label>
        <input type="text" value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} placeholder="Search card ID" />

        <label className="filter-label">Emergency Type</label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="All">All</option>
          {EMERGENCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="filter-label">Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All</option>
          {EMERGENCY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="filter-label">Reader / Device</label>
        <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
          <option value="All">All</option>
          {devices.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <button type="button" className="export-btn" onClick={exportCsv} style={{ marginTop: 12 }}>Export as CSV</button>
        {openAlerts.length > 1 && (
          <button type="button" className="export-btn" onClick={() => setResolvingAll(true)}>Resolve all open ({openAlerts.length})</button>
        )}
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>In</th>
            <th>Out</th>
            <th>Card ID</th>
            <th>Type</th>
            <th>Reader</th>
            <th>Status</th>
            <th>Personnel</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 ? (
            <tr><td colSpan={8} className="accounts-empty">{!loaded ? 'Loading…' : all.length === 0 ? 'No emergency card scans yet.' : 'No emergency records match your filters.'}</td></tr>
          ) : pageItems.map((log) => (
            <tr key={log.id} className={`activity-row ${log.status !== 'Resolved' ? 'emergency-row' : ''}`}>
              <td>
                {formatDateTime(log.timestamp)}
                {log.timeApprox && <span className="cell-sub">Approx. time (scanned offline)</span>}
              </td>
              <td>
                {log.exitAt ? formatDateTime(log.exitAt) : <span className="cell-sub">Still inside</span>}
                {log.exitTimeApprox && <span className="cell-sub">Approx. time (scanned offline)</span>}
              </td>
              <td>{log.cardId || '—'}</td>
              <td>
                {emergencyTypeOf(log) ? <span className="tag-pill emergency-type-pill">{emergencyTypeOf(log)}</span> : <span className="emergency-missing">{NOT_PROVIDED}</span>}
                {log.details?.agency && <span className="cell-sub">{log.details.agency}{log.details.plateNumber ? ` · ${log.details.plateNumber}` : ''}</span>}
              </td>
              <td>{log.device || '—'}</td>
              <td>
                <EmergencyStatusBadge status={log.status} />
                {log.resolution?.classification && <span className="cell-sub">{log.resolution.classification}</span>}
              </td>
              <td>
                {log.acknowledgedAt ? <span className="cell-sub">Ack: {log.acknowledgedByName || 'staff'} · {formatDateTime(log.acknowledgedAt)}</span> : <span className="cell-sub">Not acknowledged</span>}
                {log.resolvedAt && <span className="cell-sub">Resolved: {log.resolvedByName || 'admin'} · {formatDateTime(log.resolvedAt)}</span>}
              </td>
              <td><button type="button" className="btn-secondary" onClick={() => setOpenId(log.id)}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <PaginationRow page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {openLog && <EmergencyEventModal log={openLog} onClose={() => setOpenId(null)} />}
      {resolvingAll && <ResolveEmergenciesModal logs={openAlerts} onClose={() => setResolvingAll(false)} />}
    </div>
  )
}
