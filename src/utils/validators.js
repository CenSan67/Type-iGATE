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
