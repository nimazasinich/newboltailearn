import { Router } from 'express';
import { Server } from 'socket.io';
import { ExportController } from '../modules/controllers/export.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, schemas } from '../modules/security/validators.js';
import { apiRateLimiter } from '../modules/security/rateLimiter.js';

export function createExportRoutes(controller: ExportController, io: Server): Router {
  const router = Router();

  // Apply common middleware
  router.use(requireAuth);
  router.use(apiRateLimiter);

  // Export project
  router.post('/project', requireRole('admin'), controller.exportProject.bind(controller));
  
  // Export model
  router.post('/models/:id', requireRole('trainer'), controller.exportModel.bind(controller));
  
  // Get export status
  router.get('/:exportId/status', controller.getExportStatus.bind(controller));
  
  // Download export
  router.get('/:exportId/download', controller.downloadExport.bind(controller));
  
  // Get project structure
  router.get('/structure', controller.getProjectStructure.bind(controller));
  
  // Generate ZIP
  router.post('/generate-zip', controller.generateProjectZip.bind(controller));
  
  // Export logs
  router.get('/logs', controller.exportLogs.bind(controller));
  
  // Export dataset
  router.get('/datasets/:id', controller.exportDataset.bind(controller));

  return router;
}