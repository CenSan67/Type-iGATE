import React from 'react'

export default function Modal({ title, onClose, className = '', children }){
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
