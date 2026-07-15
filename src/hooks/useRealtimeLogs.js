import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'

export default function useRealtimeLogs(limitCount=10){
  const [logs,setLogs] = useState([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    const q = query(collection(db,'gateLogs'), orderBy('timestamp','desc'), limit(limitCount))
    const unsub = onSnapshot(q,snap=>{
      const arr = snap.docs.map(d=>({id:d.id, ...d.data()}))
      setLogs(arr)
      setLoading(false)
    }, err=>{
      console.error('Realtime logs error',err)
      setLoading(false)
    })
    return unsub
  },[limitCount])

  return {logs,loading}
}
