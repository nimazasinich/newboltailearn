import { apiRequest, API_ENDPOINTS } from '@/lib/api-config';

// Monitoring interfaces
export interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  process_memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  system_uptime: number;
  platform: string;
  arch: string;
  timestamp: string;
  active_training: number;
}

export interface TrainingStatus {
  active: number;
  total: number;
  completed: number;
  failed: number;
  success_rate: string;
}

export interface DatasetStatus {
  available: number;
  downloading: number;
  total: number;
}

export interface SystemActivity {
  [level: string]: number;
}

export interface MonitoringData {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  process_memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  system_uptime: number;
  platform: string;
  arch: string;
  timestamp: string;
  active_training: number;
  training: TrainingStatus;
  datasets: DatasetStatus;
  activity: SystemActivity;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  database: 'connected' | 'disconnected';
  version: string;
  components?: {
    database: boolean;
    redis?: boolean;
    storage: boolean;
    external_apis: boolean;
  };
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  metadata?: string;
  timestamp: string;
  model_name?: string; // For training logs
  model_id?: number;
  epoch?: number;
  loss?: number;
  accuracy?: number;
}

// Monitoring API functions
export async function getSystemMetrics(): Promise<MonitoringData> {
  const response = await apiRequest(API_ENDPOINTS.MONITORING);
  return response.json();
}

export async function getHealthCheck(): Promise<HealthCheck> {
  const response = await apiRequest(API_ENDPOINTS.HEALTH);
  return response.json();
}

export async function getPerformanceMetrics(): Promise<{
  cpu_history: number[];
  memory_history: number[];
  timestamps: string[];
  average_response_time: number;
  error_rate: number;
}> {
  const response = await apiRequest(API_ENDPOINTS.MONITORING_PERFORMANCE);
  return response.json();
}

// Logs
export async function getLogs(params?: {
  type?: 'system' | 'training';
  level?: 'info' | 'warning' | 'error' | 'debug';
  limit?: number;
  offset?: number;
}): Promise<LogEntry[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
  }
  
  const query = searchParams.toString();
  const url = query ? `${API_ENDPOINTS.LOGS}?${query}` : API_ENDPOINTS.LOGS;
  
  const response = await apiRequest(url);
  return response.json();
}

export async function getSystemLogs(limit: number = 100): Promise<LogEntry[]> {
  return getLogs({ type: 'system', limit });
}

export async function getTrainingLogs(limit: number = 100): Promise<LogEntry[]> {
  return getLogs({ type: 'training', limit });
}

export async function getErrorLogs(limit: number = 50): Promise<LogEntry[]> {
  return getLogs({ level: 'error', limit });
}

// Export monitoring data
export async function exportMonitoringData(
  format: 'csv' | 'json' = 'json',
  timeRange: '24h' | '7d' | '30d' = '24h'
): Promise<Blob> {
  const response = await apiRequest(`/monitoring/export?format=${format}&timeRange=${timeRange}`);
  return response.blob();
}

// Real-time monitoring helpers
export function getSystemHealthStatus(metrics: SystemMetrics): 'healthy' | 'warning' | 'critical' {
  const cpuThreshold = 80;
  const memoryThreshold = 85;
  
  if (metrics.cpu > 90 || metrics.memory.percentage > 90) {
    return 'critical';
  }
  
  if (metrics.cpu > cpuThreshold || metrics.memory.percentage > memoryThreshold) {
    return 'warning';
  }
  
  return 'healthy';
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getMetricColor(value: number, thresholds: { warning: number; critical: number }): string {
  if (value >= thresholds.critical) {
    return 'text-red-600 bg-red-50';
  }
  if (value >= thresholds.warning) {
    return 'text-yellow-600 bg-yellow-50';
  }
  return 'text-green-600 bg-green-50';
}

export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Alert thresholds
export const ALERT_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 80, critical: 95 },
  disk: { warning: 85, critical: 95 },
  error_rate: { warning: 5, critical: 10 }, // percentage
} as const;