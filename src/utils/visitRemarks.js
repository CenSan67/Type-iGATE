// Pure helpers behind hooks/useRemarks.js: which visit each scan belongs to, and which visit each
// stored remark belongs to. A visit = one IN scan of one person plus the OUT(s) after it.

// Who a scan row is for remark purposes: the rfidUsers record it's attributed to, else the card.
export function remarkKeyOf(entry){
  if (!entry) return ''
  if (entry.rfidUserId) return entry.rfidUserId
  return `card:${(entry.rfidId ?? '').toString().toLowerCase()}`
}

// entries: enriched gate logs. Returns { visits: Map(entryId -> { visitId, personKey }),
// insByPerson: Map(personKey -> [{ id, at }] oldest first) }. Per person, oldest first: an IN
// starts a visit (its own id); an OUT belongs to the latest IN before it, or is its own visit.
export function buildVisitIndex(entries = []){
  const byPerson = new Map()
  for (const e of entries) {
    if (!e?.id) continue
    const key = remarkKeyOf(e)
    if (!byPerson.has(key)) byPerson.set(key, [])
    byPerson.get(key).push(e)
  }
  const visits = new Map()
  const insByPerson = new Map()
  for (const [personKey, list] of byPerson) {
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    let currentIn = null
    const ins = []
    for (const e of list) {
      if (e.direction === 'IN') {
        currentIn = e.id
        ins.push({ id: e.id, at: e.timestamp || 0 })
      }
      visits.set(e.id, { visitId: e.direction === 'IN' ? e.id : (currentIn || e.id), personKey })
    }
    insByPerson.set(personKey, ins)
  }
  return { visits, insByPerson }
}

// remarks: the visitRemarks node. Per-visit records ({ personKey } set) are keyed by their visit;
// older per-person records (no personKey, keyed by the person) go to the visit they were written
// during - the person's last IN at or before `at` - marked with `legacyKey`. A per-visit record
// always wins over an older one for the same visit. Returns Map(visitId -> remark).
export function remarksByVisit(remarks = {}, insByPerson = new Map()){
  const map = new Map()
  for (const [key, remark] of Object.entries(remarks || {})) {
    if (!remark?.text || remark.personKey) continue
    const ins = insByPerson.get(key) || []
    const visit = ins.filter((i) => i.at <= (remark.at || 0)).pop() || ins[0]
    if (visit && !map.has(visit.id)) map.set(visit.id, { ...remark, legacyKey: key })
  }
  for (const [key, remark] of Object.entries(remarks || {})) {
    if (remark?.text && remark.personKey) map.set(key, remark)
  }
  return map
}
