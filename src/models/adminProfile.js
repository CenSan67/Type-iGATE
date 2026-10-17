import { ROLES } from '../constants/roles'

/**
 * @typedef {Object} AdminProfile
 * @property {string} fullName
 * @property {string} displayName
 * @property {string} email
 * @property {string} phone
 * @property {string} address
 * @property {'Super Admin'|'Administrator'|'Security Guard'} role
 * @property {'Pending'|'Active'|'Inactive'|'Locked'} status  Pending = signed up, awaiting admin approval; Locked = legacy only (the removed sign-in lockout) - a Super Admin can Reactivate it
 * @property {'Super Admin'|'Administrator'|'Security Guard'} [requestedRole]  role asked for at signup
 * @property {boolean} [emailVerified]  mirrored from Firebase Auth, checked by rules against the auth token
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
  if (data.status && !['Pending', 'Active', 'Inactive', 'Locked'].includes(data.status)) {
    throw new Error('AdminProfile: status must be Pending, Active, Inactive or Locked')
  }
  if (data.requestedRole && !ROLES.includes(data.requestedRole)) {
    throw new Error(`AdminProfile: requestedRole must be one of ${ROLES.join(', ')}`)
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
    // Optional signup-approval fields - only included when present, since RTDB rejects
    // `undefined` and a full set() (e.g. a Super Admin's role change) must not silently drop
    // them from an existing record.
    ...(data.requestedRole ? { requestedRole: data.requestedRole } : {}),
    ...(typeof data.emailVerified === 'boolean' ? { emailVerified: data.emailVerified } : {}),
  }
}
