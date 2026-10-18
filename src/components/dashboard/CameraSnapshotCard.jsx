import React, { useEffect, useState } from 'react'
import useLatestSnapshot from '../../hooks/useLatestSnapshot'
import ImagePreviewModal from '../modals/ImagePreviewModal'
import { SNAPSHOT_SOURCE_LABELS } from '../../utils/snapshotUrl'

const AUTO_POPUP_KEY = 'igate_snapshot_autopopup' // per-viewer preference only

const readAutoPopup = () => { try { return localStorage.getItem(AUTO_POPUP_KEY) === '1' } catch { return false } }
const formatDateTime = (ms) => new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const CameraIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
)

// Dashboard card: the latest gate-camera photo as a thumbnail; click it for the large view with
// the scan's details. Optionally pops the large view up by itself when a new photo arrives.
export default function CameraSnapshotCard(){
  const { status, latest, freshId, latestScanMissedPhoto, camera, cameraConnection } = useLatestSnapshot()
  const [open, setOpen] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [autoPopup, setAutoPopup] = useState(readAutoPopup)

  useEffect(() => { setThumbFailed(false) }, [latest?.imageUrl])
  useEffect(() => { if (freshId && autoPopup) setOpen(true) }, [freshId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAutoPopup = (checked) => {
    setAutoPopup(checked)
    try { localStorage.setItem(AUTO_POPUP_KEY, checked ? '1' : '0') } catch { /* private mode: session only */ }
  }

  const cameraBadge = cameraConnection === 'online' ? ['badge-positive', 'Camera: Online']
    : cameraConnection === 'offline' ? ['badge-negative', 'Camera: Offline'] : ['badge-neutral', 'Camera: Unknown']
  const invalidUrl = latest && !latest.source
  const vehicle = latest && [latest.plateNumber, latest.vehicleType].filter(Boolean).join(' · ')

  let thumb
  if (status === 'loading') thumb = <div className="snapshot-card-thumb is-empty"><span className="snapshot-card-spinner" aria-label="Loading" /></div>
  else if (!latest) thumb = <div className="snapshot-card-thumb is-empty"><CameraIcon /></div>
  else if (invalidUrl || thumbFailed) thumb = <button type="button" className="snapshot-card-thumb is-empty" onClick={() => setOpen(true)} title="Photo unavailable"><CameraIcon /></button>
  else thumb = (
    <button type="button" className="snapshot-card-thumb" onClick={() => setOpen(true)} title="View larger">
      <img src={latest.imageUrl} alt="Latest vehicle snapshot" loading="lazy" onError={() => setThumbFailed(true)} />
      {freshId === latest.logId && <span className="snapshot-card-new">New</span>}
    </button>
  )

  return (
    <div className="overview-card">
      <h4>Camera Snapshot</h4>
      <div className="snapshot-card">
        {thumb}
        <div className="snapshot-card-info">
          <span className={`status-badge ${cameraBadge[0]}`}>{cameraBadge[1]}</span>
          {status === 'loading' && <p>Loading the latest photo…</p>}
          {status === 'capturing' && <p>Capturing photo for the latest scan…</p>}
          {status === 'empty' && <p>{cameraConnection === 'online' ? 'No photo yet - the camera takes one on the next entry scan.' : 'No photo recorded yet.'}</p>}
          {latest && (
            <>
              <p><strong>{latest.name || 'Unknown holder'}</strong>{vehicle ? ` - ${vehicle}` : ''}</p>
              <p>{formatDateTime(latest.timestamp)} · entry scan</p>
            </>
          )}
          {(invalidUrl || thumbFailed) && <p className="form-hint">This photo couldn't be loaded (removed, invalid or expired link).</p>}
          {cameraConnection === 'offline' && camera?.lastSeen && <p className="form-hint">Camera last seen {formatDateTime(camera.lastSeen)} - new scans won't have photos until it's back online.</p>}
          {cameraConnection === 'online' && latestScanMissedPhoto && <p className="form-hint">The latest entry scan has no photo (the camera didn't capture one).</p>}
          <div className="snapshot-card-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpen(true)} disabled={!latest}>View larger</button>
            <label className="snapshot-card-toggle">
              <input type="checkbox" checked={autoPopup} onChange={(e) => toggleAutoPopup(e.target.checked)} />
              Pop up new photos
            </label>
          </div>
        </div>
      </div>

      {open && latest && (
        <ImagePreviewModal title="Latest Camera Snapshot" src={latest.source ? latest.imageUrl : null} onClose={() => setOpen(false)}>
          <dl className="snapshot-details">
            <dt>Taken</dt><dd>{formatDateTime(latest.timestamp)}</dd>
            <dt>Holder</dt><dd>{latest.name || 'Unknown'}</dd>
            <dt>Vehicle</dt><dd>{vehicle || '—'}</dd>
            <dt>RFID</dt><dd>{latest.rfidId || '—'}</dd>
            <dt>Event</dt><dd>Entry scan (gate log {latest.logId})</dd>
            <dt>Camera</dt><dd>{SNAPSHOT_SOURCE_LABELS[latest.source] || 'Unknown source'}{latest.source === 'camera' && camera?.ip ? ` · ${camera.ip}` : ''}</dd>
          </dl>
        </ImagePreviewModal>
      )}
    </div>
  )
}
