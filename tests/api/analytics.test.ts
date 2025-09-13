import request from 'supertest';
import express from 'express';
import { beforeAll, beforeEach, describe, it, expect } from '@jest/globals';
import { testDb, createTestUser, generateTestToken } from '../setup';
import { requireAuth, requireRole } from '../../server/middleware/auth';

describe('Analytics API', () => {
  let app: express.Application;
  let viewerToken: string;
  let trainerToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Add auth middleware
    app.use('/api/analytics', (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
          next();
        } catch (error) {
          res.status(403).json({ error: 'Invalid token' });
        }
      } else {
        res.status(401).json({ error: 'Authorization required' });
      }
    });

    // Add analytics routes
    app.get('/api/analytics', (req, res) => {
      try {
        const modelStats = testDb.prepare(`
          SELECT 
            type,
            COUNT(*) as count,
            AVG(accuracy) as avg_accuracy,
            MAX(accuracy) as max_accuracy
          FROM models 
          GROUP BY type
        `).all();
        
        const trainingStats = testDb.prepare(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as models_created
          FROM models 
          WHERE created_at >= date('now', '-30 days')
          GROUP BY DATE(created_at)
          ORDER BY date
        `).all();
        
        const recentActivity = testDb.prepare(`
          SELECT level, COUNT(*) as count
          FROM system_logs 
          WHERE timestamp >= datetime('now', '-24 hours')
          GROUP BY level
        `).all();
        
        res.json({
          modelStats,
          trainingStats,
          recentActivity,
          summary: {
            totalModels: (testDb.prepare('SELECT COUNT(*) as count FROM models').get() as { count: number }).count,
            activeTraining: (testDb.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'training'").get() as { count: number }).count,
            completedModels: (testDb.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'completed'").get() as { count: number }).count,
            totalDatasets: (testDb.prepare('SELECT COUNT(*) as count FROM datasets').get() as { count: number }).count
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
      }
    });

    app.get('/api/analytics/advanced', requireAuth, requireRole('viewer'), (req, res) => {
      try {
        // Get model performance metrics
        const modelPerformance = testDb.prepare(`
          SELECT 
            m.id as modelId,
            m.name as modelName,
            m.type as modelType,
            m.accuracy,
            m.loss,
            m.epochs,
            m.current_epoch,
            m.created_at,
            m.updated_at,
            d.name as datasetName
          FROM models m
          LEFT JOIN datasets d ON m.dataset_id = d.id
          WHERE m.created_at >= date('now', '-30 days')
          ORDER BY m.updated_at DESC
        `).all();
        
        // Calculate enhanced performance metrics
        const enhancedPerformance = modelPerformance.map((model: any) => {
          const accuracy = model.accuracy;
          const epochs = model.epochs;
          
          const precision = Math.min(0.99, accuracy * 0.95 + (accuracy > 0.8 ? 0.05 : 0.02));
          const recall = Math.min(0.99, accuracy * 0.92 + (accuracy > 0.8 ? 0.08 : 0.03));
          const f1Score = 2 * (precision * recall) / (precision + recall);
          
          return {
            ...model,
            precision,
            recall,
            f1Score,
            trainingTime: epochs * 1800,
            inferenceTime: 50,
            memoryUsage: 512 + (epochs * 50),
            convergenceRate: Math.min(1, accuracy / 0.8),
            stability: Math.min(0.99, 0.7 + (accuracy * 0.3))
          };
        });
        
        res.json({
          modelPerformance: enhancedPerformance,
          trainingAnalytics: {
            totalSessions: modelPerformance.length,
            successfulSessions: modelPerformance.filter((m: any) => m.accuracy > 0.7).length,
            failedSessions: modelPerformance.filter((m: any) => m.accuracy <= 0.7).length,
            averageTrainingTime: 7200,
            bestAccuracy: Math.max(...modelPerformance.map((m: any) => m.accuracy), 0),
            totalTrainingHours: modelPerformance.reduce((sum: number, m: any) => sum + (m.epochs * 0.5), 0),
            modelsByType: modelPerformance.reduce((acc: any, model: any) => {
              acc[model.modelType] = (acc[model.modelType] || 0) + 1;
              return acc;
            }, {}),
            successRate: modelPerformance.length > 0 ? (modelPerformance.filter((m: any) => m.accuracy > 0.7).length / modelPerformance.length) * 100 : 0,
            averageEpochs: 10,
            totalModels: modelPerformance.length,
            activeTraining: 0
          },
          systemAnalytics: {
            cpuUsage: 25,
            memoryUsage: 60,
            gpuUsage: 0,
            diskUsage: 45,
            networkThroughput: 100,
            activeConnections: 0,
            errorRate: 0.02,
            uptime: 3600,
            throughput: 50,
            latency: 25,
            queueSize: 0
          },
          recommendations: [],
          alerts: []
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch advanced analytics' });
      }
    });
  });

  beforeEach(async () => {
    // Create test users and tokens
    const viewer = await createTestUser('viewer');
    const trainer = await createTestUser('trainer');
    
    viewerToken = generateTestToken(viewer);
    trainerToken = generateTestToken(trainer);
  });

  describe('GET /api/analytics', () => {
    it('should return basic analytics', async () => {
      const response = await request(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('modelStats');
      expect(response.body).toHaveProperty('trainingStats');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('summary');
      
      expect(response.body.summary).toHaveProperty('totalModels');
      expect(response.body.summary).toHaveProperty('activeTraining');
      expect(response.body.summary).toHaveProperty('completedModels');
      expect(response.body.summary).toHaveProperty('totalDatasets');
    });
  });

  describe('GET /api/analytics/advanced', () => {
    it('should return advanced analytics for viewer', async () => {
      const response = await request(app)
        .get('/api/analytics/advanced')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('modelPerformance');
      expect(response.body).toHaveProperty('trainingAnalytics');
      expect(response.body).toHaveProperty('systemAnalytics');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('alerts');
      
      expect(Array.isArray(response.body.modelPerformance)).toBe(true);
      expect(response.body.trainingAnalytics).toHaveProperty('totalSessions');
      expect(response.body.trainingAnalytics).toHaveProperty('successRate');
    });

    it('should allow access for trainer', async () => {
      const response = await request(app)
        .get('/api/analytics/advanced')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('modelPerformance');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/advanced');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization required');
    });
  });
});