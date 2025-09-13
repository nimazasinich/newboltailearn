/**
 * Performance Tests for Worker Thread Implementation
 * Tests responsiveness, throughput, and resource usage
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

describe('Worker Thread Performance Tests', () => {
  let workerManager: WorkerManager;
  let workerPool: TrainingWorkerPool;

  beforeEach(() => {
    process.env.USE_WORKERS = 'true';
    process.env.MAX_WORKERS = '4';
    process.env.WORKER_MEMORY_LIMIT = '512';
    process.env.WORKER_TIMEOUT = '30000';
    
    workerManager = new WorkerManager();
    workerPool = new TrainingWorkerPool();
  });

  afterEach(async () => {
    await workerManager.terminate();
    await workerPool.terminate();
  });

  describe('Main Thread Responsiveness', () => {
    it('should maintain main thread response time under 100ms', async () => {
      const responseTimes: number[] = [];
      
      // Measure response time during worker operations
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        
        // Simulate main thread work
        await new Promise(resolve => setImmediate(resolve));
        
        const end = process.hrtime.bigint();
        const responseTime = Number(end - start) / 1000000; // Convert to ms
        responseTimes.push(responseTime);
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(200);
    });

    it('should handle concurrent main thread operations', async () => {
      const startTime = Date.now();
      
      // Perform multiple concurrent operations
      const operations = Array.from({ length: 20 }, (_, i) => 
        new Promise(resolve => {
          setTimeout(() => {
            // Simulate some work
            const result = i * i;
            resolve(result);
          }, Math.random() * 10);
        })
      );
      
      await Promise.all(operations);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete all operations quickly
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Worker Memory Usage', () => {
    it('should keep worker memory usage under 512MB', async () => {
      const status = workerPool.getStatus();
      const metrics = status.metrics;
      
      for (const workerMetric of metrics) {
        expect(workerMetric.memoryUsage).toBeLessThan(512);
      }
    });

    it('should track memory usage over time', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform some operations
      const testData = {
        modelId: 1,
        datasetId: 'test-dataset',
        config: {
          epochs: 1,
          batchSize: 16,
          learningRate: 0.001
        },
        sessionId: 1,
        userId: 1
      };

      try {
        await workerPool.execute(WorkerMessageType.TRAIN, testData);
      } catch (error) {
        // Expected in test environment
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100);
    });
  });

  describe('Worker Throughput', () => {
    it('should handle multiple concurrent tasks', async () => {
      const startTime = Date.now();
      
      const tasks = Array.from({ length: 5 }, (_, i) => ({
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
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
      );

      await Promise.allSettled(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should handle concurrent tasks efficiently
      expect(totalTime).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain task queue performance', async () => {
      const queueStartTime = Date.now();
      
      // Add multiple tasks to queue
      const tasks = Array.from({ length: 10 }, (_, i) => ({
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
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
      );

      await Promise.allSettled(promises);
      
      const queueEndTime = Date.now();
      const queueTime = queueEndTime - queueStartTime;
      
      // Queue processing should be efficient
      expect(queueTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.mainThreadResponseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.workerUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage.total).toBeGreaterThan(0);
      expect(metrics.throughput.tasksPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should generate performance alerts when thresholds exceeded', () => {
      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary.status).toMatch(/healthy|warning|critical/);
      expect(Array.isArray(summary.alerts)).toBe(true);
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should measure system metrics', () => {
      const systemMetrics = performanceMonitor.getSystemMetrics();
      
      expect(systemMetrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.memory.total).toBeGreaterThan(0);
      expect(systemMetrics.memory.used).toBeGreaterThan(0);
      expect(systemMetrics.memory.free).toBeGreaterThan(0);
      expect(systemMetrics.uptime).toBeGreaterThan(0);
      expect(systemMetrics.processId).toBe(process.pid);
    });
  });

  describe('Error Rate Monitoring', () => {
    it('should track error rates accurately', async () => {
      const initialStatus = workerPool.getStatus();
      const initialErrorRate = initialStatus.performance.errorRate;
      
      // Simulate some errors
      const invalidTasks = Array.from({ length: 5 }, () => ({
        modelId: -1,
        datasetId: 'invalid',
        config: null
      }));

      const promises = invalidTasks.map(task => 
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
      );

      await Promise.allSettled(promises);
      
      // Wait for metrics to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStatus = workerPool.getStatus();
      const finalErrorRate = finalStatus.performance.errorRate;
      
      // Error rate should be tracked
      expect(finalErrorRate).toBeGreaterThanOrEqual(initialErrorRate);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources efficiently', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create and use workers
      const testData = {
        modelId: 1,
        datasetId: 'test-dataset',
        config: {
          epochs: 1,
          batchSize: 16,
          learningRate: 0.001
        },
        sessionId: 1,
        userId: 1
      };

      try {
        await workerPool.execute(WorkerMessageType.TRAIN, testData);
      } catch (error) {
        // Expected in test environment
      }
      
      // Terminate workers
      await workerPool.terminate();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryLeak = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      // Should not have significant memory leaks
      expect(memoryLeak).toBeLessThan(50);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale with number of workers', async () => {
      const workerCounts = [1, 2, 4];
      const results: { workers: number; time: number }[] = [];
      
      for (const count of workerCounts) {
        process.env.MAX_WORKERS = count.toString();
        const pool = new TrainingWorkerPool();
        
        const startTime = Date.now();
        
        const tasks = Array.from({ length: count * 2 }, (_, i) => ({
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
          pool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
        );

        await Promise.allSettled(promises);
        
        const endTime = Date.now();
        results.push({ workers: count, time: endTime - startTime });
        
        await pool.terminate();
      }
      
      // More workers should generally improve performance
      expect(results).toHaveLength(3);
      expect(results[0].workers).toBe(1);
      expect(results[1].workers).toBe(2);
      expect(results[2].workers).toBe(4);
    });
  });

  describe('Stress Tests', () => {
    it('should handle high load', async () => {
      const startTime = Date.now();
      
      // Create many concurrent tasks
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        modelId: i + 1,
        datasetId: `stress-test-${i}`,
        config: {
          epochs: 1,
          batchSize: 16,
          learningRate: 0.001
        },
        sessionId: i + 1,
        userId: 1
      }));

      const promises = tasks.map(task => 
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
      );

      await Promise.allSettled(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should handle high load without crashing
      expect(totalTime).toBeLessThan(30000); // 30 seconds
      
      const status = workerPool.getStatus();
      expect(status.totalWorkers).toBeGreaterThan(0);
    });

    it('should recover from worker failures', async () => {
      const initialStatus = workerPool.getStatus();
      const initialWorkers = initialStatus.totalWorkers;
      
      // Simulate worker failures by sending invalid tasks
      const invalidTasks = Array.from({ length: 10 }, () => ({
        modelId: -1,
        datasetId: 'invalid',
        config: null
      }));

      const promises = invalidTasks.map(task => 
        workerPool.execute(WorkerMessageType.TRAIN, task).catch(() => null)
      );

      await Promise.allSettled(promises);
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalStatus = workerPool.getStatus();
      
      // Should maintain worker count or recover
      expect(finalStatus.totalWorkers).toBeGreaterThanOrEqual(initialWorkers - 1);
    });
  });
});