import React from 'react'
import AppShell from '../layout/AppShell'
import SettingsPage from './SettingsPage'

export default function SettingsWrapper(){
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  )
}
