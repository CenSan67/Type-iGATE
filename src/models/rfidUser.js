import { isValidRfid, isValidPlate, isValidEmail, isValidPhone, normalizePhone } from '../utils/validators'
import { toCaps } from '../utils/textCase'

// This is the vehicle-owner "role" (who the card belongs to), unrelated to the
// admin login roles in src/constants/roles.js. Security guards register under 'Staff'.
export const VEHICLE_OWNER_ROLES = ['Student', 'Faculty', 'Staff', 'Visitor']
export const VEHICLE_TYPES = ['Car', 'Motorcycle', 'Tricycle', 'E-Bike', 'E-Scooter', 'Truck']
export const ACCOUNT_STATUSES = ['Active', 'Inactive']

/**
 * @typedef {Object} RfidUser
 * @property {string} name
 * @property {string} rfidId
 * @property {string} plateNumber
 * @property {string} vehicleType
 * @property {string} [vehicleColor]
 * @property {string} department
 * @property {'Student'|'Faculty'|'Staff'|'Visitor'} role
 * @property {string} email
 * @property {'Active'|'Inactive'} status
 * @property {number} createdAt
 * @property {string} [imageUrl] - Firebase Storage download URL of the latest known vehicle photo.
 * @property {string} [phone] - PH mobile, normalized to 09XXXXXXXXX. Optional for every role;
 *   when present, the gateLogs Cloud Function trigger (functions/index.js, Phase 7) sends this
 *   owner a Semaphore SMS on every scan of their card, IN and OUT.
 * @property {number} [expiresAt] - Visitor-pass expiry (ms epoch). Absent/null for permanent
 *   registrations (Student/Faculty/Staff); the Guard UI sets this for role='Visitor'. Purely
 *   advisory today - nothing auto-deactivates the record when this passes, the Dashboard/
 *   Account Management UI just renders an "Expired" badge instead of "Active".
 * @property {string} [hostName] - Visitor-only: who they're visiting.
 * @property {string} [purpose] - Visitor-only: reason for the visit.
 * @property {number} [returnedAt] - Visitor-only: when the pass was handed back (ms epoch),
 *   by the OUT scan (sketch_scanner auto-return) or the Dashboard's Return Pass / VIP Check
 *   Out. Ends this record's claim on the physical card: scans after it are never attributed
 *   to this visitor (utils/cardHolder.js#holderAtTime), so a pooled card carries no trace of
 *   its previous holder.
 * @property {string} [guestId] - Visitor-only: the expectedGuests/{id} this pass was issued
 *   to at VIP check-in, so an OUT scan can also mark that guest Departed.
 */

/** @param {Partial<RfidUser>} data @returns {RfidUser} */
export function validateRfidUser(data) {
  if (!data.rfidId || typeof data.rfidId !== 'string' || !isValidRfid(data.rfidId)) {
    throw new Error('RfidUser: rfidId is required and must be 3-40 letters/numbers/hyphens')
  }
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('RfidUser: name is required')
  }
  if (data.plateNumber && !isValidPlate(data.plateNumber)) {
    throw new Error('RfidUser: plateNumber format looks invalid (expected e.g. ABC-1234)')
  }
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('RfidUser: email format looks invalid')
  }
  if (data.phone && !isValidPhone(data.phone)) {
    throw new Error('RfidUser: phone format looks invalid (expected a PH mobile number, e.g. 09171234567)')
  }
  if (data.vehicleType && !VEHICLE_TYPES.includes(data.vehicleType)) {
    throw new Error(`RfidUser: vehicleType must be one of ${VEHICLE_TYPES.join(', ')}`)
  }
  if (data.role && !VEHICLE_OWNER_ROLES.includes(data.role)) {
    throw new Error(`RfidUser: role must be one of ${VEHICLE_OWNER_ROLES.join(', ')}`)
  }
  if (data.status && !ACCOUNT_STATUSES.includes(data.status)) {
    throw new Error(`RfidUser: status must be one of ${ACCOUNT_STATUSES.join(', ')}`)
  }
  if (data.expiresAt != null && typeof data.expiresAt !== 'number') {
    throw new Error('RfidUser: expiresAt must be a timestamp (ms)')
  }
  if (data.returnedAt != null && typeof data.returnedAt !== 'number') {
    throw new Error('RfidUser: returnedAt must be a timestamp (ms)')
  }
  return {
    name: toCaps(data.name.trim()),
    rfidId: data.rfidId.trim(),
    plateNumber: (data.plateNumber || '').trim().toUpperCase(),
    vehicleType: data.vehicleType || 'Car',
    vehicleColor: toCaps((data.vehicleColor || '').trim()),
    department: toCaps((data.department || '').trim()),
    role: data.role || 'Student',
    email: (data.email || '').trim(),
    phone: normalizePhone(data.phone),
    status: data.status || 'Active',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    imageUrl: data.imageUrl || '',
    expiresAt: data.expiresAt ?? null,
    hostName: (data.hostName || '').trim(),
    purpose: (data.purpose || '').trim(),
    returnedAt: data.returnedAt ?? null,
    guestId: data.guestId || '',
  }
}
