// Emergency RFID card scans (4.6): emergencyLogs/{eventId}, mirrored in database.rules.json.
// The card itself is fixed (constants/emergencyCard.js), like the master card.
//
// Scanner-written fields (never changed by staff): eventId, cardId, bits, timestamp (the IN tap),
// timeApprox?, direction: 'IN', source: 'emergency-card', device, gatesOpened, and - once the
// card is tapped again, the emergency vehicle leaving - exitAt / exitTimeApprox? (the OUT tap).
// Records from before IN/OUT tracking have no direction/exitAt: treated as an IN only.
// Staff-written (any Active role - it's an emergency): status (absent = 'New'), acknowledgedAt/By/Name (once), details
// (incident info, editable until resolved), actions/{push} (append-only history:
// acknowledged / in-progress / details / remark / resolved), resolvedAt/By/Name + resolution
// (once). A scan is an ALERT, not a confirmed emergency - the resolution classifies it.

import { normalizePlate, PLATE_PATTERN } from '../utils/validators'
import { normalizeRemarkText } from './visitRemark'

export const EMERGENCY_STATUSES = ['New', 'Acknowledged', 'In Progress', 'Resolved']
export const EMERGENCY_TYPES = ['Ambulance / Medical', 'Fire', 'Police', 'Rescue / Disaster', 'Other']
export const EMERGENCY_CLASSIFICATIONS = ['Confirmed emergency', 'False alarm', 'Test / drill', 'Other']
export const EMERGENCY_ACTION_LABELS = {
  acknowledged: 'Acknowledged',
  'in-progress': 'Marked in progress',
  details: 'Incident details updated',
  remark: 'Remark',
  resolved: 'Resolved',
}
export const EMERGENCY_LIMITS = { agency: 80, destination: 80, text: 500 }
export const NOT_PROVIDED = 'Not provided yet'
export const NOT_AVAILABLE = 'Not available'

const clip = (value, max) => (value ?? '').toString().trim().slice(0, max)

// resolvedAt is only ever written on resolution, so it wins: records resolved by the first
// version of this feature have resolvedAt/By but no status field, and must not reopen as New.
export const emergencyStatusOf = (log) => {
  if (log?.resolvedAt) return 'Resolved'
  return EMERGENCY_STATUSES.includes(log?.status) ? log.status : 'New'
}

/** Incident details staff record after a scan. `recordedAt` is added as server time on write. */
export function validateEmergencyDetails({ type, agency, plateNumber, destination, recordedBy, recordedByName }) {
  if (!EMERGENCY_TYPES.includes(type)) throw new Error('Choose the type of emergency.')
  if (!recordedBy) throw new Error('Emergency details need a signed-in staff member.')
  const plate = normalizePlate(plateNumber)
  if (plate && !PLATE_PATTERN.test(plate)) throw new Error('Plate number is not valid.')
  const details = { type, recordedBy, recordedByName: clip(recordedByName, 80) }
  const agencyClean = clip(agency, EMERGENCY_LIMITS.agency).toUpperCase()
  const destinationClean = clip(destination, EMERGENCY_LIMITS.destination)
  if (agencyClean) details.agency = agencyClean
  if (plate) details.plateNumber = plate
  if (destinationClean) details.destination = destinationClean
  return details
}

export function validateEmergencyText(text, what = 'Remark', { required = true } = {}) {
  const clean = normalizeRemarkText(text)
  if (required && !clean) throw new Error(`${what} is empty.`)
  if (clean.length > EMERGENCY_LIMITS.text) throw new Error(`${what} is too long (max ${EMERGENCY_LIMITS.text} characters).`)
  return clean
}

export function validateEmergencyResolution({ classification, summary }) {
  if (!EMERGENCY_CLASSIFICATIONS.includes(classification)) throw new Error('Choose how this alert turned out.')
  const clean = validateEmergencyText(summary, 'Resolution details', { required: false })
  return clean ? { classification, summary: clean } : { classification }
}

export const emergencyTypeOf = (log) => log?.details?.type || ''

// One event as gate-activity rows, like an ordinary card: its IN tap, plus an OUT row once
// exitAt is set. `rowKey` is unique per row; `id` stays the event id.
export function emergencyScanRows(log) {
  const rows = [{ ...log, rowKey: `${log.id}:IN`, direction: 'IN' }]
  if (log.exitAt) rows.push({ ...log, rowKey: `${log.id}:OUT`, direction: 'OUT', timestamp: log.exitAt, timeApprox: log.exitTimeApprox === true })
  return rows
}

// Actions as a list, oldest first.
export const emergencyActionsOf = (log) => Object.entries(log?.actions || {})
  .map(([id, a]) => ({ id, ...a }))
  .sort((a, b) => (a.at || 0) - (b.at || 0))
