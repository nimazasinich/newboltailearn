import { Application } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { csrfProtection } from './csrf.js';
import { apiRateLimiter, trainingRateLimiter, downloadRateLimiter } from './rateLimiter.js';

/**
 * Apply security middleware to all routes
 * This ensures JWT, CSRF, and rate limiting are properly enforced
 */
export function applyRouteProtection(app: Application): void {
  // Models endpoints - require authentication
  app.use('/api/models', requireAuth);
  app.use('/api/models', apiRateLimiter);
  
  // State-changing model operations need CSRF
  app.use('/api/models', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return csrfProtection(req, res, next);
    }
    next();
  });

  // Training operations need trainer role
  app.use('/api/models/:id/train', requireRole('trainer'));
  app.use('/api/models/:id/train', trainingRateLimiter);
  app.use('/api/models/:id/pause', requireRole('trainer'));
  app.use('/api/models/:id/resume', requireRole('trainer'));
  app.use('/api/models/:id/optimize', requireRole('trainer'));
  app.use('/api/models/:id/export', requireRole('trainer'));
  
  // Datasets endpoints - require authentication
  app.use('/api/datasets', requireAuth);
  app.use('/api/datasets', apiRateLimiter);
  app.use('/api/datasets/:id/download', downloadRateLimiter);
  
  // Analytics endpoints - require authentication
  app.use('/api/analytics', requireAuth);
  app.use('/api/analytics', apiRateLimiter);
  
  // Apply CSRF to all state-changing operations
  app.use('/api/*', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && 
        !req.path.includes('/auth/login') && 
        !req.path.includes('/auth/register')) {
      return csrfProtection(req, res, next);
    }
    next();
  });
}