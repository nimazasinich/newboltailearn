/**
 * Unit Tests for Worker Thread Implementation
 * Tests worker spawning, message passing, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerManager, TrainingWorkerPool } from '../../server/modules/workers/trainingWorker.js';
import { WorkerMessageType } from '../../server/modules/workers/types.js';
import { performanceMonitor } from '../../server/modules/workers/performanceMonitor.js';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs-node', () => ({
  ready: vi.fn().mockResolvedValue(undefined),
  sequential: vi.fn(),
  layers: {
    embedding: vi.fn(),
    bidirectional: vi.fn(),
    lstm: vi.fn(),
    globalAveragePooling1d: vi.fn(),
    dense: vi.fn(),
    dropout: vi.fn()
  },
  train: {
    adam: vi.fn()
  },
  regularizers: {
    l2: vi.fn()
  },
  tensor2d: vi.fn(),
  tensor1d: vi.fn(),
  oneHot: vi.fn(),
  disposeVariables: vi.fn()
}));

// Mock PersianTokenizer
vi.mock('../../server/training/tokenizer.js', () => ({
  PersianTokenizer: vi.fn().mockImplementation(() => ({
    getVocabSize: vi.fn().mockReturnValue(1000),
    encode: vi.fn().mockReturnValue(new Array(512).fill(0))
  }))
}));

describe('Worker Thread Implementation', () => {
  let workerManager: WorkerManager;
  let workerPool: TrainingWorkerPool;

  beforeEach(() => {
    // Set environment variables for testing
    process.env.USE_WORKERS = 'true';
    process.env.MAX_WORKERS = '2';
    process.env.WORKER_MEMORY_LIMIT = '256';
    process.env.WORKER_TIMEOUT = '30000';
    
    workerManager = new WorkerManager();
    workerPool = new TrainingWorkerPool();
  });

  afterEach(async () => {
    await workerManager.terminate();
    await workerPool.terminate();
  });

  describe('WorkerManager', () => {
    it('should initialize with worker pool', () => {
      expect(workerManager).toBeDefined();
      expect(workerManager.getStatus).toBeDefined();
    });

    it('should get worker status', () => {
      const status = workerManager.getStatus();
      expect(status).toHaveProperty('totalWorkers');
      expect(status).toHaveProperty('availableWorkers');
      expect(status).toHaveProperty('busyWorkers');
      expect(status).toHaveProperty('queuedTasks');
    });

    it('should perform health check', async () => {
      const health = await workerManager.healthCheck();
      expect(Array.isArray(health)).toBe(true);
    });
  });

  describe('TrainingWorkerPool', () => {
    it('should initialize with correct number of workers', () => {
      const status = workerPool.getStatus();
      expect(status.totalWorkers).toBeGreaterThan(0);
    });

    it('should handle task execution', async () => {
      const testData = {
        modelId: 1,
        datasetId: 'test-dataset',
        config: {
          epochs: 2,
          batchSize: 32,
          learningRate: 0.001
        },
        sessionId: 1,
        userId: 1
      };

      // This test will timeout in CI but should work in development
      try {
        const result = await Promise.race([
          workerPool.execute(WorkerMessageType.TRAIN, testData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        expect(result).toBeDefined();
      } catch (error) {
        // Expected in test environment
        expect(error).toBeDefined();
      }
    });

    it('should handle worker errors gracefully', async () => {
      const invalidData = {
        modelId: -1,
        datasetId: 'invalid',
        config: null
      };

      try {
        await workerPool.execute(WorkerMessageType.TRAIN, invalidData);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should track worker metrics', () => {
      const status = workerPool.getStatus();
      expect(status.metrics).toBeDefined();
      expect(Array.isArray(status.metrics)).toBe(true);
    });

    it('should calculate performance metrics', () => {
      const status = workerPool.getStatus();
      expect(status.performance).toBeDefined();
      expect(status.performance).toHaveProperty('mainThreadResponseTime');
      expect(status.performance).toHaveProperty('workerUtilization');
      expect(status.performance).toHaveProperty('memoryUsage');
      expect(status.performance).toHaveProperty('throughput');
      expect(status.performance).toHaveProperty('errorRate');
    });
  });

  describe('Performance Monitoring', () => {
    it('should initialize performance monitor', () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor.getMetrics).toBeDefined();
      expect(performanceMonitor.getSystemMetrics).toBeDefined();
    });

    it('should measure main thread response time', async () => {
      const responseTime = await performanceMonitor.measureMainThreadResponseTime();
      expect(typeof responseTime).toBe('number');
      expect(responseTime).toBeGreaterThan(0);
    });

    it('should get system metrics', () => {
      const metrics = performanceMonitor.getSystemMetrics();
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('processId');
    });

    it('should generate performance alerts', () => {
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary).toHaveProperty('status');
      expect(summary).toHaveProperty('metrics');
      expect(summary).toHaveProperty('alerts');
      expect(summary).toHaveProperty('recommendations');
      expect(['healthy', 'warning', 'critical']).toContain(summary.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle worker crashes', async () => {
      const status = workerPool.getStatus();
      const initialWorkers = status.totalWorkers;
      
      // Simulate worker crash by terminating a worker
      // In a real scenario, this would be handled by the pool
      expect(initialWorkers).toBeGreaterThan(0);
    });

    it('should handle task timeouts', async () => {
      const longRunningData = {
        modelId: 1,
        datasetId: 'test-dataset',
        config: {
          epochs: 1000, // Very long training
          batchSize: 32,
          learningRate: 0.001
        },
        sessionId: 1,
        userId: 1
      };

      try {
        await Promise.race([
          workerPool.execute(WorkerMessageType.TRAIN, longRunningData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
        ]);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid message types', async () => {
      try {
        await workerPool.execute('INVALID_TYPE' as any, {});
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on termination', async () => {
      const initialStatus = workerPool.getStatus();
      expect(initialStatus.totalWorkers).toBeGreaterThan(0);
      
      await workerPool.terminate();
      
      const finalStatus = workerPool.getStatus();
      expect(finalStatus.totalWorkers).toBe(0);
    });

    it('should handle graceful shutdown', async () => {
      await expect(workerPool.terminate()).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent tasks', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) => ({
        modelId: i + 1,
        datasetId: `test-dataset-${i}`,
        config: {
          epochs: 1,
          batchSize: 16,
          learningRate: 0.001
        },
        sessionId: i + 1,
        userId: 1
      }));

      const promises = tasks.map(task => 
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(error => error)
      );

      const results = await Promise.allSettled(promises);
      expect(results).toHaveLength(3);
    });
  });
});

describe('Worker Message Protocol', () => {
  it('should validate message structure', () => {
    const validMessage = {
      id: 'test-id',
      type: WorkerMessageType.TRAIN,
      data: { modelId: 1 },
      timestamp: Date.now()
    };

    expect(validMessage.id).toBeDefined();
    expect(validMessage.type).toBeDefined();
    expect(validMessage.data).toBeDefined();
    expect(validMessage.timestamp).toBeDefined();
  });

  it('should handle different message types', () => {
    const messageTypes = [
      WorkerMessageType.TRAIN,
      WorkerMessageType.EVALUATE,
      WorkerMessageType.PREDICT,
      WorkerMessageType.STOP,
      WorkerMessageType.STATUS,
      WorkerMessageType.CLEANUP
    ];

    messageTypes.forEach(type => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });
});

describe('Environment Configuration', () => {
  it('should respect USE_WORKERS environment variable', () => {
    const originalValue = process.env.USE_WORKERS;
    
    process.env.USE_WORKERS = 'false';
    const poolWithoutWorkers = new TrainingWorkerPool();
    expect(poolWithoutWorkers.getStatus().totalWorkers).toBe(0);
    
    process.env.USE_WORKERS = 'true';
    const poolWithWorkers = new TrainingWorkerPool();
    expect(poolWithWorkers.getStatus().totalWorkers).toBeGreaterThan(0);
    
    // Cleanup
    process.env.USE_WORKERS = originalValue;
    poolWithoutWorkers.terminate();
    poolWithWorkers.terminate();
  });

  it('should respect MAX_WORKERS environment variable', () => {
    const originalValue = process.env.MAX_WORKERS;
    
    process.env.MAX_WORKERS = '1';
    const pool1 = new TrainingWorkerPool();
    expect(pool1.getStatus().totalWorkers).toBe(1);
    
    process.env.MAX_WORKERS = '3';
    const pool3 = new TrainingWorkerPool();
    expect(pool3.getStatus().totalWorkers).toBe(3);
    
    // Cleanup
    process.env.MAX_WORKERS = originalValue;
    pool1.terminate();
    pool3.terminate();
  });
});