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

// Password policy for new accounts. Client-side only — Firebase Auth itself enforces just
// its own 6-character minimum, so this is what makes the stricter rules actually apply.
export const MIN_PASSWORD_LENGTH = 8

export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { id: 'upper', label: 'An uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number (0-9)', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'A special character (e.g. ! @ # $ %)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
]

export function isValidPassword(value) {
  const password = (value || '').toString()
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

// For live input masking: keeps digits only, converts a pasted +639XXXXXXXXX / 639XXXXXXXXX
// to the local 09XXXXXXXXX form, and caps at 11 digits so the field can't hold anything
// normalizePhone() would reject for length.
export function formatPhoneInput(value) {
  let digits = (value || '').toString().replace(/\D/g, '')
  if (digits.startsWith('639')) digits = `0${digits.slice(2)}`
  return digits.slice(0, 11)
}

// Phone is optional on rfidUsers (SMS alerts just won't fire for that owner), so an
// empty value is valid; only a non-empty value that doesn't normalize to a PH mobile
// number is rejected.
export function isValidPhone(value) {
  const trimmed = (value || '').toString().trim()
  return !trimmed || PHONE_PATTERN.test(normalizePhone(trimmed))
}
