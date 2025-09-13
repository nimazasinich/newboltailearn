import { Application, Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import { config } from '../security/config.js';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

const trainingSessionsTotal = new promClient.Counter({
  name: 'training_sessions_total',
  help: 'Total number of training sessions started',
  labelNames: ['model_type']
});

const trainingSessionsActive = new promClient.Gauge({
  name: 'training_sessions_active',
  help: 'Number of currently active training sessions'
});

const modelAccuracy = new promClient.Gauge({
  name: 'model_accuracy',
  help: 'Current model accuracy',
  labelNames: ['model_id', 'model_type']
});

const modelLoss = new promClient.Gauge({
  name: 'model_loss',
  help: 'Current model loss',
  labelNames: ['model_id', 'model_type']
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const authenticationAttempts = new promClient.Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'method']
});

const errorRate = new promClient.Counter({
  name: 'application_errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'severity']
});

// Register all custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(trainingSessionsTotal);
register.registerMetric(trainingSessionsActive);
register.registerMetric(modelAccuracy);
register.registerMetric(modelLoss);
register.registerMetric(databaseQueryDuration);
register.registerMetric(authenticationAttempts);
register.registerMetric(errorRate);

/**
 * Middleware to collect HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Normalize route path
    const route = req.route?.path || req.path.replace(/\/\d+/g, '/:id');
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const labels = {
        method: req.method,
        route: route,
        status_code: res.statusCode.toString()
      };
      
      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);
    });
    
    next();
  };
}

/**
 * Setup metrics endpoint
 */
export function setupRealMetrics(app: Application): void {
  if (!config.ENABLE_METRICS) {
    return;
  }
  
  // Add metrics middleware
  app.use(metricsMiddleware());
  
  // Metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      res.status(500).end(error);
    }
  });
  
  console.log('✅ Real Prometheus metrics enabled at /metrics');
}

/**
 * Update WebSocket connections metric
 */
export function updateWebSocketConnections(count: number): void {
  activeConnections.set(count);
}

/**
 * Record training session start
 */
export function recordTrainingStart(modelType: string): void {
  trainingSessionsTotal.inc({ model_type: modelType });
  trainingSessionsActive.inc();
}

/**
 * Record training session end
 */
export function recordTrainingEnd(): void {
  trainingSessionsActive.dec();
}

/**
 * Update model metrics
 */
export function updateModelMetrics(modelId: string, modelType: string, accuracy: number, loss: number): void {
  modelAccuracy.set({ model_id: modelId, model_type: modelType }, accuracy);
  modelLoss.set({ model_id: modelId, model_type: modelType }, loss);
}

/**
 * Record database query
 */
export function recordDatabaseQuery(operation: string, table: string, duration: number): void {
  databaseQueryDuration.observe({ operation, table }, duration / 1000);
}

/**
 * Record authentication attempt
 */
export function recordAuthAttempt(status: 'success' | 'failure', method: 'login' | 'register' | 'token'): void {
  authenticationAttempts.inc({ status, method });
}

/**
 * Record application error
 */
export function recordError(type: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
  errorRate.inc({ type, severity });
}

// Export metrics for testing
export { register as metricsRegistry };