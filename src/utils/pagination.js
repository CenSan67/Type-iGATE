// Builds a compact page-number list with '…' gaps (e.g. [1, '…', 4, 5, 6, '…', 45])
// instead of one button per page - with large datasets (hundreds of gateLogs entries
// across dozens of pages), rendering every page number breaks the layout.
export function buildPageList(current, total, siblings = 1) {
  if (total <= 1) return [1]

  const pages = new Set([1, total, current])
  for (let i = 1; i <= siblings; i++) {
    if (current - i >= 1) pages.add(current - i)
    if (current + i <= total) pages.add(current + i)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const result = []
  let prev = null
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) result.push('…')
    result.push(p)
    prev = p
  }
  return result
}
