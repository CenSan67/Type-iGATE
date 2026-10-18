import { normalizePlate } from './validators'

// ALL CAPS for names, plate numbers, departments and vehicle colors - the convention on LTO and
// school records, and it keeps one spelling per person/vehicle. Emails stay as typed.
// Applied while typing (forms, via capsInputValue) and again on save (the model validators),
// so a record is uppercase whichever screen wrote it.
export const CAPS_FIELDS = new Set(['name', 'plate', 'plateNumber', 'department', 'color', 'vehicleColor'])

export const toCaps = (value) => (typeof value === 'string' ? value.toUpperCase() : value)

// Plate fields also drop anything that isn't a letter or digit while typing (plateInputValue).
export const PLATE_FIELDS = new Set(['plate', 'plateNumber'])

// onChange helper: uppercases the input in place and keeps the cursor where it was (a plain
// controlled-input swap jumps the cursor to the end when editing mid-word). Returns the value
// to put in state.
export function capsInputValue(event) {
  const el = event.target
  const upper = el.value.toUpperCase()
  if (upper !== el.value) {
    const { selectionStart, selectionEnd } = el
    el.value = upper
    try { el.setSelectionRange(selectionStart, selectionEnd) } catch { /* input type without a caret */ }
  }
  return upper
}

// onChange helper for plate numbers: ALL CAPS, letters and digits only. A typed or pasted
// space/hyphen/symbol is removed and the cursor stays after the character just typed.
export function plateInputValue(event) {
  const el = event.target
  const clean = normalizePlate(el.value)
  if (clean !== el.value) {
    const caret = normalizePlate(el.value.slice(0, el.selectionStart ?? el.value.length)).length
    el.value = clean
    try { el.setSelectionRange(caret, caret) } catch { /* input type without a caret */ }
  }
  return clean
}

// For forms whose onChange is keyed by field name.
export const fieldInputValue = (field, event) => (
  PLATE_FIELDS.has(field) ? plateInputValue(event) : CAPS_FIELDS.has(field) ? capsInputValue(event) : event.target.value
)
