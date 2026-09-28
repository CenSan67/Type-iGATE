import { useState } from 'react'
import { getQuickRange, toLocalISODate } from '../utils/dateRange'

// Shared "Date Range + Quick Select" filter state (Reports, Payment, Search History).
// Keeps the range coherent: picking a From date after To moves To up to match, and To can
// never be set earlier than From, and neither can be a future date (no data exists yet -
// `maxDate` is today, for the inputs' max attribute). Quick selects fill both dates; clicking the active one clears.
export default function useDateRangeFilter() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeQuick, setActiveQuick] = useState(null)
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
