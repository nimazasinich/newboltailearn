import request from 'supertest';
import express from 'express';
import { beforeAll, beforeEach, describe, it, expect } from '@jest/globals';
import { testDb, createTestUser, generateTestToken } from '../setup';
import { requireAuth, requireRole } from '../../server/middleware/auth';

describe('Models API', () => {
  let app: express.Application;
  let trainerToken: string;
  let viewerToken: string;
  let modelId: number;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Add auth middleware
    app.use('/api/models', (req, res, next) => {
      // Mock authentication for testing
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

    // Add models routes
    app.get('/api/models', (req, res) => {
      try {
        const models = testDb.prepare('SELECT * FROM models ORDER BY created_at DESC').all();
        res.json(models);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch models' });
      }
    });

    app.post('/api/models', (req, res) => {
      try {
        const { name, type, dataset_id, config } = req.body;
        
        if (!name || !type || !dataset_id) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const stmt = testDb.prepare(`
          INSERT INTO models (name, type, dataset_id, config)
          VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(name, type, dataset_id, JSON.stringify(config || {}));
        
        res.json({ 
          id: result.lastInsertRowid, 
          message: 'Model created successfully',
          model: { id: result.lastInsertRowid, name, type, dataset_id, status: 'idle' }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create model' });
      }
    });

    app.post('/api/models/:id/train', requireAuth, requireRole('trainer'), (req, res) => {
      try {
        const { id } = req.params;
        const { epochs = 10, batch_size = 32, learning_rate = 0.001 } = req.body;
        
        const model = testDb.prepare('SELECT * FROM models WHERE id = ?').get(id) as any;
        if (!model) {
          return res.status(404).json({ error: 'Model not found' });
        }
        
        if (model.status === 'training') {
          return res.status(400).json({ error: 'Model is already training' });
        }
        
        // Update model status to training
        testDb.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('training', id);
        
        res.json({ message: 'Training started successfully', sessionId: 1 });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start training' });
      }
    });

    app.put('/api/models/:id', (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        
        const fields = Object.keys(updates).filter(key => 
          ['name', 'status', 'accuracy', 'loss', 'current_epoch', 'config'].includes(key)
        );
        
        if (fields.length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => 
          field === 'config' ? JSON.stringify(updates[field]) : updates[field]
        );
        
        const stmt = testDb.prepare(`
          UPDATE models 
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        stmt.run(...values, id);
        
        res.json({ message: 'Model updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update model' });
      }
    });

    app.delete('/api/models/:id', (req, res) => {
      try {
        const { id } = req.params;
        
        const result = testDb.prepare('DELETE FROM models WHERE id = ?').run(id);
        
        if (result.changes === 0) {
          return res.status(404).json({ error: 'Model not found' });
        }
        
        res.json({ message: 'Model deleted successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete model' });
      }
    });
  });

  beforeEach(async () => {
    // Create test users and tokens
    const trainer = await createTestUser('trainer');
    const viewer = await createTestUser('viewer');

    trainerToken = generateTestToken(trainer);
    viewerToken = generateTestToken(viewer);

    // Capture ID of a model inserted by test setup
    const firstModel = testDb.prepare('SELECT id FROM models ORDER BY id LIMIT 1').get() as { id: number };
    modelId = firstModel.id;
  });

  describe('GET /api/models', () => {
    it('should return all models', async () => {
      const response = await request(app)
        .get('/api/models')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/models', () => {
    it('should create a new model', async () => {
      const response = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: 'Test Model',
          type: 'persian-bert',
          dataset_id: 'test-dataset-1',
          config: { batch_size: 32 }
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Model created successfully');
      expect(response.body.model).toBeDefined();
      expect(response.body.model.name).toBe('Test Model');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: 'Test Model'
          // Missing type and dataset_id
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
  });

  describe('POST /api/models/:id/train', () => {
    it('should start training for trainer', async () => {
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Training started successfully');
    });

    it('should reject training for viewer', async () => {
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          epochs: 5
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should reject training for non-existent model', async () => {
      const response = await request(app)
        .post('/api/models/999/train')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          epochs: 5
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Model not found');
    });
  });

  describe('PUT /api/models/:id', () => {
    it('should update model', async () => {
      const response = await request(app)
        .put(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: 'Updated Model Name',
          accuracy: 0.95
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Model updated successfully');
    });
  });

  describe('DELETE /api/models/:id', () => {
    it('should delete model', async () => {
      const response = await request(app)
        .delete(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Model deleted successfully');
    });

    it('should return 404 for non-existent model', async () => {
      const response = await request(app)
        .delete(`/api/models/${modelId + 999}`)
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Model not found');
    });
  });
});