// Long-stay warnings: flags a person whose last recorded gate scan is an IN older than the
// allowed stay for their category, so management can follow up. Based only on recorded
// gateLogs IN/OUT scans - it says "no exit recorded", never "still on campus" (a missed OUT
// scan looks exactly the same).
//
//   settings/longStay        admin-edited thresholds (src/models/longStay.js, rules-validated)
//   longStayAlerts/{inLogId} one warning per visit, keyed by the visit's IN gateLogs id, so a
//                            visit can never get two. Written only here (Admin SDK); any active
//                            staff may only add acknowledgedAt/By/Name (database.rules.json). Resolved
//                            warnings are kept as history.
//
// checkLongStays (scheduled, every 5 min) creates and resolves warnings and sends the optional
// SMS; resolveLongStayOnScan resolves a warning the moment its exit (or a new entry) is logged.
// Both are in index.js; everything they decide is in the pure functions below (longStay.test.js).

const { holderAtTime, normalizeCardId } = require('./cardHolder')

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

// HAND-COPY of src/models/longStay.js LONG_STAY_DEFAULTS / LONG_STAY_LIMITS - keep in sync.
// Defaults are placeholders until the campus sets a policy (used while settings/longStay is unset).
const LONG_STAY_DEFAULTS = {
  enabled: true,
  registeredHours: 12,
  visitorHours: 4,
  vipHours: 8,
  repeatMinutes: 0,
  smsEnabled: false,
  smsRecipients: '',
}
const LIMITS = { minHours: 0.5, maxHours: 72, minRepeatMinutes: 30, maxRepeatMinutes: 1440 }
const PHONE_LIST_PATTERN = /^09\d{9}(,09\d{9}){0,4}$/

// A second IN for the same holder within this window is the reader seeing the tag twice, not
// a new visit (the firmware's own cooldown is 3 s; this also covers a buffered offline copy).
const DUPLICATE_SCAN_WINDOW_MS = 2 * MINUTE_MS
// Only scans from the last 7 days are read each run - the longest allowed stay is 72 h, and an
// IN older than this with no OUT is a missed exit that was already flagged when it was newer.
const LOOKBACK_MS = 7 * 24 * HOUR_MS
// At most this many texts per warning (first + repeats), whatever the repeat interval.
const MAX_SMS_PER_ALERT = 3

function normalizeSettings(raw) {
  const s = { ...LONG_STAY_DEFAULTS, ...(raw || {}) }
  const hours = (value, fallback) =>
    (typeof value === 'number' && value >= LIMITS.minHours && value <= LIMITS.maxHours ? value : fallback)
  const repeatMinutes = s.repeatMinutes === 0
    || (typeof s.repeatMinutes === 'number' && s.repeatMinutes >= LIMITS.minRepeatMinutes && s.repeatMinutes <= LIMITS.maxRepeatMinutes)
    ? s.repeatMinutes : 0
  const recipients = typeof s.smsRecipients === 'string' && PHONE_LIST_PATTERN.test(s.smsRecipients)
    ? s.smsRecipients.split(',') : []
  return {
    enabled: s.enabled !== false,
    thresholdsMs: {
      registered: hours(s.registeredHours, LONG_STAY_DEFAULTS.registeredHours) * HOUR_MS,
      visitor: hours(s.visitorHours, LONG_STAY_DEFAULTS.visitorHours) * HOUR_MS,
      vip: hours(s.vipHours, LONG_STAY_DEFAULTS.vipHours) * HOUR_MS,
    },
    repeatMs: repeatMinutes * MINUTE_MS,
    smsEnabled: s.smsEnabled === true && recipients.length > 0,
    smsRecipients: recipients,
  }
}

// registered = Student/Faculty/Staff; visitor = walk-in pass; vip = pass issued at VIP check-in.
function categoryOf(holder) {
  if (holder.role === 'Visitor') return holder.guestId ? 'vip' : 'visitor'
  return 'registered'
}

const directionOf = (scan) => ((scan.direction || 'IN').toString().trim().toUpperCase() === 'OUT' ? 'OUT' : 'IN')
// Same per-card key as src/hooks/useGateStats.js.
const scanCardKey = (scan) => normalizeCardId(scan.cardId ?? scan.cardHex)

// Splits every card's scans into visits, oldest first. Visits belong to the card's holder at
// the IN (pooled visitor cards change hands). A visit ends with:
//   exit          the holder's next OUT
//   reentry       a later IN by the same holder (the OUT in between was never scanned)
//   card-reissued a scan by a different holder of the card
//   pass-returned the visitor pass was returned (returnedAt) with no OUT logged
// Scans that belong to nobody (unregistered/garbage reads), duplicate INs and OUTs with no open
// visit (a repeated OUT) are ignored. Sorting by timestamp handles offline scans uploaded late.
function buildVisits(logs, users) {
  const byCard = new Map()
  for (const log of logs) {
    if (typeof log.timestamp !== 'number') continue
    const key = scanCardKey(log)
    if (!key) continue
    if (!byCard.has(key)) byCard.set(key, [])
    byCard.get(key).push(log)
  }

  const visits = []
  for (const [cardKey, scans] of byCard) {
    scans.sort((a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id)))
    let open = null
    const close = (reason, at = null, logId = null) => {
      open.closedBy = { reason, at, logId }
      open = null
    }

    for (const scan of scans) {
      const holder = holderAtTime(users, scan.cardId, scan.cardHex, scan.timestamp)
      if (!holder) continue
      if (open && open.holder.id !== holder.id) close('card-reissued', scan.timestamp, scan.id)

      if (directionOf(scan) === 'IN') {
        if (open) {
          if (scan.timestamp - open.lastInAt <= DUPLICATE_SCAN_WINDOW_MS) {
            open.lastInAt = scan.timestamp
            continue
          }
          close('reentry', scan.timestamp, scan.id)
        }
        open = { cardKey, holder, entry: scan, lastInAt: scan.timestamp, closedBy: null }
        visits.push(open)
      } else if (open) {
        close('exit', scan.timestamp, scan.id)
      }
    }

    const returnedAt = open?.holder.returnedAt
    if (open && typeof returnedAt === 'number' && returnedAt >= open.entry.timestamp) close('pass-returned', returnedAt)
  }
  return visits
}

// Open visits past their category's allowed stay at `now`.
function findLongStays(visits, settings, now) {
  return visits
    .filter((visit) => !visit.closedBy)
    .map((visit) => {
      const category = categoryOf(visit.holder)
      return { visit, category, thresholdMs: settings.thresholdsMs[category] }
    })
    .filter(({ visit, thresholdMs }) => now - visit.entry.timestamp > thresholdMs)
}

// What a newly logged scan means for one active warning on the same card - the same rules as
// buildVisits, for a single scan. `holder` = the card's holder at the scan. null = no change.
function resolutionForScan(alert, scan, holder) {
  if (typeof scan.timestamp !== 'number' || scan.timestamp < alert.entryAt || scan.id === alert.entryLogId) return null
  if (!holder) return null // card unassigned - checkLongStays resolves it via returnedAt
  if (holder.id !== alert.rfidUserId) return { reason: 'card-reissued', at: scan.timestamp, logId: scan.id }
  if (directionOf(scan) === 'OUT') return { reason: 'exit', at: scan.timestamp, logId: scan.id }
  if (scan.timestamp - alert.entryAt > DUPLICATE_SCAN_WINDOW_MS) return { reason: 'reentry', at: scan.timestamp, logId: scan.id }
  return null
}

// RTDB rejects undefined values.
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

function identifierOf(holder, category) {
  if (category !== 'registered') return { identifierLabel: 'Pass card', identifier: holder.rfidId }
  if (holder.studentId) return { identifierLabel: 'Student ID', identifier: holder.studentId }
  if (holder.plateNumber) return { identifierLabel: 'Plate', identifier: holder.plateNumber }
  return { identifierLabel: 'RFID', identifier: holder.rfidId }
}

function buildAlert({ visit, category, thresholdMs }, now, smsEnabled) {
  const h = visit.holder
  return compact({
    status: 'active',
    entryLogId: visit.entry.id,
    entryAt: visit.entry.timestamp,
    entryTimeApprox: visit.entry.timeApprox === true ? true : undefined,
    cardKey: visit.cardKey,
    rfidId: h.rfidId,
    rfidUserId: h.id,
    name: h.name || 'Unknown',
    role: h.role,
    category,
    ...identifierOf(h, category),
    plateNumber: h.plateNumber,
    vehicleType: h.vehicleType,
    hostName: category === 'registered' ? undefined : h.hostName,
    thresholdMs,
    createdAt: now,
    sms: { status: smsEnabled ? 'pending' : 'off', count: 0 },
  })
}

const toList = (snapshot) => {
  const rows = []
  snapshot.forEach((child) => { rows.push({ id: child.key, ...(child.val() || {}) }) })
  return rows
}

// Marks a warning resolved, only if it is still active (a transaction, so the scan trigger and
// the scheduled run can't both resolve it or overwrite each other).
async function resolveAlert(db, alertId, { reason, at, logId }, now) {
  const result = await db.ref(`longStayAlerts/${alertId}`).transaction((current) => {
    // null = not loaded yet (the SDK retries with the server's value) or already gone.
    if (current === null) return null
    if (current.status !== 'active') return undefined
    return { ...current, ...compact({ status: 'resolved', resolvedAt: now, resolvedReason: reason, exitAt: at, exitLogId: logId }) }
  })
  return result.committed && result.snapshot.val()?.status === 'resolved'
}

const formatClock = (ms) => new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
const CATEGORY_WORDS = { registered: 'registered user', visitor: 'visitor', vip: 'VIP guest' }

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

// One text per recipient per run, however many warnings are due (rate limits stay meaningful).
function buildSmsMessage(alerts, now) {
  const first = alerts[0]
  const more = alerts.length > 1 ? ` +${alerts.length - 1} more.` : ''
  return `iGATE long-stay warning: ${first.name} (${CATEGORY_WORDS[first.category] || 'person'}) entered ${formatClock(first.entryAt)}, ${formatDuration(now - first.entryAt)} ago, no exit recorded.${more} See the iGATE dashboard.`
}

// The scheduled pass. `sms` = { send({ phone, message }), reserve(db, phone), provider } or null.
async function runLongStayCheck({ db, now = Date.now(), sms = null, logger = console }) {
  const settings = normalizeSettings((await db.ref('settings/longStay').get()).val())
  const [logsSnap, usersSnap, activeSnap] = await Promise.all([
    db.ref('gateLogs').orderByChild('timestamp').startAt(now - LOOKBACK_MS).get(),
    db.ref('rfidUsers').get(),
    db.ref('longStayAlerts').orderByChild('status').equalTo('active').get(),
  ])
  const visits = buildVisits(toList(logsSnap), toList(usersSnap))
  const visitByEntry = new Map(visits.map((visit) => [visit.entry.id, visit]))
  const summary = { created: [], resolved: [], sms: [] }

  // 1. Resolve warnings whose visit has ended.
  const stillActive = []
  for (const alert of toList(activeSnap)) {
    const visit = visitByEntry.get(alert.entryLogId)
    let closedBy = visit?.closedBy || null
    if (!visit) {
      // Outside the lookback window (stays until a scan resolves it) or the IN was deleted.
      if ((await db.ref(`gateLogs/${alert.entryLogId}`).get()).exists()) { stillActive.push(alert); continue }
      closedBy = { reason: 'entry-removed', at: null, logId: null }
    }
    if (!closedBy) { stillActive.push(alert); continue }
    if (await resolveAlert(db, alert.id, closedBy, now)) summary.resolved.push(alert.id)
  }

  // 2. Create one warning per visit past its allowed stay (never a second one for the same IN).
  const created = []
  if (settings.enabled) {
    for (const longStay of findLongStays(visits, settings, now)) {
      const alert = buildAlert(longStay, now, settings.smsEnabled && !!sms)
      const result = await db.ref(`longStayAlerts/${alert.entryLogId}`).transaction((current) => (current ? undefined : alert))
      if (result.committed) created.push({ id: alert.entryLogId, ...alert })
    }
  }
  summary.created = created.map((a) => a.id)

  // 3. Optional SMS: new warnings, plus repeats of unacknowledged ones if a repeat interval is set.
  if (!sms || !settings.smsEnabled) return summary
  const repeats = settings.repeatMs > 0
    ? stillActive.filter((a) => !a.acknowledgedAt && (a.sms?.count || 0) > 0
      && a.sms.count < MAX_SMS_PER_ALERT && now - (a.sms.lastAt || 0) >= settings.repeatMs)
    : []
  const due = [...created, ...repeats]
  if (due.length === 0) return summary

  const message = buildSmsMessage(due, now)
  const results = []
  for (const phone of settings.smsRecipients) {
    let status = 'accepted'
    let errorMessage = null
    let providerResponse = null
    if (!(await sms.reserve(db, phone))) {
      status = 'rate-limited'
    } else {
      try {
        providerResponse = await sms.send({ phone, message })
      } catch (err) {
        status = 'failed'
        errorMessage = err.message
        logger.error(`long-stay SMS to ${phone} failed`, err)
      }
    }
    results.push(status)
    // "accepted" = the provider took the message; neither provider reports delivery back here.
    await db.ref('smsLogs').push({
      kind: 'long-stay',
      alertIds: due.map((a) => a.id),
      phone,
      message,
      status,
      errorMessage,
      semaphoreResponse: providerResponse, // field name shared with sendGateScanSms
      provider: sms.provider,
      sentAt: now,
    })
  }

  const status = results.includes('accepted') ? 'accepted' : results.includes('failed') ? 'failed' : 'rate-limited'
  await Promise.all(due.map((alert) => db.ref(`longStayAlerts/${alert.id}/sms`).set({
    status,
    count: (alert.sms?.count || 0) + 1,
    lastAt: now,
    provider: sms.provider,
    recipients: settings.smsRecipients.length,
  })))
  summary.sms = results
  return summary
}

// Called for every new gateLogs entry: resolves an active warning on that card as soon as its
// exit (or a new entry, or a different holder) is logged.
async function resolveAlertsForScan({ db, scan, now = Date.now() }) {
  const key = scanCardKey(scan)
  if (!key) return []
  const active = toList(await db.ref('longStayAlerts').orderByChild('cardKey').equalTo(key).get())
    .filter((alert) => alert.status === 'active')
  if (active.length === 0) return []

  const users = toList(await db.ref('rfidUsers').get())
  const holder = holderAtTime(users, scan.cardId, scan.cardHex, scan.timestamp)
  const resolved = []
  for (const alert of active) {
    const resolution = resolutionForScan(alert, scan, holder)
    if (resolution && await resolveAlert(db, alert.id, resolution, now)) resolved.push(alert.id)
  }
  return resolved
}

module.exports = {
  LONG_STAY_DEFAULTS,
  DUPLICATE_SCAN_WINDOW_MS,
  LOOKBACK_MS,
  MAX_SMS_PER_ALERT,
  normalizeSettings,
  categoryOf,
  buildVisits,
  findLongStays,
  resolutionForScan,
  buildAlert,
  buildSmsMessage,
  runLongStayCheck,
  resolveAlertsForScan,
}
