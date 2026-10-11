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

// Barrier motor runs = sketch_scanner.ino's MOTOR_RUN_TIME (open, forward) and
// MOTOR_CLOSE_TIME (close, reverse = open - 200 ms) - keep these in sync with the sketch.
// Gate Control's buttons stay locked for the run plus one extra second, so a second press
// can't land while a barrier is still moving.
export const GATE_MOTOR_RUN_MS = 450
export const GATE_MOTOR_CLOSE_MS = GATE_MOTOR_RUN_MS - 200
export const GATE_BUTTON_LOCK_MS = GATE_MOTOR_RUN_MS + 1000
export const GATE_CLOSE_BUTTON_LOCK_MS = GATE_MOTOR_CLOSE_MS + 1000

// Gate Control button -> scanner command (services/firebase.js#sendScannerCommand).
// Open = motor forward, Close = the same motor in reverse; closing is manual only.
export const GATE_ACTIONS = {
  open: { entrance: 'OPEN_ENTRY', exit: 'OPEN_EXIT', both: 'OPEN_BOTH' },
  close: { entrance: 'CLOSE_ENTRY', exit: 'CLOSE_EXIT', both: 'CLOSE_BOTH' },
}

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
