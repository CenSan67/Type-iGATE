import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from './ConfirmModal'
import { logOut } from '../../services/auth'

// Shared logout confirmation - used by the top-bar account menu and Settings' Logout
// button so both go through the same "are you sure?" step and the same sign-out path.
export default function LogoutConfirmModal({ onClose }){
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleConfirm = async () => {
    setLoggingOut(true)
    try {
      await logOut()
    } finally {
      navigate('/login')
    }
  }

  return (
    <ConfirmModal
      title="Log out?"
      message="Are you sure you want to log out of iGate?"
      confirmLabel={loggingOut ? 'Logging out…' : 'Logout'}
      danger
      messageClassName="confirm-message-large"
      confirmClassName="btn-logout-red"
      onConfirm={handleConfirm}
      onClose={loggingOut ? () => {} : onClose}
    />
  )
}
