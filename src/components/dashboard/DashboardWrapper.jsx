import React from 'react'
import AppShell from '../layout/AppShell'
import TopHeader from '../layout/TopHeader'
import DashboardPage from './DashboardPage'

export default function DashboardWrapper(){
  return (
    <AppShell topbar={<TopHeader />}>
      <DashboardPage />
    </AppShell>
  )
}
