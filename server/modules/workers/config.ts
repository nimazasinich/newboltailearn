/**
 * Worker Thread Configuration
 * Environment variables and configuration for worker thread management
 */

export interface WorkerEnvironment {
  USE_WORKERS: boolean;
  MAX_WORKERS: number;
  WORKER_MEMORY_LIMIT: number;
  WORKER_TIMEOUT: number;
  ENABLE_METRICS: boolean;
  ENABLE_CHECKPOINTS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Get worker environment configuration
 */
export function getWorkerEnvironment(): WorkerEnvironment {
  return {
    USE_WORKERS: process.env.USE_WORKERS === 'true',
    MAX_WORKERS: parseInt(process.env.MAX_WORKERS || '4'),
    WORKER_MEMORY_LIMIT: parseInt(process.env.WORKER_MEMORY_LIMIT || '512'),
    WORKER_TIMEOUT: parseInt(process.env.WORKER_TIMEOUT || '300000'), // 5 minutes
    ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
    ENABLE_CHECKPOINTS: process.env.ENABLE_CHECKPOINTS !== 'false',
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info'
  };
}

/**
 * Validate worker configuration
 */
export function validateWorkerConfig(config: WorkerEnvironment): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.MAX_WORKERS < 1 || config.MAX_WORKERS > 16) {
    errors.push('MAX_WORKERS must be between 1 and 16');
  }

  if (config.WORKER_MEMORY_LIMIT < 128 || config.WORKER_MEMORY_LIMIT > 2048) {
    errors.push('WORKER_MEMORY_LIMIT must be between 128MB and 2048MB');
  }

  if (config.WORKER_TIMEOUT < 30000 || config.WORKER_TIMEOUT > 1800000) {
    errors.push('WORKER_TIMEOUT must be between 30 seconds and 30 minutes');
  }

  if (!['debug', 'info', 'warn', 'error'].includes(config.LOG_LEVEL)) {
    errors.push('LOG_LEVEL must be one of: debug, info, warn, error');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get default worker configuration for development
 */
export function getDefaultWorkerConfig(): WorkerEnvironment {
  return {
    USE_WORKERS: true,
    MAX_WORKERS: 2,
    WORKER_MEMORY_LIMIT: 512,
    WORKER_TIMEOUT: 300000,
    ENABLE_METRICS: true,
    ENABLE_CHECKPOINTS: true,
    LOG_LEVEL: 'info'
  };
}

/**
 * Get production worker configuration
 */
export function getProductionWorkerConfig(): WorkerEnvironment {
  return {
    USE_WORKERS: true,
    MAX_WORKERS: 4,
    WORKER_MEMORY_LIMIT: 1024,
    WORKER_TIMEOUT: 600000, // 10 minutes
    ENABLE_METRICS: true,
    ENABLE_CHECKPOINTS: true,
    LOG_LEVEL: 'warn'
  };
}

/**
 * Performance thresholds for monitoring
 */
export const PERFORMANCE_THRESHOLDS = {
  MAIN_THREAD_RESPONSE_TIME: 100, // ms
  WORKER_MEMORY_LIMIT: 512, // MB
  ERROR_RATE_THRESHOLD: 5, // percentage
  WORKER_UTILIZATION_TARGET: 80, // percentage
  TASK_TIMEOUT_WARNING: 240000, // 4 minutes
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  METRICS_UPDATE_INTERVAL: 5000 // 5 seconds
} as const;

/**
 * Worker pool limits and constraints
 */
export const WORKER_LIMITS = {
  MAX_CONCURRENT_TASKS: 10,
  MAX_QUEUE_SIZE: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
  CLEANUP_INTERVAL: 60000, // 1 minute
  HEARTBEAT_INTERVAL: 10000 // 10 seconds
} as const;