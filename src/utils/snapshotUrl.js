// Where a gateLogs/{id}/imageUrl came from, and whether it's safe to put in an <img>.
// - ESP32-CAM uploads (functions/index.js#issueSnapshotUploadUrl): public object URL on
//   storage.googleapis.com/<bucket>/vehicle-snapshots/...
// - "Attach Vehicle Photo" (services/firebase.js#uploadVehicleSnapshot): Firebase Storage
//   download URL on firebasestorage.googleapis.com.
// Anything else (a typo, an old/foreign link, a non-https value) is treated as invalid and never
// loaded, so a bad value in the database can't point the dashboard at an arbitrary site.
const CAMERA_HOST = 'storage.googleapis.com'
const UPLOAD_HOST = 'firebasestorage.googleapis.com'

export function snapshotSource(url) {
  if (typeof url !== 'string' || !url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname === CAMERA_HOST && parsed.pathname.includes('/vehicle-snapshots/')) return 'camera'
    if (parsed.hostname === UPLOAD_HOST) return 'upload'
    return null
  } catch {
    return null
  }
}

export const SNAPSHOT_SOURCE_LABELS = {
  camera: 'ESP32-CAM (gate camera)',
  upload: 'Attached manually by staff',
}
