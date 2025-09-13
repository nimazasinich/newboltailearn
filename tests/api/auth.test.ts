import request from 'supertest';
import express from 'express';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from '@jest/globals';
import { testDb, createTestUser, generateTestToken } from '../setup';
import { AuthService } from '../../server/services/authService';

describe('Authentication API', () => {
  let app: express.Application;
  let authService: AuthService;
  let existingUser: { username: string; email: string };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Initialize auth service with test database
    authService = new AuthService(testDb);
    
    // Add auth routes
    app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await authService.authenticate({ username, password });
        
        if (!result) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
          message: 'Login successful',
          user: result.user,
          token: result.token
        });
      } catch (error) {
        res.status(500).json({ error: 'Login failed' });
      }
    });

    app.post('/api/auth/register', async (req, res) => {
      try {
        const { username, email, password, role } = req.body;
        
        if (!username || !email || !password) {
          return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        const result = await authService.register({ username, email, password, role });
        
        if (!result) {
          return res.status(400).json({ error: 'Registration failed. User may already exist.' });
        }

        res.status(201).json({
          message: 'Registration successful',
          user: result.user,
          token: result.token
        });
      } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
      }
    });
  });

  beforeEach(async () => {
    // Create a test user for login and duplicate tests
    existingUser = await createTestUser('viewer');
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: existingUser.username,
          password: 'testpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe(existingUser.username);
      expect(response.body.user.role).toBe('viewer');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should require username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'newpassword',
          role: 'trainer'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.user.role).toBe('trainer');
    });

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: existingUser.username, // Already exists
          email: 'different@example.com',
          password: 'password'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Registration failed. User may already exist.');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username, email, and password are required');
    });
  });
});