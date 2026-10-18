// Google Forms registration import: read a .csv/.xlsx, map its headers to registration fields,
// and classify every row before anything is written (models/registration.js does the field rules).
import { checkRegistration, registrationKeys, encodeKey, FIELD_LABELS, REGISTRATION_FIELDS } from '../models/registration'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 2000

// Columns that must never be imported, whatever they're mapped to.
const SENSITIVE_HEADER = /pass(word|code)?|pin\b|token|api.?key|secret|hash|otp|credential/i
export const isSensitiveHeader = (header) => SENSITIVE_HEADER.test(header)

// Google Forms headers are the question text, so match on normalized words.
const ALIASES = {
  fullName: ['full name', 'name', 'complete name', 'student name', 'name of student', 'full name (last, first, mi)', 'applicant name'],
  studentId: ['student id', 'student number', 'student no', 'id number', 'user id', 'student id number', 'id no', 'school id'],
  email: ['email', 'email address', 'e mail', 'e mail address', 'bulsu email', 'gmail'],
  phone: ['contact number', 'contact no', 'phone', 'phone number', 'mobile', 'mobile number', 'cellphone number', 'cp number'],
  role: ['role', 'classification', 'user type', 'category', 'type of user', 'designation'],
  course: ['course', 'program', 'course program', 'course and program', 'degree program'],
  yearLevel: ['year level', 'year', 'year and section', 'year section'],
  department: ['department', 'college', 'office', 'college department'],
  vehicleType: ['vehicle type', 'type of vehicle', 'vehicle'],
  plateNumber: ['plate number', 'plate no', 'vehicle plate number', 'plate', 'license plate'],
  vehicleBrand: ['vehicle brand', 'brand', 'make', 'vehicle make', 'brand of vehicle'],
  vehicleColor: ['vehicle color', 'color', 'colour', 'vehicle colour'],
  submittedAt: ['timestamp', 'date submitted', 'submitted'],
}
const normalizeHeader = (h) => (h || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// header -> field key ('' = not imported). Sensitive columns are always ''.
export function autoMapHeaders(headers) {
  const used = new Set()
  return headers.map((header) => {
    if (isSensitiveHeader(header)) return ''
    const h = normalizeHeader(header)
    const field = Object.keys(ALIASES).find((key) => !used.has(key) && ALIASES[key].some((a) => h === a))
      || Object.keys(ALIASES).find((key) => !used.has(key) && ALIASES[key].some((a) => a.length > 3 && h.includes(a)))
      || ''
    if (field) used.add(field)
    return field
  })
}

// --- reading the file -------------------------------------------------------------------------

// RFC 4180 CSV (quotes, "" escapes, commas/newlines inside quotes, CRLF, UTF-8 BOM).
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const cellText = (v) => {
  if (v == null) return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toLocaleString()
  return v.toString()
}

// File -> { headers: string[], rows: string[][] } (empty rows dropped). Throws a readable Error.
export async function readSpreadsheet(file) {
  if (!file) throw new Error('Choose a file to import.')
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is larger than 5 MB.')
  const name = (file.name || '').toLowerCase()
  let table
  if (name.endsWith('.csv')) {
    table = parseCsv(await file.text())
  } else if (name.endsWith('.xlsx')) {
    // Loaded only when someone actually imports an Excel file.
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    try {
      // v9 returns every sheet ([{ sheet, data }]); Google Forms puts the responses in the first one.
      const sheets = await readXlsxFile(file)
      table = Array.isArray(sheets?.[0]?.data) ? sheets[0].data : sheets
    } catch {
      throw new Error('That Excel file could not be read. Re-download it from Google Sheets as .xlsx or .csv.')
    }
  } else {
    throw new Error('Choose a .csv or .xlsx file (Google Forms: Responses -> Sheets -> File -> Download).')
  }
  const rows = table.map((r) => r.map(cellText)).filter((r) => r.some((v) => v.trim() !== ''))
  if (rows.length < 2) throw new Error('The file has no data rows under the header row.')
  const headers = rows[0].map((h, i) => (h || '').trim() || `Column ${i + 1}`)
  const data = rows.slice(1)
  if (data.length > MAX_IMPORT_ROWS) throw new Error(`The file has ${data.length} rows - import at most ${MAX_IMPORT_ROWS} at a time.`)
  return { headers, rows: data }
}

// --- preview ----------------------------------------------------------------------------------

// The mapping must name Full Name, and no field twice.
export function mappingProblems(mapping) {
  const problems = []
  if (!mapping.includes('fullName')) problems.push('Choose which column is the Full Name.')
  const seen = new Set()
  mapping.filter(Boolean).forEach((f) => {
    if (seen.has(f)) problems.push(`"${FIELD_LABELS[f]}" is chosen for more than one column.`)
    seen.add(f)
  })
  return problems
}

const ownerKeys = (u) => [
  u.studentId ? `sid:${u.studentId.toUpperCase()}` : null,
  u.email ? `email:${u.email.toLowerCase()}` : null,
  u.plateNumber ? `plate:${u.plateNumber.replace(/[\s-]/g, '').toUpperCase()}` : null,
].filter(Boolean)

/**
 * Every row classified, nothing written:
 *   status 'valid' | 'incomplete' (importable, completed later) | 'duplicate' | 'invalid'
 * Duplicates: another row in this file, an earlier import (existingKeys = registrationKeys node),
 * or an existing registered owner (rfidUsers: student ID, email or plate).
 */
export function buildImportPreview({ headers, rows }, mapping, { existingKeys = {}, owners = [] } = {}) {
  const ownerIndex = new Map()
  owners.filter((u) => u.role !== 'Visitor').forEach((u) => ownerKeys(u).forEach((k) => ownerIndex.set(k, u)))
  const seenInFile = new Map()

  return rows.map((cells, i) => {
    const rowNumber = i + 2 // spreadsheet row (header is row 1)
    const raw = {}
    const original = {}
    headers.forEach((header, c) => {
      if (isSensitiveHeader(header)) return // never kept, not even in the original copy
      const value = (cells[c] ?? '').toString().trim()
      if (value) original[header] = value
      if (mapping[c]) raw[mapping[c]] = value
    })
    // The iGate form's Role question is optional and only offers "Student" - so a blank (or missing)
    // Role means Student. It's an owner category only, never a login role/permission.
    if (!(raw.role || '').trim()) raw.role = 'Student'
    const check = checkRegistration(raw)
    const keys = check.values.fullName ? registrationKeys(check.values) : []
    const base = { rowNumber, values: check.values, keys, original, missing: check.missing, errors: check.errors }

    if (Object.keys(check.errors).length) {
      return { ...base, status: 'invalid', reason: Object.values(check.errors).join('; ') }
    }
    const earlierRow = keys.map((k) => seenInFile.get(k)).find(Boolean)
    keys.forEach((k) => { if (!seenInFile.has(k)) seenInFile.set(k, rowNumber) })
    if (earlierRow) return { ...base, status: 'duplicate', reason: `Same person as row ${earlierRow} in this file` }
    const importedKey = keys.find((k) => existingKeys[encodeKey(k)])
    if (importedKey) {
      const what = importedKey.startsWith('sid:') ? 'Student ID' : importedKey.startsWith('email:') ? 'email' : 'name'
      return { ...base, status: 'duplicate', reason: `Already imported (same ${what})`, duplicateOf: existingKeys[encodeKey(importedKey)] }
    }
    const owner = ownerKeys(check.values).map((k) => ownerIndex.get(k)).find(Boolean)
    if (owner) return { ...base, status: 'duplicate', reason: `Already a registered owner: ${owner.name} (${owner.rfidId})` }
    if (check.missing.length) {
      return { ...base, status: 'incomplete', reason: `Missing: ${check.missing.map((k) => (k === 'email' ? 'email or contact number' : FIELD_LABELS[k])).join(', ')}` }
    }
    return { ...base, status: 'valid', reason: '' }
  })
}

export const IMPORT_STATUS_LABELS = { valid: 'Valid', incomplete: 'Incomplete', duplicate: 'Duplicate', invalid: 'Invalid' }
export const IMPORTABLE_FIELDS = REGISTRATION_FIELDS
