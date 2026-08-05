import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/auth/LoginForm'
import DashboardWrapper from './components/dashboard/DashboardWrapper'
import AccountManagementWrapper from './components/accounts/AccountManagementWrapper'
import SearchHistoryWrapper from './components/search-history/SearchHistoryWrapper'
import ReportsWrapper from './components/reports/ReportsWrapper'
import PaymentWrapper from './components/payment/PaymentWrapper'
import SettingsWrapper from './components/settings/SettingsWrapper'
import ProfileWrapper from './components/profile/ProfileWrapper'
import { AuthProvider } from './context/AuthContext'
import { AppStateProvider } from './context/AppStateContext'
import { initializeFirebaseCollections } from './services/firebase'

export default function App() {
  useEffect(() => {
    initializeFirebaseCollections()
  }, [])

  return (
    <AuthProvider>
      <AppStateProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardWrapper />} />
          <Route path="/account-management" element={<AccountManagementWrapper />} />
          <Route path="/search-history" element={<SearchHistoryWrapper />} />
          <Route path="/reports" element={<ReportsWrapper />} />
          <Route path="/payment" element={<PaymentWrapper />} />
          <Route path="/settings" element={<SettingsWrapper />} />
          <Route path="/profile" element={<ProfileWrapper />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppStateProvider>
    </AuthProvider>
  )
}
