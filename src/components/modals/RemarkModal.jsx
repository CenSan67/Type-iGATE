import React, { useState } from 'react'
import Modal from './Modal'

export default function RemarkModal({ name, rfid, initialRemark, onClose, onSave }){
  const [text, setText] = useState(initialRemark || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(text)
    onClose()
  }

  return (
    <Modal title={`Remark - ${name}`} onClose={onClose}>
      <form className="registration-form" onSubmit={handleSubmit}>
        <label>
          RFID-ID
          <input value={rfid} readOnly />
        </label>
        <label>
          Remark
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Not the registered owner, vehicle borrowed by a relative..."
            autoFocus
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save Remark</button>
        </div>
      </form>
    </Modal>
  )
}
