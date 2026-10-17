import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { signIn, resetPassword } from '../../services/auth'
import { getErrorMessage } from '../../utils/errors'
import { isValidEmail } from '../../utils/validators'
import logo from '../../assets/bsu_logo-removebg-preview.png'

// Client-side cooldown between attempts, indexed by consecutive fail count (1st wrong
// attempt costs nothing, then it escalates). This is pure UI throttling - it can't stop a
// script that skips the browser and calls Firebase directly; Firebase Auth's own built-in
// throttling (auth/too-many-requests) is what does that.
const COOLDOWN_SCHEDULE_SECONDS = [0, 0, 3, 8, 15, 30]
const cooldownFor = (failCount) => COOLDOWN_SCHEDULE_SECONDS[Math.min(failCount, COOLDOWN_SCHEDULE_SECONDS.length - 1)]

// Wait between reset emails, so repeated clicks can't queue a pile of links (each new one
// also makes the older ones useless). Firebase rate-limits these server-side as well.
const RESET_RESEND_SECONDS = 60

export default function LoginForm(){
  // AuthActionPage sends the user back here with their email + a notice after a reset, or
  // with `forgot: true` from an expired link's "request a new one".
  const location = useLocation()
  const [notice] = useState(location.state?.notice || '')
  const [email,setEmail] = useState(location.state?.email || '')
  const [password,setPassword] = useState('')
  const [showPassword,setShowPassword] = useState(false)
  const [error,setError] = useState(null)
  const [submitting,setSubmitting] = useState(false)
  const [mode,setMode] = useState(location.state?.forgot ? 'forgot' : 'login') // 'login' | 'forgot'
  const [resetSent,setResetSent] = useState(false)
  const [resendUntil,setResendUntil] = useState(0)
  const [resendLeft,setResendLeft] = useState(0)
  const [failCount,setFailCount] = useState(0)
  const [cooldownUntil,setCooldownUntil] = useState(0)
  const [cooldownLeft,setCooldownLeft] = useState(0)
  const navigate = useNavigate()

  // Ticks the visible "try again in Ns" countdown while a cooldown is active.
  useEffect(() => {
    if (!cooldownUntil) { setCooldownLeft(0); return }
    const tick = () => setCooldownLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const handleSubmit = async (e)=>{
    e.preventDefault()
    if (submitting || cooldownLeft > 0) return
    setSubmitting(true)
    setError(null)

    try{
      await signIn(email,password)
      navigate('/dashboard')
    }catch(err){
      // At sign-in this code means the password policy's "force upgrade" caught an old weak
      // password - the password is right, it just has to be replaced first.
      setError(getErrorMessage(err, 'Unable to sign in right now. Please try again.', {
        'auth/password-does-not-meet-requirements': 'Your password no longer meets the security requirements. Use "Forgot password?" below to set a new one.',
      }))
      const nextFailCount = failCount + 1
      setFailCount(nextFailCount)
      const seconds = cooldownFor(nextFailCount)
      if (seconds > 0) setCooldownUntil(Date.now() + seconds * 1000)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!resendUntil) { setResendLeft(0); return }
    const tick = () => setResendLeft(Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [resendUntil])

  // Same success message whether or not the email has an account (no account enumeration).
  const handleResetSubmit = async (e)=>{
    e?.preventDefault()
    if (submitting || resendLeft > 0) return
    if (!email.trim()) { setError('Enter your account email.'); return }
    if (!isValidEmail(email.trim())) { setError('Enter a valid email address, e.g. name@bulsu.edu.ph.'); return }
    setSubmitting(true)
    setError(null)
    try{
      await resetPassword(email)
      setResetSent(true)
      setResendUntil(Date.now() + RESET_RESEND_SECONDS * 1000)
    }catch(err){
      setError(getErrorMessage(err, 'Unable to send a reset link right now. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const backToLogin = () => {
    setMode('login')
    setError(null)
    setResetSent(false)
  }

  if (mode === 'forgot') {
    return (
      <div className="login-page">
        <div className="login-card">
          <img src={logo} alt="BSU logo" className="logo-img" />
          <h2>BULACAN STATE UNIVERSITY</h2>
          <p className="subtitle">Intelligent Gate Access (iGate)<br/>Bustos Campus</p>

          {resetSent ? (
            <>
              <p className="form-success" style={{marginTop:6, textAlign:'center'}}>
                If an account exists for {email.trim()}, a password reset link has been sent. It works once and expires in 1 hour - check your spam folder too.
              </p>
              {error && <div className="form-error" style={{marginTop:6}}>{error}</div>}
              <button type="button" className="btn-login" onClick={backToLogin}>Back to Login</button>
              <div className="help-row">
                <button type="button" className="link-btn" disabled={submitting || resendLeft > 0} onClick={handleResetSubmit}>
                  {resendLeft > 0 ? `Resend link in ${resendLeft}s` : submitting ? 'Sending...' : 'Resend link'}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleResetSubmit}>
              <div className="input-row">
                <span className="input-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5z" fill="currentColor"/><path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor"/></svg>
                </span>
                <input className="input-field" placeholder="Enter your account email" value={email} onChange={e=>setEmail(e.target.value)} />
              </div>

              {error && <div className="form-error" style={{marginTop:6}}>{error}</div>}

              <button type="submit" className="btn-login" disabled={submitting || resendLeft > 0}>{resendLeft > 0 ? `Send again in ${resendLeft}s` : submitting ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
          )}

          <div className="help-row">
            {!resetSent && <button type="button" className="link-btn" onClick={backToLogin}>Back to login</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="BSU logo" className="logo-img" />
        <h2>BULACAN STATE UNIVERSITY</h2>
        <p className="subtitle">Intelligent Gate Access (iGate)<br/>Bustos Campus</p>

        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <span className="input-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5z" fill="currentColor"/><path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor"/></svg>
            </span>
            <input className="input-field" placeholder="Enter your email" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>

          <div className="input-row">
            <span className="input-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 8V7a5 5 0 10-10 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </span>
            <input className="input-field" placeholder="Enter your password" type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.5 12a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div className="help-row" style={{textAlign:'right', margin:'-8px 0 0'}}>
            <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setError(null) }}>Forgot password?</button>
          </div>

          {notice && !error && <div className="form-success" style={{marginTop:6}}>{notice}</div>}
          {error && <div className="form-error" style={{marginTop:6}}>{error}</div>}

          {cooldownLeft > 0 && (
            <p className="form-hint" style={{marginTop:6}}>Too many attempts - please wait {cooldownLeft}s before trying again.</p>
          )}

          <button type="submit" className="btn-login" disabled={submitting || cooldownLeft > 0}>
            {cooldownLeft > 0 ? `Try again in ${cooldownLeft}s` : submitting ? 'Signing in...' : 'LOGIN'}
          </button>
        </form>

        <div className="help-row">Do you have an account? <a href="/signup">Sign-up</a></div>
      </div>
    </div>
  )
}