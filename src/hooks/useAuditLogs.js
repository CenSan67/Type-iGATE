import { useEffect, useState } from 'react'
import { listenToAuditLogs } from '../services/firebase'

// Latest audit entries (who changed what), newest first. Super Admin only (rules).
export default function useAuditLogs() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const unsub = listenToAuditLogs(setLogs)
    return () => unsub && unsub()
  }, [])

  return logs
}
