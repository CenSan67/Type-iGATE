// "3h 05m" / "45m" / "2d 4h" - for stay lengths and thresholds.
export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor((ms || 0) / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}
