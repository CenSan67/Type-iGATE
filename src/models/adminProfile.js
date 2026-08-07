import { ROLES } from '../constants/roles'

/**
 * @typedef {Object} AdminProfile
 * @property {string} fullName
 * @property {string} displayName
 * @property {string} email
 * @property {string} phone
 * @property {string} address
 * @property {'Super Admin'|'Administrator'|'Security Guard'} role
 * @property {'Active'|'Inactive'} status
 * @property {string} joinedDate
 * @property {string|null} avatar
 */

/** @param {Partial<AdminProfile>} data @returns {AdminProfile} */
export function validateAdminProfile(data) {
  if (!data.email || typeof data.email !== 'string') {
    throw new Error('AdminProfile: email is required')
  }
  if (!data.role || !ROLES.includes(data.role)) {
    throw new Error(`AdminProfile: role must be one of ${ROLES.join(', ')}`)
  }
  if (data.status && !['Active', 'Inactive'].includes(data.status)) {
    throw new Error('AdminProfile: status must be Active or Inactive')
  }
  return {
    fullName: data.fullName || '',
    displayName: data.displayName || '',
    email: data.email,
    phone: data.phone || '',
    address: data.address || '',
    role: data.role,
    status: data.status || 'Active',
    joinedDate: data.joinedDate || '',
    avatar: data.avatar ?? null,
  }
}
