// VIP pre-clearance (Phase 11): an Administrator enters an expected guest ahead of time so
// they never queue or hand over an ID at the gate. A guard checks them in (issuing a
// temporary rfidUsers pass, same shape as a walk-in visitor) and out (returning that pass) -
// see services/firebase.js#checkInGuest/#checkOutGuest and database.rules.json's admin-vs-
// guard split on this node.
export const GUEST_CATEGORIES = ['Guest Speaker', 'University Dignitary', 'Government Official', 'VIP Event']
export const GUEST_STATUSES = ['Expected', 'Arrived', 'Departed', 'Cancelled']

/**
 * @typedef {Object} ExpectedGuest
 * @property {string} name
 * @property {'Guest Speaker'|'University Dignitary'|'Government Official'|'VIP Event'} category
 * @property {string} hostName - the office/person who invited them.
 * @property {string} [purpose]
 * @property {string} [plateNumber] - optional; often unknown ahead of time (e.g. a
 *   government convoy) and filled in by the guard at check-in instead.
 * @property {string} vehicleType
 * @property {number} validFrom - ms epoch; the guest can't be checked in before this.
 * @property {number} validUntil - ms epoch; also becomes the issued pass's expiresAt.
 * @property {'Expected'|'Arrived'|'Departed'|'Cancelled'} status
 * @property {string} createdBy - uid of the Administrator who pre-cleared them.
 * @property {string} createdByName
 * @property {number} createdAt
 * @property {string} [rfidId] - the temporary pass issued at check-in.
 * @property {number} [arrivedAt]
 * @property {number} [departedAt]
 * @property {string} [checkedInBy] - display name of the guard who checked them in.
 */

/** @param {Partial<ExpectedGuest>} data @returns {ExpectedGuest} */
export function validateExpectedGuest(data) {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('ExpectedGuest: name is required')
  }
  if (!GUEST_CATEGORIES.includes(data.category)) {
    throw new Error(`ExpectedGuest: category must be one of ${GUEST_CATEGORIES.join(', ')}`)
  }
  if (!data.hostName || typeof data.hostName !== 'string' || !data.hostName.trim()) {
    throw new Error('ExpectedGuest: hostName is required')
  }
  if (typeof data.validFrom !== 'number' || typeof data.validUntil !== 'number' || data.validUntil <= data.validFrom) {
    throw new Error('ExpectedGuest: validUntil must be a later timestamp than validFrom')
  }
  if (data.status && !GUEST_STATUSES.includes(data.status)) {
    throw new Error(`ExpectedGuest: status must be one of ${GUEST_STATUSES.join(', ')}`)
  }

  return {
    name: data.name.trim(),
    category: data.category,
    hostName: data.hostName.trim(),
    purpose: (data.purpose || '').trim(),
    plateNumber: (data.plateNumber || '').trim().toUpperCase(),
    vehicleType: data.vehicleType || 'Car',
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    status: data.status || 'Expected',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    rfidId: data.rfidId || '',
    arrivedAt: typeof data.arrivedAt === 'number' ? data.arrivedAt : null,
    departedAt: typeof data.departedAt === 'number' ? data.departedAt : null,
    checkedInBy: data.checkedInBy || '',
  }
}
