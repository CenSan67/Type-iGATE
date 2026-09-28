const pad = (n) => String(n).padStart(2, '0')

// YYYY-MM-DD in the *local* timezone. `toISOString().slice(0, 10)` is UTC, which in the
// Philippines (UTC+8) gives the previous day for anything before 8 AM local time - that
// mis-dated quick-select ranges and log/payment dates.
export function toLocalISODate(value) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// YYYY-MM-DDTHH:mm in the local timezone, for <input type="datetime-local"> value/onChange -
// same local-timezone reasoning as toLocalISODate above.
export function toLocalInputDateTime(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The inverse: a datetime-local input's string value -> ms epoch (local time), or null if empty.
export function fromLocalInputDateTime(value) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

export const QUICK_SELECTS = ['Today', 'This week', 'This month']

// Rolling windows that end today (inclusive): Today = today..today, This week = the last 7
// days, This month = the last 30 days.
const QUICK_SELECT_DAYS = { 'Today': 1, 'This week': 7, 'This month': 30 }

export function getQuickRange(kind, today = new Date()) {
  const days = QUICK_SELECT_DAYS[kind]
  if (!days) return { from: '', to: '' }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  return { from: toLocalISODate(start), to: toLocalISODate(today) }
}
