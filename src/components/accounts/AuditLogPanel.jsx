import React, { useMemo, useState } from 'react'
import useAuditLogs from '../../hooks/useAuditLogs'
import PaginationRow from '../shared/PaginationRow'
import { downloadCsv } from '../../utils/csv'
import PrintReportModal from '../shared/PrintReportModal'
import useDateRangeFilter from '../../hooks/useDateRangeFilter'
import { QUICK_SELECTS } from '../../utils/dateRange'
import { dayStartMs, dayEndMs, formatDateRange } from '../../utils/reportBuilders'

const PAGE_SIZE = 10
const CHANGES_SHOWN = 3 // longer change lists collapse behind "Show N more"

const ENTITY_LABELS = {
  adminProfiles: 'Staff account',
  rfidUsers: 'Vehicle / owner',
  payments: 'Payment',
  gateLogs: 'Gate log',
  expectedGuests: 'VIP guest',
  scannerCommand: 'Gate command',
  settings: 'App settings',
  registrations: 'Imported registration',
  visitRemarks: 'Visit remark',
}

const ACTION_BADGES = { create: 'badge-positive', update: 'badge-neutral', delete: 'badge-negative' }
const ACTION_LABELS = { create: 'Created', update: 'Updated', delete: 'Deleted' }
const TIME_FIELDS = /(At|timestamp|validFrom|validUntil|expiresAt)$/

function formatValue(field, value) {
  if (value === undefined || value === null) return '(none)'
  if (value === '') return '(empty)'
  if (typeof value === 'number' && TIME_FIELDS.test(field) && value > 1e12) return new Date(value).toLocaleString()
  if (typeof value === 'string' && value.startsWith('data:image')) return '(photo)'
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}

// One readable line per changed field. Created/deleted records list their values, not "(none) ->".
function changeLines(log) {
  return Object.entries(log.changes || {}).map(([field, { from, to }]) => {
    if (log.action === 'create') return { field, text: formatValue(field, to) }
    if (log.action === 'delete') return { field, text: formatValue(field, from) }
    return { field, text: `${formatValue(field, from)} → ${formatValue(field, to)}` }
  })
}

// A name instead of a database key: the record as it is now (`names`), else the name carried
// by the change itself (e.g. a deleted record), else a shortened key.
function recordLabel(log, names) {
  if (names[log.entityId]) return names[log.entityId]
  const c = log.changes || {}
  const named = c.name || c.fullName
  const fromChange = named && (named.to ?? named.from)
  if (fromChange) return fromChange
  if (log.entity === 'scannerCommand') return c.action?.to || ''
  if (log.entity === 'settings') return ''
  const id = log.entityId || ''
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

const actorName = (log) => log.byName && log.by !== 'system' ? log.byName : 'System'
const actorDetail = (log) => log.by === 'system' ? 'Device, server or Firebase console' : log.byRole

const PRINT_COLUMNS = [
  { key: 'time', label: 'Time' },
  { key: 'by', label: 'By' },
  { key: 'action', label: 'Action' },
  { key: 'record', label: 'Record' },
  { key: 'changes', label: 'Changes' },
]

export default function AuditLogPanel({ names = {} }){
  const logs = useAuditLogs()
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState({})
  const [showPrint, setShowPrint] = useState(false)
  const { dateFrom, dateTo, activeQuick, maxDate, changeFrom, changeTo, applyQuick } = useDateRangeFilter()
  const fromMs = dayStartMs(dateFrom)
  const toMs = dayEndMs(dateTo)

  // Everyone who appears in the loaded entries, for the "Changed by" filter.
  const actors = useMemo(() => [...new Set(logs.map(actorName))].sort(), [logs])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (entity && log.entity !== entity) return false
      if (action && log.action !== action) return false
      if (actor && actorName(log) !== actor) return false
      if (fromMs && log.at < fromMs) return false
      if (toMs && log.at > toMs) return false
      if (!term) return true
      return [actorName(log), log.byRole, log.entityId, recordLabel(log, names), ...changeLines(log).map((l) => `${l.field} ${l.text}`)]
        .some((v) => (v || '').toString().toLowerCase().includes(term))
    })
  }, [logs, entity, action, actor, fromMs, toMs, search, names])

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Every filter change goes back to page 1.
  const withReset = (fn) => (value) => { fn(value); setPage(1) }
  const hasFilters = entity || action || actor || dateFrom || dateTo || search
  const clearFilters = () => {
    setEntity(''); setAction(''); setActor(''); setSearch(''); setPage(1)
    if (activeQuick) applyQuick(activeQuick) // clicking the active quick select clears the range
    else { changeFrom(''); changeTo('') }
  }

  const printRows = filtered.map((log) => ({
    time: new Date(log.at).toLocaleString(),
    by: [actorName(log), actorDetail(log)].filter(Boolean).join(' - '),
    action: ACTION_LABELS[log.action] || log.action,
    record: [ENTITY_LABELS[log.entity] || log.entity, recordLabel(log, names)].filter(Boolean).join(': '),
    changes: changeLines(log).map((l) => `${l.field}: ${l.text}`).join('; ') || '—',
  }))
  const countOf = (a) => filtered.filter((log) => log.action === a).length

  const exportCsv = () => {
    downloadCsv(
      `igate-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Time', 'By', 'Role', 'Action', 'Type', 'Record', 'Record ID', 'Changes'],
      filtered.map((log) => [
        new Date(log.at).toLocaleString(),
        actorName(log),
        actorDetail(log),
        ACTION_LABELS[log.action] || log.action,
        ENTITY_LABELS[log.entity] || log.entity,
        recordLabel(log, names),
        log.entityId,
        changeLines(log).map((l) => `${l.field}: ${l.text}`).join('; '),
      ]),
    )
  }

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>Audit Log</h3>
        <p>Every change to staff accounts, vehicles, payments, VIP guests, gate logs, gate commands and settings - who made it and what changed. Read-only; nobody can edit or delete it from the app.</p>
      </div>

      <div className="accounts-toolbar">
        <div className="accounts-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <input type="text" placeholder="Search person, record or value..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="filter-group">
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</button>
          <button type="button" className="btn-secondary" onClick={() => setShowPrint(true)} disabled={filtered.length === 0}>Print / Save as PDF</button>
        </div>
      </div>

      <div className="registration-filters">
        <label>From<input type="date" value={dateFrom} max={dateTo || maxDate} onChange={(e) => withReset(changeFrom)(e.target.value)} /></label>
        <label>To<input type="date" value={dateTo} min={dateFrom || undefined} max={maxDate} onChange={(e) => withReset(changeTo)(e.target.value)} /></label>
        <div className="quick-select-row">
          {QUICK_SELECTS.map((q) => (
            <button key={q} type="button" className={`quick-select-btn ${activeQuick === q ? 'active' : ''}`} onClick={() => withReset(applyQuick)(q)}>{q}</button>
          ))}
        </div>
        <label>Type
          <select value={entity} onChange={(e) => withReset(setEntity)(e.target.value)}>
            <option value="">All</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>Action
          <select value={action} onChange={(e) => withReset(setAction)(e.target.value)}>
            <option value="">All</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>Changed by
          <select value={actor} onChange={(e) => withReset(setActor)(e.target.value)}>
            <option value="">Everyone</option>
            {actors.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {hasFilters && <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>}
      </div>

      <table className="activity-table audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>By</th>
            <th>Action</th>
            <th>Record</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr><td colSpan={5} className="accounts-empty">{logs.length === 0 ? 'No changes recorded yet.' : 'No entries match your filter.'}</td></tr>
          ) : pageRows.map((log) => {
            const lines = changeLines(log)
            const isOpen = expanded[log.id]
            const shown = isOpen ? lines : lines.slice(0, CHANGES_SHOWN)
            const label = recordLabel(log, names)
            return (
              <tr key={log.id} className="activity-row">
                <td className="audit-nowrap" data-label="Time">
                  {new Date(log.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  <span className="audit-sub">{new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </td>
                <td data-label="By">
                  {actorName(log)}
                  {actorDetail(log) && <span className="audit-sub">{actorDetail(log)}</span>}
                </td>
                <td data-label="Action"><span className={`status-badge ${ACTION_BADGES[log.action] || 'badge-neutral'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                <td data-label="Record">
                  {ENTITY_LABELS[log.entity] || log.entity}
                  {label && <span className="audit-sub" title={log.entityId}>{label}</span>}
                </td>
                <td data-label="Changes">
                  <ul className="audit-changes">
                    {shown.map((line) => (
                      <li key={line.field}><span className="audit-field">{line.field}</span> {line.text}</li>
                    ))}
                  </ul>
                  {lines.length > CHANGES_SHOWN && (
                    <button type="button" className="audit-more" onClick={() => setExpanded((prev) => ({ ...prev, [log.id]: !isOpen }))}>
                      {isOpen ? 'Show less' : `Show ${lines.length - CHANGES_SHOWN} more`}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <PaginationRow page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {showPrint && (
        <PrintReportModal
          title={entity ? `Audit Log - ${ENTITY_LABELS[entity]}` : 'Audit Log'}
          dateRange={formatDateRange(fromMs, toMs)}
          columns={PRINT_COLUMNS}
          rows={printRows}
          summary={[
            { label: 'Total Changes', value: filtered.length },
            { label: 'Created', value: countOf('create') },
            { label: 'Updated', value: countOf('update') },
            { label: 'Deleted', value: countOf('delete') },
          ]}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
