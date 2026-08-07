/**
 * @typedef {Object} SystemUser
 * @property {string} role
 * @property {string} displayName
 * @property {'active'|'inactive'} status
 * @property {number} createdAt
 */

/** @param {Partial<SystemUser>} data @returns {SystemUser} */
export function validateSystemUser(data) {
  if (!data.displayName || typeof data.displayName !== 'string') {
    throw new Error('SystemUser: displayName is required')
  }
  return {
    role: data.role || 'system',
    displayName: data.displayName,
    status: data.status || 'active',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  }
}
