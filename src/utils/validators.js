// Deliberately permissive RFID pattern: the physical scanner (sketch_scanner.ino) sends
// either a decimal cardId or a hex cardHex, and staff can also type one in manually —
// we don't control the hardware's exact format, so this only rejects obviously-bad input.
export const RFID_PATTERN = /^[A-Za-z0-9-]{3,40}$/

// Philippine plate formats vary (cars vs motorcycles vs e-bikes), so this accepts the
// common "ABC1234" / "ABC-1234" / "ABC 1234" shapes rather than one exact layout.
export const PLATE_PATTERN = /^[A-Z0-9]{2,4}[- ]?[A-Z0-9]{3,4}$/

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidRfid(value) {
  return RFID_PATTERN.test((value || '').trim())
}

export function isValidPlate(value) {
  return PLATE_PATTERN.test((value || '').trim().toUpperCase())
}

// Email is optional on rfidUsers, so an empty value is valid; only a non-empty,
// malformed value is rejected.
export function isValidEmail(value) {
  const trimmed = (value || '').trim()
  return !trimmed || EMAIL_PATTERN.test(trimmed)
}

// Canonical stored/display format is local PH mobile: 09XXXXXXXXX (11 digits) — this is
// the format Semaphore's SMS API (functions/index.js) expects for the `number` param, so
// normalizePhone() below is what both the registration forms and validateRfidUser call
// before anything is written to rfidUsers/{id}/phone, keeping one canonical shape end to end.
export const PHONE_PATTERN = /^09\d{9}$/

// Accepts 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX and normalizes to 09XXXXXXXXX.
// Returns '' for empty/unrecognized input rather than throwing — callers decide whether
// a phone is required (it isn't, for non-Visitor rfidUsers with no SMS opt-in).
export function normalizePhone(value) {
  const digits = (value || '').toString().trim().replace(/[\s-]/g, '').replace(/^\+/, '')
  if (/^09\d{9}$/.test(digits)) return digits
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^9\d{9}$/.test(digits)) return `0${digits}`
  return ''
}

// Phone is optional on rfidUsers (SMS alerts just won't fire for that owner), so an
// empty value is valid; only a non-empty value that doesn't normalize to a PH mobile
// number is rejected.
export function isValidPhone(value) {
  const trimmed = (value || '').toString().trim()
  return !trimmed || PHONE_PATTERN.test(normalizePhone(trimmed))
}
