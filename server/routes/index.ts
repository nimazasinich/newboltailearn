import { Router } from 'express';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import { createAuthRoutes } from './auth.routes.js';
import { createModelsRoutes } from './models.routes.js';
import { createDatasetsRoutes } from './datasets.routes.js';
import { createAnalyticsRoutes } from './analytics.routes.js';
import { createMonitoringRoutes } from './monitoring.routes.js';
import { createExportRoutes } from './export.routes.js';
import { AuthController } from '../modules/controllers/auth.controller.js';
import { ModelsController } from '../modules/controllers/models.controller.js';
import { DatasetsController } from '../modules/controllers/datasets.controller.js';
import { AnalyticsController } from '../modules/controllers/analytics.controller.js';
import { MonitoringController } from '../modules/controllers/monitoring.controller.js';
import { ExportController } from '../modules/controllers/export.controller.js';

/**
 * Main API Router
 * Mounts all API routes under /api prefix
 */
export default function createApiRouter(io: Server, db: Database.Database): Router {
  const router = Router();

  // Initialize controllers
  const authController = new AuthController(db);
  const modelsController = new ModelsController(db, io);
  const datasetsController = new DatasetsController(db);
  const analyticsController = new AnalyticsController(db);
  const monitoringController = new MonitoringController(db);
  const exportController = new ExportController(db, io);

  // Mount individual route modules
  router.use('/auth', createAuthRoutes(authController));
  router.use('/models', createModelsRoutes(modelsController, io));
  router.use('/datasets', createDatasetsRoutes(datasetsController, io));
  router.use('/analytics', createAnalyticsRoutes(analyticsController));
  router.use('/monitoring', createMonitoringRoutes(monitoringController));
  router.use('/export', createExportRoutes(exportController, io));

  // Training sessions endpoints
  router.get('/training/sessions', (req, res) => {
    try {
      const sessions = db.prepare(`
        SELECT 
          ts.*, m.name as model_name, m.type as model_type
        FROM training_sessions ts
        LEFT JOIN models m ON ts.model_id = m.id
        ORDER BY ts.start_time DESC
      `).all();
      res.json(sessions);
    } catch (error) {
      console.error('Get training sessions error:', error);
      res.status(500).json({ error: 'Failed to get training sessions' });
    }
  });

  router.get('/training/sessions/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = db.prepare(`
        SELECT 
          ts.*, m.name as model_name, m.type as model_type
        FROM training_sessions ts
        LEFT JOIN models m ON ts.model_id = m.id
        WHERE ts.session_id = ?
      `).get(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Training session not found' });
        return;
      }
      
      res.json(session);
    } catch (error) {
      console.error('Get training session error:', error);
      res.status(500).json({ error: 'Failed to get training session' });
    }
  });

  router.get('/training/stats', (req, res) => {
    try {
      const stats = {
        totalModels: db.prepare('SELECT COUNT(*) as count FROM models').get()?.count || 0,
        activeTraining: db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'training'").get()?.count || 0,
        completedTraining: db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'completed'").get()?.count || 0,
        averageAccuracy: db.prepare('SELECT AVG(accuracy) as avg FROM models WHERE accuracy > 0').get()?.avg || 0,
        totalTrainingHours: db.prepare(`
          SELECT COALESCE(SUM(
            CASE 
              WHEN end_time IS NOT NULL THEN 
                (julianday(end_time) - julianday(start_time)) * 24
              ELSE 
                (julianday('now') - julianday(start_time)) * 24
            END
          ), 0) as hours 
          FROM training_sessions
        `).get()?.hours || 0
      };
      res.json(stats);
    } catch (error) {
      console.error('Get training stats error:', error);
      res.status(500).json({ 
        error: 'Failed to get training stats',
        fallback: {
          totalModels: 0,
          activeTraining: 0,
          completedTraining: 0,
          averageAccuracy: 0,
          totalTrainingHours: 0
        }
      });
    }
  });

  // Health check endpoint (moved from index.ts)
  router.get('/health', (_req, res) => {
    res.json({ status: 'healthy', message: 'API is up and running' });
  });

  return router;
}