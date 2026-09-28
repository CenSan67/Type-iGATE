import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '../../services/auth'
import { isValidEmail, isValidPhone, formatPhoneInput, isValidPassword } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import PasswordRules from '../shared/PasswordRules'
import { ROLES, DEFAULT_SIGNUP_ROLE } from '../../constants/roles'
import logo from '../../assets/bsu_logo-removebg-preview.png'

const icons = {
  person: <><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6v1H4v-1z" fill="currentColor" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" /></>,
  phone: <path d="M6 3h3l1.5 4-2 1.5a11 11 0 006 6L16 12.5l4 1.5v3a2 2 0 01-2 2A15 15 0 013 5a2 2 0 013-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" />,
  badge: <><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" /><circle cx="9" cy="11" r="2" fill="currentColor" /><path d="M14 10h4M14 14h4M6 17c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></>,
  lock: <><path d="M17 8V7a5 5 0 10-10 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" /></>,
}

function Field({ icon, children }){
  return (
    <div className="input-row">
      <span className="input-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">{icons[icon]}</svg>
      </span>
      {children}
    </div>
  )
}

export default function SignupForm(){
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', requestedRole: DEFAULT_SIGNUP_ROLE, password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const { showError } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required.'
    if (!form.email.trim() || !isValidEmail(form.email)) return 'Enter a valid email address.'
    if (!isValidPhone(form.phone)) return 'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).'
    if (!ROLES.includes(form.requestedRole)) return 'Choose the role you are applying for.'
    if (!isValidPassword(form.password)) return 'Password does not meet all the requirements below.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) { showError(problem); return }

    setSubmitting(true)
    try {
      await signUp({ email: form.email.trim(), password: form.password, fullName: form.fullName.trim(), phone: form.phone, requestedRole: form.requestedRole })
      navigate('/pending')
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to create the account right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page signup-page">
      <div className="login-card">
        <img src={logo} alt="BSU logo" className="logo-img" />
        <h2>CREATE ACCOUNT</h2>
        <p className="subtitle">Intelligent Gate Access (iGate)<br/>An administrator must approve new accounts</p>

        <form onSubmit={handleSubmit}>
          <Field icon="person">
            <input className="input-field" placeholder="Full name" value={form.fullName} onChange={update('fullName')} autoComplete="name" />
          </Field>
          <Field icon="mail">
            <input className="input-field" type="email" placeholder="Email address" value={form.email} onChange={update('email')} autoComplete="email" />
          </Field>
          <Field icon="phone">
            <input
              className="input-field"
              type="tel"
              inputMode="numeric"
              maxLength={13}
              placeholder="Mobile number, e.g. 09171234567 (optional)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
              autoComplete="tel-national"
            />
          </Field>
          <Field icon="badge">
            <select className="input-field" value={form.requestedRole} onChange={update('requestedRole')} aria-label="Role you are applying for">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <p className="signup-role-hint">The role you pick is a request - you get access only after verifying your email and an admin approving it.</p>
          <Field icon="lock">
            <input className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={update('password')} autoComplete="new-password" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.5 12a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </button>
          </Field>
          <PasswordRules password={form.password} />
          <Field icon="lock">
            <input className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
          </Field>

          <button type="submit" className="btn-login" disabled={submitting}>{submitting ? 'CREATING ACCOUNT…' : 'SIGN UP'}</button>
        </form>

        <div className="help-row">Already have an account? <Link to="/login">Log in</Link></div>
      </div>
    </div>
  )
}
