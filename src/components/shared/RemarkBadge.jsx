import React from 'react'

const FlagIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 3v18M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
)
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export function RemarkAddButton({ onClick, title = 'Add remark' }){
  return (
    <button type="button" className="remark-btn" onClick={onClick} title={title}>
      <FlagIcon />
    </button>
  )
}

export function RemarkTick({ onClick, title = 'Has remark' }){
  return (
    <button type="button" className="remark-tick-btn" onClick={onClick} title={title}>
      <CheckIcon />
    </button>
  )
}
