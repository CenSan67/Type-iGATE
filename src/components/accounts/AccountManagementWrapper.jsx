import React from 'react'
import AppShell from '../layout/AppShell'
import AccountManagementPage from './AccountManagementPage'

export default function AccountManagementWrapper(){
  return (
    <AppShell>
      <AccountManagementPage />
    </AppShell>
  )
}
