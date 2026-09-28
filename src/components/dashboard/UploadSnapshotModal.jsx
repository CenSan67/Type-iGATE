import React, { useMemo, useState } from 'react'
import Modal from '../modals/Modal'
import { uploadVehicleSnapshot } from '../../services/firebase'
import useEnrichedGateLogs from '../../hooks/useEnrichedGateLogs'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'

const RECENT_COUNT = 20

// Mock vehicle selector: stands in for the ESP32-CAM, which will eventually capture
// and upload a photo automatically at the moment of each scan. Until that hardware is
// wired up, staff pick which recent scan a manually-chosen photo belongs to.
export default function UploadSnapshotModal({ onClose, onUploaded }){
  const entries = useEnrichedGateLogs()
  const recent = useMemo(
    () => entries.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, RECENT_COUNT),
    [entries]
  )

  const [gateLogId, setGateLogId] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const { showError } = useToast()

  const selectedEntry = recent.find((e) => e.id === gateLogId) || null

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0] || null
    setFile(picked)
    setPreviewUrl(picked ? URL.createObjectURL(picked) : '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!gateLogId) {
      showError('Pick which scan this photo belongs to.')
      return
    }
    if (!file) {
      showError('Choose an image file to upload.')
      return
    }

    setUploading(true)
    try {
      await uploadVehicleSnapshot(file, { gateLogId, rfidUserId: selectedEntry?.rfidUserId })
      onUploaded?.()
      onClose()
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to upload that image right now.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="Attach Vehicle Photo (dev/testing)" onClose={onClose}>
      <form className="register-form" onSubmit={handleSubmit}>
        <p className="form-hint">Simulates the ESP32-CAM: pick a recent scan and attach a photo to it. The photo is saved to both that scan and the vehicle's on-file record.</p>

        <label>
          Recent Scan
          <select value={gateLogId} onChange={(e) => setGateLogId(e.target.value)}>
            <option value="">-- pick a recent entry/exit --</option>
            {recent.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Pending'} — {entry.name} ({entry.rfidId}) {entry.direction}
              </option>
            ))}
          </select>
        </label>

        <label>
          Photo
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>

        {previewUrl && (
          <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }} />
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload & Attach'}</button>
        </div>
      </form>
    </Modal>
  )
}
