import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuthAction from '../../hooks/useAuthAction'
import PasswordRules from '../shared/PasswordRules'
import { isValidPassword } from '../../utils/validators'
import logo from '../../assets/bsu_logo-removebg-preview.png'

// Landing page for the links in Firebase's emails (password reset, email verification).
// Set as the action URL in Firebase console -> Authentication -> Templates.
export default function AuthActionPage(){
  const [params] = useSearchParams()
  const { status, email, error, formError, submitNewPassword } = useAuthAction(params.get('mode'), params.get('oobCode'))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = status === 'ready' && isValidPassword(password) && password === confirm

  const handleSubmit = (e) => {
    e.preventDefault()
    if (canSubmit) submitNewPassword(password)
  }

  const goToLogin = () => navigate('/login', { state: { email, notice: 'Password changed. Sign in with your new password.' } })

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="BSU logo" className="logo-img" />
        <h2>BULACAN STATE UNIVERSITY</h2>
        <p className="subtitle">Intelligent Gate Access (iGate)<br/>Bustos Campus</p>

        {status === 'checking' && <p className="form-hint" role="status" style={{textAlign:'center'}}>Checking your link…</p>}

        {status === 'error' && (
          <>
            <div className="form-error" role="alert" style={{textAlign:'center'}}>{error}</div>
            <div className="help-row"><Link to="/login" state={{ forgot: true }}>Request a new reset link</Link> · <Link to="/login">Back to login</Link></div>
          </>
        )}

        {status === 'verified' && (
          <>
            <p className="form-success" style={{textAlign:'center'}}>Your email is verified. An administrator still has to approve your account before you can use iGate.</p>
            <Link to="/pending" className="btn-login" style={{display:'block', textAlign:'center'}}>Continue</Link>
          </>
        )}

        {status === 'emailChanged' && (
          <>
            <p className="form-success" style={{textAlign:'center'}}>Your email has been changed. Sign in again with the new email (or your username).</p>
            <Link to="/login" className="btn-login" style={{display:'block', textAlign:'center'}}>Go to login</Link>
          </>
        )}

        {status === 'emailRestored' && (
          <>
            <p className="form-success" style={{textAlign:'center'}}>Your previous email has been restored. If you didn't ask for the change, reset your password now - someone may know it.</p>
            <Link to="/login" state={{ forgot: true }} className="btn-login" style={{display:'block', textAlign:'center'}}>Reset password</Link>
          </>
        )}

        {status === 'done' && (
          <>
            <p className="form-success" style={{textAlign:'center'}}>Your password has been changed. Every other device signed in to this account has been signed out.</p>
            <button type="button" className="btn-login" onClick={goToLogin}>Go to login</button>
          </>
        )}

        {(status === 'ready' || status === 'saving') && (
          <form onSubmit={handleSubmit}>
            <p className="form-hint" style={{textAlign:'center', marginTop:0}}>Set a new password for <strong>{email}</strong></p>

            <div className="input-row">
              <input className="input-field" placeholder="New password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={status === 'saving'} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.5 12a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="input-row">
              <input className="input-field" placeholder="Confirm new password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={status === 'saving'} />
            </div>

            <PasswordRules password={password} />
            {mismatch && <div className="form-error">Passwords do not match.</div>}
            {formError && <div className="form-error" role="alert">{formError}</div>}

            <button type="submit" className="btn-login" disabled={!canSubmit}>{status === 'saving' ? 'Saving…' : 'Change password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
