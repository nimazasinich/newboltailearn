/**
 * Worker Thread Types and Interfaces
 * Defines the message passing protocol and data structures for training workers
 */

export interface WorkerMessage {
  id: string;
  type: WorkerMessageType;
  data: any;
  timestamp: number;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface WorkerProgressUpdate {
  id: string;
  type: 'progress' | 'checkpoint' | 'error' | 'complete';
  data: any;
  timestamp: number;
}

export enum WorkerMessageType {
  TRAIN = 'train',
  EVALUATE = 'evaluate',
  PREDICT = 'predict',
  STOP = 'stop',
  STATUS = 'status',
  CLEANUP = 'cleanup'
}

export interface TrainingWorkerData {
  modelId: number;
  datasetId: string;
  config: TrainingConfig;
  sessionId: number;
  userId: number;
  checkpointPath?: string;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit?: number;
  earlyStopping?: boolean;
  patience?: number;
  saveCheckpoints?: boolean;
  checkpointInterval?: number;
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
  learningRate: number;
  batchSize: number;
  timestamp: string;
  estimatedTimeRemaining?: number;
}

export interface WorkerMetrics {
  workerId: string;
  cpuUsage: number;
  memoryUsage: number;
  messageLatency: number;
  tasksCompleted: number;
  tasksFailed: number;
  uptime: number;
  lastActivity: number;
}

export interface WorkerPoolConfig {
  maxWorkers: number;
  maxMemoryPerWorker: number; // in MB
  maxTasksPerWorker: number;
  workerTimeout: number; // in ms
  enableMetrics: boolean;
  enableCheckpoints: boolean;
}

export interface WorkerTask {
  id: string;
  type: WorkerMessageType;
  data: any;
  priority: number;
  createdAt: number;
  timeout: number;
  retries: number;
  maxRetries: number;
}

export interface WorkerStatus {
  id: string;
  isActive: boolean;
  currentTask?: WorkerTask;
  queueLength: number;
  metrics: WorkerMetrics;
  lastHeartbeat: number;
}

export interface TrainingResult {
  modelId: number;
  sessionId: number;
  finalLoss: number;
  finalAccuracy: number;
  totalEpochs: number;
  trainingTime: number;
  checkpointPath?: string;
  metrics: {
    peakMemoryUsage: number;
    averageEpochTime: number;
    totalBatches: number;
  };
}

export interface EvaluationData {
  modelId: number;
  testDatasetId: string;
  checkpointPath?: string;
}

export interface EvaluationResult {
  modelId: number;
  testDatasetId: string;
  loss: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  predictions: number[];
  probabilities: number[][];
}

export interface PredictionData {
  modelId: number;
  texts: string[];
  checkpointPath?: string;
}

export interface PredictionResult {
  modelId: number;
  predictions: Array<{
    text: string;
    class: number;
    probabilities: number[];
    confidence: number;
  }>;
}

export interface WorkerError {
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
  timestamp: number;
}

export interface WorkerHealthCheck {
  workerId: string;
  isHealthy: boolean;
  issues: string[];
  metrics: WorkerMetrics;
  timestamp: number;
}

// Environment configuration
export interface WorkerEnvironment {
  USE_WORKERS: boolean;
  MAX_WORKERS: number;
  WORKER_MEMORY_LIMIT: number;
  WORKER_TIMEOUT: number;
  ENABLE_METRICS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// Performance monitoring
export interface PerformanceMetrics {
  mainThreadResponseTime: number;
  workerUtilization: number;
  memoryUsage: {
    total: number;
    workers: number;
    main: number;
  };
  throughput: {
    tasksPerSecond: number;
    averageTaskTime: number;
  };
  errorRate: number;
}

// Event types for Socket.IO
export interface WorkerEvents {
  'worker_progress': WorkerProgressUpdate;
  'worker_complete': TrainingResult;
  'worker_error': WorkerError;
  'worker_metrics': WorkerMetrics;
  'worker_health': WorkerHealthCheck;
}