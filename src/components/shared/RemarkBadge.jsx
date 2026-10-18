import React from 'react'

const FlagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3v18M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export function RemarkAddButton({ onClick, title = 'Add remark' }){
  return (
    <button type="button" className="remark-btn" onClick={onClick} title={title} aria-label={title}>
      <FlagIcon />
    </button>
  )
}

export function RemarkTick({ onClick, title = 'Has remark' }){
  return (
    <button type="button" className="remark-tick-btn" onClick={onClick} title={title} aria-label={title}>
      <CheckIcon />
    </button>
  )
}

// One-line remark preview for tables/cards: long text is cut with an ellipsis, the full text (line
// breaks kept) is in the tooltip and in the modal opened by clicking it.
// `large`: a highlighted box showing up to 3 lines (line breaks kept) - used on the Dashboard,
// where the guard needs to read it at a glance.
export function RemarkPreview({ text, onClick, large = false }){
  if (!text) return null
  return (
    <button type="button" className={`remark-preview${large ? ' remark-preview-large' : ''}`} onClick={onClick} title={text}>
      {large ? text : text.replace(/\s*\n\s*/g, ' · ')}
    </button>
  )
}
