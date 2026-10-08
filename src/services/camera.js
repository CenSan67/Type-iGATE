import { get, ref } from 'firebase/database'
import { rtdb } from './firebase'
import { CAMERA_HOST } from '../constants/camera'

// The ESP32-CAM publishes its current LAN IP to devices/camera/ip on boot (CameraWebServer.ino),
// so this reads that first and only falls back to the VITE_CAMERA_HOST / hardcoded address if the
// node is missing or the read fails (e.g. rules not deployed yet).
async function resolveCameraHost() {
  try {
    const snap = await get(ref(rtdb, 'devices/camera/ip'))
    const ip = snap.val()
    if (typeof ip === 'string' && ip) return `http://${ip}`
  } catch (err) {
    console.warn('Could not read camera IP from RTDB, using configured fallback:', err)
  }
  return CAMERA_HOST
}

// Fire-and-forget: asks the ESP32-CAM to capture + upload a photo for one specific gateLogs
// entry - the exact same request sketch_scanner.ino makes automatically after a real scan
// (see CameraWebServer/app_httpd.cpp's /trigger handler). Lets the web app's own Simulate
// flows exercise the camera pipeline without the physical RFID reader, as long as the
// browser is on the same local network as the camera.
//
// Only fires for direction 'IN' - it's the same vehicle on the way out, so
// functions/index.js's backfillExitSnapshot() server-side copies the matching IN entry's
// imageUrl onto the OUT entry instead of triggering the camera twice per visit. Enforced here
// (the one place every caller funnels through) rather than at each call site, so it applies
// uniformly no matter which role or flow triggers it. sketch_scanner.ino has the same check
// for the hardware path.
//
// Never throws and is never awaited by its callers on purpose - the full pipeline on the
// camera's end (signed URL -> upload -> finalize -> gateLogs PATCH) takes several seconds,
// and a camera that's off/unreachable (or just not deployed yet) should never block or break
// whatever simulated the scan in the first place. Check the camera's own Serial output, or
// the gateLogs entry's imageUrl a few seconds later, to see whether it actually succeeded.
//
// onError is optional and only ever gets a short, plain-language reason (never the raw
// fetch/TypeError) - a caller with toast access passes `(msg) => showError(msg)` so a dead or
// misconfigured camera is visible in the UI instead of only in the browser console.
export function triggerCameraCapture(logId, direction, onError) {
  if (!logId) return
  if (direction !== 'IN') return
  resolveCameraHost()
    .then((host) => fetch(`${host}/trigger?logId=${encodeURIComponent(logId)}`, { mode: 'cors' }))
    .catch((err) => {
      console.warn('Camera trigger request failed (camera may be off/unreachable on this network):', err)
      onError?.('No camera detected, or its IP address is incorrect. The scan was still recorded - check the camera and its network connection.')
    })
}
