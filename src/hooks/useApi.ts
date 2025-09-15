import { useState, useEffect, useCallback } from 'react'

type RequestInit = globalThis.RequestInit
import { api, ApiError } from '../lib/api'

export function useApi<T>(endpoint: string, options?: RequestInit, deps: any[] = []) {
  const [data, setData] = useState<T|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try { const d = await api<T>(endpoint, options); setData(d); setLoading(false) }
    catch (e: any) { setError(e?.message || 'Error'); setLoading(false) }
  }, [endpoint, ...(deps||[])])

  useEffect(() => { run() }, [run])

  return { data, loading, error, refetch: run }
}