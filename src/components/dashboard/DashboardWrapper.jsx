import React from 'react'
import AppShell from '../layout/AppShell'
import DashboardPage from './DashboardPage'

export default function DashboardWrapper(){
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  )
}
