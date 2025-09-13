import { Application } from 'express';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import { applySecurity, setupDevIdentification } from './security/index.js';
import { applyRouteProtection } from './security/routeProtection.js';
import { setupMetrics } from './monitoring/metrics.js';
import { configureSocketAuth } from './sockets/auth.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createModelsRoutes } from './routes/models.routes.js';
import { AuthController } from './controllers/auth.controller.js';
import { ModelsController } from './controllers/models.controller.js';
import { config } from './security/config.js';

/**
 * Setup all modular components
 * This function is called from server/index.ts to wire up all modules
 * without breaking the existing structure
 */
export function setupModules(app: Application, db: Database.Database, io: Server): void {
  console.log('🔧 Setting up modular components...');

  // 1. Apply security middleware
  applySecurity(app);
  console.log('✅ Security middleware applied');
  
  // 2. Apply route-specific protection (JWT, CSRF, rate limiting)
  applyRouteProtection(app);
  console.log('✅ Route protection enforced');

  // 3. Setup dev identification (non-production only)
  setupDevIdentification(app);
  if (config.NODE_ENV !== 'production' && config.DEV_ADMIN_USER) {
    console.log('✅ Dev identification endpoint enabled');
  }

  // 4. Setup metrics endpoint
  setupMetrics(app);
  if (config.ENABLE_METRICS) {
    console.log('✅ Metrics endpoint enabled at /metrics');
  }

  // 5. Configure Socket.IO authentication
  configureSocketAuth(io);
  console.log('✅ Socket.IO authentication configured');

  // 6. Setup modular routes
  setupModularRoutes(app, db);
  console.log('✅ Modular routes configured');
}

/**
 * Setup modular routes
 */
function setupModularRoutes(app: Application, db: Database.Database): void {
  // Create controllers
  const authController = new AuthController(db);
  const modelsController = new ModelsController(db);

  // Mount routes
  app.use('/api/auth', createAuthRoutes(authController));
  app.use('/api/models', createModelsRoutes(modelsController));
  
  // Note: We're not removing existing routes from server/index.ts
  // to maintain backward compatibility. The new routes will coexist
  // with the old ones, and we can gradually migrate functionality.
}

/**
 * Export configuration for use in server/index.ts
 */
export { config } from './security/config.js';
export { metricsCollector } from './monitoring/metrics.js';