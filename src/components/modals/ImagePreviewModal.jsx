import React from 'react'
import Modal from './Modal'

export default function ImagePreviewModal({ title = 'Vehicle Snapshot', src, onClose }){
  return (
    <Modal title={title} onClose={onClose}>
      {/* maxHeight: a tall (portrait) photo stays whole on a phone screen instead of overflowing */}
      <img src={src} alt={title} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
    </Modal>
  )
}
