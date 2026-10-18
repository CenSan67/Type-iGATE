import React, { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

// Large view of one photo. `children` (optional) renders under the image, e.g. scan details.
// A photo that fails to load (deleted object, expired/invalid link, offline) shows a message
// with a Retry instead of a broken-image icon; Escape closes the dialog.
export default function ImagePreviewModal({ title = 'Vehicle Snapshot', src, onClose, children }){
  const [failed, setFailed] = useState(!src)
  const [attempt, setAttempt] = useState(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => { setFailed(!src); setAttempt(0) }, [src])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Modal title={title} onClose={onClose} className="image-preview-modal">
      {failed ? (
        <div className="snapshot-unavailable">
          <p>This photo couldn't be loaded. It may have been removed, the link may be invalid, or you may be offline.</p>
          {src && <button type="button" className="btn-secondary" onClick={() => { setFailed(false); setAttempt((n) => n + 1) }}>Retry</button>}
        </div>
      ) : (
        // maxHeight: a tall (portrait) photo stays whole on a phone screen instead of overflowing
        <img key={attempt} src={src} alt={title} onError={() => setFailed(true)} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
      )}
      {children}
    </Modal>
  )
}
