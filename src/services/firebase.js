// Firebase v9 modular SDK setup
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, push, get, remove, query, orderByChild, equalTo, startAt, limitToLast, onValue, onChildAdded, runTransaction, serverTimestamp } from 'firebase/database'
import { getStorage, connectStorageEmulator, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { validateGateLog } from '../models/gateLog'
import { validateVisitRemark } from '../models/visitRemark'
import { validateEmergencyDetails, validateEmergencyText, validateEmergencyResolution } from '../models/emergencyLog'
import { EMERGENCY_CARD_ID } from '../constants/emergencyCard'
import { validateLongStaySettings } from '../models/longStay'
import { validateRfidUser } from '../models/rfidUser'
import { validatePayment } from '../models/payment'
import { validateAdminProfile } from '../models/adminProfile'
import { validateAppSettings, validateGateStatus, GATE_IDS } from '../models/appSettings'
import { validateSystemUser } from '../models/systemUser'
import { validateExpectedGuest } from '../models/expectedGuest'
import { ROLES } from '../constants/roles'
import { getErrorMessage } from '../utils/errors'
import { currentHolder, renewableRecord, normalizeCardId } from '../utils/cardHolder'
import { toCaps } from '../utils/textCase'
import { registrationFieldValues, registrationKeys, encodeKey } from '../models/registration'
import { isValidRfid } from '../utils/validators'

// TODO: replace with your Firebase project values
const firebaseConfig = {
  apiKey: "AIzaSyCiUx-CAXk45UrgEGW99fbIO2rOJ84-B7o",
  authDomain: "igate-bulsu.firebaseapp.com",
  databaseURL: "https://igate-bulsu-default-rtdb.firebaseio.com",
  projectId: "igate-bulsu",
  storageBucket: "igate-bulsu.firebasestorage.app",
  messagingSenderId: "508714511794",
  appId: "1:508714511794:web:a49e0321bbd560e2db08ab",
  measurementId: "G-LK68HMZQPW"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const rtdb = getDatabase(app)
export const storage = getStorage(app)
// Region must match functions/index.js's callables (see the region note there).
export const functions = getFunctions(app, 'us-central1')

// Local testing only: with VITE_USE_EMULATORS=true (e.g. `VITE_USE_EMULATORS=true npm run dev`
// while `firebase emulators:start` runs) the app talks to the Firebase emulators instead of the
// live project - fake data, fake accounts. Never set it for a production build.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Offline handling: while this browser has no connection to Firebase, the SDK queues writes
// and sends them whenever the connection comes back - possibly minutes later. That's fine for
// an edit, but not for anything that moves a barrier or needs a server reply (receipt number,
// pass return), so those call assertOnline() first and fail right away instead of hanging.
let rtdbConnected = false
let serverTimeOffsetMs = 0
onValue(ref(rtdb, '.info/connected'), (snapshot) => { rtdbConnected = snapshot.val() === true })
onValue(ref(rtdb, '.info/serverTimeOffset'), (snapshot) => { serverTimeOffsetMs = snapshot.val() || 0 })

export function assertOnline(what) {
  if (!rtdbConnected) {
    throw new Error(`No internet connection - ${what} needs to be online. Try again once the connection is back.`)
  }
}

// Firebase server time in ms - right even if this PC's clock is off.
const serverNow = () => Date.now() + serverTimeOffsetMs

// true/false as this browser connects to / loses Firebase (hooks/useConnectionStatus.js).
export function listenToConnection(callback) {
  return onValue(ref(rtdb, '.info/connected'), (snapshot) => callback(snapshot.val() === true))
}

export async function initializeFirebaseCollections(onError) {
  try {
    await Promise.all([
      // update(), not set(): this runs on every admin session mount (see App.jsx), and a
      // set() here would fully overwrite settings/app - silently deleting the live
      // gateStatus/entrance and gateStatus/exit children on every admin login. update()
      // merges these four fields in instead, leaving gate state untouched.
      update(ref(rtdb, 'settings/app'), validateAppSettings({
        appName: 'iGATE',
        campus: 'Bustos Campus',
        status: 'active',
        createdAt: Date.now()
      })),
      set(ref(rtdb, 'users/system'), validateSystemUser({
        role: 'system',
        displayName: 'System',
        status: 'active',
        createdAt: Date.now()
      }))
    ])
  } catch (error) {
    console.error('Failed to initialize Firebase collections', error)
    onError?.(`App setup check failed: ${getErrorMessage(error, 'please contact an administrator if this keeps happening.')}`)
  }
}

function cardKey(cardId, cardHex) {
  return (cardId ?? cardHex ?? '').toString().trim().toLowerCase()
}

// Mirrors useGateStats's "latest scan per card" logic (same cardId/cardHex normalization) -
// finds whichever gateLogs entry for this card has the newest timestamp, so logGateEntry can
// refuse a direction that would create two consecutive INs (or OUTs) in a row for the same
// card. Only guards writes that go through this app (SimulateScanModal, SimulateUserScanModal,
// visitor registration's initial IN) - the ESP32 scanner POSTs to gateLogs directly with a
// legacy database secret and never calls this function, see CLAUDE.md's hardware note.
async function getLatestDirectionForCard(key) {
  if (!key) return null
  const snapshot = await get(ref(rtdb, 'gateLogs'))
  if (!snapshot.exists()) return null

  let latest = null
  for (const value of Object.values(snapshot.val() || {})) {
    if (cardKey(value.cardId, value.cardHex) !== key) continue
    if (!latest || (value.timestamp || 0) > (latest.timestamp || 0)) latest = value
  }
  return latest ? (latest.direction || 'IN').toString().trim().toUpperCase() : null
}

export async function logGateEntry({ cardId, cardHex, direction = 'IN', source = 'unknown', notes = '' }) {
  const normalizedDirection = (direction || 'IN').toString().trim().toUpperCase()
  const lastDirection = await getLatestDirectionForCard(cardKey(cardId, cardHex))

  if (lastDirection && lastDirection === normalizedDirection) {
    throw new Error(
      normalizedDirection === 'IN'
        ? 'This card already scanned IN and has not scanned OUT yet - refusing a duplicate IN.'
        : 'This card already scanned OUT (or has no prior IN) - refusing a duplicate OUT.'
    )
  }

  const entryRef = push(ref(rtdb, 'gateLogs'))
  await set(entryRef, validateGateLog({ cardId, cardHex, direction: normalizedDirection, source, notes, timestamp: Date.now() }))

  return entryRef.key
}

export async function registerRfidUser({ name, rfidId, plateNumber, vehicleType, vehicleBrand, department, role, email, phone, expiresAt, hostName, purpose, guestId }) {
  assertNotEmergencyCard(rfidId)
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existingUsers = snapshot.exists() ? Object.values(snapshot.val() || {}) : []

  // The university lends from a limited pool of physical RFID cards rather than issuing
  // a fresh one per visitor, so a card is only blocked while it's currently Active on
  // someone else's record - an Inactive (returned) record for the same rfidId is a past
  // holder, not a conflict. Kept as its own record rather than overwritten, the same way
  // a repeat visitor's past visits each keep their own record under a different card -
  // this just mirrors that for "same card, different visitors" instead.
  const conflictingActive = existingUsers.some((user) => user.rfidId === rfidId && (user.status || 'Active') === 'Active')
  if (conflictingActive) {
    throw new Error('This RFID card is currently active on another account - return that pass before reissuing it.')
  }

  const newUserRef = push(usersRef)
  await set(newUserRef, validateRfidUser({ name, rfidId, plateNumber, vehicleType, vehicleBrand, department, role, email, phone, expiresAt, hostName, purpose, guestId, createdAt: Date.now() }))

  return newUserRef.key
}

// Used by the Payment flow: a successful payment registers the card if it's new,
// or refreshes its details if it's a renewal — unlike registerRfidUser, it never
// throws on an existing RFID since renewals are expected to already be registered.
// With `payment`, the record and its payments/{id} entry are written in ONE atomic update,
// and the record carries that paymentId: database.rules.json only lets a non-admin create a
// non-visitor record together with a brand-new payment for the same card, received by them.
export async function upsertRfidUser({ rfidId, name, department, plateNumber, vehicleType, vehicleColor, vehicleBrand, role, email, phone }, { payment } = {}) {
  assertNotEmergencyCard(rfidId)
  const paymentId = payment ? push(ref(rtdb, 'payments')).key : null
  const save = async (id, record) => {
    const value = validateRfidUser({ ...record, ...(paymentId ? { paymentId } : {}) })
    if (!paymentId) return set(ref(rtdb, `rfidUsers/${id}`), value)
    return update(ref(rtdb), {
      [`rfidUsers/${id}`]: value,
      [`payments/${paymentId}`]: buildPaymentRecord(payment),
    })
  }
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existing = snapshot.exists() ? Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value })) : []
  // Renew the card's CURRENT holder; failing that, the latest lapsed non-visitor
  // registration on it (an Inactive student/faculty/staff renewing). A returned visitor
  // pass is never a match: overwriting it would rename that past visitor's record - and
  // with it their whole scan history - to whoever is registering the pooled card now.
  // Picking the first record for the card (the old behavior) did exactly that.
  const match = renewableRecord(existing, rfidId)

  if (match) {
    const { id, ...value } = match
    const finalRole = role || value.role
    const staysVisitor = finalRole === 'Visitor'
    await save(id, {
      ...value,
      name: name || value.name,
      department: department || value.department,
      plateNumber: plateNumber || value.plateNumber,
      vehicleType: vehicleType || value.vehicleType,
      vehicleColor: vehicleColor || value.vehicleColor,
      vehicleBrand: vehicleBrand || value.vehicleBrand, // renewal without a brand keeps the one on file
      role: finalRole,
      email: email || value.email,
      phone: phone || value.phone,
      // A registration/renewal through Payment always means the card is live again right now -
      // never silently leave a prior Inactive status (e.g. an already-returned visitor pass)
      // on the books, or the person becomes invisible to stats/active-user pickers despite
      // just having paid.
      status: 'Active',
      // expiresAt/hostName/purpose are visitor-pass-only fields (see models/rfidUser.js) -
      // once the card is tied to a paid, permanent role they're stale and should clear.
      expiresAt: staysVisitor ? value.expiresAt : null,
      hostName: staysVisitor ? value.hostName : '',
      purpose: staysVisitor ? value.purpose : '',
      guestId: staysVisitor ? value.guestId : '',
      returnedAt: null, // Active again
    })
    return id
  }

  const newUserRef = push(usersRef)
  await save(newUserRef.key, { name, rfidId, plateNumber, vehicleType, vehicleColor, vehicleBrand, department, role, email, phone, createdAt: Date.now() })

  return newUserRef.key
}

// Account Management: edits an existing record's own fields (keeps createdAt/status
// unless explicitly overridden). Deleting/deactivating are separate, more restricted
// operations below — see database.rules.json for why they're split out.
export async function updateRfidUser(id, patch) {
  const existingSnap = await get(ref(rtdb, `rfidUsers/${id}`))
  if (!existingSnap.exists()) throw new Error('RFID user not found.')
  if (patch.rfidId != null && patch.rfidId !== existingSnap.val().rfidId) assertNotEmergencyCard(patch.rfidId)

  await set(ref(rtdb, `rfidUsers/${id}`), validateRfidUser({ ...existingSnap.val(), ...patch }))
  return id
}

// Deleting an rfidUsers record is restricted to Super Admin/Administrator by
// database.rules.json (any authenticated role can create/update via the registration
// flows above, but only admins can remove a record entirely).
export async function deleteRfidUser(id) {
  await remove(ref(rtdb, `rfidUsers/${id}`))
}

// Deactivating/reactivating is a soft-delete alternative — the record and its payment
// history are kept. Only the `status` leaf is written (see database.rules.json: any
// authenticated role can leave `status` unchanged via a renewal, but only admins can
// actually change its value).
export async function setRfidUserStatus(id, status) {
  if (status !== 'Active' && status !== 'Inactive') {
    throw new Error('status must be Active or Inactive')
  }
  await set(ref(rtdb, `rfidUsers/${id}/status`), status)
}

// ---------------- Gate scanner commands (devices/scanner/command) ----------------
// The ESP32 (sketch_scanner.ino#pollScannerCommand) polls this single node every ~1.5 s
// and runs each new command once, keyed by `id`:
//   EXIT - run the exit barrier motor (Return Pass / VIP Check Out: the visitor leaves
//          without scanning), then re-download its authorization cache
//   SYNC - just re-download the authorization cache, so a pass issued or returned in the
//          app takes effect at the gate within seconds instead of the 5-minute cycle
//   OPEN_ / CLOSE_ + ENTRY | EXIT | BOTH - Gate Control: open (motor forward) or close
//          (motor reverse) the entrance, exit, or both barriers (both at the same time).
//          The scanner remembers each barrier's state, only moves one whose state changes,
//          and publishes it to settings/app/gateStatus
//   SET_AUTO_CLOSE - `seconds` (1-60): how long a scan-opened barrier stays open before it
//          closes by itself. Saved on the scanner; it reports the value back in
//          devices/scanner/autoCloseSeconds
// It acknowledges in devices/scanner/commandAck. Best-effort by design: if the scanner is
// offline the command is simply missed (it ignores whatever command is already waiting
// when it boots, so a stale EXIT can never fire later).
const SCANNER_ACTIONS = ['EXIT', 'SYNC', 'OPEN_ENTRY', 'OPEN_EXIT', 'OPEN_BOTH', 'CLOSE_ENTRY', 'CLOSE_EXIT', 'CLOSE_BOTH', 'SET_AUTO_CLOSE']

export async function sendScannerCommand(action, { cardId = '', seconds, actor } = {}) {
  if (!SCANNER_ACTIONS.includes(action)) throw new Error(`Unknown scanner command "${action}"`)
  if (action === 'SET_AUTO_CLOSE' && !(Number.isInteger(seconds) && seconds >= 1 && seconds <= 60)) {
    throw new Error('Auto-close delay must be a whole number of seconds from 1 to 60.')
  }
  // A command queued offline would move a barrier whenever the connection returned. Refused
  // here, by the rules (requestedAt older than 60 s) and by the scanner (same 60 s) as well.
  assertOnline('the gate controller')
  const id = push(ref(rtdb, 'devices/scanner')).key // unique, time-ordered id; nothing is written here
  await set(ref(rtdb, 'devices/scanner/command'), {
    id,
    action,
    cardId: (cardId ?? '').toString(),
    ...(action === 'SET_AUTO_CLOSE' ? { seconds } : {}),
    requestedAt: serverNow(),
    requestedBy: auth.currentUser?.uid || '',
    requestedByName: actor?.name || '',
  })
  return id
}

// Master card taps (sketch_scanner.ino#handleMasterCard): { action: 'OPEN_BOTH'|'CLOSE_BOTH',
// cardId, timestamp, source, timeApprox? }, newest first. Written only by the scanner (rules:
// read-only for staff); a tap made offline arrives once the scanner is back online.
// Audit trail (functions/index.js#auditTrigger): newest first. Rules: active Super Admins only.
export function listenToAuditLogs(callback, count = 500) {
  return onValue(
    query(ref(rtdb, 'auditLogs'), orderByChild('at'), limitToLast(count)),
    (snapshot) => {
      const rows = Object.entries(snapshot.val() || {}).map(([id, v]) => ({ id, ...v }))
      callback(rows.sort((a, b) => (b.at || 0) - (a.at || 0)))
    },
    () => callback([]),
  )
}

// Visit remarks (models/visitRemark.js): { [visitId]: { text, at, by, byName, personKey } }, plus
// older per-person records { [personKey]: { text, at, by, byName } } (hooks/useRemarks.js).
export function listenToVisitRemarks(callback) {
  return onValue(ref(rtdb, 'visitRemarks'), (snapshot) => callback(snapshot.val() || {}), () => callback({}))
}

// RTDB keys can't contain . # $ [ ] / - a card id never should, but a corrupted read might.
const remarkPath = (key) => `visitRemarks/${key.replace(/[.#$[\]/]/g, '_')}`

// Saves (or, with empty text, removes) ONE visit's remark: visitId = the IN gateLogs id that
// started the visit. `at` is Firebase server time. `legacyKey` = the old per-person record this
// visit was showing, removed in the same update so it can't reappear. Touches only visitRemarks.
export async function saveVisitRemark(visitId, text, actor, { personKey, legacyKey } = {}) {
  assertOnline('saving the remark')
  if (!visitId) throw new Error('No visit selected for this remark.')
  const writes = {}
  if (legacyKey) writes[remarkPath(legacyKey)] = null
  if (!(text ?? '').toString().trim()) {
    writes[remarkPath(visitId)] = null
  } else {
    const remark = validateVisitRemark({ text, by: auth.currentUser?.uid, byName: actor?.name, personKey })
    writes[remarkPath(visitId)] = { ...remark, at: serverTimestamp() }
  }
  await update(ref(rtdb), writes)
}

// Long-stay settings (models/longStay.js). null until an admin first saves them - the
// Cloud Function uses LONG_STAY_DEFAULTS meanwhile. Rules: active admins read/write.
export function listenToLongStaySettings(callback) {
  return onValue(ref(rtdb, 'settings/longStay'), (snapshot) => callback(snapshot.val()), () => callback(null))
}

export async function saveLongStaySettings(values, actor) {
  assertOnline('saving the long-stay settings')
  await set(ref(rtdb, 'settings/longStay'), {
    ...validateLongStaySettings(values),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid,
    updatedByName: (actor?.name || '').toString().slice(0, 80),
  })
}

// Long-stay warnings (functions/longStay.js): every active one, plus anything created in the
// last `historyMs` (resolved history). Two queries merged, so an old warning that is still
// active never drops off. Rules: any active staff.
export function listenToLongStayAlerts(callback, historyMs = 7 * 24 * 60 * 60 * 1000) {
  let active = {}
  let recent = {}
  const emit = () => {
    const rows = Object.entries({ ...recent, ...active }).map(([id, v]) => ({ id, ...v }))
    callback(rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
  }
  const unsubActive = onValue(query(ref(rtdb, 'longStayAlerts'), orderByChild('status'), equalTo('active')),
    (snapshot) => { active = snapshot.val() || {}; emit() }, () => { active = {}; emit() })
  const unsubRecent = onValue(query(ref(rtdb, 'longStayAlerts'), orderByChild('createdAt'), startAt(serverNow() - historyMs)),
    (snapshot) => { recent = snapshot.val() || {}; emit() }, () => { recent = {}; emit() })
  return () => { unsubActive(); unsubRecent() }
}

// "Seen, someone is following up" - stops repeat SMS; the warning stays until the exit is
// recorded. The rules only let active staff add these three fields, once, to an active warning.
export async function acknowledgeLongStayAlerts(ids, actor) {
  assertOnline('acknowledging the warning')
  const writes = {}
  for (const id of ids) {
    writes[`longStayAlerts/${id}/acknowledgedAt`] = serverTimestamp()
    writes[`longStayAlerts/${id}/acknowledgedBy`] = auth.currentUser?.uid
    writes[`longStayAlerts/${id}/acknowledgedByName`] = (actor?.name || '').toString().slice(0, 80)
  }
  await update(ref(rtdb), writes)
}

export function listenToOverrideLogs(callback, count = 5) {
  return onValue(query(ref(rtdb, 'overrideLogs'), orderByChild('timestamp'), limitToLast(count)), (snapshot) => {
    const rows = Object.entries(snapshot.val() || {}).map(([id, v]) => ({ id, ...v }))
    callback(rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  })
}

// ---- Emergency RFID card (models/emergencyLog.js) ----

// Every path that puts a card on an rfidUsers record calls this first, for a clear message;
// database.rules.json refuses the write anyway.
function assertNotEmergencyCard(rfidId) {
  const card = normalizeCardId(rfidId)
  if (card && (card === EMERGENCY_CARD_ID || card === Number(EMERGENCY_CARD_ID).toString(16))) {
    throw new Error('This is the emergency RFID card - it cannot be registered to a person, vehicle or visitor pass.')
  }
}

// Every scan, newest first - the one source for the Dashboard rows, the event modal and
// Search History. Rules: Active staff read; only the scanner creates them.
export function listenToEmergencyLogs(callback) {
  return onValue(query(ref(rtdb, 'emergencyLogs'), orderByChild('timestamp')), (snapshot) => {
    const rows = Object.entries(snapshot.val() || {}).map(([id, v]) => ({ id, ...v }))
    callback(rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  }, () => callback([]))
}

const actorName = (actor) => (actor?.name || '').toString().slice(0, 80)

// One status change / note = one atomic update: the event's fields + an append-only
// actions/{push} entry, so the history can't drift from the status.
async function writeEmergencyAction(id, type, actor, { fields = {}, text } = {}) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You need to be signed in.')
  const actionId = push(ref(rtdb, `emergencyLogs/${id}/actions`)).key
  const writes = {}
  for (const [key, value] of Object.entries(fields)) writes[`emergencyLogs/${id}/${key}`] = value
  writes[`emergencyLogs/${id}/actions/${actionId}`] = { type, at: serverTimestamp(), by: uid, byName: actorName(actor), ...(text ? { text } : {}) }
  await update(ref(rtdb), writes)
}

export async function acknowledgeEmergency(id, actor) {
  assertOnline('acknowledging the emergency')
  await writeEmergencyAction(id, 'acknowledged', actor, { fields: {
    status: 'Acknowledged',
    acknowledgedAt: serverTimestamp(),
    acknowledgedBy: auth.currentUser?.uid,
    acknowledgedByName: actorName(actor),
  } })
}

export async function markEmergencyInProgress(id, actor) {
  assertOnline('updating the emergency')
  await writeEmergencyAction(id, 'in-progress', actor, { fields: { status: 'In Progress' } })
}

// Incident details (type / unit / plate / destination). Editable until resolved; every save
// is also logged as an action with a summary, so earlier values stay in the history.
export async function saveEmergencyDetails(id, values, actor) {
  assertOnline('saving the emergency details')
  const details = validateEmergencyDetails({ ...values, recordedBy: auth.currentUser?.uid, recordedByName: actor?.name })
  const summary = [details.type, details.agency, details.plateNumber && `Plate ${details.plateNumber}`, details.destination && `To ${details.destination}`].filter(Boolean).join(' · ')
  await writeEmergencyAction(id, 'details', actor, { fields: { details: { ...details, recordedAt: serverTimestamp() } }, text: summary })
}

export async function addEmergencyRemark(id, text, actor) {
  assertOnline('saving the remark')
  await writeEmergencyAction(id, 'remark', actor, { text: validateEmergencyText(text) })
}

// Any Active staff (rules). Doesn't move the barriers - Gate Control does. resolvedAt/By/Name
// can be written only once (rules), so a record that already carries them (resolved by the
// first version of this feature, which wrote no status) keeps its stamp and only gets the
// status + outcome.
export async function resolveEmergency(id, values, actor) {
  assertOnline('resolving the emergency')
  const resolution = validateEmergencyResolution(values)
  const stamped = (await get(ref(rtdb, `emergencyLogs/${id}/resolvedAt`))).exists()
  await writeEmergencyAction(id, 'resolved', actor, {
    fields: {
      status: 'Resolved',
      ...(stamped ? {} : {
        resolvedAt: serverTimestamp(),
        resolvedBy: auth.currentUser?.uid,
        resolvedByName: actorName(actor),
      }),
      resolution,
    },
    text: [resolution.classification, resolution.summary].filter(Boolean).join(' - '),
  })
}

// Resolves several open alerts with the same outcome (e.g. a batch of test taps). A New alert
// is acknowledged first - the rules only allow Acknowledged/In Progress -> Resolved. One record
// failing doesn't stop the rest; returns { resolved, failed: [{ id, error }] }.
export async function resolveEmergencies(logs, values, actor) {
  assertOnline('resolving the emergencies')
  validateEmergencyResolution(values)
  let resolved = 0
  const failed = []
  for (const log of logs) {
    try {
      if ((log.status || 'New') === 'New') await acknowledgeEmergency(log.id, actor)
      await resolveEmergency(log.id, values, actor)
      resolved++
    } catch (err) {
      failed.push({ id: log.eventId || log.id, error: getErrorMessage(err, 'Could not be resolved') })
    }
  }
  return { resolved, failed }
}

// The scanner's answer to the latest command: { id, action, result, executedAt }.
export function listenToScannerCommandAck(callback) {
  return onValue(ref(rtdb, 'devices/scanner/commandAck'), (snapshot) => callback(snapshot.val()))
}

// Return Pass (walk-in visitor) and VIP Check Out both end a temporary pass the same way:
//   1. log the OUT - only if this card's latest gate scan is an IN (the visitor really is
//      inside); otherwise there's nothing to close and a second OUT would be refused anyway
//   2. deactivate the record and stamp returnedAt, AFTER that OUT so the OUT still counts
//      as this visitor's - every scan after returnedAt belongs to nobody until the card is
//      reissued (utils/cardHolder.js#holderAtTime)
//   3. tell the gate to open the exit barrier and drop the card from its local cache
// Steps 1 and 3 are best-effort (reported through onWarning); step 2 is the return itself.
export async function returnTemporaryPass(pass, { source = 'visitor-return', actor, onWarning } = {}) {
  if (!pass?.id) throw new Error('Pass not found.')
  assertOnline('returning a pass')
  const cardId = (pass.rfidId ?? '').toString()

  try {
    if (await getLatestDirectionForCard(cardKey(cardId)) === 'IN') {
      await logGateEntry({ cardId, direction: 'OUT', source })
    }
  } catch (scanError) {
    onWarning?.(`Pass returned, but the exit could not be recorded: ${getErrorMessage(scanError, 'please log it manually.')}`)
  }

  await update(ref(rtdb, `rfidUsers/${pass.id}`), { status: 'Inactive', returnedAt: Date.now() })

  try {
    await sendScannerCommand('EXIT', { cardId, actor })
  } catch (cmdError) {
    onWarning?.(`Pass returned, but the exit barrier could not be signalled: ${getErrorMessage(cmdError, 'open it manually.')}`)
  }
}

// Vehicle snapshot images (Firebase Storage). The ESP32-CAM (once wired up) would
// eventually upload directly to this same `vehicle-snapshots/{rfidUserId}/...` path
// and PATCH the resulting URL onto the matching gateLogs entry - this function is
// the placeholder for that, driven by the web mock selector/uploader in the meantime.
// storage.rules require the `staff` custom claim (functions/index.js#syncStaffClaims). A token
// issued before the account was approved, or before claims existed, doesn't carry it yet -
// ask the server to set it from adminProfiles and fetch a fresh token.
const refreshStaffClaimsFn = httpsCallable(functions, 'refreshStaffClaims')

async function ensureStorageAccess() {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in first.')
  const { claims } = await user.getIdTokenResult()
  if (claims.staff === true) return
  const result = await refreshStaffClaimsFn()
  if (!result.data?.staff) throw new Error('Your account is not active - uploads are disabled.')
  await user.getIdToken(true)
}

export async function uploadVehicleSnapshot(file, { gateLogId, rfidUserId } = {}) {
  if (!file) throw new Error('No image file provided.')
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max 5MB).')
  }

  await ensureStorageAccess()
  const path = `vehicle-snapshots/${rfidUserId || 'unassigned'}/${Date.now()}-${file.name}`
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, file, { contentType: file.type })
  const url = await getDownloadURL(fileRef)

  const writes = []
  if (gateLogId) writes.push(set(ref(rtdb, `gateLogs/${gateLogId}/imageUrl`), url))
  if (rfidUserId) writes.push(set(ref(rtdb, `rfidUsers/${rfidUserId}/imageUrl`), url))
  await Promise.all(writes)

  return url
}

export async function getRfidUsers() {
  const snapshot = await get(ref(rtdb, 'rfidUsers'))
  if (!snapshot.exists()) return []
  return Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
}

export function listenToGateLogs(callback) {
  return onValue(ref(rtdb, 'gateLogs'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const entries = Object.entries(snapshot.val() || {}).map(([id, value]) => ({
      id,
      ...value,
      timestamp: value.timestamp || Date.now()
    }))

    callback(entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  })
}

// Hardware-ready live feed: onChildAdded fires once per EXISTING child immediately
// on attach (the initial backlog), then again for each NEW child pushed afterwards -
// exactly the event the ESP32 scanner triggers in real time. We skip the backlog by
// only calling back for entries timestamped after this listener was attached.
export function listenToNewGateLogs(callback) {
  const startedAt = Date.now()
  return onChildAdded(ref(rtdb, 'gateLogs'), (snapshot) => {
    const value = snapshot.val() || {}
    if (typeof value.timestamp === 'number' && value.timestamp < startedAt) return
    callback({ id: snapshot.key, ...value })
  })
}

export function listenToRfidUsers(callback) {
  return onValue(ref(rtdb, 'rfidUsers'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const users = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
    callback(users)
  })
}

// Next sequential receipt number (OR-000123). A transaction on counters/receipt, so two guards
// paying at the same moment can never be issued the same number. If the payment write that
// follows fails, that number is simply skipped (a gap, never a duplicate).
export async function getNextReceiptNo() {
  const result = await runTransaction(ref(rtdb, 'counters/receipt'), (current) => (Number(current) || 0) + 1)
  return `OR-${String(result.snapshot.val()).padStart(6, '0')}`
}

export async function recordPayment(payment) {
  const paymentRef = push(ref(rtdb, 'payments'))
  await set(paymentRef, buildPaymentRecord(payment))
  return paymentRef.key
}

function buildPaymentRecord({ rfidId, name, department, plateNumber, paymentType, amount, status = 'Paid', date, time, validUntil, vehicleType, amountTendered, receiptNo, receivedBy, receivedByName, docsVerified, licenseExpiry, consentAt, privacyNoticeVersion }) {
  return validatePayment({
    rfidId,
    name,
    department,
    plateNumber,
    paymentType,
    amount,
    status,
    date,
    time,
    validUntil,
    vehicleType,
    amountTendered,
    receiptNo,
    receivedBy,
    receivedByName,
    docsVerified,
    licenseExpiry,
    consentAt,
    privacyNoticeVersion,
    timestamp: Date.now()
  })
}

export function listenToPayments(callback) {
  return onValue(ref(rtdb, 'payments'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const payments = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
    callback(payments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  })
}

// Phase 12 barrier gate control: two independent barriers (Entrance/Exit), each writing
// only its own settings/app/gateStatus/{gateId} leaf (never the whole settings/app node,
// so this can never clobber appName/campus/etc). System Settings's manual override buttons
// are the only current writer; a physical ESP32 relay controller per gate would read this
// same path the way the RFID scanner already reads/writes gateLogs - via its own legacy
// database secret, which bypasses database.rules.json entirely (see CLAUDE.md's hardware
// note), so no rules change is needed to make this "readable" by hardware.
export async function setGateStatus(gateId, state, actor = {}) {
  if (!GATE_IDS.includes(gateId)) throw new Error(`Unknown gate "${gateId}"`)
  await set(ref(rtdb, `settings/app/gateStatus/${gateId}`), validateGateStatus({
    state,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
    updatedByName: actor.email,
  }))
}

export function listenToGateStatus(gateId, callback) {
  return onValue(ref(rtdb, `settings/app/gateStatus/${gateId}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

// devices/scanner/{ready,updatedAt} - published by sketch_scanner.ino once its local RFID
// authorization cache has synced at least once (see its publishScannerReady()). Right after a
// fresh boot every scan is denied until that first sync lands (a few minutes), with no visual
// way to tell "still warming up" from "something's wrong" - this lets the Dashboard show that
// state instead of staff just not knowing why a real card isn't working yet.
export function listenToScannerStatus(callback) {
  return onValue(ref(rtdb, 'devices/scanner'), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

// devices/camera - { ip, lastSeen }. The ESP32-CAM (CameraWebServer.ino) refreshes lastSeen
// (Firebase server time) every ~30 s; see hooks/useDeviceStatus.js for Online/Offline.
export function listenToCameraStatus(callback) {
  return onValue(ref(rtdb, 'devices/camera'), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

// Difference between Firebase's server clock and this browser's, so a device's server-
// timestamped lastSeen can be compared with "now" even if the PC clock is off.
export function listenToServerTimeOffset(callback) {
  return onValue(ref(rtdb, '.info/serverTimeOffset'), (snapshot) => callback(snapshot.val() || 0))
}

// devices/scanner/lastScan - published by sketch_scanner.ino for every valid (non-noise)
// tap, regardless of authorization or the gate's own audit-log cooldown. A UI "tap to
// capture" step (registration, VIP check-in, the admin edit form's re-scan field) needs to
// see a brand-new, not-yet-registered card's tap immediately - gateLogs can never carry
// that anymore now that it only ever receives AUTHORIZED scans, since a brand-new card has
// no way to be "authorized" yet by definition. See useRfidScanner.js, the one place that
// reads this.
export function listenToScannerLastScan(callback) {
  return onValue(ref(rtdb, 'devices/scanner/lastScan'), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

export async function saveAdminProfile(uid, profile) {
  await set(ref(rtdb, `adminProfiles/${uid}`), validateAdminProfile(profile))
}

export function listenToAdminProfile(uid, callback) {
  return onValue(ref(rtdb, `adminProfiles/${uid}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

// Super Admin only (enforced by database.rules.json - a non-Super-Admin's read of the
// whole adminProfiles tree is denied). Powers Account Management's staff/role list.
export function listenToAllAdminProfiles(callback) {
  return onValue(ref(rtdb, 'adminProfiles'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }
    callback(Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value })))
  })
}

// Super Admin only (enforced server-side). Changes another staff member's role -
// writes the full profile object, not just the role leaf, since adminProfiles/{uid}'s
// own .validate requires hasChildren(['fullName','email','role','status']) on every write.
export async function setAdminRole(uid, role, currentProfile) {
  await set(ref(rtdb, `adminProfiles/${uid}`), validateAdminProfile({ ...currentProfile, role }))
}

// ---- Signup approval flow -------------------------------------------------------------
// A new signup is stored as status 'Pending' (with the role they asked for in
// `requestedRole`) and can do nothing until an admin approves it. database.rules.json is
// the real gate - these helpers are just the client side of the same rules.

// Admin-only. A query-scoped read: Administrators may read *only* the Pending slice of
// adminProfiles (rules allow that exact query), Super Admins may read everything.
export function listenToPendingProfiles(callback) {
  const pendingQuery = query(ref(rtdb, 'adminProfiles'), orderByChild('status'), equalTo('Pending'))
  return onValue(
    pendingQuery,
    (snapshot) => {
      callback(snapshot.exists() ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })) : [])
    },
    () => callback([]),
  )
}

// Targeted update (never a full set) so approving can't clobber the rest of the profile.
export async function approveAdminProfile(uid, role) {
  if (!ROLES.includes(role)) throw new Error(`Cannot approve: unknown role "${role}"`)
  await update(ref(rtdb, `adminProfiles/${uid}`), { role, status: 'Active' })
}

// Super Admin only (rules: a non-Pending status can only be changed by a Super Admin).
// Inactive = the account can still sign in to Firebase Auth but is locked out of every
// database path and bounced to /pending by RequireAuth; Active restores access.
export async function setAdminStatus(uid, status) {
  if (!['Active', 'Inactive'].includes(status)) throw new Error(`Cannot set status "${status}"`)
  await update(ref(rtdb, `adminProfiles/${uid}`), { status })
}

// Deletes the profile record only - a client can't delete someone else's Firebase Auth login
// (that needs the Admin SDK). Used by a Super Admin to remove a declined/deactivated account,
// and by the account owner via services/auth.js#deleteOwnAccount (rules: owner or Super Admin).
export async function deleteAdminProfile(uid) {
  await remove(ref(rtdb, `adminProfiles/${uid}`))
}

export async function rejectAdminProfile(uid) {
  await update(ref(rtdb, `adminProfiles/${uid}`), { status: 'Inactive' })
}

// Called by the signed-in user themself once Firebase Auth reports their email verified.
// Rules only accept `true` when the auth token itself says email_verified.
export async function markProfileEmailVerified(uid) {
  await update(ref(rtdb, `adminProfiles/${uid}`), { emailVerified: true })
}

// After a confirmed email change (services/auth.js#requestEmailChange) Firebase Auth holds the
// new address; this brings the profile's display copy in line. Targeted leaf update only.
export async function syncProfileEmail(uid, email) {
  await update(ref(rtdb, `adminProfiles/${uid}`), { email })
}

// ---- Imported registrations (Google Forms) ----------------------------------------------
// registrations/{id} = an applicant who is not a card holder yet (models/registration.js);
// registrationKeys/{encoded key} = id, one per Student ID / email (or name fallback), written in the
// SAME update as the registration - database.rules.json refuses a key that already points at a
// different registration, so a duplicate can't be created even by a second import running at once.
// Admin-only (rules). Nothing here marks anyone Paid or Active: activation goes through the existing
// Payment registration (usePaymentRegistration), then markRegistrationActive links the result.

const IMPORT_CHUNK = 50 // rows per atomic update - well inside RTDB's write limits

export function listenToRegistrations(callback) {
  return onValue(ref(rtdb, 'registrations'), (snapshot) => {
    const rows = Object.entries(snapshot.val() || {}).map(([id, v]) => ({ id, ...v }))
    callback(rows.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0)))
  }, () => callback([]))
}

// encoded key -> registration id, for duplicate checks before an import.
export async function getRegistrationKeys() {
  return (await get(ref(rtdb, 'registrationKeys'))).val() || {}
}

function actorFields() {
  return { updatedAt: Date.now(), updatedBy: auth.currentUser?.uid || '' }
}

// rows: preview rows from utils/registrationImport.js#buildImportPreview (valid/incomplete only).
// Returns { imported: [rowNumber], failed: [{ rowNumber, error }] }. A chunk that fails as a whole
// (e.g. someone imported the same person a second earlier) is retried row by row, so one bad row
// never blocks the others and nothing is left half-written.
export async function importRegistrations(rows, { fileName, actorName }) {
  assertOnline('importing registrations')
  const uid = auth.currentUser?.uid || ''
  const batchId = push(ref(rtdb, 'registrations')).key
  const now = Date.now()
  const writesFor = (row) => {
    const id = push(ref(rtdb, 'registrations')).key
    const updates = {
      [`registrations/${id}`]: {
        ...registrationFieldValues(row.values),
        status: 'Pending Review',
        // The untouched submission: the sheet row as written + the fields as first imported.
        originalJson: JSON.stringify({ columns: row.original, fields: registrationFieldValues(row.values) }),
        importedAt: now,
        importedBy: uid,
        importedByName: actorName || '',
        importBatchId: batchId,
        sourceFile: (fileName || '').slice(0, 120),
        sourceRow: row.rowNumber,
        ...actorFields(),
      },
    }
    row.keys.forEach((k) => { updates[`registrationKeys/${encodeKey(k)}`] = id })
    return updates
  }

  const imported = []
  const failed = []
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK)
    const perRow = chunk.map(writesFor)
    try {
      await update(ref(rtdb), Object.assign({}, ...perRow))
      imported.push(...chunk.map((r) => r.rowNumber))
    } catch {
      for (let j = 0; j < chunk.length; j++) {
        try {
          await update(ref(rtdb), perRow[j])
          imported.push(chunk[j].rowNumber)
        } catch (err) {
          failed.push({ rowNumber: chunk[j].rowNumber, error: err?.code === 'PERMISSION_DENIED' || /permission/i.test(err?.message || '') ? 'Already imported (duplicate Student ID or email)' : getErrorMessage(err, 'Could not be saved') })
        }
      }
    }
  }
  return { imported, failed, batchId }
}

// Save corrected fields (and optionally a new processing status). Keeps registrationKeys in step
// with a changed Student ID / email, refusing one that another registration already uses.
export async function updateRegistration(registration, values, { status } = {}) {
  assertOnline('saving the registration')
  const oldKeys = registration.fullName ? registrationKeys(registration) : []
  const newKeys = registrationKeys(values)
  const updates = {}
  for (const k of newKeys.filter((k) => !oldKeys.includes(k))) {
    const owner = (await get(ref(rtdb, `registrationKeys/${encodeKey(k)}`))).val()
    if (owner && owner !== registration.id) {
      throw new Error(`Another imported registration already uses this ${k.startsWith('sid:') ? 'Student ID' : k.startsWith('email:') ? 'email' : 'name'}.`)
    }
    updates[`registrationKeys/${encodeKey(k)}`] = registration.id
  }
  oldKeys.filter((k) => !newKeys.includes(k)).forEach((k) => { updates[`registrationKeys/${encodeKey(k)}`] = null })
  const base = `registrations/${registration.id}`
  Object.entries({ ...registrationFieldValues(values), ...actorFields() }).forEach(([k, v]) => { updates[`${base}/${k}`] = v })
  if (status && status !== registration.status) Object.assign(updates, statusWrites(base, status))
  await update(ref(rtdb), updates)
}

function statusWrites(base, status) {
  const uid = auth.currentUser?.uid || ''
  const writes = { [`${base}/status`]: status, [`${base}/updatedAt`]: Date.now(), [`${base}/updatedBy`]: uid }
  if (status === 'Approved') Object.assign(writes, { [`${base}/approvedAt`]: Date.now(), [`${base}/approvedBy`]: uid })
  if (status === 'Rejected') Object.assign(writes, { [`${base}/rejectedAt`]: Date.now(), [`${base}/rejectedBy`]: uid })
  return writes
}

// An activated registration whose owner record was deleted goes back to Approved with no card, so
// it can be carded and activated again (the rules allow Active -> Approved only in that case).
export async function reopenRegistration(registration) {
  assertOnline('reopening the registration')
  const base = `registrations/${registration.id}`
  await update(ref(rtdb), { ...statusWrites(base, 'Approved'), [`${base}/rfidUserId`]: null })
}

export async function setRegistrationStatus(registration, status) {
  assertOnline('changing the registration status')
  await update(ref(rtdb), statusWrites(`registrations/${registration.id}`, status))
}

// Links a physical card to the applicant. Creates their rfidUsers record as INACTIVE - the ESP32
// refuses an Inactive card, so the card is reserved but opens nothing until the Payment step
// activates it. Refuses a card that someone holds now or that is reserved for another applicant.
// `replace` = swap the card on a not-yet-activated assignment (the caller confirms first).
export async function assignRegistrationCard(registration, rfidId, users, { replace = false } = {}) {
  assertOnline('assigning the RFID card')
  const card = (rfidId || '').trim()
  if (!isValidRfid(card)) throw new Error('That RFID looks invalid - scan the card again.')
  assertNotEmergencyCard(card)
  const current = registration.rfidUserId ? users.find((u) => u.id === registration.rfidUserId) : null
  if (current && (current.status || 'Active') === 'Active') throw new Error('This registration is already activated - change its card from the owner record (Edit).')
  if (current && !replace) throw new Error('A card is already assigned - confirm replacing it.')

  const holder = currentHolder(users, card)
  if (holder && holder.id !== current?.id) throw new Error(`Card ${card} is in use by ${holder.name || 'another owner'}.`)
  const reserved = users.find((u) => u.id !== current?.id && u.registrationId && u.registrationId !== registration.id
    && (u.rfidId || '').toLowerCase() === card.toLowerCase() && (u.status || 'Active') !== 'Active' && !u.returnedAt)
  if (reserved) throw new Error(`Card ${card} is already assigned to ${reserved.name} (not activated yet).`)

  if (current) {
    await update(ref(rtdb), { [`rfidUsers/${current.id}/rfidId`]: card, ...registrationTouch(registration.id) })
    return current.id
  }
  const ownerRef = push(ref(rtdb, 'rfidUsers'))
  const owner = validateRfidUser({
    name: registration.fullName,
    rfidId: card,
    plateNumber: registration.plateNumber,
    vehicleType: registration.vehicleType || 'Car',
    vehicleColor: registration.vehicleColor,
    vehicleBrand: registration.vehicleBrand,
    department: registration.department || registration.course,
    role: registration.role || 'Student',
    email: registration.email,
    phone: registration.phone,
    status: 'Inactive',
    createdAt: Date.now(),
    registrationId: registration.id,
    studentId: registration.studentId,
  })
  await update(ref(rtdb), {
    [`rfidUsers/${ownerRef.key}`]: owner,
    [`registrations/${registration.id}/rfidUserId`]: ownerRef.key,
    ...registrationTouch(registration.id),
  })
  return ownerRef.key
}

// Takes a not-yet-activated card back (the reserved Inactive record is removed - it never opened
// anything and has no payments).
export async function unassignRegistrationCard(registration, users) {
  assertOnline('removing the RFID card')
  const current = users.find((u) => u.id === registration.rfidUserId)
  if (current && (current.status || 'Active') === 'Active') throw new Error('This registration is already activated - its card is managed from the owner record.')
  await update(ref(rtdb), {
    ...(current ? { [`rfidUsers/${current.id}`]: null } : {}),
    [`registrations/${registration.id}/rfidUserId`]: null,
    ...registrationTouch(registration.id),
  })
}

function registrationTouch(id) {
  return { [`registrations/${id}/updatedAt`]: Date.now(), [`registrations/${id}/updatedBy`]: auth.currentUser?.uid || '' }
}

// After the Payment registration made the owner record Active (paid, card scanned, documents and
// consent recorded): mark the registration Active and link both ways. The rules accept 'Active' only
// when that rfidUsers record really is Active.
// releaseOwner: the card reserved earlier, when a different card was scanned at payment - its
// Inactive placeholder is removed in the same update so it doesn't keep that card reserved.
export async function markRegistrationActive(registration, rfidUserId, { releaseOwner = null } = {}) {
  const base = `registrations/${registration.id}`
  const release = releaseOwner && releaseOwner.id !== rfidUserId && (releaseOwner.status || 'Active') !== 'Active'
  await update(ref(rtdb), {
    ...(release ? { [`rfidUsers/${releaseOwner.id}`]: null } : {}),
    ...statusWrites(base, 'Active'),
    [`${base}/rfidUserId`]: rfidUserId,
    [`${base}/activatedAt`]: Date.now(),
    [`${base}/activatedBy`]: auth.currentUser?.uid || '',
    [`rfidUsers/${rfidUserId}/registrationId`]: registration.id,
    ...(registration.studentId ? { [`rfidUsers/${rfidUserId}/studentId`]: registration.studentId } : {}),
  })
}

// ---- VIP pre-clearance (expectedGuests) ------------------------------------------------
// An Administrator enters a guest ahead of time (createExpectedGuest); any staff role can
// then check them in/out at the gate (checkInGuest/checkOutGuest) without the admin's
// involvement. database.rules.json enforces that split - a guard's write may only move
// status Expected->Arrived->Departed and touch the check-in fields, never the guest's core
// details or Cancelled.

export async function createExpectedGuest(data, actor) {
  const guestRef = push(ref(rtdb, 'expectedGuests'))
  await set(guestRef, validateExpectedGuest({
    ...data,
    name: toCaps(data.name), // ALL CAPS on create only - check-in must leave it unchanged (rules)
    status: 'Expected',
    createdBy: actor?.uid || '',
    createdByName: actor?.name || '',
    createdAt: Date.now(),
  }))
  return guestRef.key
}

export function listenToExpectedGuests(callback) {
  return onValue(ref(rtdb, 'expectedGuests'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }
    const guests = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
    callback(guests.sort((a, b) => (a.validFrom || 0) - (b.validFrom || 0)))
  })
}

// Admin only (rules): withdraws a pre-clearance that hasn't arrived (or was mistaken) rather
// than deleting it, so there's still a record of what was cancelled and by whom.
export async function cancelExpectedGuest(id) {
  const snap = await get(ref(rtdb, `expectedGuests/${id}`))
  if (!snap.exists()) throw new Error('Guest entry not found.')
  await set(ref(rtdb, `expectedGuests/${id}`), validateExpectedGuest({ ...snap.val(), status: 'Cancelled' }))
}

// Admin only (rules): moves a not-yet-arrived guest's arrival window (they're coming earlier
// or later than planned). Everything else on the entry stays as it was.
export async function updateExpectedGuestWindow(id, { validFrom, validUntil }) {
  const snap = await get(ref(rtdb, `expectedGuests/${id}`))
  if (!snap.exists()) throw new Error('Guest entry not found.')
  const guest = snap.val()
  if (guest.status !== 'Expected') throw new Error('Only a guest who has not arrived yet can be rescheduled.')
  await set(ref(rtdb, `expectedGuests/${id}`), validateExpectedGuest({ ...guest, validFrom, validUntil }))
}

// Any staff role (rules restrict this to only the Expected->Arrived transition plus the
// check-in fields below - see database.rules.json). Issues the guest a temporary visitor-
// shaped rfidUsers pass, the same one a walk-in visitor gets, valid until the guest's window
// closes, then marks them Arrived. No payment is recorded - VIP guests don't pay this fee.
//
// Does NOT log an IN: like a walk-in visitor pass, the guest's own card scan at the gate
// opens the entry barrier and logs the IN (sketch_scanner.ino). The pass carries guestId so
// that scanner can also mark this guest Departed when the card scans OUT.
export async function checkInGuest(id, { rfidId, plateNumber, vehicleType }, actor, onWarning) {
  assertOnline('checking in a guest')
  const snap = await get(ref(rtdb, `expectedGuests/${id}`))
  if (!snap.exists()) throw new Error('Guest entry not found.')
  const guest = snap.val()

  await registerRfidUser({
    name: guest.name,
    rfidId,
    plateNumber: plateNumber || guest.plateNumber,
    vehicleType: vehicleType || guest.vehicleType,
    department: '',
    role: 'Visitor',
    email: '',
    phone: '',
    expiresAt: guest.validUntil,
    hostName: guest.hostName,
    purpose: [guest.category, guest.purpose].filter(Boolean).join(' - '),
    guestId: id,
  })

  await set(ref(rtdb, `expectedGuests/${id}`), validateExpectedGuest({
    ...guest,
    status: 'Arrived',
    rfidId,
    plateNumber: plateNumber || guest.plateNumber,
    vehicleType: vehicleType || guest.vehicleType,
    arrivedAt: Date.now(),
    checkedInBy: actor?.name || '',
  }))

  // No IN is logged here: the guest enters by scanning the card at the gate, which opens
  // the entry barrier and logs the IN (with its photo). SYNC just makes the scanner pick
  // the new pass up immediately.
  try {
    await sendScannerCommand('SYNC', { cardId: rfidId, actor })
  } catch (cmdError) {
    onWarning?.(`Guest checked in, but the scanner could not be refreshed - the first tap may take a few seconds: ${getErrorMessage(cmdError, '')}`)
  }
}

// Any staff role. Manual check-out (the guest leaves without scanning): returns the pass
// through returnTemporaryPass - OUT logged if they're inside, pass deactivated with
// returnedAt, exit barrier opened - then marks the guest Departed. Nothing to return (an
// admin deleted the record, or the guest's OUT scan already returned it) is fine.
export async function checkOutGuest(id, onWarning, actor) {
  assertOnline('checking out a guest')
  const snap = await get(ref(rtdb, `expectedGuests/${id}`))
  if (!snap.exists()) throw new Error('Guest entry not found.')
  const guest = snap.val()

  if (guest.rfidId) {
    const usersSnap = await get(ref(rtdb, 'rfidUsers'))
    const users = usersSnap.exists() ? Object.entries(usersSnap.val() || {}).map(([key, v]) => ({ id: key, ...v })) : []
    // This guest's own pass (guestId), else the card's current holder - never just the
    // first record for a pooled card, which could be a long-gone visitor's.
    const pass = users.find((u) => u.guestId === id && (u.status || 'Active') === 'Active')
      || currentHolder(users, guest.rfidId)
    if (pass) {
      await returnTemporaryPass(pass, { source: 'vip-checkout', actor, onWarning })
    }
  }

  await set(ref(rtdb, `expectedGuests/${id}`), validateExpectedGuest({ ...guest, status: 'Departed', departedAt: Date.now() }))
}

export default app
