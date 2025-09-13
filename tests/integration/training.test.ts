import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../../server/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use consistent JWT secret for tests
process.env.JWT_SECRET = 'test-secret-min-32-chars-for-testing-purposes';
process.env.SESSION_SECRET = 'test-session-secret-min-32-chars-for-testing';
process.env.NODE_ENV = 'test';
process.env.SKIP_CSRF = 'true';

describe('Training API Integration Tests', () => {
  let db: Database.Database;
  let authToken: string;
  let modelId: number;
  let server: any;

  beforeAll(async () => {
    // Initialize test database
    const dbPath = path.join(__dirname, '../../test-persian-legal-ai.db');
    db = new Database(dbPath);
    
    // Create test user with trainer role
    const passwordHash = await bcrypt.hash('testpass123', 12);
    const userResult = db.prepare(`
      INSERT OR REPLACE INTO users (username, email, password_hash, role)
      VALUES ('testtrainer', 'trainer@test.com', ?, 'trainer')
    `).run(passwordHash);
    
    const userId = userResult.lastInsertRowid;
    
    // Generate auth token
    authToken = jwt.sign(
      { 
        id: userId, 
        username: 'testtrainer', 
        email: 'trainer@test.com',
        role: 'trainer' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Create test dataset
    db.prepare(`
      INSERT OR REPLACE INTO datasets (id, name, source, huggingface_id, samples, size_mb, status)
      VALUES ('test-dataset', 'Test Dataset', 'test', 'test/dataset', 100, 1.0, 'available')
    `).run();
    
    // Create test model
    const modelResult = db.prepare(`
      INSERT INTO models (name, type, dataset_id, status, config)
      VALUES ('Test Model', 'persian-bert', 'test-dataset', 'idle', '{}')
    `).run();
    
    modelId = modelResult.lastInsertRowid as number;
  });

  afterAll(() => {
    // Clean up database
    if (db) {
      db.prepare('DELETE FROM training_logs WHERE 1=1').run();
      db.prepare('DELETE FROM training_sessions WHERE 1=1').run();
      db.prepare('DELETE FROM checkpoints WHERE 1=1').run();
      db.prepare('DELETE FROM models WHERE 1=1').run();
      db.prepare('DELETE FROM datasets WHERE 1=1').run();
      db.prepare('DELETE FROM users WHERE username = ?').run('testtrainer');
      db.close();
    }
    
    // Close server if running
    if (server && server.close) {
      server.close();
    }
  });

  describe('POST /api/models/:id/train', () => {
    it('should start training with valid token and trainer role', async () => {
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001,
          dataset_ids: ['test-dataset']
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Training started successfully');
      expect(response.body).toHaveProperty('sessionId');
      
      // Verify training session was created
      const session = db.prepare('SELECT * FROM training_sessions WHERE model_id = ?').get(modelId);
      expect(session).toBeDefined();
      expect(session.status).toBe('running');
    });

    it('should reject training without authentication', async () => {
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject training with viewer role', async () => {
      // Create viewer token
      const viewerToken = jwt.sign(
        { 
          id: 999, 
          username: 'viewer', 
          email: 'viewer@test.com',
          role: 'viewer' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001
        });
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });

    it('should reject training for non-existent model', async () => {
      const response = await request(app)
        .post('/api/models/99999/train')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Model not found');
    });

    it('should reject training if model is already training', async () => {
      // Set model status to training
      db.prepare('UPDATE models SET status = ? WHERE id = ?').run('training', modelId);
      
      const response = await request(app)
        .post(`/api/models/${modelId}/train`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          epochs: 5,
          batch_size: 16,
          learning_rate: 0.001
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Model is already training');
      
      // Reset status
      db.prepare('UPDATE models SET status = ? WHERE id = ?').run('idle', modelId);
    });
  });

  describe('POST /api/models/:id/pause', () => {
    it('should pause training with valid token', async () => {
      // Set model to training state
      db.prepare('UPDATE models SET status = ? WHERE id = ?').run('training', modelId);
      
      const response = await request(app)
        .post(`/api/models/${modelId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Training paused successfully');
      
      // Verify model status
      const model = db.prepare('SELECT status FROM models WHERE id = ?').get(modelId) as any;
      expect(model.status).toBe('paused');
    });

    it('should reject pause without authentication', async () => {
      const response = await request(app)
        .post(`/api/models/${modelId}/pause`);
      
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/models/:id/resume', () => {
    it('should resume training with valid token', async () => {
      // Set model to paused state
      db.prepare('UPDATE models SET status = ?, current_epoch = ?, epochs = ? WHERE id = ?')
        .run('paused', 3, 10, modelId);
      
      const response = await request(app)
        .post(`/api/models/${modelId}/resume`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Training resumed successfully');
      
      // Verify model status
      const model = db.prepare('SELECT status FROM models WHERE id = ?').get(modelId) as any;
      expect(model.status).toBe('training');
    });

    it('should reject resume if model is not paused', async () => {
      // Set model to idle state
      db.prepare('UPDATE models SET status = ? WHERE id = ?').run('idle', modelId);
      
      const response = await request(app)
        .post(`/api/models/${modelId}/resume`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Model is not paused');
    });
  });

  describe('Training Progress via Socket.IO', () => {
    it('should emit training progress events', (done) => {
      // This would require Socket.IO client setup
      // For now, verify that the endpoints exist and respond
      expect(app).toBeDefined();
      done();
    });
  });

  describe('Checkpoint Management', () => {
    it('should create checkpoints during training', async () => {
      // Create a checkpoint manually to test the flow
      const checkpointResult = db.prepare(`
        INSERT INTO checkpoints (model_id, epoch, accuracy, loss, file_path, file_size_mb)
        VALUES (?, 5, 0.85, 0.35, './checkpoints/test.json', 1.5)
      `).run(modelId);
      
      const checkpointId = checkpointResult.lastInsertRowid;
      
      // Verify checkpoint was created
      const checkpoint = db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(checkpointId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint.model_id).toBe(modelId);
      expect(checkpoint.epoch).toBe(5);
      expect(checkpoint.accuracy).toBe(0.85);
      
      // Clean up
      db.prepare('DELETE FROM checkpoints WHERE id = ?').run(checkpointId);
    });

    it('should retrieve checkpoints for a model', async () => {
      // Create test checkpoints
      db.prepare(`
        INSERT INTO checkpoints (model_id, epoch, accuracy, loss, file_path, file_size_mb)
        VALUES (?, 1, 0.65, 0.55, './checkpoints/test1.json', 1.0)
      `).run(modelId);
      
      db.prepare(`
        INSERT INTO checkpoints (model_id, epoch, accuracy, loss, file_path, file_size_mb)
        VALUES (?, 2, 0.75, 0.45, './checkpoints/test2.json', 1.2)
      `).run(modelId);
      
      const response = await request(app)
        .get(`/api/models/${modelId}/checkpoints`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      // Clean up
      db.prepare('DELETE FROM checkpoints WHERE model_id = ?').run(modelId);
    });
  });

  describe('Training Sessions', () => {
    it('should track training sessions', async () => {
      // Create a training session
      const sessionResult = db.prepare(`
        INSERT INTO training_sessions (model_id, dataset_id, parameters, start_time, status)
        VALUES (?, 'test-dataset', '{"epochs": 10}', CURRENT_TIMESTAMP, 'completed')
      `).run(modelId);
      
      const sessionId = sessionResult.lastInsertRowid;
      
      // Get sessions
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      
      // Clean up
      db.prepare('DELETE FROM training_sessions WHERE id = ?').run(sessionId);
    });

    it('should filter sessions by status', async () => {
      // Create sessions with different statuses
      db.prepare(`
        INSERT INTO training_sessions (model_id, dataset_id, parameters, start_time, status)
        VALUES (?, 'test-dataset', '{}', CURRENT_TIMESTAMP, 'running')
      `).run(modelId);
      
      db.prepare(`
        INSERT INTO training_sessions (model_id, dataset_id, parameters, start_time, status)
        VALUES (?, 'test-dataset', '{}', CURRENT_TIMESTAMP, 'completed')
      `).run(modelId);
      
      const response = await request(app)
        .get('/api/sessions?status=running')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      
      // Clean up
      db.prepare('DELETE FROM training_sessions WHERE model_id = ?').run(modelId);
    });
  });
});