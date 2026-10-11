// Who a physical RFID card belongs to. Visitor passes come from a limited pool of
// physical cards, so one rfidId can have several rfidUsers records over time - one per
// holder. Every "which person is this card?" lookup in the app goes through here, so a
// returned pass never leaks its previous visitor's details into a later scan, toast,
// registration form or search.
//
// HAND-COPIED in functions/index.js#findOwnerByCard (separate Node package, no shared
// bundler) - keep both in sync if this logic changes.

export function normalizeCardId(value) {
  return (value ?? '').toString().trim().toLowerCase()
}

export function recordsForCard(users, cardId, cardHex) {
  const id = normalizeCardId(cardId)
  const hex = normalizeCardId(cardHex)
  if (!id && !hex) return []
  return users.filter((u) => {
    const rfid = normalizeCardId(u.rfidId)
    return rfid && (rfid === id || rfid === hex)
  })
}

// The card's holder AT `timestamp`: the most recently created record that existed by then
// and had not been returned yet (a returned pass covers scans up to and including its
// returnedAt - the OUT that returned it). Returns null for a scan made while the card was
// unassigned (after a return, before the next registration). Only a scan older than every
// record (clock skew) falls back to the earliest record rather than showing nothing.
export function holderAtTime(users, cardId, cardHex, timestamp) {
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

// The card's holder RIGHT NOW: its Active record, or null if nobody currently holds it.
export function currentHolder(users, rfidId) {
  return recordsForCard(users, rfidId)
    .filter((u) => (u.status || 'Active') === 'Active')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null
}

// A visitor pass that has been handed back - its details belong to that past visit only
// and must never be loaded into a new registration or renewal.
export function isReturnedPass(user) {
  return user?.role === 'Visitor' && (user.status || 'Active') !== 'Active'
}

// The record a Payment registration/renewal of this card should update: its current holder,
// else the latest lapsed (Inactive) non-visitor registration on it. null = treat the card as
// brand new - which is what a returned visitor pass must look like to its next holder.
// services/firebase.js#upsertRfidUser applies the same rule when saving.
export function renewableRecord(users, rfidId) {
  return currentHolder(users, rfidId)
    || recordsForCard(users, rfidId)
      .filter((u) => !isReturnedPass(u))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    || null
}
