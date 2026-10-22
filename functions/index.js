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
//
// Testing with UniSMS while the Semaphore sender name is pending approval:
//   1. firebase functions:secrets:set UNISMS_API_KEY   (run this yourself, same rule as above)
//   2. functions/.env: SMS_PROVIDER=unisms  (+ optionally UNISMS_SENDER_ID=<approved sender ID>)
//   3. firebase deploy --only functions:sendGateScanSms
// Switch back by removing SMS_PROVIDER (or setting it to semaphore) and deploying again.

const functionsV1 = require('firebase-functions/v1')
const crypto = require('node:crypto')
const { onValueCreated, onValueUpdated, onValueWritten, onValueDeleted } = require('firebase-functions/v2/database')
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const { getAuth } = require('firebase-admin/auth')
const { getStorage } = require('firebase-admin/storage')
const { holderAtTime } = require('./cardHolder')
const { runLongStayCheck, resolveAlertsForScan } = require('./longStay')

initializeApp()

const SEMAPHORE_SENDER_NAME = defineString('SEMAPHORE_SENDER_NAME', { default: 'SEMAPHORE' })
const SEMAPHORE_ENDPOINT = 'https://api.semaphore.co/api/v4/messages'

// SMS provider for sendGateScanSms: 'semaphore' (default) or 'unisms' (testing until the
// Semaphore sender name is approved). Read from process.env, not defineString, because it also
// picks which secret is declared: every defineSecret() is checked at deploy time (even one no
// function binds), so declaring the other provider's never-set key fails the whole deploy.
// functions/.env is loaded at deploy and run time.
const SMS_PROVIDER = (process.env.SMS_PROVIDER || 'semaphore').toLowerCase() === 'unisms' ? 'unisms' : 'semaphore'
const SMS_API_KEY = defineSecret(SMS_PROVIDER === 'unisms' ? 'UNISMS_API_KEY' : 'SEMAPHORE_API_KEY')
// Without an approved sender ID, UniSMS's default one reaches Globe and DITO numbers only.
const UNISMS_SENDER_ID = defineString('UNISMS_SENDER_ID', { default: 'UniSMS' })
const UNISMS_ENDPOINT = 'https://unismsapi.com/api/sms'

function normalizeId(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

// Mirrors src/hooks/useEnrichedGateLogs.js's cardId/cardHex -> rfidUsers match, so a
// scan is attributed to the same owner here as it is on the live dashboard. Kept as a
// hand-copied port rather than a shared import because functions/ is a separate Node
// package/runtime from src/ (no bundler wiring the two together) - if that match logic
// ever changes in useEnrichedGateLogs.js, mirror the change here too.
async function findOwnerByCard(db, entry) {
  if (!normalizeId(entry.cardId) && !normalizeId(entry.cardHex)) return null

  const snapshot = await db.ref('rfidUsers').get()
  if (!snapshot.exists()) return null

  // The university lends from a limited pool of physical cards, so more than one rfidUsers
  // record can share the same rfidId over time. This scan must stay attributed to whoever
  // held the card AT THAT TIME (cardHolder.js#holderAtTime, a hand copy of
  // src/utils/cardHolder.js), never to whoever holds it now.
  const users = []
  snapshot.forEach((child) => {
    users.push({ id: child.key, ...(child.val() || {}) })
    return false
  })
  return holderAtTime(users, entry.cardId, entry.cardHex, entry.timestamp ?? Infinity)
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

// UniSMS: Basic auth with the secret key as username and an empty password, JSON body.
async function sendUniSms({ apiKey, senderId, phone, message }) {
  const response = await fetch(UNISMS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient: phone, content: message, sender_id: senderId }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`UniSMS HTTP ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

function sendSms({ phone, message }) {
  return SMS_PROVIDER === 'unisms'
    ? sendUniSms({ apiKey: SMS_API_KEY.value(), senderId: UNISMS_SENDER_ID.value(), phone, message })
    : sendSemaphoreSms({ apiKey: SMS_API_KEY.value(), senderName: SEMAPHORE_SENDER_NAME.value(), phone, message })
}

// Per-phone SMS limits: at most one text per SMS_MIN_INTERVAL_MS and SMS_DAILY_LIMIT per
// Manila calendar day. smsRate/{phone} is server-only (database.rules.json). Returns whether
// this text may be sent.
const SMS_MIN_INTERVAL_MS = 30 * 1000
const SMS_DAILY_LIMIT = 20

async function reserveSmsSlot(db, phone) {
  const now = Date.now()
  const day = new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const result = await db.ref(`smsRate/${phone}`).transaction((current) => {
    const state = current && current.day === day ? current : { day, count: 0, lastAt: 0 }
    if (now - (state.lastAt || 0) < SMS_MIN_INTERVAL_MS || state.count >= SMS_DAILY_LIMIT) return undefined
    return { day, count: state.count + 1, lastAt: now }
  })
  return result.committed
}

// NOTE: region should match the RTDB instance's actual location (Firebase console ->
// Realtime Database -> your instance). igate-bulsu-default-rtdb's .firebaseio.com
// hostname (rather than a regional *.firebasedatabase.app one) indicates the classic
// us-central1 location, hence the default below - double check before deploying.
exports.sendGateScanSms = onValueCreated(
  {
    ref: '/gateLogs/{logId}',
    region: 'us-central1',
    secrets: [SMS_API_KEY],
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

    // Any active staff account can create gateLogs (Simulate, Return Pass), so a flood of
    // them must not turn into a flood of texts to one owner (or an SMS bill).
    if (!(await reserveSmsSlot(db, owner.phone))) {
      await db.ref(`smsLogs/${logId}`).set({
        rfidUserId: owner.id,
        phone: owner.phone,
        message,
        direction,
        status: 'rate-limited',
        errorMessage: null,
        semaphoreResponse: null,
        provider: SMS_PROVIDER,
        sentAt: Date.now(),
      })
      logger.warn(`gateLogs/${logId}: SMS to ${owner.phone} skipped (rate limit)`)
      return
    }

    try {
      // Field name kept for existing smsLogs readers; holds whichever provider answered.
      semaphoreResponse = await sendSms({ phone: owner.phone, message })
    } catch (err) {
      status = 'failed'
      errorMessage = err.message
      logger.error(`gateLogs/${logId}: ${SMS_PROVIDER} SMS to ${owner.phone} failed`, err)
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
      provider: SMS_PROVIDER,
      sentAt: Date.now(),
    })

    if (status === 'sent') {
      logger.info(`gateLogs/${logId}: SMS sent to ${owner.phone}`)
    }
  }
)

// ---------------------------------------------------------------------------------------
// Long-stay warnings (longStay.js): a scheduled check, every 5 minutes, creates one warning
// per visit whose IN is older than the allowed stay with no exit recorded, resolves warnings
// whose visit ended, and - only when an admin turned it on in System Settings - texts the
// configured management numbers through the same provider, secret and per-phone rate limit as
// sendGateScanSms. A failed or unconfigured SMS never stops the dashboard warning. Requires
// the Blaze plan (Cloud Scheduler), like the SMS functions.
exports.checkLongStays = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Manila', region: 'us-central1', secrets: [SMS_API_KEY] },
  async () => {
    const summary = await runLongStayCheck({
      db: getDatabase(),
      now: Date.now(),
      sms: { send: sendSms, reserve: reserveSmsSlot, provider: SMS_PROVIDER },
      logger,
    })
    if (summary.created.length || summary.resolved.length || summary.sms.length) {
      logger.info('long-stay check', summary)
    }
  }
)

// Resolves a long-stay warning the moment the person's exit (or a new entry) is logged,
// instead of waiting for the next scheduled check.
exports.resolveLongStayOnScan = onValueCreated(
  { ref: '/gateLogs/{logId}', region: 'us-central1' },
  async (event) => {
    const scan = { id: event.params.logId, ...(event.data.val() || {}) }
    const resolved = await resolveAlertsForScan({ db: getDatabase(), scan, now: Date.now() })
    if (resolved.length) logger.info(`gateLogs/${scan.id}: resolved long-stay warning(s) ${resolved.join(', ')}`)
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
// Staff custom claim for Firebase Storage. storage.rules can't read RTDB, so an Active
// adminProfiles/{uid} is mirrored onto the Auth token as `staff: true` (+ `role`); any other
// status (Pending, Inactive, removed) clears it. A token only picks up a change when
// it refreshes (at most an hour) - src/services/firebase.js#ensureStorageAccess calls
// refreshStaffClaims and force-refreshes before an upload, so a just-approved account
// doesn't have to wait.
function staffClaimsFor(profile) {
  return profile && profile.status === 'Active' ? { staff: true, role: profile.role } : { staff: false }
}

async function applyStaffClaims(uid, profile) {
  const want = staffClaimsFor(profile)
  const user = await getAuth().getUser(uid)
  const { staff, role, ...others } = user.customClaims || {}
  if (staff === want.staff && role === want.role) return want
  await getAuth().setCustomUserClaims(uid, { ...others, ...want })
  return want
}

exports.syncStaffClaims = onValueWritten(
  { ref: '/adminProfiles/{uid}', region: 'us-central1' },
  async (event) => {
    try {
      await applyStaffClaims(event.params.uid, event.data.after.val())
    } catch (err) {
      if (err.code !== 'auth/user-not-found') logger.error(`syncStaffClaims ${event.params.uid} failed`, err)
    }
  }
)

exports.refreshStaffClaims = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const snapshot = await getDatabase().ref(`adminProfiles/${request.auth.uid}`).get()
  const claims = await applyStaffClaims(request.auth.uid, snapshot.val())
  return { staff: claims.staff }
})

// ---------------------------------------------------------------------------------------
// Audit trail: every change to the records that matter is copied into auditLogs/{pushId}
// with WHO made it, so after a compromised or misused account you can see exactly what it
// changed and put it back. auditLogs is read-only for active Super Admins and not writable by
// any client (database.rules.json) - not even a Super Admin can erase their tracks from the app.
//
// These use the 1st-gen (v1) database triggers on purpose: they report the signed-in user
// who made the write (context.auth / context.authType); the 2nd-gen ones above don't.
// authType 'ADMIN' = not an app user: the ESP32 (legacy database secret), a Cloud Function,
// or someone editing in the Firebase console - logged as by: 'system'.
//
// Entry: { at, entity, entityId, action: create|update|delete, by, byName, byRole,
//          changes: { field: { from?, to? } } } - a missing from/to means the field didn't exist.
function diffFields(before, after) {
  const changes = {}
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  for (const key of keys) {
    const from = before?.[key]
    const to = after?.[key]
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    changes[key] = { ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) }
  }
  return changes
}

// `skip(changes, action, isAppUser)` drops routine machine traffic so the log stays readable.
function auditTrigger(refPattern, entity, skip = () => false, omitFields = []) {
  return functionsV1.region('us-central1').database.ref(refPattern).onWrite(async (change, context) => {
    const before = change.before.val()
    const after = change.after.val()
    const action = before == null ? 'create' : after == null ? 'delete' : 'update'
    const isAppUser = context.authType === 'USER' && !!context.auth?.uid
    const isObject = (v) => v !== null && typeof v === 'object'
    const changes = isObject(before) || isObject(after)
      ? diffFields(isObject(before) ? before : {}, isObject(after) ? after : {})
      : { value: { ...(before != null ? { from: before } : {}), ...(after != null ? { to: after } : {}) } }
    omitFields.forEach((field) => { delete changes[field] })
    if (Object.keys(changes).length === 0 || skip(changes, action, isAppUser)) return

    const db = getDatabase()
    let byName = ''
    let byRole = ''
    if (isAppUser) {
      const actor = (await db.ref(`adminProfiles/${context.auth.uid}`).get()).val() || {}
      byName = actor.fullName || actor.displayName || context.auth.token?.email || ''
      byRole = actor.role || ''
    }
    await db.ref('auditLogs').push({
      at: Date.parse(context.timestamp) || Date.now(), // when the change happened, not when this ran
      entity,
      entityId: Object.values(context.params || {})[0] || entity,
      action,
      by: isAppUser ? context.auth.uid : 'system',
      byName: isAppUser ? byName : 'Device / server / Firebase console',
      byRole,
      changes,
    })
  })
}

const onlyFields = (changes, fields) => Object.keys(changes).every((key) => fields.includes(key))

exports.auditAdminProfiles = auditTrigger('/adminProfiles/{uid}', 'adminProfiles')
exports.auditRfidUsers = auditTrigger('/rfidUsers/{id}', 'rfidUsers')
exports.auditPayments = auditTrigger('/payments/{id}', 'payments')
exports.auditExpectedGuests = auditTrigger('/expectedGuests/{id}', 'expectedGuests')
// Google Forms imports and their processing (who corrected / approved / activated what, and when).
// originalJson is the untouched submission - long and never changes, so it isn't repeated here.
exports.auditVisitRemarks = auditTrigger('/visitRemarks/{key}', 'visitRemarks', (changes) => onlyFields(changes, ['at']))
exports.auditRegistrations = auditTrigger('/registrations/{id}', 'registrations', () => false, ['originalJson'])
// Who pressed Gate Control / Return Pass / auto-close (each command overwrites the last).
exports.auditScannerCommands = auditTrigger('/devices/scanner/command', 'scannerCommand')
// Scanner scans and camera photos are routine; staff-made entries and any edit/delete are not.
exports.auditGateLogs = auditTrigger('/gateLogs/{id}', 'gateLogs', (changes, action, isAppUser) =>
  (action === 'create' && !isAppUser) || (action === 'update' && onlyFields(changes, ['imageUrl'])))
// The ESP32 rewrites gateStatus on every barrier move, and App.jsx's initializeFirebaseCollections
// re-stamps createdAt on every admin login - neither is a settings change.
exports.auditAppSettings = auditTrigger('/settings/app', 'settings', (changes) => onlyFields(changes, ['gateStatus', 'createdAt']))
// Who changed the long-stay limits / SMS switch, and who acknowledged which warning (the
// warnings themselves are created and resolved by checkLongStays - not app-user writes).
exports.auditLongStaySettings = auditTrigger('/settings/longStay', 'longStaySettings')
exports.auditLongStayAlerts = auditTrigger('/longStayAlerts/{id}', 'longStayAlerts', (_changes, _action, isAppUser) => !isAppUser)
// Who recorded / resolved an emergency card tap (the taps themselves come from the scanner).
exports.auditEmergencyLogs = auditTrigger('/emergencyLogs/{id}', 'emergencyLogs', (_changes, _action, isAppUser) => !isAppUser)

// ---------------------------------------------------------------------------------------
// Username login. Firebase Authentication only signs in with email + password, so a username
// is resolved HERE, server-side, and the email never leaves this function:
//   usernames/{key} -> { uid, username }   (server-only - database.rules.json: no client read/write)
//   adminProfiles/{uid}/username            (display copy - clients can't change it, see rules)
// signInWithUsername checks the password with Firebase Auth itself (the same REST endpoint the
// client SDK uses) and only then returns a one-time custom token for that uid; the client signs
// in with it. No password is stored or logged anywhere. setUsername is the ONLY way to claim or
// change a username, always for the caller's own uid, inside a transaction (no duplicates).
//
// Production requirement: createCustomToken needs the functions' service account to hold the
// "Service Account Token Creator" role (Google Cloud console -> IAM). Without it username login
// fails with a signBlob permission error; email login is unaffected.
//
// HAND-COPY of src/utils/validators.js (USERNAME_PATTERN / normalizeUsername) - keep identical.
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/
const normalizeUsername = (value) => (value || '').toString().trim().toLowerCase()
// RTDB keys can't contain ".", so the lookup key swaps it for "," (not allowed in usernames).
const usernameKey = (username) => username.replace(/\./g, ',')

// The Firebase web API key is public by design (it's in the web app bundle - src/services/
// firebase.js); it only names the project. A plain constant, not a deploy-time param.
const FIREBASE_WEB_API_KEY = 'AIzaSyCiUx-CAXk45UrgEGW99fbIO2rOJ84-B7o'
const USERNAME_LOGIN_MAX_FAILURES = 10
const USERNAME_LOGIN_WINDOW_MS = 15 * 60 * 1000

// Cloud Run appends the caller's real address as the LAST X-Forwarded-For entry.
function callerIp(request) {
  const raw = request.rawRequest
  const forwarded = (raw?.headers?.['x-forwarded-for'] || '').toString().split(',').map((s) => s.trim()).filter(Boolean)
  return forwarded[forwarded.length - 1] || raw?.ip || 'unknown'
}

const ipKey = (request) => crypto.createHash('sha256').update(callerIp(request)).digest('hex').slice(0, 40)

// Per-IP failure budget, so this endpoint can't be used for fast password guessing (Firebase
// Auth also throttles per account). Server-only node usernameLoginThrottle/{ipHash}.
async function usernameLoginBlocked(db, request) {
  const state = (await db.ref(`usernameLoginThrottle/${ipKey(request)}`).get()).val()
  return !!state && Date.now() - state.firstAt < USERNAME_LOGIN_WINDOW_MS && state.count >= USERNAME_LOGIN_MAX_FAILURES
}

async function recordUsernameLoginFailure(db, request) {
  const now = Date.now()
  await db.ref(`usernameLoginThrottle/${ipKey(request)}`).transaction((current) => {
    const fresh = !current || now - current.firstAt >= USERNAME_LOGIN_WINDOW_MS
    return { firstAt: fresh ? now : current.firstAt, count: (fresh ? 0 : current.count) + 1 }
  })
}

// Same message for "no such username" and "wrong password", so it can't be used to find usernames.
const badCredentials = () => new HttpsError('unauthenticated', 'Incorrect username or password.')

async function passwordMatches(email, password) {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const base = host ? `http://${host}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com'
  const response = await fetch(`${base}/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  })
  if (response.ok) return 'ok'
  const code = ((await response.json().catch(() => null))?.error?.message || '').split(' ')[0]
  if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') return 'throttled'
  if (code === 'USER_DISABLED') return 'disabled'
  return 'bad'
}

exports.signInWithUsername = onCall({ region: 'us-central1' }, async (request) => {
  const username = normalizeUsername(request.data?.username)
  const password = request.data?.password
  if (!USERNAME_PATTERN.test(username) || typeof password !== 'string' || !password) throw badCredentials()

  const db = getDatabase()
  if (await usernameLoginBlocked(db, request)) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.')
  }

  const entry = (await db.ref(`usernames/${usernameKey(username)}`).get()).val()
  const user = entry?.uid ? await getAuth().getUser(entry.uid).catch(() => null) : null
  const result = user?.email ? await passwordMatches(user.email, password) : 'bad'

  if (result === 'throttled') throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.')
  if (result === 'disabled') throw new HttpsError('permission-denied', 'This account is unavailable. Please contact an administrator.')
  if (result !== 'ok') {
    await recordUsernameLoginFailure(db, request)
    throw badCredentials()
  }
  return { token: await getAuth().createCustomToken(user.uid) }
})

exports.setUsername = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const uid = request.auth.uid
  const username = normalizeUsername(request.data?.username)
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpsError('invalid-argument', 'Usernames are 3-30 characters: letters, numbers, dot, underscore or hyphen, starting and ending with a letter or number.')
  }

  const db = getDatabase()
  const profileRef = db.ref(`adminProfiles/${uid}`)
  const profile = (await profileRef.get()).val()
  if (!profile) throw new HttpsError('failed-precondition', 'Your account has no profile yet.')
  if (profile.status === 'Inactive') throw new HttpsError('permission-denied', 'This account is inactive.')
  if (profile.username === username) return { username }

  // Claim the new name atomically: succeeds only if it's free or already ours.
  const claim = await db.ref(`usernames/${usernameKey(username)}`).transaction((current) => {
    if (current && current.uid !== uid) return undefined // taken - abort
    return { uid, username, claimedAt: Date.now() }
  })
  if (!claim.committed) throw new HttpsError('already-exists', 'That username is already taken.')

  // Release the previous name (only if it still points at this account).
  if (profile.username) {
    const oldRef = db.ref(`usernames/${usernameKey(profile.username)}`)
    if ((await oldRef.get()).val()?.uid === uid) await oldRef.remove()
  }
  await profileRef.update({ username })
  return { username }
})

// A removed profile (declined signup "start over", Super Admin "Remove") frees its username.
exports.releaseUsername = onValueDeleted(
  { ref: '/adminProfiles/{uid}', region: 'us-central1' },
  async (event) => {
    const username = event.data.val()?.username
    if (!username) return
    const ref = getDatabase().ref(`usernames/${usernameKey(username)}`)
    if ((await ref.get()).val()?.uid === event.params.uid) await ref.remove()
  }
)
