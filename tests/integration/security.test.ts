import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { setupModules } from '../../server/modules/setup';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket } from 'socket.io-client';

describe('Security Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let db: Database.Database;
  let io: Server;
  let authToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    // Setup test database
    db = new Database(':memory:');
    
    // Create tables
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );
      
      CREATE TABLE models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        accuracy REAL DEFAULT 0,
        loss REAL DEFAULT 0,
        epochs INTEGER DEFAULT 0,
        current_epoch INTEGER DEFAULT 0,
        dataset_id TEXT,
        config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        huggingface_id TEXT,
        samples INTEGER DEFAULT 0,
        size_mb REAL DEFAULT 0,
        status TEXT DEFAULT 'available',
        local_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT,
        category TEXT,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Create HTTP server and Socket.IO
    server = createServer(app);
    io = new Server(server);
    
    // Setup modules with security
    setupModules(app, db, io);
    
    // Start server
    await new Promise((resolve) => {
      server.listen(0, () => resolve(undefined));
    });
    
    // Register a test user and get token
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'trainer'
      });
    
    authToken = registerRes.body.token;
    
    // Get CSRF token
    const csrfRes = await request(app)
      .get('/api/csrf-token')
      .set('Authorization', `Bearer ${authToken}`);
    
    csrfToken = csrfRes.body.csrfToken;
  });

  afterAll(async () => {
    db.close();
    io.close();
    server.close();
  });

  describe('JWT Authentication', () => {
    it('should reject requests without token', async () => {
      const res = await request(app)
        .get('/api/models')
        .expect(401);
      
      expect(res.body.error).toContain('Authorization');
    });

    it('should accept requests with valid token', async () => {
      const res = await request(app)
        .get('/api/models')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(res.body).toBeDefined();
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/models')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
      
      expect(res.body.error).toContain('Invalid token');
    });
  });

  describe('CSRF Protection', () => {
    it('should reject POST without CSRF token', async () => {
      const res = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Model', type: 'dora' })
        .expect(403);
      
      expect(res.body.error).toContain('CSRF');
    });

    it('should accept POST with valid CSRF token', async () => {
      const res = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Test Model', type: 'dora' })
        .expect(201);
      
      expect(res.body.id).toBeDefined();
    });

    it('should not require CSRF for GET requests', async () => {
      const res = await request(app)
        .get('/api/models')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(res.body).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      // Make multiple login attempts
      const attempts = 10;
      const results = [];
      
      for (let i = 0; i < attempts; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'wrong', password: 'wrong' });
        
        results.push(res.status);
      }
      
      // Should have some 429 (rate limited) responses
      const rateLimited = results.filter(status => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should enforce different limits for different endpoints', async () => {
      // API endpoints should have higher limit than auth
      const apiAttempts = 50;
      let apiRateLimited = 0;
      
      for (let i = 0; i < apiAttempts; i++) {
        const res = await request(app)
          .get('/api/models')
          .set('Authorization', `Bearer ${authToken}`);
        
        if (res.status === 429) apiRateLimited++;
      }
      
      // API should allow more requests than auth
      expect(apiRateLimited).toBeLessThan(apiAttempts / 2);
    });
  });

  describe('Socket.IO Authentication', () => {
    it('should reject socket connection without token', async () => {
      const port = server.address().port;
      const socket = ioClient(`http://localhost:${port}`, {
        autoConnect: false
      });
      
      await new Promise((resolve, reject) => {
        socket.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication required');
          socket.close();
          resolve(undefined);
        });
        
        socket.on('connect', () => {
          reject(new Error('Should not connect without token'));
        });
        
        socket.connect();
      });
    });

    it('should accept socket connection with valid token', async () => {
      const port = server.address().port;
      const socket = ioClient(`http://localhost:${port}`, {
        auth: { token: authToken }
      });
      
      await new Promise((resolve, reject) => {
        socket.on('auth:success', (data) => {
          expect(data.username).toBe('testuser');
          socket.close();
          resolve(undefined);
        });
        
        socket.on('connect_error', (error) => {
          reject(error);
        });
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid input formats', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'a', // Too short
          email: 'not-an-email',
          password: '123' // Too weak
        })
        .expect(400);
      
      expect(res.body.error).toBeDefined();
      expect(res.body.details).toBeDefined();
    });

    it('should sanitize output to prevent XSS', async () => {
      // Try to inject script tag
      const maliciousName = '<script>alert("xss")</script>Test';
      
      const res = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: maliciousName, type: 'dora' });
      
      // Response should have sanitized name
      if (res.body.name) {
        expect(res.body.name).not.toContain('<script>');
      }
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role requirements', async () => {
      // Create a viewer user
      const viewerRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'viewer',
          email: 'viewer@example.com',
          password: 'ViewerPass123!',
          role: 'viewer'
        });
      
      const viewerToken = viewerRes.body.token;
      
      // Viewer should not be able to start training
      const res = await request(app)
        .post('/api/models/1/train')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ datasetId: 'test', config: { epochs: 10 } })
        .expect(403);
      
      expect(res.body.error).toContain('permissions');
    });

    it('should allow higher roles to access lower role endpoints', async () => {
      // Admin token (trainer role in our test)
      const res = await request(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(res.body).toBeDefined();
    });
  });
});

export default {};