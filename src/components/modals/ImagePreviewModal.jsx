import React from 'react'
import Modal from './Modal'

export default function ImagePreviewModal({ title = 'Vehicle Snapshot', src, onClose }){
  return (
    <Modal title={title} onClose={onClose}>
      <img src={src} alt={title} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
    </Modal>
  )
}
