// Firebase v9 modular SDK setup
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, set, update, push, get, remove, query, orderByChild, equalTo, onValue, onChildAdded, runTransaction } from 'firebase/database'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { validateGateLog } from '../models/gateLog'
import { validateRfidUser } from '../models/rfidUser'
import { validatePayment } from '../models/payment'
import { validateAdminProfile } from '../models/adminProfile'
import { validateAppSettings, validateGateStatus, GATE_IDS } from '../models/appSettings'
import { validateSystemUser } from '../models/systemUser'
import { validateExpectedGuest } from '../models/expectedGuest'
import { ROLES } from '../constants/roles'
import { getErrorMessage } from '../utils/errors'

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

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

export async function registerRfidUser({ name, rfidId, plateNumber, vehicleType, department, role, email, phone, expiresAt, hostName, purpose }) {
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existingUsers = snapshot.exists() ? Object.values(snapshot.val() || {}) : []

  if (existingUsers.some((user) => user.rfidId === rfidId)) {
    throw new Error('This RFID ID is already registered.')
  }

  const newUserRef = push(usersRef)
  await set(newUserRef, validateRfidUser({ name, rfidId, plateNumber, vehicleType, department, role, email, phone, expiresAt, hostName, purpose, createdAt: Date.now() }))

  return newUserRef.key
}

// Used by the Payment flow: a successful payment registers the card if it's new,
// or refreshes its details if it's a renewal — unlike registerRfidUser, it never
// throws on an existing RFID since renewals are expected to already be registered.
export async function upsertRfidUser({ rfidId, name, department, plateNumber, vehicleType, vehicleColor, role, email, phone }) {
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existing = snapshot.exists() ? Object.entries(snapshot.val() || {}) : []
  const match = existing.find(([, value]) => (value.rfidId || '').toString().toLowerCase() === (rfidId || '').toString().toLowerCase())

  if (match) {
    const [id, value] = match
    const finalRole = role || value.role
    const staysVisitor = finalRole === 'Visitor'
    await set(ref(rtdb, `rfidUsers/${id}`), validateRfidUser({
      ...value,
      name: name || value.name,
      department: department || value.department,
      plateNumber: plateNumber || value.plateNumber,
      vehicleType: vehicleType || value.vehicleType,
      vehicleColor: vehicleColor || value.vehicleColor,
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
    }))
    return id
  }

  const newUserRef = push(usersRef)
  await set(newUserRef, validateRfidUser({ name, rfidId, plateNumber, vehicleType, vehicleColor, department, role, email, phone, createdAt: Date.now() }))

  return newUserRef.key
}

// Account Management: edits an existing record's own fields (keeps createdAt/status
// unless explicitly overridden). Deleting/deactivating are separate, more restricted
// operations below — see database.rules.json for why they're split out.
export async function updateRfidUser(id, patch) {
  const existingSnap = await get(ref(rtdb, `rfidUsers/${id}`))
  if (!existingSnap.exists()) throw new Error('RFID user not found.')

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

// Vehicle snapshot images (Firebase Storage). The ESP32-CAM (once wired up) would
// eventually upload directly to this same `vehicle-snapshots/{rfidUserId}/...` path
// and PATCH the resulting URL onto the matching gateLogs entry - this function is
// the placeholder for that, driven by the web mock selector/uploader in the meantime.
export async function uploadVehicleSnapshot(file, { gateLogId, rfidUserId } = {}) {
  if (!file) throw new Error('No image file provided.')
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max 5MB).')
  }

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

export async function recordPayment({ rfidId, name, department, plateNumber, paymentType, amount, status = 'Paid', date, time, validUntil, vehicleType, amountTendered, receiptNo, receivedBy, receivedByName, docsVerified, licenseExpiry, consentAt, privacyNoticeVersion }) {
  const paymentRef = push(ref(rtdb, 'payments'))
  await set(paymentRef, validatePayment({
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
  }))

  return paymentRef.key
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

// ---- Account lockout (5 failed sign-ins) -----------------------------------------------
// The counter/lock itself lives server-side in functions/index.js (Admin SDK - RTDB rules
// require auth != null on every path, so an unauthenticated client can't write it itself).
// These are just the client's read of the locked slice and its call into the unlock action.

// Admin-only read, same query-scoped pattern as listenToPendingProfiles - Administrators
// may read only the Locked slice of adminProfiles (rules allow that exact query), Super
// Admins may read everything.
export function listenToLockedProfiles(callback) {
  const lockedQuery = query(ref(rtdb, 'adminProfiles'), orderByChild('status'), equalTo('Locked'))
  return onValue(
    lockedQuery,
    (snapshot) => {
      callback(snapshot.exists() ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })) : [])
    },
    () => callback([]),
  )
}

// Re-enables the Firebase Auth login and restores the profile's prior status. Authorization
// (caller must be an active Administrator/Super Admin) is enforced inside the Function
// itself, since its Admin SDK writes bypass database.rules.json entirely.
export async function unlockAdminAccount(uid) {
  const unlockAccount = httpsCallable(functions, 'unlockAccount')
  await unlockAccount({ uid })
}

// Called by the signed-in user themself once Firebase Auth reports their email verified.
// Rules only accept `true` when the auth token itself says email_verified.
export async function markProfileEmailVerified(uid) {
  await update(ref(rtdb, `adminProfiles/${uid}`), { emailVerified: true })
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

// Any staff role (rules restrict this to only the Expected->Arrived transition plus the
// check-in fields below - see database.rules.json). Issues the guest a temporary visitor-
// shaped rfidUsers pass, the same one a walk-in visitor gets, valid until the guest's window
// closes, then marks them Arrived. No payment is recorded - VIP guests don't pay this fee.
//
// Also logs the IN gate scan (the guest is entering campus right now, same reasoning as
// RegisterRfidModal's walk-in visitor flow) and returns its logId so the caller can trigger
// the camera - kept in the caller (CheckInGuestModal) rather than here to avoid importing
// services/camera.js into this file, which imports rtdb from here (circular import).
// Non-fatal: the pass itself is already issued even if this log write fails.
export async function checkInGuest(id, { rfidId, plateNumber, vehicleType }, actor, onWarning) {
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

  let logId = null
  try {
    logId = await logGateEntry({ cardId: rfidId, direction: 'IN', source: 'vip-checkin' })
  } catch (scanError) {
    console.warn('VIP guest checked in, but the gate entry could not be logged:', scanError)
    onWarning?.(`Guest checked in, but today's gate entry could not be recorded: ${getErrorMessage(scanError, 'please log it manually.')}`)
  }
  return logId
}

// Any staff role. Returns the temporary pass issued at check-in (best-effort - an admin who
// deleted rfidUsers records in between just means there's nothing left to deactivate) and
// marks the guest Departed. Also logs the OUT gate scan for the same card - functions/
// index.js#backfillExitSnapshot picks this up automatically and reuses the guest's IN photo,
// the same as any other OUT scan. Non-fatal: the guest is already checked out either way.
export async function checkOutGuest(id, onWarning) {
  const snap = await get(ref(rtdb, `expectedGuests/${id}`))
  if (!snap.exists()) throw new Error('Guest entry not found.')
  const guest = snap.val()

  if (guest.rfidId) {
    const usersSnap = await get(ref(rtdb, 'rfidUsers'))
    const match = usersSnap.exists()
      ? Object.entries(usersSnap.val() || {}).find(([, v]) => (v.rfidId || '').toString().toLowerCase() === guest.rfidId.toString().toLowerCase())
      : null
    if (match) await set(ref(rtdb, `rfidUsers/${match[0]}/status`), 'Inactive')

    try {
      await logGateEntry({ cardId: guest.rfidId, direction: 'OUT', source: 'vip-checkout' })
    } catch (scanError) {
      console.warn('VIP guest checked out, but the gate exit could not be logged:', scanError)
      onWarning?.(`Guest checked out, but the gate exit could not be recorded: ${getErrorMessage(scanError, 'please log it manually.')}`)
    }
  }

  await set(ref(rtdb, `expectedGuests/${id}`), validateExpectedGuest({ ...guest, status: 'Departed', departedAt: Date.now() }))
}

export default app
