import request from 'supertest';
import express from 'express';
import { beforeAll, beforeEach, describe, it, expect } from '@jest/globals';
import { testDb, createTestUser, generateTestToken } from '../setup';
import { requireAuth, requireRole } from '../../server/middleware/auth';

describe('Datasets API', () => {
  let app: express.Application;
  let trainerToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Add auth middleware
    app.use('/api/datasets', (req, res, next) => {
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

    // Add datasets routes
    app.get('/api/datasets', (req, res) => {
      try {
        const datasets = testDb.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all();
        res.json(datasets);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch datasets' });
      }
    });

    app.post('/api/datasets/:id/download', requireAuth, requireRole('trainer'), (req, res) => {
      try {
        const { id } = req.params;
        const dataset = testDb.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as any;
        
        if (!dataset) {
          return res.status(404).json({ error: 'Dataset not found' });
        }
        
        // Update status to downloading
        testDb.prepare('UPDATE datasets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('downloading', id);
        
        res.json({ message: 'Dataset download started' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to download dataset' });
      }
    });
  });

  beforeEach(async () => {
    // Create test users and tokens
    const trainer = await createTestUser('trainer');
    const viewer = await createTestUser('viewer');
    
    trainerToken = generateTestToken(trainer);
    viewerToken = generateTestToken(viewer);
  });

  describe('GET /api/datasets', () => {
    it('should return all datasets', async () => {
      const response = await request(app)
        .get('/api/datasets')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check dataset structure
      const dataset = response.body[0];
      expect(dataset).toHaveProperty('id');
      expect(dataset).toHaveProperty('name');
      expect(dataset).toHaveProperty('source');
      expect(dataset).toHaveProperty('status');
    });
  });

  describe('POST /api/datasets/:id/download', () => {
    it('should start download for trainer', async () => {
      const response = await request(app)
        .post('/api/datasets/test-dataset-1/download')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Dataset download started');
      
      // Verify status was updated
      const dataset = testDb
        .prepare('SELECT status FROM datasets WHERE id = ?')
        .get('test-dataset-1') as { status: string };
      expect(dataset.status).toBe('downloading');
    });

    it('should reject download for viewer', async () => {
      const response = await request(app)
        .post('/api/datasets/test-dataset-1/download')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should return 404 for non-existent dataset', async () => {
      const response = await request(app)
        .post('/api/datasets/non-existent/download')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Dataset not found');
    });
  });
});