import React from 'react'

const stats = [
  { value: '30', label: 'Car', variant: 'red' },
  { value: '77', label: 'Students', variant: 'gold' },
  { value: '50', label: 'Faculty', variant: 'red' },
  { value: '99', label: 'Motorcycles', variant: 'gold' },
  { value: '127', label: 'TOTAL', variant: 'red' },
]

export default function StatsCards(){
  return (
    <div className="stats-panel">
      {stats.map((item) => (
        <div key={item.label} className={`stat-card ${item.variant}`}>
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
