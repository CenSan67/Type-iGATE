// Who held a physical RFID card at a given time. Visitor passes come from a limited pool of
// cards, so one rfidId can have several rfidUsers records over time - one per holder.
//
// HAND-COPY of src/utils/cardHolder.js (normalizeCardId / recordsForCard / holderAtTime):
// functions/ is a separate Node package with no bundler linking it to src/ - keep the two in
// sync if this logic changes.

function normalizeCardId(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

function recordsForCard(users, cardId, cardHex) {
  const id = normalizeCardId(cardId)
  const hex = normalizeCardId(cardHex)
  if (!id && !hex) return []
  return users.filter((u) => {
    const rfid = normalizeCardId(u.rfidId)
    return rfid && (rfid === id || rfid === hex)
  })
}

// The card's holder AT `timestamp`: the most recently created record that existed by then and
// had not been returned yet (a returned pass covers scans up to and including its returnedAt).
// null for a scan made while the card was unassigned. Only a scan older than every record
// (clock skew) falls back to the earliest record.
function holderAtTime(users, cardId, cardHex, timestamp) {
  const candidates = recordsForCard(users, cardId, cardHex)
  if (candidates.length === 0) return null
  const t = timestamp ?? Infinity

  const created = candidates.filter((u) => (u.createdAt || 0) <= t)
  if (created.length === 0) {
    return candidates.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0]
  }
  return created
    .filter((u) => u.returnedAt == null || t <= u.returnedAt)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null
}

module.exports = { normalizeCardId, recordsForCard, holderAtTime }
