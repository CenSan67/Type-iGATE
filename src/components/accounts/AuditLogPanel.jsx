import React, { useMemo, useState } from 'react'
import useAuditLogs from '../../hooks/useAuditLogs'
import PaginationRow from '../shared/PaginationRow'
import { downloadCsv } from '../../utils/csv'

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

export default function AuditLogPanel({ names = {} }){
  const logs = useAuditLogs()
  const [entity, setEntity] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState({})

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (entity && log.entity !== entity) return false
      if (!term) return true
      return [actorName(log), log.byRole, log.entityId, recordLabel(log, names), ...changeLines(log).map((l) => `${l.field} ${l.text}`)]
        .some((v) => (v || '').toString().toLowerCase().includes(term))
    })
  }, [logs, entity, search, names])

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const chooseEntity = (key) => { setEntity(key); setPage(1) }

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
          <button type="button" className={`filter-btn ${entity === '' ? 'active' : ''}`} onClick={() => chooseEntity('')}>All</button>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={`filter-btn ${entity === key ? 'active' : ''}`} onClick={() => chooseEntity(key)}>{label}</button>
          ))}
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</button>
        </div>
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
                <td className="audit-nowrap">
                  {new Date(log.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  <span className="audit-sub">{new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </td>
                <td>
                  {actorName(log)}
                  {actorDetail(log) && <span className="audit-sub">{actorDetail(log)}</span>}
                </td>
                <td><span className={`status-badge ${ACTION_BADGES[log.action] || 'badge-neutral'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                <td>
                  {ENTITY_LABELS[log.entity] || log.entity}
                  {label && <span className="audit-sub" title={log.entityId}>{label}</span>}
                </td>
                <td>
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
    </div>
  )
}
