import React from 'react'
import AppShell from '../layout/AppShell'
import ProfilePage from './ProfilePage'

export default function ProfileWrapper(){
  return (
    <AppShell>
      <ProfilePage />
    </AppShell>
  )
}
