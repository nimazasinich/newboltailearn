/**
 * Performance Monitoring Service for Worker Threads
 * Monitors main thread responsiveness, worker utilization, and system metrics
 */

import { EventEmitter } from 'events';
import { 
  PerformanceMetrics, 
  WorkerMetrics, 
  WorkerStatus,
  PERFORMANCE_THRESHOLDS 
} from './types.js';

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  metrics: any;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
  };
  uptime: number;
  processId: number;
}

/**
 * Performance Monitor for Worker Threads
 */
export class WorkerPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private workerMetrics: Map<string, WorkerMetrics> = new Map();
  private systemMetrics: SystemMetrics;
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private lastMainThreadCheck = 0;
  private mainThreadResponseTimes: number[] = [];

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = PERFORMANCE_THRESHOLDS.METRICS_UPDATE_INTERVAL): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
    }, intervalMs);

    console.log('Worker performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('Worker performance monitoring stopped');
  }

  /**
   * Update worker metrics
   */
  updateWorkerMetrics(workerId: string, metrics: WorkerMetrics): void {
    this.workerMetrics.set(workerId, metrics);
  }

  /**
   * Remove worker metrics
   */
  removeWorkerMetrics(workerId: string): void {
    this.workerMetrics.delete(workerId);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge: number = 3600000): void { // 1 hour
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Measure main thread response time
   */
  measureMainThreadResponseTime(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      
      // Use setImmediate to measure event loop responsiveness
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const responseTime = Number(end - start) / 1000000; // Convert to milliseconds
        this.mainThreadResponseTimes.push(responseTime);
        
        // Keep only last 100 measurements
        if (this.mainThreadResponseTimes.length > 100) {
          this.mainThreadResponseTimes.shift();
        }
        
        resolve(responseTime);
      });
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      mainThreadResponseTime: 0,
      workerUtilization: 0,
      memoryUsage: {
        total: 0,
        workers: 0,
        main: 0
      },
      throughput: {
        tasksPerSecond: 0,
        averageTaskTime: 0
      },
      errorRate: 0
    };
  }

  /**
   * Initialize system metrics
   */
  private initializeSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    
    return {
      cpu: {
        usage: 0,
        loadAverage: []
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      uptime: process.uptime(),
      processId: process.pid
    };
  }

  /**
   * Update all metrics
   */
  private async updateMetrics(): Promise<void> {
    // Update system metrics
    this.updateSystemMetrics();
    
    // Measure main thread response time
    const responseTime = await this.measureMainThreadResponseTime();
    this.metrics.mainThreadResponseTime = responseTime;
    
    // Update worker metrics
    this.updateWorkerMetrics();
    
    // Calculate derived metrics
    this.calculateDerivedMetrics();
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    this.systemMetrics = {
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
        loadAverage: require('os').loadavg()
      },
      memory: {
        total: require('os').totalmem(),
        used: require('os').totalmem() - require('os').freemem(),
        free: require('os').freemem(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      uptime: process.uptime(),
      processId: process.pid
    };
  }

  /**
   * Update worker-related metrics
   */
  private updateWorkerMetrics(): void {
    let totalWorkerMemory = 0;
    let activeWorkers = 0;
    let totalTasks = 0;
    let failedTasks = 0;
    let totalUptime = 0;

    for (const metrics of this.workerMetrics.values()) {
      totalWorkerMemory += metrics.memoryUsage;
      if (metrics.uptime > 0) {
        activeWorkers++;
      }
      totalTasks += metrics.tasksCompleted + metrics.tasksFailed;
      failedTasks += metrics.tasksFailed;
      totalUptime += metrics.uptime;
    }

    this.metrics.workerUtilization = this.workerMetrics.size > 0 
      ? (activeWorkers / this.workerMetrics.size) * 100 
      : 0;

    this.metrics.memoryUsage = {
      total: this.systemMetrics.memory.heapUsed / 1024 / 1024, // MB
      workers: totalWorkerMemory,
      main: (this.systemMetrics.memory.heapUsed / 1024 / 1024) - totalWorkerMemory
    };

    this.metrics.errorRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;
  }

  /**
   * Calculate derived metrics
   */
  private calculateDerivedMetrics(): void {
    // Calculate average main thread response time
    if (this.mainThreadResponseTimes.length > 0) {
      const avgResponseTime = this.mainThreadResponseTimes.reduce((a, b) => a + b, 0) / this.mainThreadResponseTimes.length;
      this.metrics.mainThreadResponseTime = avgResponseTime;
    }

    // Calculate throughput metrics
    let totalTasks = 0;
    let totalTime = 0;

    for (const metrics of this.workerMetrics.values()) {
      totalTasks += metrics.tasksCompleted;
      totalTime += metrics.uptime;
    }

    this.metrics.throughput = {
      tasksPerSecond: totalTime > 0 ? totalTasks / (totalTime / 1000) : 0,
      averageTaskTime: totalTasks > 0 ? totalTime / totalTasks : 0
    };
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(): void {
    // Check main thread response time
    if (this.metrics.mainThreadResponseTime > PERFORMANCE_THRESHOLDS.MAIN_THREAD_RESPONSE_TIME) {
      this.addAlert('warning', 
        `Main thread response time ${this.metrics.mainThreadResponseTime.toFixed(2)}ms exceeds threshold ${PERFORMANCE_THRESHOLDS.MAIN_THREAD_RESPONSE_TIME}ms`,
        this.metrics
      );
    }

    // Check worker memory usage
    for (const [workerId, metrics] of this.workerMetrics) {
      if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.WORKER_MEMORY_LIMIT) {
        this.addAlert('error',
          `Worker ${workerId} memory usage ${metrics.memoryUsage.toFixed(2)}MB exceeds limit ${PERFORMANCE_THRESHOLDS.WORKER_MEMORY_LIMIT}MB`,
          metrics
        );
      }
    }

    // Check error rate
    if (this.metrics.errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD) {
      this.addAlert('critical',
        `Error rate ${this.metrics.errorRate.toFixed(2)}% exceeds threshold ${PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD}%`,
        this.metrics
      );
    }

    // Check worker utilization
    if (this.metrics.workerUtilization < 20 && this.workerMetrics.size > 0) {
      this.addAlert('warning',
        `Low worker utilization ${this.metrics.workerUtilization.toFixed(2)}%`,
        this.metrics
      );
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(type: 'warning' | 'error' | 'critical', message: string, metrics: any): void {
    const alert: PerformanceAlert = {
      type,
      message,
      timestamp: Date.now(),
      metrics
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const criticalAlerts = this.alerts.filter(a => a.type === 'critical');
    const warningAlerts = this.alerts.filter(a => a.type === 'warning');
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    const recommendations: string[] = [];
    
    if (this.metrics.mainThreadResponseTime > PERFORMANCE_THRESHOLDS.MAIN_THREAD_RESPONSE_TIME) {
      recommendations.push('Consider reducing worker count or optimizing main thread operations');
    }
    
    if (this.metrics.errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD) {
      recommendations.push('Investigate and fix worker errors to improve reliability');
    }
    
    if (this.metrics.workerUtilization < 20) {
      recommendations.push('Consider reducing worker pool size for better resource utilization');
    }

    return {
      status,
      metrics: this.metrics,
      alerts: this.alerts,
      recommendations
    };
  }
}

// Export singleton instance
export const performanceMonitor = new WorkerPerformanceMonitor();