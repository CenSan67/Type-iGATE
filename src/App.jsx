import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/auth/LoginForm'
import SignupPage from './components/auth/SignupForm'
import PendingApprovalPage from './components/auth/PendingApprovalPage'
import RequireAuth from './components/auth/RequireAuth'
import RequireRole from './components/auth/RequireRole'
import DashboardWrapper from './components/dashboard/DashboardWrapper'
import AccountManagementWrapper from './components/accounts/AccountManagementWrapper'
import SearchHistoryWrapper from './components/search-history/SearchHistoryWrapper'
import ReportsWrapper from './components/reports/ReportsWrapper'
import PaymentWrapper from './components/payment/PaymentWrapper'
import SettingsWrapper from './components/settings/SettingsWrapper'
import ProfileWrapper from './components/profile/ProfileWrapper'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppStateProvider } from './context/AppStateContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { initializeFirebaseCollections } from './services/firebase'
import { ADMIN_ROLES } from './constants/roles'
import useGateExitNotifications from './hooks/useGateExitNotifications'

function AppRoutes() {
  const { user, role, status, loading } = useAuth()
  const { showError } = useToast()

  // Phase 9: settings/app and users/system are now Super Admin/Administrator-only
  // writes (database.rules.json) - this bootstrap seed would otherwise throw a
  // permission-denied on every Security Guard login. Only admins need to run it
  // anyway, since it's an idempotent seed, not something every login must repeat.
  useEffect(() => {
    if (!loading && user && ADMIN_ROLES.includes(role)) initializeFirebaseCollections((msg) => showError(msg))
  }, [user, role, loading])

  // Any staff role, not just admins - exits matter to whoever's on gate duty, regardless
  // of which page they're currently on. Gated on status 'Active' (not just a signed-in user):
  // a Pending/Inactive account sitting on /pending has no database.rules.json access to
  // gateLogs/rfidUsers at all, so subscribing for it would just be a permission-denied loop.
  useGateExitNotifications(!loading && status === 'Active')

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pending" element={<PendingApprovalPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardWrapper />} />
        <Route path="/search-history" element={<SearchHistoryWrapper />} />
        <Route path="/reports" element={<ReportsWrapper />} />
        <Route path="/payment" element={<PaymentWrapper />} />
        <Route path="/profile" element={<ProfileWrapper />} />
        {/* Phase 12: reachable by every staff role (Security Guard included) - it's
            where the barrier gate override now lives, plus My Profile/Change Password/
            Logout for roles that have no other route to reach those. */}
        <Route path="/settings" element={<SettingsWrapper />} />

        <Route element={<RequireRole allowedRoles={ADMIN_ROLES} />}>
          <Route path="/account-management" element={<AccountManagementWrapper />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AppStateProvider>
    </AuthProvider>
  )
}
