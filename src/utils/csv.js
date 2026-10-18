// A text cell starting with = + - @ (or tab/CR) runs as a formula when the file is opened in
// Excel - a name like =HYPERLINK(...) could do that. A leading ' makes it plain text.
export function neutralizeFormula(value) {
  const str = value === null || value === undefined ? '' : String(value)
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
}

function escapeCsvCell(value) {
  const str = neutralizeFormula(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','))
  // The BOM makes Excel read the file as UTF-8 (names with ñ etc. display correctly).
  downloadBlob(filename, new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }))
}
