// ALL CAPS for names, plate numbers, departments and vehicle colors - the convention on LTO and
// school records, and it keeps one spelling per person/vehicle. Emails stay as typed.
// Applied while typing (forms, via capsInputValue) and again on save (the model validators),
// so a record is uppercase whichever screen wrote it.
export const CAPS_FIELDS = new Set(['name', 'plate', 'plateNumber', 'department', 'color', 'vehicleColor'])

export const toCaps = (value) => (typeof value === 'string' ? value.toUpperCase() : value)

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

// For forms whose onChange is keyed by field name.
export const fieldInputValue = (field, event) => (CAPS_FIELDS.has(field) ? capsInputValue(event) : event.target.value)
