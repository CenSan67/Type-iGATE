import { isValidEmail, isValidPhone, isValidPlate, normalizePhone, normalizePlate, PLATE_FORMAT_HINT } from '../utils/validators'
import { VEHICLE_TYPES } from './rfidUser'
import { PLATE_OPTIONAL_TYPES } from '../constants/fees'
import { VEHICLE_BRANDS, NO_VEHICLE_VALUE, isValidVehicleBrand, normalizeVehicleBrand } from '../constants/vehicleBrands'
import { toCaps } from '../utils/textCase'

/**
 * An imported registration (registrations/{id}) - an applicant from a Google Forms list who is
 * NOT yet a card holder. Kept out of rfidUsers on purpose: every rfidUsers record is a card the
 * ESP32 and the gate logic act on. Processing turns it into a normal rfidUsers record through the
 * existing Payment registration flow (fee, documents, consent, card scan).
 *
 * @typedef {Object} Registration
 * @property {string} fullName
 * @property {string} [studentId]
 * @property {string} [email]
 * @property {string} [phone]          09XXXXXXXXX
 * @property {string} [role]           vehicle-owner category: Student | Faculty | Staff
 * @property {string} [course]
 * @property {string} [yearLevel]
 * @property {string} [department]
 * @property {string} [vehicleType]
 * @property {string} [plateNumber]
 * @property {string} [vehicleBrand]
 * @property {string} [vehicleColor]
 * @property {string} [submittedAt]    the Google Forms "Timestamp" cell, as written
 * @property {'Pending Review'|'Under Processing'|'Approved'|'Active'|'Rejected'} status  processing status
 * @property {string} originalJson     the submitted row (non-sensitive columns only) - never changes
 * @property {string} [rfidUserId]     the rfidUsers record once a card is assigned / it's activated
 * @property {number} importedAt
 * @property {string} importedBy / importedByName / importBatchId / sourceFile
 * @property {number} updatedAt
 * @property {string} updatedBy
 */

// Processing status. Account, payment and RFID status are NOT stored here: they come from the
// linked rfidUsers record and its payments (the existing sources), see deriveRegistrationStatus.
export const REGISTRATION_STATUSES = ['Pending Review', 'Under Processing', 'Approved', 'Active', 'Rejected']

// Allowed moves (mirrored in database.rules.json). 'Active' is set only by activation, after the
// Payment flow has made the rfidUsers record Active.
export const STATUS_TRANSITIONS = {
  'Pending Review': ['Under Processing', 'Approved', 'Rejected'],
  'Under Processing': ['Pending Review', 'Approved', 'Rejected'],
  Approved: ['Under Processing', 'Active', 'Rejected'],
  Rejected: ['Pending Review'],
  Active: [],
}

export const REGISTRATION_ROLES = ['Student', 'Faculty', 'Staff']

// System fields an import can fill, in form order. `caps` = stored uppercase (CAPS convention).
export const REGISTRATION_FIELDS = [
  { key: 'fullName', label: 'Full Name', caps: true },
  { key: 'studentId', label: 'Student ID / User ID', caps: true },
  { key: 'email', label: 'Email Address' },
  { key: 'phone', label: 'Contact Number' },
  { key: 'role', label: 'Role / Classification' },
  { key: 'course', label: 'Course / Program', caps: true },
  { key: 'yearLevel', label: 'Year Level' },
  { key: 'department', label: 'Department', caps: true },
  { key: 'vehicleType', label: 'Vehicle Type' },
  { key: 'plateNumber', label: 'Plate Number', caps: true },
  { key: 'vehicleBrand', label: 'Vehicle Brand' },
  { key: 'vehicleColor', label: 'Vehicle Color', caps: true },
  { key: 'submittedAt', label: 'Submitted (Google Forms Timestamp)' },
]

export const FIELD_LABELS = Object.fromEntries(REGISTRATION_FIELDS.map((f) => [f.key, f.label]))

const STUDENT_ID_PATTERN = /^[A-Z0-9-]{3,20}$/
const MAX_TEXT = 80
const clean = (v) => (v ?? '').toString().trim().replace(/\s+/g, ' ')
const pickCaseInsensitive = (value, list) => list.find((x) => x.toLowerCase() === value.toLowerCase())
const NO_VEHICLE_WORDS = ['none', 'no vehicle', 'n/a', 'na', 'wala', 'no']

// Normalizes one set of raw field values (from a spreadsheet row or the edit form).
// Returns { values, errors: {field: message}, missing: [field] } - errors are wrong values
// (row can't be imported as-is), missing are blanks that must be filled before approval.
export function checkRegistration(raw) {
  const values = {}
  const errors = {}
  for (const { key, caps } of REGISTRATION_FIELDS) {
    const text = clean(raw[key])
    values[key] = caps ? toCaps(text) : text
    if (text.length > MAX_TEXT) errors[key] = `${FIELD_LABELS[key]} is too long (max ${MAX_TEXT} characters)`
  }

  if (!values.fullName) errors.fullName = 'Full Name is missing'

  values.studentId = values.studentId.replace(/\s/g, '')
  if (values.studentId && !STUDENT_ID_PATTERN.test(values.studentId)) errors.studentId = 'Student ID: 3-20 letters, numbers or hyphens'

  values.email = values.email.toLowerCase()
  if (values.email && !isValidEmail(values.email)) errors.email = 'Email address looks invalid'

  if (values.phone) {
    if (!isValidPhone(values.phone)) errors.phone = 'Contact number must be a PH mobile number (09XXXXXXXXX)'
    else values.phone = normalizePhone(values.phone)
  }

  if (values.role) {
    const role = pickCaseInsensitive(values.role, REGISTRATION_ROLES)
    if (role) values.role = role
    else errors.role = `Role must be ${REGISTRATION_ROLES.join(', ')}`
  }

  if (values.vehicleType) {
    const type = pickCaseInsensitive(values.vehicleType, VEHICLE_TYPES)
      || (/^motor/i.test(values.vehicleType) ? 'Motorcycle' : null)
    if (type) values.vehicleType = type
    else errors.vehicleType = `Vehicle Type must be one of ${VEHICLE_TYPES.join(', ')}`
  }

  values.plateNumber = normalizePlate(values.plateNumber)
  if (values.plateNumber && !isValidPlate(values.plateNumber)) errors.plateNumber = `Plate Number: ${PLATE_FORMAT_HINT}`

  if (values.vehicleBrand) {
    if (NO_VEHICLE_WORDS.includes(values.vehicleBrand.toLowerCase())) values.vehicleBrand = NO_VEHICLE_VALUE
    else {
      const listed = pickCaseInsensitive(values.vehicleBrand, VEHICLE_BRANDS)
      const brand = normalizeVehicleBrand(listed || values.vehicleBrand)
      if (isValidVehicleBrand(brand)) values.vehicleBrand = brand
      else errors.vehicleBrand = 'Vehicle Brand: 2-40 letters or numbers'
    }
  }

  // Required before approval = what the Payment registration needs. The iGate Google Form asks no
  // Student ID, so it isn't required (it's still stored and used for duplicate checks when present).
  const missing = []
  if (!values.email && !values.phone) missing.push('email')
  if (!values.role) missing.push('role')
  if (!values.vehicleType) missing.push('vehicleType')
  if (!values.plateNumber && !PLATE_OPTIONAL_TYPES.includes(values.vehicleType)) missing.push('plateNumber')

  return { values, errors, missing }
}

// What still blocks approval, in words (errors first, then blanks).
export function approvalProblems({ errors, missing }) {
  return [
    ...Object.values(errors),
    ...missing.map((k) => (k === 'email' ? 'An email address or contact number is required' : `${FIELD_LABELS[k]} is required`)),
  ]
}

// Duplicate-detection keys (registrationKeys/{key} in the database = one registration each).
// Student ID and email when present; otherwise name + phone/plate so a re-import still matches.
export function registrationKeys(values) {
  const keys = []
  if (values.studentId) keys.push(`sid:${values.studentId.toUpperCase()}`)
  if (values.email) keys.push(`email:${values.email.toLowerCase()}`)
  if (!keys.length) {
    const second = values.phone || values.plateNumber
    keys.push(`name:${values.fullName.toUpperCase()}|${(second || '').toUpperCase()}`)
  }
  return keys
}

// RTDB keys can't contain . # $ [ ] / - percent-encode them (and % itself).
export const encodeKey = (key) => key.replace(/[%.#$[\]/]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// The status columns shown in Account Management. Only `processing` is stored on the registration;
// the rest are read from the linked rfidUsers record and its payments (no duplicate status fields).
export function deriveRegistrationStatus(registration, users, payments) {
  const owner = registration.rfidUserId ? users.find((u) => u.id === registration.rfidUserId) : null
  const paid = owner
    ? payments.some((p) => (p.rfidId || '').toLowerCase() === (owner.rfidId || '').toLowerCase() && (p.timestamp || 0) >= (owner.createdAt || 0))
    : false
  const ownerActive = owner && (owner.status || 'Active') === 'Active'
  // Activated, but its owner record was deleted (Account Management -> Delete): can be reopened.
  const ownerDeleted = registration.status === 'Active' && !owner
  return {
    processing: registration.status,
    account: ownerActive ? 'Active' : ownerDeleted ? 'Owner deleted' : owner && registration.status === 'Active' ? 'Inactive' : 'Pending Activation',
    ownerDeleted,
    payment: paid ? 'Paid' : 'Pending',
    rfid: owner?.rfidId ? 'Assigned' : 'Unassigned',
    rfidId: owner?.rfidId || '',
    owner,
  }
}

// Files the applicant uploaded with the Google Form: the sheet only holds Drive links (the files stay
// private in the form owner's Drive), one cell can list several, comma-separated. Only https links
// on Google's own Drive/Docs hosts are returned, so a crafted cell can't become a javascript: link.
const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com']
export function uploadedFileLinks(columns) {
  const links = []
  for (const value of Object.values(columns || {})) {
    for (const part of String(value).split(/[,\s]+/)) {
      try {
        const url = new URL(part)
        if (url.protocol === 'https:' && DRIVE_HOSTS.includes(url.hostname) && !links.includes(url.href)) links.push(url.href)
      } catch { /* not a URL */ }
    }
  }
  return links
}

// The editable fields as stored (strings, '' when empty) for a write.
export function registrationFieldValues(values) {
  return Object.fromEntries(REGISTRATION_FIELDS.map(({ key }) => [key, values[key] || '']))
}
