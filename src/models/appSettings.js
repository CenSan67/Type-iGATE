/**
 * @typedef {Object} AppSettings
 * @property {string} appName
 * @property {string} campus
 * @property {'active'|'inactive'} status
 * @property {number} createdAt
 */

/** @param {Partial<AppSettings>} data @returns {AppSettings} */
export function validateAppSettings(data) {
  if (!data.appName || typeof data.appName !== 'string') {
    throw new Error('AppSettings: appName is required')
  }
  return {
    appName: data.appName,
    campus: data.campus || '',
    status: data.status || 'active',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  }
}

// Phase 12: two independent physical barriers (Entrance and Exit), each with its own
// manual override on System Settings - reachable by any staff role now, not just admins,
// since a Security Guard is exactly who needs to raise/lower a barrier from the gatehouse.
// State lives at settings/app/gateStatus/{gateId} (see setGateStatus/listenToGateStatus in
// services/firebase.js), written directly to that leaf, never through validateAppSettings,
// so a status change never has to touch/overwrite appName/campus/etc.
export const GATE_IDS = ['entrance', 'exit']
export const GATE_LABELS = { entrance: 'Entrance Gate', exit: 'Exit Gate' }

export const GATE_STATUS_STATES = ['OPEN', 'CLOSED']

/**
 * @typedef {Object} GateStatus
 * @property {'OPEN'|'CLOSED'} state
 * @property {number} updatedAt
 * @property {string} updatedBy - Firebase Auth uid of the staff member who triggered this
 * @property {string} updatedByName - email of the staff member, for the "last updated by" line
 */

/** @param {Partial<GateStatus>} data @returns {GateStatus} */
export function validateGateStatus(data) {
  if (!GATE_STATUS_STATES.includes(data.state)) {
    throw new Error(`GateStatus: state must be one of ${GATE_STATUS_STATES.join(', ')}`)
  }
  return {
    state: data.state,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    updatedBy: data.updatedBy || 'unknown',
    updatedByName: data.updatedByName || 'Unknown',
  }
}
