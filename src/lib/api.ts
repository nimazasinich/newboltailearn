import { API_BASE } from './config'

type RequestInit = globalThis.RequestInit

export class ApiError extends Error {
  status: number
  response: any
  constructor(message: string, status: number, response?: any) {
    super(message); this.name = 'ApiError'; this.status = status; this.response = response
  }
}

export async function api<T=any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(options.headers||{}) },
      signal: controller.signal,
      ...options
    })
    clearTimeout(t)
    if (!res.ok) {
      let body: any = null
      try { body = await res.json() } catch (error) {
        // Ignore JSON parsing errors
      }
      throw new ApiError(body?.message || `HTTP ${res.status}`, res.status, body)
    }
    const ct = res.headers.get('content-type')||''
    return ct.includes('application/json') ? await res.json() : await res.text() as any
  } catch (e: any) {
    clearTimeout(t)
    if (e.name === 'AbortError') throw new ApiError('Request timeout', 408)
    if (e instanceof ApiError) throw e
    throw new ApiError(e?.message || 'Network error', 0)
  }
}

export const health        = () => api('/health')
export const monitoring    = () => api('/monitoring')
export const models        = () => api('/models')
export const datasets      = () => api('/datasets')
export const logs          = (type='all', limit=100) => api(`/logs?type=${type}&limit=${limit}`)
export const createModel   = (data: any) => api('/models', { method: 'POST', body: JSON.stringify(data) })
export const startTraining = (id: number, cfg: any) => api(`/models/${id}/train`, { method: 'POST', body: JSON.stringify(cfg) })
export const pauseTraining = (id: number) => api(`/models/${id}/pause`, { method: 'POST' })
export const stopTraining  = (id: number) => api(`/models/${id}/stop`, { method: 'POST' })
export const deleteModel   = (id: number) => api(`/models/${id}`, { method: 'DELETE' })