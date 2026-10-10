// Phase 7: sends a Semaphore SMS to a vehicle owner every time their RFID card is
// scanned at the gate (IN and OUT). Triggered server-side off gateLogs writes so the
// Semaphore API key never has to exist in the client bundle - the hardware scanner
// (sketch_scanner.ino) already writes gateLogs directly via its own legacy database
// secret, and this function reacts to that same write, the way any other RTDB
// consumer would (see CLAUDE.md's hardware note for the existing pattern this mirrors).
//
// Setup (see also the deploy notes at the bottom of this file):
//   1. firebase functions:secrets:set SEMAPHORE_API_KEY   (run this yourself - never
//      paste the key value into chat/AI tooling, it's a billable credential)
//   2. optionally: functions/.env with SEMAPHORE_SENDER_NAME=<your approved sender name>
//   3. firebase deploy --only functions   (requires the Blaze plan - Semaphore is an
//      external HTTP call, which the free Spark plan blocks entirely)

const { onValueCreated, onValueUpdated } = require('firebase-functions/v2/database')
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret, defineString } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const { getAuth } = require('firebase-admin/auth')
const { getStorage } = require('firebase-admin/storage')

initializeApp()

const SEMAPHORE_API_KEY = defineSecret('SEMAPHORE_API_KEY')
const SEMAPHORE_SENDER_NAME = defineString('SEMAPHORE_SENDER_NAME', { default: 'SEMAPHORE' })
const SEMAPHORE_ENDPOINT = 'https://api.semaphore.co/api/v4/messages'

function normalizeId(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

// Mirrors src/hooks/useEnrichedGateLogs.js's cardId/cardHex -> rfidUsers match, so a
// scan is attributed to the same owner here as it is on the live dashboard. Kept as a
// hand-copied port rather than a shared import because functions/ is a separate Node
// package/runtime from src/ (no bundler wiring the two together) - if that match logic
// ever changes in useEnrichedGateLogs.js, mirror the change here too.
async function findOwnerByCard(db, entry) {
  const cardId = normalizeId(entry.cardId)
  const cardHex = normalizeId(entry.cardHex)
  if (!cardId && !cardHex) return null

  const snapshot = await db.ref('rfidUsers').get()
  if (!snapshot.exists()) return null

  // The university lends from a limited pool of physical cards, so more than one
  // rfidUsers record can share the same rfidId over time (one per past/current holder -
  // see src/services/firebase.js#registerRfidUser). This scan must stay attributed to
  // whoever actually held the card AT THAT TIME, not whoever holds it now - otherwise a
  // card's older scans silently relabel themselves (and misdirect SMS/snapshot reuse) to
  // the newest holder the moment the card gets reissued. So this picks whichever record
  // was the most recently created one that still existed at or before this entry's own
  // timestamp - the registration actually in effect then - falling back to the earliest
  // record if the entry is somehow older than all of them. Mirrors
  // useEnrichedGateLogs.js's identical fix for the same bug.
  const candidates = []
  snapshot.forEach((child) => {
    const value = child.val() || {}
    const rfid = normalizeId(value.rfidId)
    if (rfid === cardId || rfid === cardHex) candidates.push({ id: child.key, ...value })
    return false
  })
  if (candidates.length === 0) return null

  const entryTime = entry.timestamp ?? Infinity
  const inEffectAtScanTime = candidates
    .filter((c) => (c.createdAt || 0) <= entryTime)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
  return inEffectAtScanTime || candidates.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0]
}

function buildMessage({ plateNumber, direction, timestamp }) {
  const verb = direction === 'OUT' ? 'exited' : 'entered'
  const date = new Date(timestamp)
  const dateString = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
  const timeString = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
  // Matches the sample message submitted with the Semaphore sender-name application
  // (iGATEBULSU) - keep this wording in sync with that submission, since Semaphore checks
  // live traffic against it. Stays under one 160-char SMS segment even with a long plate.
  return `Notice: Your vehicle ${plateNumber || 'registered under your account'} ${verb} BulSU Bustos Campus gate at ${timeString} on ${dateString}. If this wasn't you, contact the gate office.`
}

async function sendSemaphoreSms({ apiKey, senderName, phone, message }) {
  const body = new URLSearchParams({
    apikey: apiKey,
    number: phone,
    message,
    sendername: senderName,
  })

  const response = await fetch(SEMAPHORE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Semaphore HTTP ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

// NOTE: region should match the RTDB instance's actual location (Firebase console ->
// Realtime Database -> your instance). igate-bulsu-default-rtdb's .firebaseio.com
// hostname (rather than a regional *.firebasedatabase.app one) indicates the classic
// us-central1 location, hence the default below - double check before deploying.
exports.sendGateScanSms = onValueCreated(
  {
    ref: '/gateLogs/{logId}',
    region: 'us-central1',
    secrets: [SEMAPHORE_API_KEY],
  },
  async (event) => {
    const logId = event.params.logId
    const entry = event.data.val() || {}
    const db = getDatabase()

    const owner = await findOwnerByCard(db, entry)
    if (!owner || !owner.phone) {
      logger.info(`gateLogs/${logId}: no matching rfidUser with a phone on file, skipping SMS`)
      return
    }

    const direction = (entry.direction || 'IN').toString().toUpperCase() === 'OUT' ? 'OUT' : 'IN'
    const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : Date.now()
    const message = buildMessage({ plateNumber: owner.plateNumber, direction, timestamp })

    let status = 'sent'
    let errorMessage = null
    let semaphoreResponse = null

    try {
      semaphoreResponse = await sendSemaphoreSms({
        apiKey: SEMAPHORE_API_KEY.value(),
        senderName: SEMAPHORE_SENDER_NAME.value(),
        phone: owner.phone,
        message,
      })
    } catch (err) {
      status = 'failed'
      errorMessage = err.message
      logger.error(`gateLogs/${logId}: Semaphore SMS to ${owner.phone} failed`, err)
    }

    // Audit trail only - smsLogs has no client .write rule (see database.rules.json),
    // this Admin SDK write bypasses that the same way the ESP32's legacy secret does.
    await db.ref(`smsLogs/${logId}`).set({
      rfidUserId: owner.id,
      phone: owner.phone,
      message,
      direction,
      status,
      errorMessage,
      semaphoreResponse,
      sentAt: Date.now(),
    })

    if (status === 'sent') {
      logger.info(`gateLogs/${logId}: SMS sent to ${owner.phone}`)
    }
  }
)

// ---------------------------------------------------------------------------------------
// Entry/exit snapshot reuse - the camera is only ever triggered on IN scans now
// (sketch_scanner.ino and src/services/camera.js#triggerCameraCapture both no-op for OUT),
// since the vehicle photographed on the way out is the same one that was already
// photographed on the way in - no need to make the camera (and its TLS upload path) run
// twice per visit. These two functions do the reuse server-side, off gateLogs writes, so it
// works the same way no matter which path logged the scan (hardware, Simulate, any future
// one) and for every role (Student/Faculty/Staff/Visitor alike), since the match below is
// purely by card, the same as findOwnerByCard() above.
//
// lastEntryImages/{normalizedRfidId} is an internal node only these two functions touch -
// database.rules.json blocks it from clients entirely (nothing in the UI needs to read it;
// the UI only ever reads gateLogs/{id}/imageUrl, which this backfills).

// Mirrors a freshly-arrived IN snapshot into lastEntryImages/{cardId} the moment the camera
// PATCHes imageUrl onto its own gateLogs entry. This has to be a separate onValueUpdated
// trigger (not folded into the onValueCreated handler below) because that PATCH lands several
// seconds after the entry is first created - onValueCreated's event only ever sees the entry
// as it looked the instant it was written, before the camera's capture+upload finishes.
exports.mirrorEntrySnapshot = onValueUpdated(
  { ref: '/gateLogs/{logId}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before.val() || {}
    const after = event.data.after.val() || {}
    if (before.imageUrl || !after.imageUrl) return // only care about imageUrl newly appearing
    if ((after.direction || 'IN').toString().toUpperCase() !== 'IN') return

    const db = getDatabase()
    const owner = await findOwnerByCard(db, after)
    const cardKey = normalizeId(owner?.rfidId)
    if (!cardKey) return

    await db.ref(`lastEntryImages/${cardKey}`).set({
      imageUrl: after.imageUrl,
      logId: event.params.logId,
      timestamp: after.timestamp || Date.now(),
    })
  }
)

// Backfills an OUT scan's imageUrl from that same card's most recently mirrored IN snapshot.
// Runs on every new gateLogs entry - the same trigger shape sendGateScanSms already uses - so
// it covers every write path with no firmware/app-side special-casing per role needed. If the
// vehicle exits before its IN photo finished uploading (a real but rare race, given a vehicle
// has to physically travel from the entry point to the exit point in between), there's simply
// nothing to backfill yet and the OUT entry is left with no imageUrl - the UI shows "no image
// available" for it, which is accurate.
exports.backfillExitSnapshot = onValueCreated(
  { ref: '/gateLogs/{logId}', region: 'us-central1' },
  async (event) => {
    const logId = event.params.logId
    const entry = event.data.val() || {}
    if ((entry.direction || 'IN').toString().toUpperCase() !== 'OUT') return
    if (entry.imageUrl) return // already has one somehow - never overwrite

    const db = getDatabase()
    const owner = await findOwnerByCard(db, entry)
    const cardKey = normalizeId(owner?.rfidId)
    if (!cardKey) return

    const snap = await db.ref(`lastEntryImages/${cardKey}`).get()
    const imageUrl = snap.val()?.imageUrl
    if (!imageUrl) {
      logger.info(`gateLogs/${logId}: no prior IN snapshot on file for this card yet, leaving imageUrl unset`)
      return
    }
    await db.ref(`gateLogs/${logId}/imageUrl`).set(imageUrl)
  }
)

// ---------------------------------------------------------------------------------------
// Vehicle snapshot pipeline - lets the ESP32-CAM (CameraWebServer, a separate board from
// the RFID reader - see CameraWebServer/) upload the photo it captures at the moment of a
// validated gate scan, without embedding a full Firebase/GCP service-account credential in
// firmware. The device only ever holds DEVICE_SHARED_SECRET, a short app-level key - set it
// yourself with `firebase functions:secrets:set DEVICE_SHARED_SECRET` (never paste the value
// into chat/AI tooling, same rule as SEMAPHORE_API_KEY above), then paste the identical value
// into CameraWebServer.ino's DEVICE_SHARED_SECRET constant.
//
// Flow (see CameraWebServer.ino's captureAndUploadSnapshot() for the device side):
//   1. GET issueSnapshotUploadUrl -> a short-lived V4-signed Cloud Storage PUT URL, plus the
//      object's eventual public URL. The signed URL itself bypasses storage.rules (it's a
//      raw GCS IAM grant, not a Firebase Storage SDK request) - no rules change was needed.
//   2. The device PUTs the JPEG straight to that signed URL - no Firebase credential needed
//      for the upload itself.
//   3. GET finalizeSnapshot -> flips that one object public (same privacy posture the
//      existing human-upload path already has: src/services/firebase.js's
//      uploadVehicleSnapshot()'s getDownloadURL() is *also* a public-if-you-have-the-link
//      URL by Firebase Storage's own token design - this isn't a new exposure, just the
//      hardware path's equivalent of it).
//   4. The device PATCHes gateLogs/{logId}/imageUrl itself, over the RTDB REST API with the
//      same legacy database secret sketch_scanner.ino already uses for every other write it
//      makes - these two functions never touch the Realtime Database at all.
const DEVICE_SHARED_SECRET = defineSecret('DEVICE_SHARED_SECRET')
const SNAPSHOT_UPLOAD_URL_TTL_MS = 5 * 60 * 1000 // plenty for the capture+upload round trip; short enough a leaked URL is useless soon after

// Restricts both functions to exactly the vehicle-snapshots/ folder with a conservative
// filename charset, so a compromised/misconfigured device secret can't be used to write to
// or publish anything else in the bucket.
const SNAPSHOT_PATH_PATTERN = /^vehicle-snapshots\/[A-Za-z0-9_-]{1,100}\.jpg$/

function checkDeviceSecret(req, res) {
  if (req.query.secret !== DEVICE_SHARED_SECRET.value()) {
    res.status(401).json({ error: 'invalid secret' })
    return false
  }
  if (typeof req.query.path !== 'string' || !SNAPSHOT_PATH_PATTERN.test(req.query.path)) {
    res.status(400).json({ error: 'invalid path' })
    return false
  }
  return true
}

exports.issueSnapshotUploadUrl = onRequest(
  // invoker: 'public' lets the ESP32-CAM call it without Google sign-in; DEVICE_SHARED_SECRET is the real gate.
  { region: 'us-central1', secrets: [DEVICE_SHARED_SECRET], invoker: 'public' },
  async (req, res) => {
    if (!checkDeviceSecret(req, res)) return

    try {
      const bucket = getStorage().bucket()
      const file = bucket.file(req.query.path)
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + SNAPSHOT_UPLOAD_URL_TTL_MS,
        contentType: 'image/jpeg',
      })

      res.status(200).json({ uploadUrl, imageUrl: `https://storage.googleapis.com/${bucket.name}/${req.query.path}` })
    } catch (err) {
      logger.error('issueSnapshotUploadUrl failed', err)
      res.status(500).json({ error: 'internal' })
    }
  }
)

exports.finalizeSnapshot = onRequest(
  // invoker: 'public' lets the ESP32-CAM call it without Google sign-in; DEVICE_SHARED_SECRET is the real gate.
  { region: 'us-central1', secrets: [DEVICE_SHARED_SECRET], invoker: 'public' },
  async (req, res) => {
    if (!checkDeviceSecret(req, res)) return

    try {
      await getStorage().bucket().file(req.query.path).makePublic()
      res.status(200).json({ ok: true })
    } catch (err) {
      logger.error('finalizeSnapshot failed', err)
      res.status(500).json({ error: 'internal' })
    }
  }
)

// ---------------------------------------------------------------------------------------
// Account lockout (5 failed sign-ins -> temporary lock, admin unlock or auto-expiry).
//
// This has to live server-side: database.rules.json requires auth != null on every path
// (see the RBAC audit note in CLAUDE.md), so a client can't write a failed-attempt counter
// before it has successfully signed in - there is nowhere in RTDB an unauthenticated
// browser is allowed to write. These callables use the Admin SDK, which bypasses that the
// same way sendGateScanSms's writes to smsLogs above do, and disable the Firebase Auth
// login itself (not just the app-level `status` field) so a locked account can't complete
// sign-in at all, not merely get bounced by RequireAuth after the fact.
//
// A lock also auto-expires (LOCK_DURATION_MS) so an account is never permanently stuck
// just because no admin happens to be available - see checkLoginLock. This matters most
// for the sole-Super-Admin case: if the only Super Admin locks themselves out, there is no
// one else in-app who can unlock them, so the lock must eventually clear on its own. (If
// they've also forgotten their password, that's a separate problem - see resetPassword in
// src/services/auth.js - and the last-resort fallback is the same one already documented
// for provisioning the first Super Admin: fix it directly in the Firebase console.)
const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Deliberately generic on any "account doesn't exist" case (unknown email, no profile) so
// these callables don't become an email-enumeration oracle for an unauthenticated caller.
async function getProfileByEmail(db, email) {
  let userRecord
  try {
    userRecord = await getAuth().getUserByEmail(email)
  } catch {
    return null
  }
  const snapshot = await db.ref(`adminProfiles/${userRecord.uid}`).get()
  if (!snapshot.exists()) return null
  return { uid: userRecord.uid, profile: snapshot.val() }
}

async function autoUnlockIfExpired(db, uid, profile) {
  if (profile.status !== 'Locked') return profile
  if (typeof profile.lockExpiresAt === 'number' && Date.now() < profile.lockExpiresAt) return profile
  const restoredStatus = profile.preLockStatus || 'Active'
  await getAuth().updateUser(uid, { disabled: false })
  await db.ref(`adminProfiles/${uid}`).update({
    status: restoredStatus,
    failedLoginAttempts: 0,
    lockedAt: null,
    lockExpiresAt: null,
    preLockStatus: null,
  })
  return { ...profile, status: restoredStatus, failedLoginAttempts: 0 }
}

// Called before every sign-in attempt so a locked account never even reaches
// signInWithEmailAndPassword, and so an expired lock clears itself on the next attempt.
exports.checkLoginLock = onCall({ region: 'us-central1' }, async (request) => {
  const email = (request.data?.email || '').trim()
  if (!email) return { locked: false }

  const db = getDatabase()
  const found = await getProfileByEmail(db, email)
  if (!found) return { locked: false }

  const profile = await autoUnlockIfExpired(db, found.uid, found.profile)
  if (profile.status !== 'Locked') return { locked: false }
  return { locked: true, retryAt: profile.lockExpiresAt }
})

// Called after a failed signInWithEmailAndPassword. Bumps the failed-attempt counter and
// locks the account (disabling the Firebase Auth login) once it reaches MAX_FAILED_ATTEMPTS.
exports.recordFailedLogin = onCall({ region: 'us-central1' }, async (request) => {
  const email = (request.data?.email || '').trim()
  if (!email) return { locked: false }

  const db = getDatabase()
  const found = await getProfileByEmail(db, email)
  if (!found) return { locked: false }

  const { uid } = found
  const profile = await autoUnlockIfExpired(db, uid, found.profile)
  if (profile.status === 'Locked') return { locked: true, retryAt: profile.lockExpiresAt }

  const attempts = (profile.failedLoginAttempts || 0) + 1

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockExpiresAt = Date.now() + LOCK_DURATION_MS
    await getAuth().updateUser(uid, { disabled: true })
    await db.ref(`adminProfiles/${uid}`).update({
      failedLoginAttempts: attempts,
      status: 'Locked',
      preLockStatus: profile.status,
      lockedAt: Date.now(),
      lockExpiresAt,
    })
    logger.info(`adminProfiles/${uid}: locked after ${attempts} failed sign-in attempts`)
    return { locked: true, retryAt: lockExpiresAt }
  }

  await db.ref(`adminProfiles/${uid}`).update({ failedLoginAttempts: attempts })
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts }
})

// Called right after a successful sign-in to zero out the counter so occasional typos
// don't accumulate toward a lock over separate sessions.
exports.resetLoginAttempts = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const db = getDatabase()
  await db.ref(`adminProfiles/${request.auth.uid}/failedLoginAttempts`).set(0)
  return { ok: true }
})

// Admin/Super Admin action from Account Management's Locked Accounts panel. Authorization
// is enforced here (not by database.rules.json, since the Admin SDK bypasses rules) by
// re-reading the caller's own profile the same way the rules would have checked it.
exports.unlockAccount = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const targetUid = request.data?.uid
  if (!targetUid) throw new HttpsError('invalid-argument', 'Missing uid.')

  const db = getDatabase()
  const callerSnap = await db.ref(`adminProfiles/${request.auth.uid}`).get()
  const caller = callerSnap.val()
  if (!caller || caller.status !== 'Active' || !['Super Admin', 'Administrator'].includes(caller.role)) {
    throw new HttpsError('permission-denied', 'Only an active Administrator or Super Admin can unlock an account.')
  }

  const targetSnap = await db.ref(`adminProfiles/${targetUid}`).get()
  const target = targetSnap.val()
  if (!target || target.status !== 'Locked') {
    throw new HttpsError('failed-precondition', 'That account is not locked.')
  }

  await getAuth().updateUser(targetUid, { disabled: false })
  await db.ref(`adminProfiles/${targetUid}`).update({
    status: target.preLockStatus || 'Active',
    failedLoginAttempts: 0,
    lockedAt: null,
    lockExpiresAt: null,
    preLockStatus: null,
  })
  logger.info(`adminProfiles/${targetUid}: unlocked by ${request.auth.uid}`)
  return { ok: true }
})
