import React from 'react'
import Modal from './Modal'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, messageClassName = '', confirmClassName = '', onConfirm, onClose }){
  return (
    <Modal title={title} onClose={onClose}>
      <p className={`form-hint ${messageClassName}`.trim()}>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} ${confirmClassName}`.trim()} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
