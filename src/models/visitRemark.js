// A gate remark on one person's current visit (visitRemarks/{personKey}), written by any Active
// staff from the Dashboard's Recent Vehicle Activity or Search History. personKey = the person's
// rfidUsers record id, or `card:<rfidId>` for a scan whose holder is unknown (hooks/useRemarks.js
// #remarkKeyOf). Kept in its own node - never on rfidUsers - so saving a remark can't touch the
// owner record, and editing the owner record can't overwrite the remark.
//
// Mirrored in database.rules.json (text 1-500 chars, at = server time, by = the writer's uid).

/**
 * @typedef {Object} VisitRemark
 * @property {string} text      1-500 characters, line breaks kept
 * @property {number} at        server time it was saved (compared against IN scan times)
 * @property {string} by        uid of the staff member who saved it
 * @property {string} byName    their display name at the time
 */

export const REMARK_MAX_LENGTH = 500

// Line breaks are kept (normalized to \n); only leading/trailing whitespace and runs of 3+ blank
// lines are trimmed. '' means "no remark" - the caller removes the record instead of saving it.
export function normalizeRemarkText(value) {
  return (value ?? '')
    .toString()
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** @returns {{ text: string, by: string, byName: string }} (`at` is added as server time on write) */
export function validateVisitRemark({ text, by, byName }) {
  const clean = normalizeRemarkText(text)
  if (!clean) throw new Error('Remark is empty.')
  if (clean.length > REMARK_MAX_LENGTH) throw new Error(`Remark is too long (max ${REMARK_MAX_LENGTH} characters).`)
  if (!by) throw new Error('Remark needs a signed-in staff member.')
  return { text: clean, by, byName: (byName || '').toString().slice(0, 80) }
}
