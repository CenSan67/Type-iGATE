import React from 'react'
import useGateStats from '../../hooks/useGateStats'

const RegisteredIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3.5" y="5" width="17" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 20h8M12 17v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M8 10.5l2.4 2.4L16 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const InsideIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M4 16v-3.2c0-.5.2-1 .5-1.4l2-2.4c.3-.4.8-.6 1.3-.6h8.4c.5 0 1 .2 1.3.6l2 2.4c.3.4.5.9.5 1.4V16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <rect x="2.6" y="14.5" width="18.8" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="7" cy="18.6" r="1.4" fill="currentColor" />
    <circle cx="17" cy="18.6" r="1.4" fill="currentColor" />
  </svg>
)

const EntryIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const ExitIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export default function StatsCards(){
  const { totalRegisteredVehicles, vehiclesInsideCampus, todaysEntries, todaysExits } = useGateStats()

  const stats = [
    { value: totalRegisteredVehicles, label: 'Total Registered Vehicles', variant: 'red', Icon: RegisteredIcon },
    { value: vehiclesInsideCampus, label: 'Vehicles Inside Campus', variant: 'gold', Icon: InsideIcon },
    { value: todaysEntries, label: "Today's Entries", variant: 'red', Icon: EntryIcon },
    { value: todaysExits, label: "Today's Exits", variant: 'gold', Icon: ExitIcon },
  ]

  return (
    <div className="stats-panel">
      {stats.map((item) => (
        <div key={item.label} className={`stat-card ${item.variant}`}>
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
          <span className="stat-icon"><item.Icon /></span>
        </div>
      ))}
    </div>
  )
}
