import { z } from 'zod'
import { API_URL } from '../lib/config'

type RequestInit = globalThis.RequestInit

const BASE = `${API_URL}/api`
let csrf = ''

// Zod schemas for API responses
export const SystemMetricsSchema = z.object({
  cpu: z.number(),
  memory: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  disk: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  network: z.object({
    download: z.number(),
    upload: z.number(),
  }),
  uptime: z.number(),
  temperature: z.number().optional(),
  timestamp: z.string(),
})

export const TrainingSessionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  accuracy: z.number(),
  loss: z.number(),
  epochs: z.number(),
  current_epoch: z.number(),
  progress: z.number(),
  dataset_id: z.union([z.string(), z.number()]),
  estimated_time: z.number(),
  learning_rate: z.number(),
  batch_size: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  metrics_history: z.array(z.object({
    epoch: z.number(),
    accuracy: z.number(),
    loss: z.number(),
    timestamp: z.string(),
  })),
})

export const DatasetSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  source: z.string(),
  samples: z.number(),
  size_mb: z.number(),
  status: z.string(),
  type: z.string().optional(),
  created_at: z.string(),
  last_used: z.string().optional(),
  description: z.string().optional(),
})

export const HealthSchema = z.object({
  ok: z.boolean(),
  database: z.boolean().optional(),
  tables: z.record(z.number()).optional(),
  timestamp: z.string().optional(),
})

export type SystemMetrics = z.infer<typeof SystemMetricsSchema>
export type TrainingSession = z.infer<typeof TrainingSessionSchema>
export type Dataset = z.infer<typeof DatasetSchema>
export type Health = z.infer<typeof HealthSchema>

async function getCsrf() {
  try {
    const r = await fetch(`${BASE}/csrf-token`, { credentials: 'include' })
    if (r.ok) {
      const j = await r.json()
      csrf = j?.token || ''
    }
  } catch (error) {
    // Ignore CSRF errors
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token') || ''
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as any),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.method && init.method !== 'GET') headers['X-CSRF-Token'] = csrf

  let res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })
  if (res.status === 403) {
    await getCsrf()
    headers['X-CSRF-Token'] = csrf
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

async function requestWithSchema<T>(
  path: string, 
  schema: z.ZodSchema<T>, 
  init: RequestInit = {}
): Promise<T> {
  try {
    const data = await request(path, init)
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`API Schema validation error for ${path}:`, error.errors)
      throw new Error(`Invalid API response format for ${path}`)
    }
    throw error
  }
}

export const API = {
  // Health check
  health: (): Promise<Health> => requestWithSchema('/health', HealthSchema),
  
  // System monitoring
  monitoring: (): Promise<SystemMetrics> => requestWithSchema('/monitoring', SystemMetricsSchema),
  systemStats: (): Promise<SystemMetrics> => requestWithSchema('/system-stats', SystemMetricsSchema),
  
  // Models and training
  models: (): Promise<TrainingSession[]> => requestWithSchema('/models', z.array(TrainingSessionSchema)),
  getModels: (): Promise<TrainingSession[]> => requestWithSchema('/models', z.array(TrainingSessionSchema)),
  getModel: (id: string | number): Promise<TrainingSession> => requestWithSchema(`/models/${id}`, TrainingSessionSchema),
  createModel: (data: any) => request('/models', { method: 'POST', body: JSON.stringify(data) }),
  startTraining: (id: string | number, body?: any) => request(`/models/${id}/start`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  pauseTraining: (id: string | number) => request(`/models/${id}/pause`, { method: 'POST' }),
  stopTraining: (id: string | number) => request(`/models/${id}/stop`, { method: 'POST' }),
  resumeTraining: (id: string | number) => request(`/models/${id}/resume`, { method: 'POST' }),
  
  // Datasets
  datasets: (): Promise<Dataset[]> => requestWithSchema('/datasets', z.array(DatasetSchema)),
  getDatasets: (): Promise<Dataset[]> => requestWithSchema('/datasets', z.array(DatasetSchema)),
  getDataset: (id: string | number): Promise<Dataset> => requestWithSchema(`/datasets/${id}`, DatasetSchema),
  downloadDataset: (id: string | number) => request(`/datasets/${id}/download`, { method: 'POST' }),
  
  // Logs (fallback to raw request since schema varies)
  logs: (params?: { page?: number; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return request(`/logs${query}`)
  },
  getLogs: (params?: { page?: number; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return request(`/logs${query}`)
  },
  
  // Additional API methods
  getAnalytics: () => request('/analytics'),
  getSystemMetrics: (): Promise<SystemMetrics> => requestWithSchema('/system-stats', SystemMetricsSchema),
  getSettings: () => request('/settings'),
  updateSettings: (settings: any) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
}

export async function bootstrapClient() {
  await getCsrf()
}