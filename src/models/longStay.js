// Long-stay warnings (functions/longStay.js does the detection, every 5 minutes, server-side).
//
// settings/longStay - admin-edited, validated here and in database.rules.json:
/**
 * @typedef {Object} LongStaySettings
 * @property {boolean} enabled          create warnings at all
 * @property {number}  registeredHours  allowed stay for Student/Faculty/Staff, 0.5-72
 * @property {number}  visitorHours     walk-in visitor pass, 0.5-72
 * @property {number}  vipHours         VIP guest pass (issued at VIP check-in), 0.5-72
 * @property {number}  repeatMinutes    re-send the SMS for an unacknowledged warning; 0 = never, else 30-1440
 * @property {boolean} smsEnabled       text the numbers below (never on unless an admin turns it on)
 * @property {string}  smsRecipients    up to 5 management numbers, "09XXXXXXXXX,09XXXXXXXXX"
 */
//
// longStayAlerts/{inGateLogId} - written by the Cloud Functions only; admins may add the
// acknowledgedAt/By/Name fields. { status: 'active'|'resolved', name, category, identifierLabel,
// identifier, rfidId, rfidUserId, role, plateNumber, vehicleType, hostName, entryAt,
// entryTimeApprox, thresholdMs, createdAt, sms: { status, count, lastAt, provider, recipients },
// resolvedAt, resolvedReason, exitAt, exitLogId, acknowledgedAt, acknowledgedBy, acknowledgedByName }

import { normalizePhone, PHONE_PATTERN } from '../utils/validators'

// Placeholders until the campus sets a policy - shown as "default" in System Settings.
// HAND-COPIED in functions/longStay.js (LONG_STAY_DEFAULTS / LIMITS) - keep in sync.
export const LONG_STAY_DEFAULTS = {
  enabled: true,
  registeredHours: 12,
  visitorHours: 4,
  vipHours: 8,
  repeatMinutes: 0,
  smsEnabled: false,
  smsRecipients: '',
}

export const LONG_STAY_LIMITS = { minHours: 0.5, maxHours: 72, minRepeatMinutes: 30, maxRepeatMinutes: 1440, maxRecipients: 5 }

export const LONG_STAY_THRESHOLD_FIELDS = [
  { key: 'registeredHours', category: 'registered', label: 'Students, faculty & staff' },
  { key: 'visitorHours', category: 'visitor', label: 'Walk-in visitors' },
  { key: 'vipHours', category: 'vip', label: 'VIP guests' },
]

export const LONG_STAY_CATEGORY_LABELS = { registered: 'Registered user', visitor: 'Visitor', vip: 'VIP guest' }

export const LONG_STAY_RESOLUTION_LABELS = {
  exit: 'Exit recorded',
  reentry: 'New entry recorded - the exit was never scanned',
  'pass-returned': 'Visitor pass returned',
  'card-reissued': 'Card is now held by someone else',
  'entry-removed': 'The entry log was removed',
}

// "accepted" only means the SMS provider took the message - delivery is never reported back.
export const LONG_STAY_SMS_LABELS = {
  off: 'SMS off',
  pending: 'SMS pending',
  accepted: 'SMS accepted by provider (delivery not confirmed)',
  failed: 'SMS failed',
  'rate-limited': 'SMS skipped (rate limit)',
}

// Accepts numbers separated by new lines, commas or semicolons (spaces inside a number, like
// "0917 123 4567", are fine); returns them as the stored string.
export function parseRecipients(text) {
  const parts = (text || '').toString().split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean)
  const phones = parts.map(normalizePhone)
  const invalid = parts.filter((_, i) => !PHONE_PATTERN.test(phones[i]))
  return { value: [...new Set(phones.filter((p) => PHONE_PATTERN.test(p)))].join(','), invalid }
}

/** @returns {LongStaySettings} normalized values, or throws with every problem listed */
export function validateLongStaySettings(data) {
  const errors = []
  const hours = (key, label) => {
    const value = Number(data[key])
    if (!Number.isFinite(value) || value < LONG_STAY_LIMITS.minHours || value > LONG_STAY_LIMITS.maxHours) {
      errors.push(`${label}: enter ${LONG_STAY_LIMITS.minHours}-${LONG_STAY_LIMITS.maxHours} hours.`)
    }
    return Math.round(value * 100) / 100
  }
  const values = Object.fromEntries(LONG_STAY_THRESHOLD_FIELDS.map((f) => [f.key, hours(f.key, f.label)]))

  const repeatMinutes = Number(data.repeatMinutes) || 0
  if (repeatMinutes !== 0 && (repeatMinutes < LONG_STAY_LIMITS.minRepeatMinutes || repeatMinutes > LONG_STAY_LIMITS.maxRepeatMinutes)) {
    errors.push(`Repeat SMS: choose Off or ${LONG_STAY_LIMITS.minRepeatMinutes}-${LONG_STAY_LIMITS.maxRepeatMinutes} minutes.`)
  }

  const { value: smsRecipients, invalid } = parseRecipients(data.smsRecipients)
  if (invalid.length) errors.push(`Not a valid PH mobile number: ${invalid.join(', ')}.`)
  if (smsRecipients.split(',').filter(Boolean).length > LONG_STAY_LIMITS.maxRecipients) {
    errors.push(`At most ${LONG_STAY_LIMITS.maxRecipients} SMS numbers.`)
  }
  const smsEnabled = data.smsEnabled === true
  if (smsEnabled && !smsRecipients) errors.push('Add at least one mobile number to turn SMS alerts on.')

  if (errors.length) throw new Error(errors.join(' '))
  return { enabled: data.enabled !== false, ...values, repeatMinutes, smsEnabled, smsRecipients }
}
