import React, { useEffect, useState } from 'react'
import { sendScannerCommand, listenToScannerCommandAck } from '../../services/firebase'
import useDeviceStatus from '../../hooks/useDeviceStatus'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errors'

const COMMAND_TIMEOUT_MS = 10000 // same as Gate Control's wait for the scanner's ack

// Admin-only (Dashboard): how long a barrier opened by a card scan / Return Pass stays open
// before closing by itself. The value lives on the scanner (SET_AUTO_CLOSE command, saved in
// its flash); the "current" figure is what the scanner itself reports back.
export default function AutoCloseControl(){
  const { scanner } = useDeviceStatus()
  const { user, profile } = useAuth()
  const { showError, showInfo } = useToast()
  const current = scanner?.autoCloseSeconds
  const [seconds, setSeconds] = useState('')
  const [awaitingId, setAwaitingId] = useState(null)
  const [ack, setAck] = useState(null)

  useEffect(() => listenToScannerCommandAck(setAck), [])

  useEffect(() => {
    if (current && seconds === '') setSeconds(String(current))
  }, [current, seconds])

  useEffect(() => {
    if (!awaitingId || ack?.id !== awaitingId) return
    if (ack.result === 'ok') showInfo(`Auto-close set to ${seconds} s.`)
    else showError(`The scanner did not change the auto-close delay: ${ack.result}.`)
    setAwaitingId(null)
  }, [ack, awaitingId, seconds, showError, showInfo])

  useEffect(() => {
    if (!awaitingId) return undefined
    const timer = setTimeout(() => {
      showError('The scanner did not respond - check that it is powered, online and running the latest firmware.')
      setAwaitingId(null)
    }, COMMAND_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [awaitingId, showError])

  const handleSave = async (e) => {
    e.preventDefault()
    const value = Number(seconds)
    try {
      const id = await sendScannerCommand('SET_AUTO_CLOSE', {
        seconds: value,
        actor: { name: profile?.fullName || profile?.displayName || user?.email || '' },
      })
      setAwaitingId(id)
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to send the new auto-close delay.'))
    }
  }

  return (
    <form className="scanner-status-row" onSubmit={handleSave}>
      <label className="form-hint" htmlFor="auto-close-seconds">Barrier auto-close after</label>
      <input
        id="auto-close-seconds"
        type="number"
        min="1"
        max="60"
        step="1"
        value={seconds}
        onChange={(e) => setSeconds(e.target.value)}
        style={{ width: 70 }}
      />
      <span className="form-hint">seconds</span>
      <button type="submit" className="btn-secondary" disabled={!!awaitingId || seconds === ''}>
        {awaitingId ? 'Saving…' : 'Save'}
      </button>
      <span className="form-hint">{current ? `Scanner is set to ${current} s` : 'Current value not reported yet'}</span>
    </form>
  )
}
