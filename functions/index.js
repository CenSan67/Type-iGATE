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

const { onValueCreated } = require('firebase-functions/v2/database')
const { defineSecret, defineString } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')

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

  let found = null
  snapshot.forEach((child) => {
    const value = child.val() || {}
    const rfid = normalizeId(value.rfidId)
    if (rfid && (rfid === cardId || rfid === cardHex)) {
      found = { id: child.key, ...value }
      return true // stop iterating
    }
    return false
  })
  return found
}

function buildMessage({ plateNumber, direction, timestamp }) {
  const verb = direction === 'OUT' ? 'exited' : 'entered'
  const date = new Date(timestamp)
  const dateString = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
  const timeString = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
  return `Notice: Your vehicle ${plateNumber || 'registered under your account'} ${verb} the campus gate at ${timeString} on ${dateString}.`
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
