// Pure builders that turn page data into the { columns, rows, summary, dateRange } shape
// PrintReportModal renders, so Search History / Reports / Payment share one report layout.

const LONG_DATE = { month: 'long', day: 'numeric', year: 'numeric' }

export const formatLongDate = (ms) => new Date(ms).toLocaleDateString([], LONG_DATE)

// "April 1 - April 30, 2026" style range; falls back to "All dates" when neither end is known.
export function formatDateRange(fromMs, toMs) {
  if (!fromMs && !toMs) return 'All dates'
  if (!fromMs || !toMs) return formatLongDate(fromMs || toMs)
  const from = new Date(fromMs)
  const to = new Date(toMs)
  if (from.toDateString() === to.toDateString()) return formatLongDate(fromMs)
  if (from.getFullYear() === to.getFullYear()) {
    const short = { month: 'long', day: 'numeric' }
    return `${from.toLocaleDateString([], short)} - ${to.toLocaleDateString([], LONG_DATE)}`
  }
  return `${formatLongDate(fromMs)} - ${formatLongDate(toMs)}`
}

// YYYY-MM-DD from a date input -> ms at local start / end of that day.
export const dayStartMs = (iso) => (iso ? new Date(`${iso}T00:00:00`).getTime() : null)
export const dayEndMs = (iso) => (iso ? new Date(`${iso}T23:59:59`).getTime() : null)

function timestampBounds(timestamps) {
  const valid = timestamps.filter(Boolean)
  return valid.length ? { min: Math.min(...valid), max: Math.max(...valid) } : { min: null, max: null }
}

export const GATE_LOG_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'name', label: 'Name' },
  { key: 'plate', label: 'Plate Number' },
  { key: 'department', label: 'Department' },
  { key: 'userType', label: 'User Type' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'direction', label: 'IN/OUT', type: 'direction' },
]

// `entries` are useEnrichedGateLogs() entries (already filtered/sorted by the caller).
// `from`/`to` (ms) are the caller's explicit filter range, if any; otherwise the range of the data.
export function buildGateLogReport(entries, { from = null, to = null } = {}) {
  const rows = entries.map((entry) => ({
    date: entry.timestamp ? formatLongDate(entry.timestamp) : '—',
    time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
    name: entry.name || 'Unknown',
    plate: entry.plateNumber || '—',
    department: entry.department || '—',
    userType: entry.role || '—',
    vehicle: entry.vehicleType || '—',
    direction: entry.direction === 'OUT' ? 'OUT' : 'IN',
  }))
  const bounds = timestampBounds(entries.map((e) => e.timestamp))
  const vehicles = new Set(entries.map((e) => e.rfidId || e.plateNumber).filter(Boolean))

  return {
    columns: GATE_LOG_COLUMNS,
    rows,
    dateRange: formatDateRange(from ?? bounds.min, to ?? bounds.max),
    summary: [
      { label: 'Total Records', value: rows.length },
      { label: 'Total Vehicles', value: vehicles.size },
      { label: 'Total IN', value: rows.filter((r) => r.direction === 'IN').length },
      { label: 'Total OUT', value: rows.filter((r) => r.direction === 'OUT').length },
    ],
  }
}

export const PAYMENT_COLUMNS = [
  { key: 'id', label: 'Transaction ID' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'rfid', label: 'RFID' },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'plate', label: 'Plate Number' },
  { key: 'paymentType', label: 'Payment Type' },
  { key: 'amount', label: 'Amount' },
  { key: 'receiptNo', label: 'Receipt No.' },
  { key: 'receivedBy', label: 'Received By' },
]

// `transactions` are PaymentPage's mapped transactions (date is YYYY-MM-DD).
export function buildPaymentReport(transactions, { from = null, to = null } = {}) {
  const rows = transactions.map((t) => ({
    id: t.id,
    date: t.date ? formatLongDate(dayStartMs(t.date)) : '—',
    time: t.time || '—',
    rfid: t.rfid,
    name: t.name,
    department: t.department,
    plate: t.plate,
    paymentType: t.paymentType,
    amount: `₱${t.amount.toFixed(2)}`,
    receiptNo: t.receiptNo,
    receivedBy: t.receivedBy,
  }))
  const bounds = timestampBounds(transactions.map((t) => dayStartMs(t.date)))

  return {
    columns: PAYMENT_COLUMNS,
    rows,
    dateRange: formatDateRange(from ?? bounds.min, to ?? bounds.max),
    summary: [
      { label: 'Total Transactions', value: rows.length },
      { label: 'Total Collected', value: `₱${transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}` },
    ],
  }
}
