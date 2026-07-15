import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../../services/auth'
import logo from '../../assets/bsu_logo-removebg-preview.png'

export default function LoginForm(){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [showPassword,setShowPassword] = useState(false)
  const [error,setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e)=>{
    e.preventDefault()

    // --- BYPASS CODE START ---
    // If you type "admin" and "123456", it will skip Firebase and take you straight inside!
    if (email === "admin@bulsu.edu.ph" && password === "123456") {
      navigate('/dashboard')
      return
    }
    // --- BYPASS CODE END ---

    try{
      await signIn(email,password)
      navigate('/dashboard')
    }catch(err){
      setError(err.message)
    }
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
            <input className="input-field" placeholder="Enter your username" value={email} onChange={e=>setEmail(e.target.value)} />
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

          {error && <div style={{color:'red',marginTop:6}}>{error}</div>}

          <button type="submit" className="btn-login">LOGIN</button>
        </form>

        <div className="help-row">Do you have an account? <a href="/signup">Sign-up</a></div>
      </div>
    </div>
  )
}