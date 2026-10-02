import { useState } from 'react'
import { getQuickRange, toLocalISODate } from '../utils/dateRange'

// Shared "Date Range + Quick Select" filter state (Reports, Payment, Search History).
// Keeps the range coherent: picking a From date after To moves To up to match, and To can
// never be set earlier than From, and neither can be a future date (no data exists yet -
// `maxDate` is today, for the inputs' max attribute). Quick selects fill both dates; clicking the active one clears.
// `defaultQuick` (e.g. 'Today') seeds the initial range/active-quick state - omit it to keep
// the old default of an unfiltered (empty) range, which Payment/Search History still rely on.
export default function useDateRangeFilter({ defaultQuick = null } = {}) {
  const initial = defaultQuick ? getQuickRange(defaultQuick) : { from: '', to: '' }
  const [dateFrom, setDateFrom] = useState(initial.from)
  const [dateTo, setDateTo] = useState(initial.to)
  const [activeQuick, setActiveQuick] = useState(defaultQuick)
  const maxDate = toLocalISODate(new Date())
  const notFuture = (value) => (value > maxDate ? maxDate : value)

  const changeFrom = (raw) => {
    const value = notFuture(raw)
    setDateFrom(value)
    if (value && dateTo && value > dateTo) setDateTo(value)
    setActiveQuick(null)
  }

  const changeTo = (raw) => {
    const value = notFuture(raw)
    setDateTo(value && dateFrom && value < dateFrom ? dateFrom : value)
    setActiveQuick(null)
  }

  const applyQuick = (kind) => {
    if (activeQuick === kind) {
      setDateFrom('')
      setDateTo('')
      setActiveQuick(null)
      return
    }
    const { from, to } = getQuickRange(kind)
    setDateFrom(from)
    setDateTo(to)
    setActiveQuick(kind)
  }

  return { dateFrom, dateTo, activeQuick, maxDate, changeFrom, changeTo, applyQuick }
}
