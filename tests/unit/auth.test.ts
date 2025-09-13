import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { AuthController } from '../../server/modules/controllers/auth.controller';
import { AuthService } from '../../server/services/authService';
import bcrypt from 'bcryptjs';

describe('AuthController', () => {
  let db: Database.Database;
  let authController: AuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Set environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    
    // Create in-memory database
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
      )
    `);

    authController = new AuthController(db);

    // Setup mock request and response
    mockReq = {
      body: {},
      user: undefined,
      headers: {}
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    db.close();
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('testpass123', 10);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `).run('testuser', 'test@example.com', hashedPassword, 'viewer');

      mockReq.body = {
        username: 'testuser',
        password: 'testpass123'
      };

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          user: expect.objectContaining({
            username: 'testuser',
            email: 'test@example.com',
            role: 'viewer'
          })
        })
      );
    });

    it('should reject invalid credentials', async () => {
      mockReq.body = {
        username: 'nonexistent',
        password: 'wrongpass'
      };

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should handle login errors gracefully', async () => {
      // Close database to cause error
      db.close();

      mockReq.body = {
        username: 'testuser',
        password: 'testpass'
      };

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Login failed' });
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      mockReq.body = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'NewPass123!',
        role: 'viewer'
      };

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          user: expect.objectContaining({
            username: 'newuser',
            email: 'new@example.com',
            role: 'viewer'
          })
        })
      );

      // Verify user was created in database
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('newuser');
      expect(user).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      // Create existing user
      const hashedPassword = await bcrypt.hash('existingpass', 10);
      db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `).run('existinguser', 'existing@example.com', hashedPassword);

      mockReq.body = {
        username: 'existinguser',
        email: 'different@example.com',
        password: 'NewPass123!'
      };

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Username already exists' });
    });

    it('should reject duplicate email', async () => {
      // Create existing user
      const hashedPassword = await bcrypt.hash('existingpass', 10);
      db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `).run('existinguser', 'existing@example.com', hashedPassword);

      mockReq.body = {
        username: 'differentuser',
        email: 'existing@example.com',
        password: 'NewPass123!'
      };

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Email already registered' });
    });
  });

  describe('getProfile', () => {
    it('should get user profile when authenticated', async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('testpass', 10);
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `).run('testuser', 'test@example.com', hashedPassword, 'admin');

      mockReq.user = {
        id: Number(result.lastInsertRowid),
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };

      await authController.getProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
          role: 'admin'
        })
      );
    });

    it('should reject unauthenticated requests', async () => {
      mockReq.user = undefined;

      await authController.getProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not authenticated' });
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      // Create test user
      const currentPassword = 'currentpass123';
      const hashedPassword = await bcrypt.hash(currentPassword, 10);
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `).run('testuser', 'test@example.com', hashedPassword);

      mockReq.user = {
        id: Number(result.lastInsertRowid),
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer'
      };

      mockReq.body = {
        currentPassword,
        newPassword: 'NewSecurePass123!'
      };

      await authController.changePassword(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });

      // Verify password was changed
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(result.lastInsertRowid) as { password_hash: string };
      
      const isNewPasswordValid = await bcrypt.compare('NewSecurePass123!', user.password_hash);
      expect(isNewPasswordValid).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('correctpass', 10);
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `).run('testuser', 'test@example.com', hashedPassword);

      mockReq.user = {
        id: Number(result.lastInsertRowid),
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer'
      };

      mockReq.body = {
        currentPassword: 'wrongpass',
        newPassword: 'NewPass123!'
      };

      await authController.changePassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
    });
  });
});