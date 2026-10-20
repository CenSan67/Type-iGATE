import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../modals/ConfirmModal'
import useLongStayAlerts from '../../hooks/useLongStayAlerts'
import { acknowledgeLongStayAlerts } from '../../services/firebase'
import { LONG_STAY_CATEGORY_LABELS, LONG_STAY_RESOLUTION_LABELS, LONG_STAY_SMS_LABELS } from '../../models/longStay'
import { formatDuration } from '../../utils/duration'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'needsAttention', label: 'Needs attention' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved (7 days)' },
]

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

// Any staff role - admins and Security Guards (Dashboard): people whose last recorded scan is an entry older than the allowed
// stay (System Settings -> Long-Stay Warnings). Created and resolved server-side by
// functions/longStay.js; here any staff can acknowledge (recorded by name, audited) and look them up. Hidden when there is
// nothing at all in the last 7 days.
export default function LongStayAlertsPanel(){
  const lists = useLongStayAlerts(true)
  const navigate = useNavigate()
  const { showError } = useToast()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('needsAttention')
  const [busyIds, setBusyIds] = useState([])
  const [confirmAll, setConfirmAll] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const total = lists.needsAttention.length + lists.acknowledged.length + lists.resolved.length
  if (total === 0) return null
  const rows = lists[tab]

  const acknowledge = async (ids) => {
    setBusyIds(ids)
    try {
      await acknowledgeLongStayAlerts(ids, { name: profile?.fullName || profile?.displayName || user?.email || '' })
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to acknowledge right now.'))
    }
    setBusyIds([])
  }

  const viewRecord = (alert) => navigate('/search-history', {
    state: alert.name && alert.name !== 'Unknown' ? { searchType: 'Name', query: alert.name } : { searchType: 'RFID-ID', query: alert.rfidId },
  })

  return (
    <div className={`activity-panel long-stay-panel ${lists.needsAttention.length ? 'has-warnings' : ''}`}>
      <div className="activity-header">
        <div>
          <h3>Long-Stay Warnings{lists.needsAttention.length > 0 && <span className="status-badge badge-negative long-stay-count">{lists.needsAttention.length}</span>}</h3>
          <p>No exit recorded after the allowed stay. Based on gate scans only - a missed exit scan looks the same, so check before acting.</p>
        </div>
        {tab === 'needsAttention' && lists.needsAttention.length > 1 && (
          <div className="activity-header-actions">
            <button type="button" className="btn-secondary" onClick={() => setConfirmAll(true)} disabled={busyIds.length > 0}>Acknowledge all</button>
          </div>
        )}
      </div>

      <div className="search-tabs long-stay-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`search-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} ({lists[t.id].length})
          </button>
        ))}
      </div>

      <table className="activity-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Entry</th>
            <th>{tab === 'resolved' ? 'Stay' : 'Since entry'}</th>
            <th>Allowed</th>
            <th>Status</th>
            <th>Warning issued</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan="7" className="empty-state">{tab === 'needsAttention' ? 'Nothing new - every warning has been acknowledged.' : 'None.'}</td></tr>
          ) : rows.map((a) => (
            <tr key={a.id} className={`activity-row ${a.status === 'active' && !a.acknowledgedAt ? 'long-stay-row' : ''}`}>
              <td>
                <strong>{a.name}</strong>
                <span className="cell-sub">
                  <span className="tag-pill">{a.category === 'registered' ? (a.role || LONG_STAY_CATEGORY_LABELS.registered) : LONG_STAY_CATEGORY_LABELS[a.category]}</span>
                  {' '}{a.identifierLabel}: {a.identifier || '—'}
                </span>
                {[a.identifierLabel !== 'Plate' && a.plateNumber, a.hostName && `Visiting ${a.hostName}`].some(Boolean) && (
                  <span className="cell-sub">{[a.identifierLabel !== 'Plate' && a.plateNumber, a.hostName && `Visiting ${a.hostName}`].filter(Boolean).join(' · ')}</span>
                )}
              </td>
              <td>
                {formatDateTime(a.entryAt)}
                {a.entryTimeApprox && <span className="cell-sub">Approx. time (scanned offline)</span>}
              </td>
              <td className={a.status === 'active' ? 'long-stay-elapsed' : ''}>
                {a.status === 'active' ? formatDuration(now - a.entryAt) : a.exitAt ? formatDuration(a.exitAt - a.entryAt) : '—'}
              </td>
              <td className="long-stay-nowrap">{formatDuration(a.thresholdMs)}</td>
              <td>
                {a.status === 'resolved' ? (
                  <>
                    <span className="status-badge badge-positive">Resolved</span>
                    <span className="cell-sub">{LONG_STAY_RESOLUTION_LABELS[a.resolvedReason] || 'Resolved'}{a.exitAt ? ` · ${formatDateTime(a.exitAt)}` : ''}</span>
                  </>
                ) : a.acknowledgedAt ? (
                  <>
                    <span className="status-badge badge-warn">No exit yet</span>
                    <span className="cell-sub">Acknowledged by {a.acknowledgedByName || 'staff'} · {formatDateTime(a.acknowledgedAt)}</span>
                  </>
                ) : (
                  <span className="status-badge badge-negative">No exit recorded</span>
                )}
                {a.sms?.status && a.sms.status !== 'off' && <span className="cell-sub">{LONG_STAY_SMS_LABELS[a.sms.status] || a.sms.status}</span>}
              </td>
              <td>{formatDateTime(a.createdAt)}</td>
              <td>
                <div className="long-stay-actions">
                  {a.status === 'active' && !a.acknowledgedAt && (
                    <button type="button" className="btn-primary" onClick={() => acknowledge([a.id])} disabled={busyIds.includes(a.id)}>
                      {busyIds.includes(a.id) ? 'Saving…' : 'Acknowledge'}
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => viewRecord(a)}>View record</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmAll && (
        <ConfirmModal
          title="Acknowledge all warnings?"
          message={`Mark all ${lists.needsAttention.length} warnings as seen? They stay listed under Acknowledged until each person's exit is recorded, and no repeat SMS is sent for them.`}
          confirmLabel="Acknowledge all"
          onConfirm={() => { setConfirmAll(false); acknowledge(lists.needsAttention.map((a) => a.id)) }}
          onClose={() => setConfirmAll(false)}
        />
      )}
    </div>
  )
}
