// Mirrors exactly what the ESP32 scanner (sketch_scanner.ino) POSTs: cardId, cardHex,
// direction, timestamp. `source`/`notes` are app-only extensions (e.g. a manually
// simulated scan) the hardware never sends - keep both branches valid.
export const GATE_LOG_DIRECTIONS = ['IN', 'OUT']

/**
 * @typedef {Object} GateLog
 * @property {number|string} [cardId]
 * @property {string} [cardHex]
 * @property {'IN'|'OUT'} direction
 * @property {string} source
 * @property {string} notes
 * @property {number} timestamp
 * @property {string} [imageUrl] - Firebase Storage download URL of the snapshot captured for this
 *   specific scan, if any. Written directly to the leaf via setGateLogImage, not through this
 *   validator - gateLogs entries are never re-validated/merged after creation in this app.
 */

/** @param {Partial<GateLog>} data @returns {GateLog} */
export function validateGateLog(data) {
  if (!data.cardId && !data.cardHex) {
    throw new Error('GateLog: cardId or cardHex is required')
  }
  if (data.direction && !GATE_LOG_DIRECTIONS.includes(data.direction)) {
    throw new Error(`GateLog: direction must be one of ${GATE_LOG_DIRECTIONS.join(', ')}`)
  }
  return {
    cardId: data.cardId ?? null,
    cardHex: data.cardHex ?? null,
    direction: data.direction || 'IN',
    source: data.source || 'unknown',
    notes: data.notes || '',
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
  }
}
