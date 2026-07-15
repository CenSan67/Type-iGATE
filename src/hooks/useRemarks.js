import { useCallback, useState } from 'react'

const STORAGE_KEY = 'igate_user_remarks'

function loadRemarks(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useRemarks(){
  const [remarks, setRemarks] = useState(loadRemarks)

  const saveRemark = useCallback((rfid, text) => {
    setRemarks((prev) => {
      const next = { ...prev }
      if (text && text.trim()) next[rfid] = text.trim()
      else delete next[rfid]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { remarks, saveRemark }
}
