import { isValidRfid, isValidPlate, isValidEmail } from '../utils/validators'

// This is the vehicle-owner "role" (who the card belongs to), unrelated to the
// admin login roles in src/constants/roles.js. Security guards register under 'Staff'.
export const VEHICLE_OWNER_ROLES = ['Student', 'Faculty', 'Staff', 'Visitor']
export const VEHICLE_TYPES = ['Car', 'Motorcycle', 'E-Bike', 'Truck']
export const ACCOUNT_STATUSES = ['Active', 'Inactive']

/**
 * @typedef {Object} RfidUser
 * @property {string} name
 * @property {string} rfidId
 * @property {string} plateNumber
 * @property {string} vehicleType
 * @property {string} department
 * @property {'Student'|'Faculty'|'Staff'|'Visitor'} role
 * @property {string} email
 * @property {'Active'|'Inactive'} status
 * @property {number} createdAt
 * @property {string} [imageUrl] - Firebase Storage download URL of the latest known vehicle photo.
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
  if (data.vehicleType && !VEHICLE_TYPES.includes(data.vehicleType)) {
    throw new Error(`RfidUser: vehicleType must be one of ${VEHICLE_TYPES.join(', ')}`)
  }
  if (data.role && !VEHICLE_OWNER_ROLES.includes(data.role)) {
    throw new Error(`RfidUser: role must be one of ${VEHICLE_OWNER_ROLES.join(', ')}`)
  }
  if (data.status && !ACCOUNT_STATUSES.includes(data.status)) {
    throw new Error(`RfidUser: status must be one of ${ACCOUNT_STATUSES.join(', ')}`)
  }
  return {
    name: data.name.trim(),
    rfidId: data.rfidId.trim(),
    plateNumber: (data.plateNumber || '').trim().toUpperCase(),
    vehicleType: data.vehicleType || 'Car',
    department: data.department || '',
    role: data.role || 'Student',
    email: (data.email || '').trim(),
    status: data.status || 'Active',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    imageUrl: data.imageUrl || '',
  }
}
