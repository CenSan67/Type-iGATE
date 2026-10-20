// node --test   (from functions/) - pure long-stay rules, no Firebase needed.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeSettings, buildVisits, findLongStays, resolutionForScan, buildAlert, buildSmsMessage, categoryOf,
} = require('./longStay')

const H = 60 * 60 * 1000
const M = 60 * 1000
const T0 = Date.UTC(2026, 9, 20, 1, 0) // 09:00 Manila

const student = { id: 'u1', name: 'JUAN DELA CRUZ', rfidId: '1001', role: 'Student', createdAt: T0 - 100 * H, studentId: '2021-001' }
const visitor = { id: 'v1', name: 'MARIA SANTOS', rfidId: '2002', role: 'Visitor', createdAt: T0 - H, hostName: 'REGISTRAR' }
const nextVisitor = { id: 'v2', name: 'PEDRO REYES', rfidId: '2002', role: 'Visitor', createdAt: T0 + 3 * H }
const vip = { id: 'g1', name: 'DR. CRUZ', rfidId: '3003', role: 'Visitor', guestId: 'guest1', createdAt: T0 - H }
const users = [student, visitor, vip]
const settings = normalizeSettings(null) // defaults: registered 12 h, visitor 4 h, vip 8 h

const scan = (id, cardId, direction, timestamp, extra = {}) => ({ id, cardId, direction, timestamp, ...extra })

test('defaults apply when no settings are saved, invalid values fall back', () => {
  assert.equal(settings.enabled, true)
  assert.equal(settings.smsEnabled, false)
  assert.deepEqual(settings.thresholdsMs, { registered: 12 * H, visitor: 4 * H, vip: 8 * H })
  const s = normalizeSettings({ visitorHours: 500, repeatMinutes: 5, smsEnabled: true, smsRecipients: 'bad' })
  assert.equal(s.thresholdsMs.visitor, 4 * H)
  assert.equal(s.repeatMs, 0)
  assert.equal(s.smsEnabled, false) // SMS needs valid recipients
})

test('categories', () => {
  assert.equal(categoryOf(student), 'registered')
  assert.equal(categoryOf(visitor), 'visitor')
  assert.equal(categoryOf(vip), 'vip')
})

test('example scenario: visitor in at 9:00, no exit, warned after 4 h', () => {
  const visits = buildVisits([scan('a', '2002', 'IN', T0)], users)
  assert.equal(findLongStays(visits, settings, T0 + 4 * H).length, 0, 'exactly 4 h is not over the limit')
  const found = findLongStays(visits, settings, T0 + 4 * H + M)
  assert.equal(found.length, 1)
  assert.equal(found[0].category, 'visitor')
  assert.equal(found[0].visit.entry.id, 'a')
})

test('exit before the threshold: no warning', () => {
  const visits = buildVisits([scan('a', '1001', 'IN', T0), scan('b', '1001', 'OUT', T0 + 2 * H)], users)
  assert.equal(findLongStays(visits, settings, T0 + 20 * H).length, 0)
  assert.equal(visits[0].closedBy.reason, 'exit')
})

test('exit after the threshold closes the visit', () => {
  const visits = buildVisits([scan('a', '1001', 'IN', T0), scan('b', '1001', 'OUT', T0 + 13 * H)], users)
  assert.equal(findLongStays(visits, settings, T0 + 14 * H).length, 0)
})

test('duplicate IN scans count as one visit from the earliest IN', () => {
  const logs = [scan('a', '1001', 'IN', T0), scan('b', '1001', 'IN', T0 + 3000), scan('c', '1001', 'IN', T0 + 60 * 1000)]
  const visits = buildVisits(logs, users)
  assert.equal(visits.length, 1)
  assert.equal(visits[0].entry.id, 'a')
  assert.equal(findLongStays(visits, settings, T0 + 13 * H).length, 1)
})

test('duplicate OUT scans are ignored', () => {
  const logs = [scan('a', '1001', 'IN', T0), scan('b', '1001', 'OUT', T0 + H), scan('c', '1001', 'OUT', T0 + H + 2000)]
  const visits = buildVisits(logs, users)
  assert.equal(visits.length, 1)
  assert.equal(findLongStays(visits, settings, T0 + 30 * H).length, 0)
})

test('later IN without an OUT starts a new visit; the old one is closed as reentry', () => {
  const logs = [scan('a', '1001', 'IN', T0), scan('b', '1001', 'IN', T0 + 24 * H)]
  const visits = buildVisits(logs, users)
  assert.equal(visits.length, 2)
  assert.equal(visits[0].closedBy.reason, 'reentry')
  assert.equal(findLongStays(visits, settings, T0 + 25 * H).length, 0, 'the new visit is only 1 h old')
})

test('out-of-order upload (offline buffer) is sorted by timestamp', () => {
  const logs = [scan('late-out', '1001', 'OUT', T0 + H), scan('a', '1001', 'IN', T0)]
  const visits = buildVisits(logs, users)
  assert.equal(visits[0].closedBy.reason, 'exit')
})

test('scans of unregistered cards never produce warnings', () => {
  const visits = buildVisits([scan('a', '99999999', 'IN', T0)], users)
  assert.equal(visits.length, 0)
})

test('returned visitor pass with no OUT logged closes the visit', () => {
  const returned = { ...visitor, status: 'Inactive', returnedAt: T0 + H }
  const visits = buildVisits([scan('a', '2002', 'IN', T0)], [student, returned])
  assert.equal(visits[0].closedBy.reason, 'pass-returned')
})

test('pooled card reissued: next holder scan closes the previous visit', () => {
  const returned = { ...visitor, status: 'Inactive', returnedAt: T0 + 2 * H }
  const logs = [scan('a', '2002', 'IN', T0), scan('b', '2002', 'IN', T0 + 3 * H + M)]
  const visits = buildVisits(logs, [returned, nextVisitor])
  assert.equal(visits.length, 2)
  assert.equal(visits[0].holder.id, 'v1')
  assert.notEqual(visits[0].closedBy, null)
  assert.equal(visits[1].holder.id, 'v2')
})

test('cardHex-only scans match', () => {
  const visits = buildVisits([{ id: 'a', cardHex: '1001', direction: 'IN', timestamp: T0 }], users)
  assert.equal(visits.length, 1)
})

test('resolutionForScan: exit, reentry, duplicate, older scan, other holder', () => {
  const alert = { entryLogId: 'a', entryAt: T0, rfidUserId: 'u1' }
  assert.equal(resolutionForScan(alert, scan('b', '1001', 'OUT', T0 + 13 * H), student).reason, 'exit')
  assert.equal(resolutionForScan(alert, scan('c', '1001', 'IN', T0 + 13 * H), student).reason, 'reentry')
  assert.equal(resolutionForScan(alert, scan('d', '1001', 'IN', T0 + 3000), student), null)
  assert.equal(resolutionForScan(alert, scan('e', '1001', 'OUT', T0 - H), student), null)
  assert.equal(resolutionForScan(alert, scan('a', '1001', 'IN', T0), student), null)
  assert.equal(resolutionForScan(alert, scan('f', '1001', 'IN', T0 + 13 * H), { id: 'other' }).reason, 'card-reissued')
  assert.equal(resolutionForScan(alert, scan('g', '1001', 'OUT', T0 + 13 * H), null), null)
})

test('alert record carries identifier, threshold and no undefined values', () => {
  const [longStay] = findLongStays(buildVisits([scan('a', '1001', 'IN', T0, { timeApprox: true })], users), settings, T0 + 13 * H)
  const alert = buildAlert(longStay, T0 + 13 * H, false)
  assert.equal(alert.identifierLabel, 'Student ID')
  assert.equal(alert.identifier, '2021-001')
  assert.equal(alert.thresholdMs, 12 * H)
  assert.equal(alert.entryTimeApprox, true)
  assert.deepEqual(alert.sms, { status: 'off', count: 0 })
  assert.ok(Object.values(alert).every((v) => v !== undefined))
})

test('SMS message uses Manila time and summarizes extra warnings', () => {
  const msg = buildSmsMessage([{ name: 'MARIA SANTOS', category: 'visitor', entryAt: T0 }, { name: 'X', category: 'registered', entryAt: T0 }], T0 + 4 * H + 5 * M)
  assert.match(msg, /MARIA SANTOS \(visitor\) entered 09:00 AM, 4h 5m ago, no exit recorded\. \+1 more\./)
})
