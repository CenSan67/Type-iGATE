import React from 'react'
import AppShell from '../layout/AppShell'
import SearchHistoryPage from './SearchHistoryPage'

export default function SearchHistoryWrapper(){
  return (
    <AppShell>
      <SearchHistoryPage />
    </AppShell>
  )
}
