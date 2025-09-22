import { apiRequest, API_ENDPOINTS } from '@/lib/api-config';

// Analytics interfaces
export interface AnalyticsOverview {
  totalModels: number;
  activeTraining: number;
  completedToday: number;
  systemHealth: number;
}

export interface PerformanceMetrics {
  cpuUsage: number[];
  memoryUsage: number[];
  gpuUsage: number[];
  timestamps: string[];
}

export interface ModelMetrics {
  id: string;
  name: string;
  accuracy: number;
  loss: number;
  epochs: number;
  type: string;
  dataset: string;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  performance: PerformanceMetrics;
  modelMetrics: ModelMetrics[];
  modelStats: Array<{
    type: string;
    count: number;
    avg_accuracy: number;
    max_accuracy: number;
  }>;
  trainingStats: Array<{
    date: string;
    models_created: number;
  }>;
  recentActivity: Array<{
    level: string;
    count: number;
  }>;
  summary: {
    totalModels: number;
    activeTraining: number;
    completedModels: number;
    totalDatasets: number;
  };
}

export interface AdvancedAnalytics {
  modelPerformance: Array<{
    modelId: string;
    modelName: string;
    modelType: string;
    accuracy: number;
    loss: number;
    epochs: number;
    current_epoch: number;
    created_at: string;
    updated_at: string;
    datasetName: string;
    precision: number;
    recall: number;
    f1Score: number;
    trainingTime: number;
    inferenceTime: number;
    memoryUsage: number;
    convergenceRate: number;
    stability: number;
  }>;
  trainingAnalytics: {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    averageTrainingTime: number;
    bestAccuracy: number;
    totalTrainingHours: number;
    modelsByType: Record<string, number>;
    performanceTrend: Array<{
      date: string;
      accuracy: number;
      loss: number;
      models: number;
    }>;
    successRate: number;
    averageEpochs: number;
    totalModels: number;
    activeTraining: number;
  };
  systemAnalytics: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage: number;
    diskUsage: number;
    networkThroughput: number;
    activeConnections: number;
    errorRate: number;
    uptime: number;
    throughput: number;
    latency: number;
    queueSize: number;
  };
  recommendations: string[];
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Analytics API functions
export async function getAnalytics(): Promise<AnalyticsData> {
  const response = await apiRequest(API_ENDPOINTS.ANALYTICS);
  return response.json();
}

export async function getAdvancedAnalytics(timeRange: string = '30d'): Promise<AdvancedAnalytics> {
  const response = await apiRequest(`${API_ENDPOINTS.ANALYTICS_ADVANCED}?timeRange=${timeRange}`);
  return response.json();
}

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  const response = await apiRequest(API_ENDPOINTS.ANALYTICS_PERFORMANCE);
  return response.json();
}

export async function getUsageAnalytics(): Promise<{
  dailyUsage: Array<{ date: string; requests: number; users: number }>;
  topEndpoints: Array<{ endpoint: string; count: number; avgResponseTime: number }>;
  errorRates: Array<{ date: string; errors: number; total: number }>;
}> {
  const response = await apiRequest(API_ENDPOINTS.ANALYTICS_USAGE);
  return response.json();
}

// Export analytics data
export async function exportAnalytics(format: 'csv' | 'json' = 'json'): Promise<Blob> {
  const response = await apiRequest(`/analytics/export?format=${format}`);
  return response.blob();
}

// Real-time analytics helpers
export function calculateSuccessRate(successful: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((successful / total) * 100);
}

export function formatTrainingTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getHealthStatus(percentage: number): 'excellent' | 'good' | 'warning' | 'critical' {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 70) return 'good';
  if (percentage >= 50) return 'warning';
  return 'critical';
}

export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}