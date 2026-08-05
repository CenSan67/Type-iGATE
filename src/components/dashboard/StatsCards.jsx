import React, { useEffect, useState } from 'react'
import { listenToRfidUsers } from '../../services/firebase'

const emptyCounts = { total: 0, students: 0, faculty: 0, cars: 0, motorcycles: 0 }

const CarIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M4 16v-3.2c0-.5.2-1 .5-1.4l2-2.4c.3-.4.8-.6 1.3-.6h8.4c.5 0 1 .2 1.3.6l2 2.4c.3.4.5.9.5 1.4V16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <rect x="2.6" y="14.5" width="18.8" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="7" cy="18.6" r="1.4" fill="currentColor" />
    <circle cx="17" cy="18.6" r="1.4" fill="currentColor" />
  </svg>
)

const GradCapIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 4l9.5 4.4L12 12.8 2.5 8.4 12 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M6 10.4v4.4c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M21.5 8.4v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const FacultyIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3.5" y="5" width="17" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 20h8M12 17v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M8 10.5l2.4 2.4L16 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MotorcycleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="5.5" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="18.5" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 17.5h5.5l3-6h2.3M13.5 11.5H10l-1.5 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 8h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const PeopleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 19c.9-3.2 3.2-4.8 6-4.8s5.1 1.6 6 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15 14.6c2.3.2 4 1.7 4.7 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export default function StatsCards(){
  const [counts, setCounts] = useState(emptyCounts)

  useEffect(() => {
    const unsub = listenToRfidUsers((users) => {
      const next = users.reduce((acc, user) => {
        const role = (user.role || '').toLowerCase()
        const vehicle = (user.vehicleType || user.vehicle || '').toLowerCase()
        if (role === 'student') acc.students += 1
        else if (role === 'faculty') acc.faculty += 1
        if (vehicle === 'car') acc.cars += 1
        else if (vehicle === 'motorcycle') acc.motorcycles += 1
        acc.total += 1
        return acc
      }, { ...emptyCounts })

      setCounts(next)
    })

    return () => unsub && unsub()
  }, [])

  const stats = [
    { value: counts.cars, label: 'Car', variant: 'red', Icon: CarIcon },
    { value: counts.students, label: 'Students', variant: 'gold', Icon: GradCapIcon },
    { value: counts.faculty, label: 'Faculty', variant: 'red', Icon: FacultyIcon },
    { value: counts.motorcycles, label: 'Motorcycles', variant: 'gold', Icon: MotorcycleIcon },
    { value: counts.total, label: 'TOTAL', variant: 'red wide', Icon: PeopleIcon },
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
