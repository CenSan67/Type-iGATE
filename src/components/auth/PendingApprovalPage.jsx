import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import useEmailVerification from '../../hooks/useEmailVerification'
import useCancelSignup from '../../hooks/useCancelSignup'
import LogoutConfirmModal from '../modals/LogoutConfirmModal'
import CancelSignupModal from '../modals/CancelSignupModal'
import logo from '../../assets/bsu_logo-removebg-preview.png'

function Step({ done, index, title, children }){
  return (
    <li className={`pending-step ${done ? 'is-done' : ''}`}>
      <span className="pending-step-mark">{done ? '✓' : index}</span>
      <div>
        <h4>{title}</h4>
        {children}
      </div>
    </li>
  )
}

// Landing page for a signed-in account that isn't usable yet: a Pending signup (verify
// email + wait for an admin) or a declined one (Inactive). RequireAuth sends them here.
export default function PendingApprovalPage(){
  const { user, profile, status, loading } = useAuth()
  const { verified, checking, message, check, resend } = useEmailVerification(user, profile)
  const { busy, cancelSignup } = useCancelSignup()
  const [showLogout, setShowLogout] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  // status === null means the login exists but its profile was removed (or is mid-cancel).
  if (status && status !== 'Pending' && status !== 'Inactive') return <Navigate to="/dashboard" replace />

  const removed = !status
  const declined = status === 'Inactive'
  const requestedRole = profile?.requestedRole || profile?.role

  return (
    <div className="login-page signup-page">
      <div className="login-card">
        <img src={logo} alt="BSU logo" className="logo-img" />
        <h2>{removed ? 'ACCOUNT REMOVED' : declined ? 'ACCOUNT NOT ACTIVE' : 'ACCOUNT PENDING'}</h2>
        <p className="subtitle">{removed ? 'This account was removed by an administrator.' : declined ? 'This account was declined or deactivated.' : `Signed in as ${user.email}`}</p>

        {removed ? (
          <p className="pending-note">Use "Start over" below to clear this login, then sign up again.</p>
        ) : declined ? (
          <p className="pending-note">Please contact a Super Admin or Administrator if you think this is a mistake, or start over with a new signup.</p>
        ) : (
          <ol className="pending-steps">
            <Step index={1} done={verified} title="Verify your email">
              {verified ? (
                <p>Your email address is verified.</p>
              ) : (
                <>
                  <p>We sent a link to <strong>{user.email}</strong>. Click it to verify your email, then come back here.</p>
                  <div className="pending-step-actions">
                    <button type="button" className="btn-primary" onClick={() => check()} disabled={checking}>
                      {checking ? 'Checking…' : "I've verified my email"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={resend}>Resend email</button>
                  </div>
                </>
              )}
              {message && <p style={{ marginTop: 8 }}>{message}</p>}
            </Step>

            <Step index={2} done={false} title="Wait for admin approval">
              <p>
                You requested the <strong>{requestedRole}</strong> role. An administrator will review it
                {verified ? '' : ' once your email is verified'} - this page updates automatically when you are approved.
              </p>
            </Step>
          </ol>
        )}

        <button type="button" className="btn-secondary pending-start-over" onClick={() => setShowCancel(true)}>{removed ? 'Start over' : 'Cancel signup & start over'}</button>
        <button type="button" className="btn-login" onClick={() => setShowLogout(true)}>LOGOUT</button>
      </div>

      {showLogout && <LogoutConfirmModal onClose={() => setShowLogout(false)} />}
      {showCancel && <CancelSignupModal busy={busy} onConfirm={cancelSignup} onClose={() => setShowCancel(false)} />}
    </div>
  )
}
