import React from 'react'

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" /><path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const UnlockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" /><path d="M8 11V8a4 4 0 017.94-.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function GateButton({ label, isOpen, onToggle }){
  return (
    <button type="button" className={`gate-toggle-btn ${isOpen ? 'open' : 'closed'}`} onClick={onToggle}>
      <span className="gate-icon">{isOpen ? <UnlockIcon /> : <LockIcon />}</span>
      <span className="gate-text">
        <strong>{isOpen ? 'Close' : 'Open'}</strong>
        <small>{label}</small>
      </span>
      <span className="gate-chevrons"><Chevron /><Chevron /></span>
    </button>
  )
}
