function escapeCsvCell(value) {
  let str = value === null || value === undefined ? '' : String(value)
  // A text cell starting with = + - @ (or tab/CR) runs as a formula when the CSV is opened in
  // Excel - a name like =HYPERLINK(...) could do that. A leading ' makes it plain text.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
