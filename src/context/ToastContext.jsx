import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext({ showError: () => {}, showInfo: () => {} })

const TOAST_DURATION_MS = 5000
const MAX_TOASTS = 3

// Lightweight, non-blocking popups. Wraps the whole app so any component or hook can call
// `showError(message)` (or `showInfo` for a neutral confirmation) instead of rendering its
// own inline paragraph.
export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message, type) => {
    if (!message) return
    const id = ++nextId.current
    // Re-showing the same message replaces the old toast, so a repeated failure still gives feedback.
    setToasts((list) => [...list.filter((t) => t.message !== message), { id, message, type }].slice(-MAX_TOASTS))
    timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION_MS))
  }, [dismiss])

  const showError = useCallback((message) => show(message, 'error'), [show])
  const showInfo = useCallback((message) => show(message, 'info'), [show])

  useEffect(() => {
    const active = timers.current
    return () => active.forEach(clearTimeout)
  }, [])

  return (
    <ToastContext.Provider value={{ showError, showInfo }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            <span className="toast-message">{t.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(){
  return useContext(ToastContext)
}
