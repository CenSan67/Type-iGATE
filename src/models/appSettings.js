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

// Phase 6: physical barrier gate state, written by the dashboard's manual override
// and (once built) polled/read by the ESP32 relay controller the same way the
// existing RFID scanner already reads/writes gateLogs - see the hardware note in
// CLAUDE.md. Lives at settings/app/gateStatus and is written directly to that leaf
// (see setGateStatus in services/firebase.js), never through validateAppSettings,
// so a status change never has to touch/overwrite appName/campus/etc.
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
